import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import {
  createPrismaProxy,
  createLoggerMock,
  createJwtUtilsMock,
  createConfigMock,
  passThrough,
} from '@/test-helpers';

vi.mock('@/lib', () => ({
  prisma: createPrismaProxy(),
  logger: createLoggerMock(),
  jwtUtils: createJwtUtilsMock(),
  config: createConfigMock(),
}));

vi.mock('@/services/authLockout', () => ({
  checkAccountLockout: vi.fn().mockResolvedValue({ isLocked: false }),
  recordFailedLogin: vi.fn(),
  clearFailedLoginAttempts: vi.fn(),
  formatLockoutTime: vi.fn().mockReturnValue('15 minutes'),
}));

vi.mock('@/services/tokenBlacklist', () => ({
  blacklistToken: vi.fn(),
  isTokenBlacklisted: vi.fn().mockResolvedValue(false),
}));

vi.mock('@/middleware/rateLimiter', () => ({
  authRateLimiter: passThrough,
  registrationRateLimiter: passThrough,
  passwordResetRateLimiter: passThrough,
}));

vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('$2b$12$hashed'), compare: vi.fn().mockResolvedValue(true) },
  hash: vi.fn().mockResolvedValue('$2b$12$hashed'),
  compare: vi.fn().mockResolvedValue(true),
}));

import { prisma } from '@/lib';
import { authRouter } from '@/routes/auth';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  return app;
}

describe('Auth Routes', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-1', email: 'test@example.com', name: 'Test', role: 'EDITOR',
      });

      const res = await request(createApp())
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'SecurePass123', name: 'Test' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user.email).toBe('test@example.com');
    });

    it('should reject duplicate email', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

      const res = await request(createApp())
        .post('/api/auth/register')
        .send({ email: 'test@example.com', password: 'SecurePass123', name: 'Test' });

      expect(res.status).toBe(409);
    });

    it('should reject invalid email', async () => {
      const res = await request(createApp())
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'SecurePass123', name: 'Test' });

      expect(res.status).toBe(400);
    });

    it('should reject missing password', async () => {
      const res = await request(createApp())
        .post('/api/auth/register')
        .send({ email: 'test@example.com', name: 'Test' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'test@example.com', name: 'Test',
        passwordHash: 'hashed', role: 'user',
      });

      const res = await request(createApp())
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'SecurePass123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data).toHaveProperty('sessionId');
    });

    it('should reject wrong password', async () => {
      const bcrypt = await import('bcryptjs');
      (bcrypt.compare as any).mockResolvedValue(false);
      (bcrypt.default.compare as any).mockResolvedValue(false);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1', email: 'test@example.com', passwordHash: 'hashed', role: 'user',
      });

      const res = await request(createApp())
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'WrongPass' });

      expect(res.status).toBe(401);
    });

    it('should reject non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'SecurePass123' });

      expect(res.status).toBe(401);
    });
  });
});
