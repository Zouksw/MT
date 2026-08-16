/**
 * Forecasting model management service.
 *
 * Pure functions for listing, fetching, updating, and deleting forecasting
 * models and their forecasts. Routes in `routes/models.ts` own the HTTP
 * boundary and the inference-service + socket.io coupling for train/predict;
 * this service owns the Prisma queries for the read/CRUD surface.
 */

import type { ModelAlgorithm, Prisma } from "@prisma/client";
import { prisma } from "@/lib";
import { BadRequestError, ForbiddenError, NotFoundError } from "@/middleware/errorHandler";

export interface ListModelsParams {
	timeseriesId?: string;
	isActive?: boolean;
	algorithm?: string;
	skip: number;
	take: number;
}

/** List forecasting models with optional filters + pagination. */
export async function listModels(params: ListModelsParams) {
	const where: Prisma.ForecastingModelWhereInput = {};
	if (params.timeseriesId) where.timeseriesId = params.timeseriesId;
	if (params.isActive !== undefined) where.isActive = params.isActive;
	if (params.algorithm) {
		// Use 'in' filter for enum values (requires array)
		where.algorithm = { in: [params.algorithm as ModelAlgorithm] };
	}

	const [models, total] = await Promise.all([
		prisma.forecastingModel.findMany({
			where,
			skip: params.skip,
			take: params.take,
			include: {
				timeseries: { select: { id: true, name: true, slug: true, unit: true } },
				trainedBy: { select: { id: true, name: true, email: true } },
				_count: { select: { forecasts: true } },
			},
			orderBy: { trainedAt: "desc" },
		}),
		prisma.forecastingModel.count({ where }),
	]);

	return { models, total };
}

/** Get a single model with timeseries, trainer, and recent forecasts. */
export async function getModel(id: string) {
	const model = await prisma.forecastingModel.findUnique({
		where: { id },
		include: {
			timeseries: {
				select: {
					id: true,
					name: true,
					slug: true,
					unit: true,
					dataset: { select: { id: true, name: true, slug: true } },
				},
			},
			trainedBy: { select: { id: true, name: true, email: true } },
			forecasts: { take: 10, orderBy: { timestamp: "desc" } },
			_count: { select: { forecasts: true } },
		},
	});
	if (!model) throw new NotFoundError("Model");
	return model;
}

/**
 * Persist a freshly-trained model record and deactivate prior active models
 * for the same timeseries. Used by the train route after the inference
 * service returns; the route keeps the socket.io emit.
 */
export async function createModelRecord(input: {
	timeseriesId: string;
	trainedById: string;
	algorithm: ModelAlgorithm;
	hyperparameters: Record<string, string | number | boolean>;
	trainingSamples: number;
}) {
	// Deactivate existing models for this timeseries
	await prisma.forecastingModel.updateMany({
		where: { timeseriesId: input.timeseriesId, isActive: true },
		data: { isActive: false },
	});

	return prisma.forecastingModel.create({
		data: {
			timeseriesId: input.timeseriesId,
			trainedById: input.trainedById,
			algorithm: input.algorithm,
			hyperparameters: input.hyperparameters,
			trainingMetrics: { trainingSamples: input.trainingSamples },
			version: 1,
			isActive: true,
			trainedAt: new Date(),
			deployedAt: new Date(),
		},
		include: {
			timeseries: { select: { id: true, name: true, slug: true, unit: true } },
			trainedBy: { select: { id: true, name: true, email: true } },
		},
	});
}

/** Batch-insert forecast records (used by the predict route). */
export async function createForecasts(forecasts: Prisma.ForecastCreateManyInput[]): Promise<void> {
	await prisma.forecast.createMany({ data: forecasts, skipDuplicates: true });
}

/** List forecasts for a model with optional time-range filter + limit. */
export async function listForecasts(
	modelId: string,
	range?: { start?: string; end?: string },
	limit = 100,
) {
	const where: Prisma.ForecastWhereInput = { modelId };
	if (range?.start || range?.end) {
		where.timestamp = {};
		if (range.start) where.timestamp.gte = new Date(range.start);
		if (range.end) where.timestamp.lte = new Date(range.end);
	}

	return prisma.forecast.findMany({
		where,
		take: limit,
		orderBy: { timestamp: "asc" },
	});
}

/**
 * Update a model's active status. When activating, deactivate other models
 * for the same timeseries so only one is active at a time. Only the trainer
 * or an admin may update — the deactivate-others sweep made this a
 * cross-user destructive operation before the ownership check existed.
 */
export async function setModelActive(
	id: string,
	isActive: boolean,
	userId: string,
	role: string | undefined,
) {
	const model = await prisma.forecastingModel.findUnique({
		where: { id },
		select: { id: true, timeseriesId: true, trainedById: true },
	});
	if (!model) throw new NotFoundError("Model");
	if (model.trainedById !== userId && role !== "ADMIN") {
		throw new ForbiddenError("You can only update models you created");
	}
	if (isActive) {
		await prisma.forecastingModel.updateMany({
			where: { timeseriesId: model.timeseriesId, id: { not: id } },
			data: { isActive: false },
		});
	}
	return prisma.forecastingModel.update({ where: { id }, data: { isActive } });
}

/**
 * Delete a model. Only the trainer or an admin may delete. Throws 404 if the
 * model doesn't exist, BadRequestError if the caller lacks permission.
 */
export async function deleteModel(
	modelId: string,
	userId: string,
	role: string | undefined,
): Promise<void> {
	const model = await prisma.forecastingModel.findUnique({
		where: { id: modelId },
		select: { trainedById: true },
	});
	if (!model) throw new NotFoundError("Model");
	if (model.trainedById !== userId && role !== "ADMIN") {
		throw new BadRequestError("You can only delete models you created");
	}
	await prisma.forecastingModel.delete({ where: { id: modelId } });
}

/** Delete forecasts for a model with optional time-range filter.
 *
 * Ownership (round-106): mirrors setModelActive/deleteModel — only the
 * trainer or an ADMIN may clear a model's forecasts. Previously any
 * authenticated user could wipe any other user's forecast rows.
 */
export async function deleteForecasts(
	modelId: string,
	range?: { start?: string; end?: string },
	userId?: string,
	role?: string,
): Promise<number> {
	const model = await prisma.forecastingModel.findUnique({
		where: { id: modelId },
		select: { trainedById: true },
	});
	if (!model) throw new NotFoundError("Model");
	if (userId !== undefined && model.trainedById !== userId && role !== "ADMIN") {
		throw new ForbiddenError("You can only delete forecasts of models you created");
	}

	const where: Prisma.ForecastWhereInput = { modelId };
	if (range?.start || range?.end) {
		where.timestamp = {};
		if (range.start) where.timestamp.gte = new Date(range.start);
		if (range.end) where.timestamp.lte = new Date(range.end);
	}
	const result = await prisma.forecast.deleteMany({ where });
	return result.count;
}
