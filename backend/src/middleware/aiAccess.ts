/**
 * AI Feature Access Control Middleware
 *
 * Provides multi-layered security for AI features:
 * - Feature flag control (global kill switch)
 * - Authentication required
 * - Tier gating (dormant by default): when AI_TIER_ENFORCED=true, AI is a
 *   Pro-tier feature — VIEWER (free tier) is blocked and told to upgrade,
 *   EDITOR (Pro) and ADMIN pass. Enforcement is OFF by default (round-119):
 *   registration now defaults to VIEWER and no upgrade path exists yet
 *   (PRODUCT-SPEC §九: paywall/AI tiering deferred until there is a user
 *   base), so enforcing the tier would lock every new user out of the core
 *   value chain with no way through. The gate is built and one env var away.
 * - IP whitelist (optional)
 * - Audit logging
 */

import type { NextFunction, Request, Response } from "express";
import { logger } from "@/lib";
import type { AuthRequest } from "./auth";
import { ForbiddenError, ServiceUnavailableError } from "./errorHandler";

/**
 * Configured IP whitelist (optional)
 * Leave empty to disable IP restriction
 */
const AI_ALLOWED_IPS = process.env.AI_ALLOWED_IPS
	? process.env.AI_ALLOWED_IPS.split(",").map((ip) => ip.trim())
	: [];

/** Roles allowed to use AI features when tier enforcement is on (Pro tier+). */
const AI_ALLOWED_ROLES = new Set(["ADMIN", "EDITOR"]);

/**
 * Extract IP address from request
 */
function getClientIp(req: Request): string {
	return (req.ip || req.socket.remoteAddress || "unknown").split(":").pop() || "unknown";
}

/**
 * AI Feature Access Control Middleware
 *
 * Security layers:
 * 1. Feature flag check (global kill switch)
 * 2. User authentication verification
 * 3. Tier gating — VIEWER (free) is blocked, EDITOR/ADMIN (Pro+) pass
 * 4. IP whitelist (if configured)
 * 5. Audit logging
 */
export function checkAIAccess(req: AuthRequest, _res: Response, next: NextFunction) {
	// Layer 1: Check feature flag
	if (process.env.AI_FEATURES_DISABLED === "true") {
		logger.warn("[AI_ACCESS] AI features are disabled");
		throw new ServiceUnavailableError(
			"AI features are currently disabled. Please contact your administrator.",
		);
	}

	// Layer 2: Check authentication
	if (!req.user) {
		logger.warn("[AI_ACCESS] Unauthenticated AI access attempt");
		throw new ForbiddenError("Authentication required for AI features.");
	}

	// Layer 3: Tier gating — dormant unless AI_TIER_ENFORCED=true (round-119).
	// See the module docstring: with registration defaulting to VIEWER and no
	// upgrade path, enforcement is a product switch, not a code default.
	if (process.env.AI_TIER_ENFORCED === "true" && !AI_ALLOWED_ROLES.has(req.user.role)) {
		logger.warn(
			`[AI_ACCESS] VIEWER (free tier) AI access denied for ${req.user.email} — upgrade required`,
		);
		throw new ForbiddenError(
			"AI features require a Pro subscription. Please upgrade to access predictions, signals, and anomaly detection.",
		);
	}

	// Layer 4: IP whitelist check (if configured)
	if (AI_ALLOWED_IPS.length > 0) {
		const clientIp = getClientIp(req);
		if (!AI_ALLOWED_IPS.includes(clientIp)) {
			logger.warn(`[AI_ACCESS] AI access denied from non-whitelisted IP: ${clientIp}`);
			throw new ForbiddenError("AI features are only accessible from authorized networks.");
		}
	}

	// Layer 5: Log successful access
	const clientIp = getClientIp(req);
	logger.info(
		`[AI_ACCESS] AI feature accessed by ${req.user.email} (${req.user.role}) from ${clientIp}`,
	);

	next();
}
