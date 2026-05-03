/**
 * Prediction Job Queue — BullMQ + Redis
 *
 * Scheduled predictions: every 30 min per commodity
 * Background correlation calculation
 * CSV export jobs
 *
 * Key prefix isolation: `bull:` vs `cache:`
 */

import { type Job, Queue, Worker } from "bullmq";
import { logger } from "@/lib";
import { getRedisClient } from "@/lib/redis";
import { computeCorrelationMatrix } from "./correlationAnalysis";
import { logPrediction } from "./mapeTracking";
import { runAndCachePrediction } from "./predictionCache";
import { getAllModels } from "./tradingSignals";

const QUEUE_NAME = "prediction-jobs";
const CORRELATION_QUEUE = "correlation-jobs";

let predictionQueue: Queue | null = null;
let correlationQueue: Queue | null = null;
let predictionWorker: Worker | null = null;
let correlationWorker: Worker | null = null;

interface PredictionJobData {
	commodityId: string;
	timeseriesPath: string;
	models: string[];
	horizon: number;
}

interface CorrelationJobData {
	commodityIds: string[];
	windowDays: number;
}

async function getRedisConnection() {
	return {
		host: process.env.REDIS_HOST || "localhost",
		port: parseInt(process.env.REDIS_PORT || "6379", 10),
		password: process.env.REDIS_PASSWORD || undefined,
	};
}

/**
 * Initialize prediction job queue and worker
 */
export async function initPredictionQueue(): Promise<void> {
	const connection = await getRedisConnection();

	predictionQueue = new Queue(QUEUE_NAME, { connection });
	correlationQueue = new Queue(CORRELATION_QUEUE, { connection });

	// Prediction worker
	predictionWorker = new Worker<PredictionJobData>(
		QUEUE_NAME,
		async (job: Job<PredictionJobData>) => {
			const { commodityId, timeseriesPath, models, horizon } = job.data;

			logger.info(
				`Processing prediction job for ${commodityId} (${models.length} models)`,
			);

			const results = await Promise.allSettled(
				models.map(async (modelId) => {
					try {
						const prediction = await runAndCachePrediction(
							commodityId,
							timeseriesPath,
							modelId,
							horizon,
						);

						// Log for MAPE tracking
						await logPrediction({
							modelId,
							commodityId,
							timeseriesPath,
							horizon,
							predictedValues: prediction.values,
							lowerBounds: prediction.lowerBound,
							upperBounds: prediction.upperBound,
						});

						return { modelId, status: "success" };
					} catch (error) {
						logger.error(`Prediction job failed for ${modelId}: ${error}`);
						return { modelId, status: "failed" };
					}
				}),
			);

			const succeeded = results.filter((r) => r.status === "fulfilled").length;
			logger.info(
				`Prediction job complete: ${succeeded}/${models.length} models succeeded`,
			);
		},
		{ connection, concurrency: 1 },
	);

	// Correlation worker
	correlationWorker = new Worker<CorrelationJobData>(
		CORRELATION_QUEUE,
		async (job: Job<CorrelationJobData>) => {
			const { commodityIds, windowDays } = job.data;
			logger.info(
				`Computing correlation matrix for ${commodityIds.length} commodities`,
			);

			const matrix = await computeCorrelationMatrix(commodityIds, windowDays);

			// Cache the matrix result
			const client = await getRedisClient();
			if (client) {
				await client.setEx(
					`correlation:matrix:${windowDays}`,
					3600,
					JSON.stringify(matrix),
				);
			}

			return matrix;
		},
		{ connection, concurrency: 1 },
	);

	logger.info("Prediction and correlation job queues initialized");
}

/**
 * Schedule a prediction refresh for a commodity
 */
export async function schedulePrediction(
	commodityId: string,
	timeseriesPath: string,
	horizon: number = 10,
): Promise<string | null> {
	if (!predictionQueue) return null;

	const models = getAllModels();
	const job = await predictionQueue.add(
		`predict-${commodityId}`,
		{ commodityId, timeseriesPath, models, horizon },
		{
			attempts: 2,
			backoff: { type: "exponential", delay: 5000 },
			removeOnComplete: 100,
			removeOnFail: 50,
		},
	);

	return job.id ?? null;
}

/**
 * Schedule a correlation matrix computation
 */
export async function scheduleCorrelation(
	commodityIds: string[],
	windowDays: number = 30,
): Promise<string | null> {
	if (!correlationQueue) return null;

	const job = await correlationQueue.add(
		`correlation-${windowDays}d`,
		{ commodityIds, windowDays },
		{
			attempts: 2,
			backoff: { type: "exponential", delay: 5000 },
			removeOnComplete: 50,
			removeOnFail: 20,
		},
	);

	return job.id ?? null;
}

/**
 * Schedule recurring prediction refreshes (every 30 minutes)
 */
export async function scheduleRecurringPredictions(
	commodityId: string,
	timeseriesPath: string,
	horizon: number = 10,
): Promise<void> {
	if (!predictionQueue) return;

	const models = getAllModels();
	await predictionQueue.add(
		`recurring-predict-${commodityId}`,
		{ commodityId, timeseriesPath, models, horizon },
		{
			repeat: { every: 30 * 60 * 1000 }, // every 30 minutes
			attempts: 2,
			backoff: { type: "exponential", delay: 5000 },
			removeOnComplete: 10,
		},
	);

	logger.info(
		`Scheduled recurring predictions for ${commodityId} (every 30 min)`,
	);
}

/**
 * Remove recurring prediction schedule
 */
export async function cancelRecurringPredictions(
	commodityId: string,
): Promise<void> {
	if (!predictionQueue) return;

	const jobs = await predictionQueue.getRepeatableJobs();
	for (const job of jobs) {
		if (job.key.includes(commodityId)) {
			await predictionQueue.removeRepeatableByKey(job.key);
		}
	}
}

/**
 * Graceful shutdown
 */
export async function shutdownQueues(): Promise<void> {
	await predictionWorker?.close();
	await correlationWorker?.close();
	await predictionQueue?.close();
	await correlationQueue?.close();
	predictionQueue = null;
	correlationQueue = null;
	predictionWorker = null;
	correlationWorker = null;
}
