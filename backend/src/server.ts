import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
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
import securityRouter from '@/routes/security';
import healthRouter from '@/routes/health';
import docsRouter from '@/routes/docs';
import { metricsRouter } from '@/routes/metrics';
import { errorHandler } from '@/middleware/errorHandler';
import { logger } from '@/lib';
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
  origin: function (origin, callback) {
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
  app.use((req, res, next) => {
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
app.use('/api/security', securityRouter);

// API documentation
app.use('/api/docs', docsRouter);

// Performance metrics
app.use('/api/metrics', metricsRouter);

// Error handling
app.use(errorHandler);

// WebSocket connection
io.on('connection', (socket) => {
  logger.info(`Client connected: ${socket.id}`);

  socket.on('join-timeseries', (timeseriesId: string) => {
    socket.join(`timeseries:${timeseriesId}`);
    logger.info(`Socket ${socket.id} joined timeseries:${timeseriesId}`);
  });

  socket.on('leave-timeseries', (timeseriesId: string) => {
    socket.leave(`timeseries:${timeseriesId}`);
    logger.info(`Socket ${socket.id} left timeseries:${timeseriesId}`);
  });

  socket.on('disconnect', () => {
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
});
