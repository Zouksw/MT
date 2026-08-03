/**
 * Backend Type Definitions
 *
 * Central export point for all backend types.
 * Following Linus's philosophy: "Good programmers worry about data structures."
 *
 * @module types
 */

// ============================================================================
// API Request/Response Types
// ============================================================================

// NOTE: `AuthenticatedRequest` lived here as a third duplicate of the type
// defined in middleware/auth.ts (the canonical one all routes import). It had
// a divergent shape (no userId, different user fields) and zero importers, so
// it was removed to stop carrying a misleading duplicate. Use the middleware
// version: `import { type AuthenticatedRequest } from "@/middleware/auth"`.

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
