/**
 * Backend Type Definitions
 *
 * Central export point for all backend types.
 * Following Linus's philosophy: "Good programmers worry about data structures."
 *
 * @module types
 */

// Re-export API response types
export * from "./api";
// Re-export model types
export * from "./models";

// ============================================================================
// Domain Types
// ============================================================================

/**
 * Query parameters with time range
 */
export interface TimeRangeQuery {
	startTime?: string;
	endTime?: string;
	limit?: number;
	aggregation?: string;
}

/**
 * Parsed import data
 * Replaces `any` with proper generic type
 */
export interface ParsedImportData<T = Record<string, unknown>> {
	headers: string[];
	data: Array<T>;
	rowCount: number;
}

/**
 * AI Model training result
 */
export interface ModelTrainingResult {
	success: boolean;
	modelId?: string;
	message: string;
	accuracy?: number;
	trainingTime?: number;
}

/**
 * Security audit log entry
 * Replaces `any` with proper Record type
 */
export interface SecurityAuditLog {
	event: string;
	timestamp: Date;
	sessionId: string;
	userId?: string;
	severity: "low" | "medium" | "high" | "critical";
	details: Record<string, unknown>;
	userAgent?: string;
	url?: string;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

/**
 * Authenticated request with user
 */
export interface AuthenticatedRequest {
	user: {
		id: string;
		email: string;
		role: "ADMIN" | "EDITOR" | "VIEWER";
	};
}

/**
 * Filter parameters
 */
export interface FilterParams {
	search?: string;
	status?: string;
	startDate?: string;
	endDate?: string;
}

/**
 * Query builder conditions
 * Replaces `any` with proper Record type
 */
export interface QueryConditions {
	where?: Record<string, unknown>;
	orderBy?: Record<string, "asc" | "desc">;
	take?: number;
	skip?: number;
}
