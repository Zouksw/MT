/**
 * Create a test Express app with real database connections
 *
 * Builds the full application stack from server.ts but allows
 * injecting a real PrismaClient and Redis client for integration tests.
 */

import express from 'express';
import cors from 'cors';
import type { PrismaClient } from '@prisma/client';
import { authRouter } from '@/routes/auth';
import { datasetsRouter } from '@/routes/datasets';
import { timeseriesRouter } from '@/routes/timeseries';
import alertsRouter from '@/routes/alerts';
import healthRouter from '@/routes/health';
import { errorHandler } from '@/middleware/errorHandler';

export interface TestAppResult {
  app: express.Application;
  prisma: PrismaClient;
}

/**
 * Create a fully functional Express app for integration testing.
 * Uses real Prisma client but bypasses auth middleware with a test user.
 */
export async function createIntegrationTestApp(
  prisma: PrismaClient,
): Promise<TestAppResult> {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // Mount all API routes
  app.use('/api/auth', authRouter);
  app.use('/api/datasets', datasetsRouter);
  app.use('/api/timeseries', timeseriesRouter);
  app.use('/api/alerts', alertsRouter);
  app.use('/api/health', healthRouter);

  // Error handler
  app.use(errorHandler);

  return { app, prisma };
}
