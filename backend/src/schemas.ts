/**
 * Zod request-validation schemas (single module).
 *
 * Sections: common (pagination) · datasets · models · anomalies.
 * Merged from schemas/{common,datasets,models,anomalies}.ts — exports unchanged.
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Common — pagination with automatic string-to-number coercion
// (replaces manual parseInt() calls throughout routes)
// ---------------------------------------------------------------------------

/** Usage: paginationSchema.parse(req.query) */
export const paginationSchema = z.object({
	page: z.coerce.number().int().positive().optional().default(1),
	limit: z.coerce.number().int().positive().max(1000).optional().default(20),
});

/** For endpoints that just need a limit parameter */
export const limitSchema = z.object({
	limit: z.coerce.number().int().positive().max(10000).optional().default(1000),
});

/** Extract pagination as skip/take for Prisma queries */
export const getPagination = (query: unknown): { skip: number; take: number } => {
	const safeQuery = typeof query === "object" && query !== null ? query : {};
	const params = paginationSchema.parse(safeQuery);
	return {
		skip: (params.page - 1) * params.limit,
		take: params.limit,
	};
};

// ---------------------------------------------------------------------------
// Datasets
// ---------------------------------------------------------------------------

export const createDatasetSchema = z.object({
	name: z.string().min(1).max(255),
	slug: z
		.string()
		.min(1)
		.max(100)
		.regex(/^[a-z0-9-]+$/),
	description: z.string().optional(),
	storageFormat: z.enum(["TIMESERIES", "INFLUXDB", "OPENML", "CSV"]),
	filePath: z.string().optional(),
	isPublic: z.boolean().default(false),
});

export const updateDatasetSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	description: z.string().optional(),
	isPublic: z.boolean().optional(),
	isImported: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// ML models
// ---------------------------------------------------------------------------

export const modelsQuerySchema = paginationSchema.extend({
	timeseriesId: z.string().uuid().optional(),
	isActive: z
		.enum(["true", "false"])
		.transform((val) => val === "true")
		.optional(),
	algorithm: z.enum(["ARIMA", "PROPHET", "LSTM", "TRANSFORMER", "ENSEMBLE"]).optional(),
});

export const trainModelSchema = z.object({
	timeseriesId: z.string().uuid(),
	algorithm: z.enum(["ARIMA", "PROPHET", "LSTM", "TRANSFORMER", "ENSEMBLE"]),
	hyperparameters: z.record(z.unknown()).optional(),
	trainingStart: z.string().datetime().optional(),
	trainingEnd: z.string().datetime().optional(),
});

export const predictSchema = z.object({
	horizon: z.coerce.number().min(1).max(100).default(100), // cap matches /api/inference (was 10000 — 10k Forecast rows per call, round-106)
	confidenceLevel: z.coerce.number().min(0).max(1).default(0.95),
});

// ---------------------------------------------------------------------------
// Anomaly detection
// ---------------------------------------------------------------------------

export const anomaliesQuerySchema = paginationSchema.extend({
	timeseriesId: z.string().uuid().optional(),
	severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
	isResolved: z
		.enum(["true", "false"])
		.transform((val) => val === "true")
		.optional(),
});

export const detectAnomaliesSchema = z.object({
	timeseriesId: z.string().uuid(),
	method: z.enum(["STATISTICAL", "RULE_BASED"]).default("STATISTICAL"),
	start: z.string().datetime().optional(),
	end: z.string().datetime().optional(),
	threshold: z.coerce.number().min(0).max(1).default(0.95),
	windowSize: z.coerce.number().min(5).max(1000).default(100),
});

export const updateAnomalySchema = z.object({
	isInvestigated: z.boolean().optional(),
	resolutionNotes: z.string().optional(),
	isResolved: z.boolean().optional(),
});

export const bulkResolveSchema = z.object({
	timeseriesId: z.string().uuid().optional(),
	start: z.string().datetime().optional(),
	end: z.string().datetime().optional(),
	severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
});
