/**
 * Dataset validation schemas
 */

import { z } from "zod";

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
