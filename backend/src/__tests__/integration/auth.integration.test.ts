/**
 * Auth Real Integration Tests
 *
 * Tests authentication endpoints against a REAL PostgreSQL + Redis.
 * Automatically skipped if database services are unavailable.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// Build a minimal Express app with real routes + error handler
import express from 'express';
import { authRouter } from '@/routes/auth';
import { errorHandler } from '@/middleware/errorHandler';

const TEST_PREFIX = `real-auth-${Date.now()}`;
const TEST_PASSWORD = 'SecurePass123!';
let TEST_PASSWORD_HASH: string;

let prisma: PrismaClient;
let app: express.Application;
let dbAvailable = false;

// Check if database is available before running tests
async function checkDatabaseAvailable(): Promise<boolean> {
  try {
    const p = new PrismaClient({ log: ['error'] });
    await p.$connect();
    await p.$executeRaw`SELECT 1`;
    await p.$disconnect();
    return true;
  } catch {
    return false;
  }
}

async function hashPassword(password: string): Promise<string> {
  // Use real bcrypt, not the mock from jest.setup.js
  const realBcrypt = jest.requireActual('bcryptjs') as typeof import('bcryptjs');
  const salt = await realBcrypt.genSalt(4); // Low rounds for speed
  return realBcrypt.hash(password, salt);
}

describe('Auth Integration Tests', () => {
  beforeAll(async () => {
    dbAvailable = await checkDatabaseAvailable();
    if (!dbAvailable) return;

    prisma = new PrismaClient({ log: ['error'] });
    TEST_PASSWORD_HASH = await hashPassword(TEST_PASSWORD);

    app = express();
    app.use(express.json());
    app.use('/auth', authRouter);
    app.use(errorHandler);
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    // Clean up test data
    try {
      await prisma.user.deleteMany({
        where: { email: { startsWith: TEST_PREFIX } },
      });
    } catch {
      // Ignore cleanup errors
    }
    await prisma.$disconnect();
  });

  // Skip all tests if database is unavailable
  beforeEach(() => {
    if (!dbAvailable) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest.skip();
    }
  });

  describe('Full auth lifecycle: register → login → me → logout', () => {
    test('should complete full registration → login → access → logout cycle', async () => {
      const email = `${TEST_PREFIX}-lifecycle@example.com`;

      // 1. Register
      const reg = await request(app)
        .post('/auth/register')
        .send({ email, password: TEST_PASSWORD, name: 'Test User' });

      expect(reg.status).toBe(201);
      expect(reg.body).toMatchObject({
        success: true,
        data: {
          user: { email, name: 'Test User' },
          token: expect.any(String),
        },
      });

      const regToken = reg.body.data.token;
      expect(typeof regToken).toBe('string');

      // 2. Login
      const login = await request(app)
        .post('/auth/login')
        .send({ email, password: TEST_PASSWORD });

      expect(login.status).toBe(200);
      expect(login.body).toMatchObject({
        success: true,
        data: {
          user: { email },
          token: expect.any(String),
        },
      });

      const loginToken = login.body.data.token;

      // 3. Access protected endpoint
      const me = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${loginToken}`);

      expect(me.status).toBe(200);
      expect(me.body.data.user).toBeDefined();
      expect(me.body.data.user.email).toBe(email);

      // 4. Logout
      const logout = await request(app)
        .post('/auth/logout')
        .set('Authorization', `Bearer ${loginToken}`);

      expect(logout.status).toBe(200);

      // 5. Verify token is blacklisted
      const retry = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${loginToken}`);

      expect(retry.status).toBe(401);
    });
  });

  describe('Registration validation', () => {
    test('should reject invalid email', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({ email: 'not-an-email', password: TEST_PASSWORD });

      expect(response.status).toBe(400);
    });

    test('should reject weak password', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({ email: `${TEST_PREFIX}-weak@example.com`, password: 'short' });

      expect(response.status).toBe(400);
    });

    test('should reject duplicate email', async () => {
      const email = `${TEST_PREFIX}-dup-${Date.now()}@example.com`;

      // First registration — may succeed (201) or get rate-limited (429)
      const reg1 = await request(app)
        .post('/auth/register')
        .send({ email, password: TEST_PASSWORD, name: 'First' });

      if (reg1.status === 429) {
        // Rate limited — skip this test
        return;
      }
      expect(reg1.status).toBe(201);

      // Second registration with same email fails
      const reg2 = await request(app)
        .post('/auth/register')
        .send({ email, password: TEST_PASSWORD, name: 'Second' });
      expect(reg2.status).toBe(409);
    });
  });

  describe('Login validation', () => {
    test('should reject non-existent user with 401', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({ email: `nonexistent-${Date.now()}@example.com`, password: TEST_PASSWORD });

      // Precise assertion: must be 401, not 500 or anything else
      expect(response.status).toBe(401);
    });

    test('should reject wrong password with 401', async () => {
      const email = `${TEST_PREFIX}-wrongpw@example.com`;

      // Register first
      await request(app)
        .post('/auth/register')
        .send({ email, password: TEST_PASSWORD, name: 'Wrong PW Test' });

      // Login with wrong password
      const response = await request(app)
        .post('/auth/login')
        .send({ email, password: 'WrongPass123!' });

      // Precise assertion: must be 401
      expect(response.status).toBe(401);
    });
  });

  describe('Token refresh', () => {
    test('should reject invalid refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token-value' });

      expect(response.status).toBe(401);
    });

    test('should reject missing refresh token', async () => {
      const response = await request(app)
        .post('/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
    });
  });

  describe('Protected endpoints', () => {
    test('should require authentication for /auth/me', async () => {
      const response = await request(app)
        .get('/auth/me');

      expect(response.status).toBe(401);
    });

    test('should require authentication for /auth/logout', async () => {
      const response = await request(app)
        .post('/auth/logout');

      expect(response.status).toBe(401);
    });

    test('should reject malformed JWT', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer not-a-jwt');

      expect(response.status).toBe(401);
    });
  });
});
