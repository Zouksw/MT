/**
 * Sentry Error Tracking Configuration
 *
 * Centralized error monitoring and performance tracking
 */

import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

import { logger } from "./logger";

/**
 * Initialize Sentry for error tracking
 */
export function initSentry(): void {
	const dsn = process.env.SENTRY_DSN;
	const environment = process.env.NODE_ENV || "development";

	if (!dsn) {
		logger.warn(
			"SENTRY_NOT_CONFIGURED",
			"Sentry DSN not configured. Error tracking is disabled.",
		);
		return;
	}

	Sentry.init({
		dsn,
		environment,
		integrations: [nodeProfilingIntegration()],

		// Performance monitoring
		tracesSampleRate: environment === "production" ? 0.1 : 1.0,

		// Attach environment information
		release:
			process.env.GIT_COMMIT_SHA ||
			process.env.npm_package_version ||
			"development",
	});

	logger.info("SENTRY_INITIALIZED", "Sentry initialized", { environment });
}

/**
 * Capture error with additional context
 */
export function captureError(
	error: Error,
	context?: Record<string, unknown>,
): void {
	if (!process.env.SENTRY_DSN) return;

	Sentry.withScope((scope) => {
		if (context) {
			scope.setExtras(context);
		}
		Sentry.captureException(error);
	});
}

/**
 * Alias for captureError for compatibility
 */
export function captureException(
	error: Error,
	context?: Record<string, unknown>,
): void {
	captureError(error, context);
}

/**
 * Capture message with level
 */
export function captureMessage(
	message: string,
	level: "info" | "warning" | "error" = "info",
	context?: Record<string, unknown>,
): void {
	if (!process.env.SENTRY_DSN) return;

	Sentry.withScope((scope) => {
		if (context) {
			scope.setExtras(context);
		}

		const sentryLevel =
			level === "warning" ? "warning" : level === "error" ? "error" : "info";
		Sentry.captureMessage(message, {
			level: sentryLevel as Sentry.SeverityLevel,
		});
	});
}

/**
 * Capture performance data
 */
export function captureTransaction(
	name: string,
	operation: string,
	context?: Record<string, unknown>,
): void {
	if (!process.env.SENTRY_DSN) return;

	Sentry.withScope((scope) => {
		if (context) {
			scope.setExtras(context);
		}

		Sentry.startSpan({ name, op: operation }, (span) => {
			// Span will be automatically sent
			return span;
		});
	});
}

/**
 * Capture performance data for API requests
 */
export function captureApiRequest(
	endpoint: string,
	method: string,
	statusCode: number,
	duration: number,
): void {
	if (!process.env.SENTRY_DSN) return;

	const isSlowRequest = duration > 1000; // 1 second
	const isError = statusCode >= 400;

	if (isSlowRequest || isError) {
		captureMessage(
			`${method} ${endpoint} - ${statusCode} (${duration}ms)`,
			isError ? "error" : "warning",
			{
				endpoint,
				method,
				statusCode,
				duration,
			},
		);
	}
}

export { Sentry };
