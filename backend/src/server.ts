import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { authRouter } from '@/routes/auth';
import { datasetsRouter } from '@/routes/datasets';
import { timeseriesRouter } from '@/routes/timeseries';
import { modelsRouter } from '@/routes/models';
import { anomaliesRouter } from '@/routes/anomalies';
import { iotdbRouter } from '@/routes/iotdb';
import apiKeysRouter from '@/routes/apiKeys';
import alertsRouter from '@/routes/alerts';
import { signalsRouter } from '@/routes/signals';
import { marketDataRouter } from '@/routes/marketData';
import { watchlistRouter } from '@/routes/watchlist';
import { portfolioRouter } from '@/routes/portfolios';
import { simulationRouter } from '@/routes/simulation';
import { analyticsRouter } from '@/routes/analytics';
import { socialRouter } from '@/routes/social';
import { communityRouter } from '@/routes/community';
import { billingRouter } from '@/routes/billing';
import securityRouter from '@/routes/security';
import healthRouter from '@/routes/health';
import docsRouter from '@/routes/docs';
import { metricsRouter } from '@/routes/metrics';
import { checkLimitOrders } from '@/services/simulationEngine';
import { registerAllScrapers, scraperManager } from '@/services/dataIngestion';
import { syncCommoditiesToIoTDB, scheduleAllCommodityPredictions } from '@/services/dataIngestion/iotdbSync';
import { initPredictionQueue } from '@/services/predictionQueue';
import { errorHandler } from '@/middleware/errorHandler';
import { logger, jwtUtils } from '@/lib';
import { securityHeaders } from '@/middleware/security';
import { config } from './lib';
import { loggingMiddleware, errorLoggingMiddleware } from '@/middleware/logging';

dotenv.config();

const app = express();
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
    if (config.server.nodeEnv === 'production' &&
        (allowedOrigins.length === 0 ||
         allowedOrigins.includes('*') ||
         allowedOrigins.some(origin => origin === 'http://localhost:3000' ||
                                          origin === 'http://localhost:3001' ||
                                          origin === 'http://localhost:3002'))) {
      logger.warn('SECURITY: Default localhost origins detected in production CORS configuration. ' +
                   'Please set CORS_ORIGIN environment variable with your production domains.');
    }

    // Check if origin is exactly in allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      // For development, allow variations with different ports
      if (config.server.nodeEnv !== 'production' &&
          allowedOrigins.some(allowed => origin?.startsWith(allowed.replace(':3000', '').replace(':3001', '').replace(':3002', '')))) {
        callback(null, true);
      } else {
        callback(new Error('CORS policy violation: Origin not allowed'));
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
app.use(compression({
  threshold: 1024, // Only compress responses larger than 1KB
  level: 6, // Compression level (1-9, 6 is best balance)
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      // Don't compress if client explicitly requests no compression
      return false;
    }
    // Use compression for all requests except when explicitly disabled
    return compression.filter(req, res);
  },
}));

// Production monitoring middleware (only in production)
if (config.server.nodeEnv === 'production') {
  // Enhanced logging middleware
  app.use(...loggingMiddleware);
}

// Error logging middleware
app.use(errorLoggingMiddleware);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Development request logging
if (config.server.nodeEnv !== 'production') {
  app.use((req, _res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
  });
}

// Health check routes
app.use('/health', healthRouter);

// API routes
app.use('/api/auth', authRouter);
app.use('/api/datasets', datasetsRouter);
app.use('/api/timeseries', timeseriesRouter);
app.use('/api/models', modelsRouter);
app.use('/api/anomalies', anomaliesRouter);
app.use('/api/iotdb', iotdbRouter);
app.use('/api/api-keys', apiKeysRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/signals', signalsRouter);
app.use('/api/market', marketDataRouter);
app.use('/api/watchlists', watchlistRouter);
app.use('/api/portfolios', portfolioRouter);
app.use('/api/sim', simulationRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/social', socialRouter);
app.use('/api/community', communityRouter);
app.use('/api/billing', billingRouter);
app.use('/api/security', securityRouter);

// API documentation
app.use('/api/docs', docsRouter);

// Performance metrics
app.use('/api/metrics', metricsRouter);

// Error handling
app.use(errorHandler);

// WebSocket connection
io.on('connection', (socket) => {
  // Authenticate socket via handshake query
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  let socketUserId: string | null = null;

  if (token && typeof token === 'string') {
    try {
      const payload = jwtUtils.verifyToken(token);
      socketUserId = payload.userId;
      logger.info(`Socket ${socket.id} authenticated as user ${socketUserId}`);
    } catch {
      logger.warn(`Socket ${socket.id} provided invalid token`);
    }
  } else {
    logger.warn(`Socket ${socket.id} connected without authentication`);
  }

  const subscriptions = new Set<string>();

  socket.on('join-timeseries', (timeseriesId: string) => {
    socket.join(`timeseries:${timeseriesId}`);
    logger.info(`Socket ${socket.id} joined timeseries:${timeseriesId}`);
  });

  socket.on('leave-timeseries', (timeseriesId: string) => {
    socket.leave(`timeseries:${timeseriesId}`);
    logger.info(`Socket ${socket.id} left timeseries:${timeseriesId}`);
  });

  // Trading rooms — require authentication
  socket.on('subscribe', (room: string) => {
    if (!socketUserId) {
      socket.emit('error', { message: 'Authentication required' });
      return;
    }

    const validRoom = /^(commodity:|portfolio:|signals:|orders:)([a-zA-Z0-9_-]+)$/;
    const match = validRoom.exec(room);
    if (!match) {
      socket.emit('error', { message: 'Invalid room name' });
      return;
    }

    const [, prefix, roomId] = match;

    // Private rooms require ownership verification
    if ((prefix === 'portfolio:' || prefix === 'orders:') && roomId !== socketUserId) {
      socket.emit('error', { message: 'Access denied' });
      return;
    }

    if (subscriptions.size >= 20) {
      socket.emit('error', { message: 'Max subscriptions (20) reached' });
      return;
    }

    socket.join(room);
    subscriptions.add(room);
    logger.info(`Socket ${socket.id} subscribed to ${room}`);
  });

  socket.on('unsubscribe', (room: string) => {
    socket.leave(room);
    subscriptions.delete(room);
    logger.info(`Socket ${socket.id} unsubscribed from ${room}`);
  });

  socket.on('disconnect', () => {
    subscriptions.clear();
    logger.info(`Client disconnected: ${socket.id}`);
  });
});

// Make io accessible to routes
app.set('io', io);

// Start server
httpServer.listen(config.server.port, () => {
  logger.info(`🚀 Server running on http://localhost:${config.server.port}`);
  logger.info(`📡 WebSocket server ready`);
  logger.info(`🌍 Environment: ${config.server.nodeEnv}`);

  // Initialize data scrapers
  registerAllScrapers();
  logger.info('📊 Data scrapers registered');

  // Run initial data fetch (don't block server startup)
  scraperManager.runAll().then((results) => {
    const summary = Object.entries(results)
      .map(([name, r]) => `${name}: ${'error' in r ? 'error' : `${(r as any).inserted} inserted, ${(r as any).updated} updated`}`)
      .join('; ');
    logger.info(`📊 Initial data fetch: ${summary}`);
  }).catch((err) => {
    logger.error(`📊 Initial data fetch failed: ${err}`);
  });

  // Initialize prediction queue (BullMQ workers)
  try {
    initPredictionQueue();
    logger.info('🤖 Prediction queue initialized');
  } catch (err) {
    logger.warn(`🤖 Prediction queue skipped (Redis may not be available): ${err}`);
  }

  // Sync commodity prices to IoTDB and schedule AI predictions (async, non-blocking)
  setTimeout(async () => {
    try {
      const syncResult = await syncCommoditiesToIoTDB();
      logger.info(`📊 IoTDB sync: ${syncResult.synced} commodities synced`);
    } catch (err) {
      logger.warn(`📊 IoTDB sync skipped: ${err}`);
    }

    try {
      const count = await scheduleAllCommodityPredictions();
      logger.info(`🤖 Scheduled predictions for ${count} commodities (every 30 min)`);
    } catch (err) {
      logger.warn(`🤖 Prediction scheduling skipped: ${err}`);
    }
  }, 5000); // Delay 5s to let scrapers finish first run
});

// Check pending backtest prediction orders every 30 seconds
setInterval(async () => {
  try {
    const executed = await checkLimitOrders();
    if (executed > 0) {
      logger.info(`[Backtest] Executed ${executed} pending prediction orders`);
    }
  } catch (err) {
    logger.error('[Backtest] Error checking orders:', err);
  }
}, 30_000);

// Daily data refresh at 8:00 AM server time (every 24 hours)
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
setInterval(async () => {
  try {
    const results = await scraperManager.runAll();
    const summary = Object.entries(results)
      .map(([name, r]) => `${name}: ${'error' in r ? 'error' : `${(r as any).inserted}+${(r as any).updated}`}`)
      .join('; ');
    logger.info(`📊 Daily data refresh: ${summary}`);
  } catch (err) {
    logger.error(`📊 Daily data refresh failed: ${err}`);
  }
}, TWENTY_FOUR_HOURS);
