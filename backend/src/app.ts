/**
 * Express application factory.
 *
 * Pure assembly of the Express app: middleware, routes, error handler. This
 * module has NO process-level side effects (no listen, no scrapers, no crons,
 * no prediction queue) so it can be imported by tests via
 * `supertest(request(app))` without starting background work.
 *
 * The runtime entry point (`server.ts`) calls `createApp()` then starts the
 * HTTP listener and background jobs.
 *
 * Socket.IO was REMOVED (round-112): the server ran a full realtime stack
 * (connection auth, room join/subscribe handlers, emits on signals/anomalies/
 * models/alerts) with zero consumers — the frontend never shipped
 * socket.io-client. Emit sites collapsed to their DB-persistence paths.
 */

import { createServer, type Server } from "node:http";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express, { type Express } from "express";

import { config, logger } from "@/lib";
import { errorHandler } from "@/middleware/errorHandler";
import { errorLoggingMiddleware, loggingMiddleware } from "@/middleware/logging";
import { globalRateLimiter, healthRateLimiter } from "@/middleware/rateLimiter";
import { securityHeaders } from "@/middleware/security";
import alertsRouter from "@/routes/alerts";
import { analyticsRouter } from "@/routes/analytics";
import { anomaliesRouter } from "@/routes/anomalies";
import apiKeysRouter from "@/routes/apiKeys";
import { authRouter } from "@/routes/auth";
import { beefRouter } from "@/routes/beef";
import { billingRouter } from "@/routes/billing";
import { datasetsRouter } from "@/routes/datasets";
import docsRouter from "@/routes/docs";
import healthRouter from "@/routes/health";
import { inferenceRouter } from "@/routes/inference";
import { marketDataRouter } from "@/routes/marketData";
import { marketNewsRouter } from "@/routes/marketNews";
import { metricsRouter } from "@/routes/metrics";
import { modelsRouter } from "@/routes/models";
import { portfolioRouter } from "@/routes/portfolios";
import securityRouter from "@/routes/security";
import { signalsRouter } from "@/routes/signals";
import { timeseriesRouter } from "@/routes/timeseries";
import { watchlistRouter } from "@/routes/watchlist";

export interface AppInstance {
	app: Express;
	httpServer: Server;
}

/**
 * Build the Express application with all middleware, routes, and error
 * handling. Returns the assembled pieces without starting the listener.
 */
export function createApp(): AppInstance {
	const app = express();
	// Trust the first proxy hop so req.secure / req.ip are correct behind TLS
	// terminators (nginx, load balancers). Required for the secure cookie flag
	// and correct rate-limit keying in production.
	app.set("trust proxy", 1);
	const httpServer = createServer(app);

	// CORS middleware with whitelist support.
	// Security: In production, requires explicit ALLOWED_ORIGINS configuration.
	//
	// Same-origin exemption (delegation mode): browsers attach an Origin header
	// to every POST, so requests proxied from our own frontend entry (nginx
	// `proxy_set_header Host $host`, or the Next.js /api rewrites) arrive with an
	// Origin that the strict whitelist below would reject — 500ing every
	// same-origin POST (login, web-vitals, all mutations). When the Origin's
	// host:port equals the request's Host (or X-Forwarded-Host behind a proxy),
	// the request is same-origin and CORS does not apply, so we skip the
	// whitelist entirely.
	const isSameOriginRequest = (req: express.Request, origin: string): boolean => {
		try {
			const originHost = new URL(origin).host;
			const forwarded = req.headers["x-forwarded-host"];
			const host =
				(typeof forwarded === "string" ? forwarded.split(",")[0].trim() : undefined) ||
				req.headers.host;
			return !!host && originHost === host;
		} catch {
			return false;
		}
	};

	const corsOptionsDelegate: cors.CorsOptionsDelegate<express.Request> = (req, callback) => {
		const origin = typeof req.headers.origin === "string" ? req.headers.origin : undefined;

		// Allow requests with no origin (mobile apps, curl, server-to-server)
		if (!origin || isSameOriginRequest(req, origin)) {
			return callback(null, { credentials: true });
		}

		const allowedOrigins = config.server.corsOrigin;

		// Security check: Production should have explicit CORS whitelist
		if (
			config.server.nodeEnv === "production" &&
			(allowedOrigins.length === 0 ||
				allowedOrigins.includes("*") ||
				allowedOrigins.some(
					(o) =>
						o === "http://localhost:3000" ||
						o === "http://localhost:3001" ||
						o === "http://localhost:3002",
				))
		) {
			logger.error(
				"SECURITY: Default localhost origins detected in production CORS configuration. " +
					"Please set CORS_ORIGIN environment variable with your production domains.",
			);
			return callback(new Error("CORS: localhost origins not allowed in production"));
		}

		// Check if origin is exactly in allowed list
		if (allowedOrigins.indexOf(origin) !== -1) {
			return callback(null, { credentials: true, origin: true });
		}

		// For development, allow variations with different ports
		if (
			config.server.nodeEnv !== "production" &&
			allowedOrigins.some((allowed) =>
				origin.startsWith(allowed.replace(":3000", "").replace(":3001", "").replace(":3002", "")),
			)
		) {
			return callback(null, { credentials: true, origin: true });
		}

		callback(new Error("CORS policy violation: Origin not allowed"));
	};

	app.use(cors(corsOptionsDelegate));

	// Security middleware
	app.use(securityHeaders);

	// Response compression middleware
	// Compresses all responses > 1KB using gzip (level 6 for balance)
	// Skips compression for small responses where overhead outweighs benefit
	app.use(
		compression({
			threshold: 1024, // Only compress responses larger than 1KB
			level: 6, // Compression level (1-9, 6 is best balance)
			filter: (req, res) => {
				if (req.headers["x-no-compression"]) {
					// Don't compress if client explicitly requests no compression
					return false;
				}
				// Use compression for all requests except when explicitly disabled
				return compression.filter(req, res);
			},
		}),
	);

	// Production monitoring middleware (only in production)
	if (config.server.nodeEnv === "production") {
		// Enhanced logging middleware
		app.use(...loggingMiddleware);
	}

	// Error logging middleware
	app.use(errorLoggingMiddleware);

	app.use(express.json({ limit: "10mb" }));
	app.use(express.urlencoded({ extended: true }));

	// Parse Cookie headers into req.cookies. Required by every cookie read in
	// the app: /auth/verify and /auth/me's HttpOnly `auth_token` fallback (the
	// SPA's refresh-survival session), logout's cookie revocation, and the
	// csrf_token double-submit. Without this middleware req.cookies is
	// undefined and all those paths silently see "no cookie" — observed live
	// in round-105: login SETS cookies fine (res.cookie needs no parser) but
	// every read was dead, so a page refresh always unauthenticated.
	app.use(cookieParser());

	// Development request logging
	if (config.server.nodeEnv !== "production") {
		app.use((req, _res, next) => {
			logger.info(`${req.method} ${req.path}`);
			next();
		});
	}

	// Health check routes. /health/ready fans out to DB/Redis/inference
	// probes — cap it so an unauthenticated client can't hammer it for
	// resource exhaustion. The /api-scoped global limiter does not cover
	// /health; cron-healthcheck polls once per 5 min, far under 60/min.
	app.use("/health", healthRateLimiter);
	app.use("/health", healthRouter);

	// Global rate limiter — baseline abuse cap across all API routes. Stricter
	// per-route limiters (auth, registration, AI) apply on top of this.
	app.use("/api", globalRateLimiter);

	// API routes
	app.use("/api/auth", authRouter);
	app.use("/api/datasets", datasetsRouter);
	app.use("/api/timeseries", timeseriesRouter);
	app.use("/api/models", modelsRouter);
	app.use("/api/anomalies", anomaliesRouter);
	app.use("/api/inference", inferenceRouter);
	app.use("/api/api-keys", apiKeysRouter);
	app.use("/api/alerts", alertsRouter);
	app.use("/api/signals", signalsRouter);
	app.use("/api/market", marketDataRouter);
	app.use("/api/news", marketNewsRouter);
	app.use("/api/watchlists", watchlistRouter);
	app.use("/api/portfolios", portfolioRouter);
	app.use("/api/analytics", analyticsRouter);
	app.use("/api/billing", billingRouter);
	app.use("/api/security", securityRouter);

	// API documentation
	app.use("/api/docs", docsRouter);

	// Performance metrics
	app.use("/api/metrics", metricsRouter);

	// Beef data (factory-level, cut-level)
	app.use("/api/beef", beefRouter);

	// Error handling
	app.use(errorHandler);

	return { app, httpServer };
}
