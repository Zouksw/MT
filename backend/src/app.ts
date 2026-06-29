/**
 * Express application factory.
 *
 * Pure assembly of the Express app: middleware, routes, error handler, and the
 * Socket.IO server. This module has NO process-level side effects (no listen,
 * no scrapers, no crons, no prediction queue) so it can be imported by tests
 * via `supertest(request(app))` without starting background work.
 *
 * The runtime entry point (`server.ts`) calls `createApp()` then starts the
 * HTTP listener and background jobs.
 */

import { createServer, type Server } from "node:http";
import compression from "compression";
import cors from "cors";
import express, { type Express } from "express";
import { Server as SocketIOServer, type Server as SocketIOInstance } from "socket.io";

import { config, jwtUtils, logger } from "@/lib";
import { errorHandler } from "@/middleware/errorHandler";
import { errorLoggingMiddleware, loggingMiddleware } from "@/middleware/logging";
import { globalRateLimiter } from "@/middleware/rateLimiter";
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
import { metricsRouter } from "@/routes/metrics";
import { modelsRouter } from "@/routes/models";
import { portfolioRouter } from "@/routes/portfolios";
import securityRouter from "@/routes/security";
import { signalsRouter } from "@/routes/signals";
import { socialRouter } from "@/routes/social";
import { timeseriesRouter } from "@/routes/timeseries";
import { watchlistRouter } from "@/routes/watchlist";

export interface AppInstance {
	app: Express;
	httpServer: Server;
	io: SocketIOInstance;
}

/**
 * Build the Express application with all middleware, routes, error handling,
 * and a Socket.IO server bound to the HTTP server. Returns the assembled
 * pieces without starting the listener.
 */
export function createApp(): AppInstance {
	const app = express();
	// Trust the first proxy hop so req.secure / req.ip are correct behind TLS
	// terminators (nginx, load balancers). Required for the secure cookie flag
	// and correct rate-limit keying in production.
	app.set("trust proxy", 1);
	const httpServer = createServer(app);

	// Socket.IO setup
	const io = new SocketIOServer(httpServer, {
		cors: {
			origin: config.server.corsOrigin,
			credentials: true,
		},
	});

	// CORS middleware with whitelist support
	// Security: In production, requires explicit ALLOWED_ORIGINS configuration
	const corsOptions: cors.CorsOptions = {
		credentials: true,
		origin: (origin, callback) => {
			// Allow requests with no origin (like mobile apps or curl requests)
			if (!origin) return callback(null, true);

			const allowedOrigins = config.server.corsOrigin;

			// Security check: Production should have explicit CORS whitelist
			if (
				config.server.nodeEnv === "production" &&
				(allowedOrigins.length === 0 ||
					allowedOrigins.includes("*") ||
					allowedOrigins.some(
						(origin) =>
							origin === "http://localhost:3000" ||
							origin === "http://localhost:3001" ||
							origin === "http://localhost:3002",
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
				callback(null, true);
			} else {
				// For development, allow variations with different ports
				if (
					config.server.nodeEnv !== "production" &&
					allowedOrigins.some((allowed) =>
						origin?.startsWith(
							allowed.replace(":3000", "").replace(":3001", "").replace(":3002", ""),
						),
					)
				) {
					callback(null, true);
				} else {
					callback(new Error("CORS policy violation: Origin not allowed"));
				}
			}
		},
	};

	app.use(cors(corsOptions));

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

	// Development request logging
	if (config.server.nodeEnv !== "production") {
		app.use((req, _res, next) => {
			logger.info(`${req.method} ${req.path}`);
			next();
		});
	}

	// Health check routes
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
	app.use("/api/watchlists", watchlistRouter);
	app.use("/api/portfolios", portfolioRouter);
	app.use("/api/analytics", analyticsRouter);
	app.use("/api/social", socialRouter);
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

	// WebSocket connection
	io.on("connection", (socket) => {
		// Authenticate socket via handshake query
		const token = socket.handshake.auth?.token || socket.handshake.query?.token;
		let socketUserId: string | null = null;

		if (token && typeof token === "string") {
			try {
				const payload = jwtUtils.verifyToken(token);
				socketUserId = payload.userId;
				logger.info(`Socket ${socket.id} authenticated as user ${socketUserId}`);
			} catch (error) {
				logger.warn(`Socket ${socket.id} provided invalid token`, error);
			}
		} else {
			logger.warn(`Socket ${socket.id} connected without authentication`);
		}

		const subscriptions = new Set<string>();

		socket.on("join-timeseries", (timeseriesId: string) => {
			socket.join(`timeseries:${timeseriesId}`);
			logger.info(`Socket ${socket.id} joined timeseries:${timeseriesId}`);
		});

		socket.on("leave-timeseries", (timeseriesId: string) => {
			socket.leave(`timeseries:${timeseriesId}`);
			logger.info(`Socket ${socket.id} left timeseries:${timeseriesId}`);
		});

		// Realtime rooms — require authentication
		socket.on("subscribe", (room: string) => {
			if (!socketUserId) {
				socket.emit("error", { message: "Authentication required" });
				return;
			}

			const validRoom = /^(commodity:|portfolio:|signals:|orders:)([a-zA-Z0-9_-]+)$/;
			const match = validRoom.exec(room);
			if (!match) {
				socket.emit("error", { message: "Invalid room name" });
				return;
			}

			const [, prefix, roomId] = match;

			// Private rooms require ownership verification
			if ((prefix === "portfolio:" || prefix === "orders:") && roomId !== socketUserId) {
				socket.emit("error", { message: "Access denied" });
				return;
			}

			if (subscriptions.size >= 20) {
				socket.emit("error", { message: "Max subscriptions (20) reached" });
				return;
			}

			socket.join(room);
			subscriptions.add(room);
			logger.info(`Socket ${socket.id} subscribed to ${room}`);
		});

		socket.on("unsubscribe", (room: string) => {
			socket.leave(room);
			subscriptions.delete(room);
			logger.info(`Socket ${socket.id} unsubscribed from ${room}`);
		});

		socket.on("disconnect", () => {
			subscriptions.clear();
			logger.info(`Client disconnected: ${socket.id}`);
		});
	});

	// Make io accessible to routes
	app.set("io", io);

	return { app, httpServer, io };
}
