/**
 * AI Access Control Middleware
 *
 * Provides multi-layered security for AI features:
 * - Feature flag control
 * - Role-based access (any authenticated user)
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

/**
 * Extract IP address from request
 */
function getClientIp(req: Request): string {
	return (
		(req.ip || req.socket.remoteAddress || "unknown").split(":").pop() ||
		"unknown"
	);
}

/**
 * AI Feature Access Control Middleware
 *
 * Security layers:
 * 1. Feature flag check
 * 2. User authentication verification
 * 3. IP whitelist (if configured)
 * 4. Audit logging
 */
export function checkAIAccess(
	req: AuthRequest,
	_res: Response,
	next: NextFunction,
) {
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

	// Layer 3: IP whitelist check (if configured)
	if (AI_ALLOWED_IPS.length > 0) {
		const clientIp = getClientIp(req);
		if (!AI_ALLOWED_IPS.includes(clientIp)) {
			logger.warn(
				`[AI_ACCESS] AI access denied from non-whitelisted IP: ${clientIp}`,
			);
			throw new ForbiddenError(
				"AI features are only accessible from authorized networks.",
			);
		}
	}

	// Layer 4: Log successful access
	const clientIp = getClientIp(req);
	logger.info(
		`[AI_ACCESS] AI feature accessed by ${req.user.email} (${req.user.role}) from ${clientIp}`,
	);

	next();
}

/**
 * Middleware to check if AI features are enabled
 * (for informational endpoints like /api/iotdb/ai/models)
 */
export function checkAIEnabled(
	_req: Request,
	res: Response,
	next: NextFunction,
) {
	if (process.env.AI_FEATURES_DISABLED === "true") {
		// Return 503 with informative message
		return res.status(503).json({
			enabled: false,
			message:
				"AI features are currently disabled. Please contact your administrator.",
		});
	}

	// Attach AI status to response
	res.locals.aiEnabled = true;
	next();
}
