/**
 * Timeseries validation schemas
 */

import { z } from "zod";
import { limitSchema, paginationSchema } from "./common";

export const timeseriesQuerySchema = paginationSchema.extend({
	datasetId: z.string().uuid().optional(),
	search: z.string().optional(),
});

export const timeseriesDataQuerySchema = limitSchema.extend({
	startTime: z.string().datetime().optional(),
	endTime: z.string().datetime().optional(),
});

export const createTimeseriesSchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().optional(),
	unit: z.string().optional(),
	dataType: z
		.enum(["BOOLEAN", "INT32", "INT64", "FLOAT", "DOUBLE", "TEXT", "STRING"])
		.optional(),
	datasetId: z.string().uuid(),
});

export const updateTimeseriesSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	description: z.string().optional(),
	unit: z.string().optional(),
	dataType: z
		.enum(["BOOLEAN", "INT32", "INT64", "FLOAT", "DOUBLE", "TEXT", "STRING"])
		.optional(),
});

export const createDataPointSchema = z.object({
	timestamp: z.string().datetime().optional(),
	value: z.number(),
	quality: z.number().min(0).max(100).optional(),
});
