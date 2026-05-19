import { z } from "zod";
import { paginationSchema } from "./common";

export const alertsQuerySchema = paginationSchema.extend({
	isResolved: z
		.enum(["true", "false"])
		.transform((val) => val === "true")
		.optional(),
	alertType: z.enum(["THRESHOLD", "ANOMALY", "SYSTEM"]).optional(),
});

export const createAlertSchema = z.object({
	name: z.string().min(1).max(255),
	description: z.string().optional(),
	alertType: z.enum(["THRESHOLD", "ANOMALY", "SYSTEM"]),
	timeseriesId: z.string().uuid().optional(),
	conditions: z.record(z.unknown()),
	actions: z.array(z.string()).optional(),
	enabled: z.boolean().default(true),
});

export const updateAlertSchema = z.object({
	name: z.string().min(1).max(255).optional(),
	description: z.string().optional(),
	conditions: z.record(z.unknown()).optional(),
	actions: z.array(z.string()).optional(),
	enabled: z.boolean().optional(),
});

export const resolveAlertSchema = z.object({
	resolutionNotes: z.string().optional(),
});
