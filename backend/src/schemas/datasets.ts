/**
 * Dataset validation schemas
 */

import { z } from "zod";
import { paginationSchema } from "./common";

export const datasetsQuerySchema = paginationSchema.extend({
	search: z.string().optional(),
});

export const createDatasetSchema = z.object({
	name: z.string().min(1).max(255),
	slug: z
		.string()
		.min(1)
		.max(100)
		.regex(/^[a-z0-9-]+$/),
	description: z.string().optional(),
	storageFormat: z.enum(["IOTDB_CACHE", "INFLUXDB", "OPENML", "CSV"]),
	filePath: z.string().optional(),
	isPublic: z.boolean().default(false),
});

export const updateDatasetSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	description: z.string().optional(),
	isPublic: z.boolean().optional(),
	isImported: z.boolean().optional(),
});
