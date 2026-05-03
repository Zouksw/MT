/**
 * Common validation schemas with automatic type coercion
 * Replaces manual parseInt() calls throughout routes
 */

import { z } from "zod";

/**
 * Common pagination schema with automatic string-to-number coercion
 * Usage: paginationSchema.parse(req.query)
 */
export const paginationSchema = z.object({
	page: z.coerce.number().int().positive().optional().default(1),
	limit: z.coerce.number().int().positive().max(1000).optional().default(20),
});

/**
 * Limit schema for endpoints that just need a limit parameter
 */
export const limitSchema = z.object({
	limit: z.coerce.number().int().positive().max(10000).optional().default(1000),
});

/**
 * Parse and validate pagination params from query
 * Returns skip/take values for Prisma queries
 */
export type PaginationParams = z.infer<typeof paginationSchema>;

/**
 * Extract pagination with proper typing for Prisma queries
 * @param query - Request query object
 * @returns Object with skip and take properties
 */
export const getPagination = (
	query: unknown,
): { skip: number; take: number } => {
	const safeQuery = typeof query === "object" && query !== null ? query : {};
	const params = paginationSchema.parse(safeQuery);
	return {
		skip: (params.page - 1) * params.limit,
		take: params.limit,
	};
};
