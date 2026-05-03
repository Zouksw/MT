/**
 * ML model validation schemas
 */

import { z } from "zod";
import { limitSchema, paginationSchema } from "./common";

export const modelsQuerySchema = paginationSchema.extend({
	timeseriesId: z.string().uuid().optional(),
	isActive: z
		.enum(["true", "false"])
		.transform((val) => val === "true")
		.optional(),
	algorithm: z
		.enum(["ARIMA", "PROPHET", "LSTM", "TRANSFORMER", "ENSEMBLE"])
		.optional(),
});

export const trainModelSchema = z.object({
	timeseriesId: z.string().uuid(),
	algorithm: z.enum(["ARIMA", "PROPHET", "LSTM", "TRANSFORMER", "ENSEMBLE"]),
	hyperparameters: z.record(z.any()).optional(),
	trainingStart: z.string().datetime().optional(),
	trainingEnd: z.string().datetime().optional(),
});

export const predictSchema = z.object({
	horizon: z.coerce.number().min(1).max(10000).default(100),
	confidenceLevel: z.coerce.number().min(0).max(1).default(0.95),
});

export const forecastsQuerySchema = limitSchema.extend({
	start: z.string().datetime().optional(),
	end: z.string().datetime().optional(),
});
