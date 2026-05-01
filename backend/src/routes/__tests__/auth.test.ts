/**
 * Auth Route Integration Tests
 *
 * Tests real /api/auth endpoints against a running backend with real PostgreSQL + Redis.
 * Creates test users with unique prefixes and cleans up after.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const TEST_PREFIX = `auth-${Date.now()}`;
const ADMIN_EMAIL = 'admin@trademind.com';
const ADMIN_PASSWORD = 'Admin123!';
const REAL_DB_URL = 'postgresql://iotdb_user:iotdb_password@localhost:5432/iotdb_enhanced';
const BASE = `http://localhost:${process.env.PORT || 8000}`;

let prisma: PrismaClient;
let dbAvailable = false;

async function checkDatabase(): Promise<boolean> {
  try {
    const p = new PrismaClient({ log: [], datasources: { db: { url: REAL_DB_URL } } });
    await p.$connect();
    await p.$executeRaw`SELECT 1`;
    await p.$disconnect();
    return true;
  } catch {
    return false;
  }
}

describe('Auth Routes (Integration)', () => {
  beforeAll(async () => {
    dbAvailable = await checkDatabase();
    if (!dbAvailable) return;
    prisma = new PrismaClient({ log: ['error'], datasources: { db: { url: REAL_DB_URL } } });
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    try {
      await prisma.user.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } });
    } catch { /* ignore */ }
    await prisma.$disconnect();
  });

  beforeEach(() => {
    if (!dbAvailable) vi.skip();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user with real DB and real bcrypt', async () => {
      const email = `${TEST_PREFIX}-new@test.com`;
      const res = await request(BASE)
        .post('/api/auth/register')
        .send({ email, password: 'SecurePass123!', name: 'Integration Test User' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data).toHaveProperty('refreshToken');
      expect(res.body.data.user.email).toBe(email);
    });

    it('should reject duplicate email', async () => {
      const email = `${TEST_PREFIX}-dup@test.com`;
      // Register first
      await request(BASE)
        .post('/api/auth/register')
        .send({ email, password: 'SecurePass123!', name: 'Dup User' });

      // Try again with same email
      const res = await request(BASE)
        .post('/api/auth/register')
        .send({ email, password: 'AnotherPass456!', name: 'Dup User 2' });

      expect(res.status).toBe(409);
    });

    it('should reject invalid email', async () => {
      const res = await request(BASE)
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'SecurePass123!', name: 'Test' });

      expect(res.status).toBe(400);
    });

    it('should reject missing password', async () => {
      const res = await request(BASE)
        .post('/api/auth/register')
        .send({ email: `${TEST_PREFIX}-nopass@test.com`, name: 'Test' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login admin with correct credentials', async () => {
      const res = await request(BASE)
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('should reject wrong password', async () => {
      const res = await request(BASE)
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: 'WrongPassword123!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject non-existent user', async () => {
      const res = await request(BASE)
        .post('/api/auth/login')
        .send({ email: 'nonexistent@nowhere.com', password: 'Whatever123!' });

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const loginRes = await request(BASE)
        .post('/api/auth/login')
        .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });

      const token = loginRes.body.data.token;

      const res = await request(BASE)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(ADMIN_EMAIL);
    });

    it('should reject request without token', async () => {
      const res = await request(BASE).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should reject malformed JWT', async () => {
      const res = await request(BASE)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.jwt.token');

      expect(res.status).toBe(401);
    });
  });
});
