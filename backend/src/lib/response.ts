/**
 * Unified API response utilities
 * Standardizes success and error response formats
 */

import type { Response } from "express";
import type { ErrorDetail } from "@/types/api";

/**
 * Standard success response structure
 * Using proper generic type instead of `any`
 */
export interface SuccessResponse<T = unknown> {
	success: true;
	data: T;
	message?: string;
}

/**
 * Standard error response structure
 * Using proper type instead of `any` for details
 */
export interface ErrorResponse {
	success: false;
	error: {
		message: string;
		code?: string;
		details?: ErrorDetail;
	};
}

/**
 * Send a success response
 */
export function success<T>(res: Response, data: T, status: number = 200): void {
	res.status(status).json({
		success: true,
		data,
	});
}

/**
 * Send a success response with a message
 */
export function successWithMessage<T>(
	res: Response,
	data: T,
	message: string,
	status: number = 200,
): void {
	res.status(status).json({
		success: true,
		data,
		message,
	});
}

/**
 * Send an error response
 * @param res - Express response object
 * @param message - Error message
 * @param status - HTTP status code (default: 500)
 * @param code - Error code for client handling
 * @param details - Additional error details (properly typed)
 */
export function error(
	res: Response,
	message: string,
	status: number = 500,
	code?: string,
	details?: ErrorDetail,
): void {
	res.status(status).json({
		success: false,
		error: {
			message,
			...(code && { code }),
			...(details && { details }),
		},
	});
}

/**
 * Send a validation error response
 * @param res - Express response object
 * @param details - Validation error details (properly typed)
 */
export function validationError(res: Response, details: ErrorDetail): void {
	res.status(400).json({
		success: false,
		error: {
			message: "Validation failed",
			details,
		},
	});
}

/**
 * Send a not found error response
 */
export function notFound(res: Response, resource: string = "Resource"): void {
	res.status(404).json({
		success: false,
		error: {
			message: `${resource} not found`,
			code: "NOT_FOUND",
		},
	});
}

/**
 * Send an unauthorized error response
 */
export function unauthorized(
	res: Response,
	message: string = "Unauthorized",
): void {
	res.status(401).json({
		success: false,
		error: {
			message,
			code: "UNAUTHORIZED",
		},
	});
}

/**
 * Send a forbidden error response
 */
export function forbidden(res: Response, message: string = "Forbidden"): void {
	res.status(403).json({
		success: false,
		error: {
			message,
			code: "FORBIDDEN",
		},
	});
}

/**
 * Send a conflict error response
 */
export function conflict(res: Response, message: string): void {
	res.status(409).json({
		success: false,
		error: {
			message,
			code: "CONFLICT",
		},
	});
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
	page: number;
	limit: number;
	total: number;
	totalPages: number;
}

/**
 * Send a paginated response
 */
export function paginated<T>(
	res: Response,
	items: T[],
	meta: PaginationMeta,
	status: number = 200,
): void {
	res.status(status).json({
		success: true,
		data: items,
		pagination: meta,
	});
}

// Export as a grouped utility object
export const responseUtils = {
	success,
	successWithMessage,
	error,
	validationError,
	notFound,
	unauthorized,
	forbidden,
	conflict,
	paginated,
};

export default responseUtils;
