/**
 * Anomaly detection & management service.
 *
 * Pure functions for listing, detecting, updating, and aggregating anomalies.
 * Routes in `routes/anomalies.ts` own the HTTP boundary (auth, response
 * shaping) and the socket.io emit on detection; this service owns the Prisma
 * queries and the detection algorithms (z-score / rule-based).
 */

import type { AnomalySeverity, DetectionMethod, Prisma } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "@/lib";
import { BadRequestError, NotFoundError } from "@/middleware/errorHandler";
import type {
	bulkResolveSchema,
	detectAnomaliesSchema,
	updateAnomalySchema,
} from "@/schemas/anomalies";

export interface DetectedAnomaly {
	timeseriesId: string;
	datapointId: string;
	severity: AnomalySeverity;
	detectionMethod: DetectionMethod;
	score: string;
	context: Prisma.InputJsonValue;
}

export interface DetectionMeta {
	timeseriesId: string;
	method: string;
	dataPointsAnalyzed: number;
	anomaliesDetected: number;
	anomaliesCreated: number;
}

/** List anomalies with optional filters + pagination. */
export async function listAnomalies(options: {
	timeseriesId?: string;
	severity?: AnomalySeverity;
	isResolved?: boolean;
	skip: number;
	take: number;
}) {
	const where: Prisma.AnomalyWhereInput = {};
	if (options.timeseriesId) where.timeseriesId = options.timeseriesId;
	if (options.severity) where.severity = options.severity;
	if (options.isResolved !== undefined) where.isResolved = options.isResolved;

	const [anomalies, total] = await Promise.all([
		prisma.anomaly.findMany({
			where,
			skip: options.skip,
			take: options.take,
			include: {
				timeseries: {
					select: { id: true, name: true, slug: true, unit: true },
				},
			},
			orderBy: { createdAt: "desc" },
		}),
		prisma.anomaly.count({ where }),
	]);

	return { anomalies, total };
}

/** Get a single anomaly with its timeseries + dataset. */
export async function getAnomaly(id: string) {
	const anomaly = await prisma.anomaly.findUnique({
		where: { id },
		include: {
			timeseries: {
				include: {
					dataset: { select: { id: true, name: true, slug: true } },
				},
			},
		},
	});
	if (!anomaly) throw new NotFoundError("Anomaly");
	return anomaly;
}

/**
 * Run anomaly detection on a timeseries. Performs the full pipeline: fetch
 * datapoints → run the requested algorithm → persist anomalies → update the
 * timeseries flag → create alerts for HIGH/CRITICAL. Returns the detected
 * anomalies and a meta summary; the caller (route) is responsible for any
 * socket.io emit so this stays free of Express/HTTP coupling.
 */
export async function detectAnomalies(
	validatedData: z.infer<typeof detectAnomaliesSchema>,
	userId: string,
): Promise<{ anomalies: DetectedAnomaly[]; meta: DetectionMeta }> {
	const timeseries = await prisma.timeseries.findUnique({
		where: { id: validatedData.timeseriesId },
	});
	if (!timeseries) throw new NotFoundError("Timeseries");

	const dataPoints = await prisma.datapoint.findMany({
		where: {
			timeseriesId: validatedData.timeseriesId,
			...(validatedData.start && {
				timestamp: { gte: new Date(validatedData.start) },
			}),
			...(validatedData.end && {
				timestamp: { lte: new Date(validatedData.end) },
			}),
		},
		orderBy: { timestamp: "asc" },
		take: 100000,
	});

	if (dataPoints.length < validatedData.windowSize) {
		throw new BadRequestError(
			`Not enough data points. Need at least ${validatedData.windowSize} points`,
		);
	}

	const detectedAnomalies = runDetection(validatedData, dataPoints);

	const created = await prisma.anomaly.createMany({
		data: detectedAnomalies,
		skipDuplicates: true,
	});

	await prisma.timeseries.update({
		where: { id: validatedData.timeseriesId },
		data: { isAnomalyDetectionEnabled: true },
	});

	// Create alerts for high/critical anomalies
	const highSeverityAnomalies = detectedAnomalies.filter(
		(a) => a.severity === "HIGH" || a.severity === "CRITICAL",
	);
	if (highSeverityAnomalies.length > 0) {
		await prisma.alert.createMany({
			data: highSeverityAnomalies.slice(0, 10).map((anomaly) => ({
				userId,
				timeseriesId: validatedData.timeseriesId,
				type: "ANOMALY",
				severity: anomaly.severity === "CRITICAL" ? "ERROR" : "WARNING",
				message: `${anomaly.severity} severity anomaly detected (${anomaly.score} anomaly score)`,
				metadata: {
					...anomaly,
					datapointId: anomaly.datapointId,
				},
			})),
		});
	}

	return {
		anomalies: detectedAnomalies.slice(0, 100),
		meta: {
			timeseriesId: validatedData.timeseriesId,
			method: validatedData.method,
			dataPointsAnalyzed: dataPoints.length,
			anomaliesDetected: detectedAnomalies.length,
			anomaliesCreated: created.count,
		},
	};
}

/** Run the requested detection algorithm over the data points. */
function runDetection(
	validatedData: z.infer<typeof detectAnomaliesSchema>,
	dataPoints: Array<{ id: string; valueJson: Prisma.JsonValue }>,
): DetectedAnomaly[] {
	const detected: DetectedAnomaly[] = [];

	if (validatedData.method === "STATISTICAL") {
		const values = dataPoints.map((dp) => Number(dp.valueJson) || 0);
		const mean = values.reduce((a, b) => a + b, 0) / values.length;
		const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
		const stdDev = Math.sqrt(variance);
		const zThreshold = 3;

		for (let i = validatedData.windowSize; i < dataPoints.length; i++) {
			const value = Number(dataPoints[i].valueJson) || 0;
			const zScore = Math.abs((value - mean) / stdDev);

			if (zScore > zThreshold) {
				const severity = zScoreSeverity(zScore);
				detected.push({
					timeseriesId: validatedData.timeseriesId,
					datapointId: dataPoints[i].id,
					severity,
					detectionMethod: "STATISTICAL",
					score: (zScore / 5).toFixed(2),
					context: {
						value,
						mean: mean.toFixed(2),
						stdDev: stdDev.toFixed(2),
						zScore: zScore.toFixed(2),
						windowSize: validatedData.windowSize,
					},
				});
			}
		}
	} else if (validatedData.method === "RULE_BASED") {
		const threshold = validatedData.threshold;
		const windowSize = validatedData.windowSize;

		for (let i = windowSize; i < dataPoints.length; i++) {
			const currentValue = Number(dataPoints[i].valueJson) || 0;
			const windowValues = dataPoints
				.slice(i - windowSize, i)
				.map((dp) => Number(dp.valueJson) || 0);
			const windowMean = windowValues.reduce((a, b) => a + b, 0) / windowSize;

			const percentChange = Math.abs((currentValue - windowMean) / (windowMean || 1));

			if (percentChange > 1 - threshold) {
				const severity = percentChangeSeverity(percentChange);
				detected.push({
					timeseriesId: validatedData.timeseriesId,
					datapointId: dataPoints[i].id,
					severity,
					detectionMethod: "RULE_BASED",
					score: Math.min(percentChange * 2, 1).toFixed(2),
					context: {
						currentValue,
						windowMean: windowMean.toFixed(2),
						percentChange: `${(percentChange * 100).toFixed(2)}%`,
					},
				});
			}
		}
	}

	return detected;
}

function zScoreSeverity(zScore: number): AnomalySeverity {
	if (zScore > 5) return "CRITICAL";
	if (zScore > 4) return "HIGH";
	if (zScore > 3) return "MEDIUM";
	return "LOW";
}

function percentChangeSeverity(percentChange: number): AnomalySeverity {
	if (percentChange > 0.5) return "CRITICAL";
	if (percentChange > 0.3) return "HIGH";
	return "MEDIUM";
}

/** Update an anomaly (typically to resolve it). */
export async function updateAnomaly(id: string, data: z.infer<typeof updateAnomalySchema>) {
	return prisma.anomaly.update({
		where: { id },
		data: {
			...data,
			...(data.isResolved && { resolvedAt: new Date() }),
		},
		include: {
			timeseries: { select: { id: true, name: true, slug: true } },
		},
	});
}

/** Delete an anomaly. */
export async function deleteAnomaly(id: string): Promise<void> {
	await prisma.anomaly.delete({ where: { id } });
}

/** Anomaly statistics for a timeseries (counts, severity breakdown, resolution rate). */
export async function getAnomalyStats(
	timeseriesId: string,
	range?: { start?: string; end?: string },
) {
	const where: Prisma.AnomalyWhereInput = { timeseriesId };
	if (range?.start || range?.end) {
		where.createdAt = {};
		if (range.start) where.createdAt.gte = new Date(range.start);
		if (range.end) where.createdAt.lte = new Date(range.end);
	}

	const [total, bySeverity, resolved, unresolved] = await Promise.all([
		prisma.anomaly.count({ where }),
		prisma.anomaly.groupBy({ by: ["severity"], where, _count: true }),
		prisma.anomaly.count({ where: { ...where, isResolved: true } }),
		prisma.anomaly.count({ where: { ...where, isResolved: false } }),
	]);

	const severityBreakdown = bySeverity.reduce(
		(acc: Record<string, number>, item) => {
			acc[item.severity] = item._count;
			return acc;
		},
		{} as Record<string, number>,
	);

	return {
		total,
		resolved,
		unresolved,
		resolutionRate: total > 0 ? `${((resolved / total) * 100).toFixed(1)}%` : "0%",
		severityBreakdown,
	};
}

/** Bulk-resolve anomalies matching the filter. Returns the count updated. */
export async function bulkResolveAnomalies(
	validatedData: z.infer<typeof bulkResolveSchema>,
): Promise<number> {
	const where: Prisma.AnomalyWhereInput = { isResolved: false };
	if (validatedData.timeseriesId) where.timeseriesId = validatedData.timeseriesId;
	if (validatedData.severity) where.severity = validatedData.severity as AnomalySeverity;
	if (validatedData.start || validatedData.end) {
		where.createdAt = {};
		if (validatedData.start) where.createdAt.gte = new Date(validatedData.start);
		if (validatedData.end) where.createdAt.lte = new Date(validatedData.end);
	}

	const result = await prisma.anomaly.updateMany({
		where,
		data: { isResolved: true, resolvedAt: new Date() },
	});
	return result.count;
}
