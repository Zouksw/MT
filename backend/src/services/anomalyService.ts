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
		// Only finite numeric points feed the statistics (round-106): the
		// old `Number(x) || 0` coerced objects/strings in the Json column to
		// 0, skewing mean/stdDev for every series containing non-numeric
		// points.
		const numericOf = (dp: { valueJson: Prisma.JsonValue }): number => {
			const n = Number(dp.valueJson);
			return Number.isFinite(n) ? n : Number.NaN;
		};
		const stats = dataPoints.map(numericOf).filter((v) => Number.isFinite(v)) as number[];
		const mean = stats.reduce((a, b) => a + b, 0) / stats.length;
		const variance = stats.reduce((a, b) => a + (b - mean) ** 2, 0) / stats.length;
		const stdDev = Math.sqrt(variance);
		const zThreshold = 3;

		for (let i = validatedData.windowSize; i < dataPoints.length; i++) {
			const value = numericOf(dataPoints[i]);
			if (!Number.isFinite(value)) continue; // non-numeric point — not analyzable
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
		const numericOf = (dp: { valueJson: Prisma.JsonValue }): number => {
			const n = Number(dp.valueJson);
			return Number.isFinite(n) ? n : Number.NaN;
		};

		for (let i = windowSize; i < dataPoints.length; i++) {
			const currentValue = numericOf(dataPoints[i]);
			if (!Number.isFinite(currentValue)) continue; // non-numeric — skip
			const windowValues = dataPoints
				.slice(i - windowSize, i)
				.map(numericOf)
				.filter(Number.isFinite) as number[];
			if (windowValues.length === 0) continue;
			const windowMean = windowValues.reduce((a, b) => a + b, 0) / windowValues.length;

			// A zero baseline made |value - 0| / 1 report |value| as a
			// "percent change" (e.g. value 2 → 200%), feeding false
			// CRITICAL anomalies. Percent change is undefined at zero —
			// skip the point (round-06).
			if (windowMean === 0) continue;
			const percentChange = Math.abs((currentValue - windowMean) / windowMean);

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

/** Update an anomaly (typically to resolve it).
 *
 * Ownership (round-106): the anomaly's timeseries must belong to a dataset
 * the caller owns (ADMIN bypasses). Previously ANY authenticated user could
 * resolve/edit any other user's anomaly — "missing" and "not owned" return
 * the same 404 so existence isn't disclosed cross-user.
 */
export async function updateAnomaly(
	id: string,
	data: z.infer<typeof updateAnomalySchema>,
	userId: string,
	role: string | undefined,
) {
	const existing = await prisma.anomaly.findUnique({
		where: { id },
		select: { id: true, timeseries: { select: { dataset: { select: { ownerId: true } } } } },
	});
	const ownerId = existing?.timeseries.dataset.ownerId;
	if (!existing || (ownerId !== userId && role !== "ADMIN")) {
		throw new NotFoundError("Anomaly");
	}

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

/** Delete an anomaly. Same ownership rule as updateAnomaly. */
export async function deleteAnomaly(
	id: string,
	userId: string,
	role: string | undefined,
): Promise<void> {
	const existing = await prisma.anomaly.findUnique({
		where: { id },
		select: { id: true, timeseries: { select: { dataset: { select: { ownerId: true } } } } },
	});
	const ownerId = existing?.timeseries.dataset.ownerId;
	if (!existing || (ownerId !== userId && role !== "ADMIN")) {
		throw new NotFoundError("Anomaly");
	}

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

/** Bulk-resolve anomalies matching the filter. Returns the count updated.
 *
 * Ownership (round-106): non-admins only ever touch anomalies on their own
 * datasets' timeseries. Previously the updateMany had no scope at all — an
 * empty body from any VIEWER resolved EVERY unresolved anomaly in the DB.
 */
export async function bulkResolveAnomalies(
	validatedData: z.infer<typeof bulkResolveSchema>,
	userId: string,
	role: string | undefined,
): Promise<number> {
	const where: Prisma.AnomalyWhereInput = { isResolved: false };
	if (role !== "ADMIN") {
		where.timeseries = { dataset: { ownerId: userId } };
	}
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
