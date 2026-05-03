/**
 * Anomaly detection validation schemas
 */

import { z } from "zod";
import { paginationSchema } from "./common";

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
	method: z
		.enum(["STATISTICAL", "ML_AUTOENCODER", "RULE_BASED"])
		.default("STATISTICAL"),
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
