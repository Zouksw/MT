/**
 * API Keys Route Integration Tests
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const TEST_PREFIX = `ak-${Date.now()}`;
const REAL_DB_URL = 'postgresql://iotdb_user:iotdb_password@localhost:5432/iotdb_enhanced';
const BASE = `http://localhost:${process.env.PORT || 8000}`;

let prisma: PrismaClient;
let dbAvailable = false;
let token: string;
let createdKeyId: string;

async function checkDatabase(): Promise<boolean> {
  try {
    const p = new PrismaClient({ log: [], datasources: { db: { url: REAL_DB_URL } } });
    await p.$connect();
    await p.$executeRaw`SELECT 1`;
    await p.$disconnect();
    return true;
  } catch { return false; }
}

async function getAdminToken(): Promise<string> {
  const res = await request(BASE)
    .post('/api/auth/login')
    .send({ email: 'admin@trademind.com', password: 'Admin123!' });
  return res.body.data.token;
}

describe('API Keys Routes (Integration)', () => {
  beforeAll(async () => {
    dbAvailable = await checkDatabase();
    if (!dbAvailable) return;
    prisma = new PrismaClient({ log: ['error'], datasources: { db: { url: REAL_DB_URL } } });
    token = await getAdminToken();
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    try {
      await prisma.apiKey.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
    } catch { /* ignore cleanup */ }
    await prisma.$disconnect();
  });

  beforeEach(() => { if (!dbAvailable) vi.skip(); });

  describe('POST /api/api-keys', () => {
    it('should create an API key', async () => {
      const res = await request(BASE)
        .post('/api/api-keys')
        .set({ Authorization: `Bearer ${token}` })
        .send({ name: `${TEST_PREFIX}-key-1` });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data).toHaveProperty('apiKey');
      expect(res.body.data.apiKey).toMatch(/^iotd_/);
      createdKeyId = res.body.data.id;
    });

    it('should reject without name', async () => {
      const res = await request(BASE)
        .post('/api/api-keys')
        .set({ Authorization: `Bearer ${token}` })
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/api-keys', () => {
    it('should list API keys', async () => {
      const res = await request(BASE)
        .get('/api/api-keys')
        .set({ Authorization: `Bearer ${token}` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.apiKeys)).toBe(true);
    });
  });

  describe('DELETE /api/api-keys/:id/revoke', () => {
    it('should revoke the created key', async () => {
      if (!createdKeyId) return;
      const res = await request(BASE)
        .delete(`/api/api-keys/${createdKeyId}/revoke`)
        .set({ Authorization: `Bearer ${token}` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('DELETE /api/api-keys/:id', () => {
    it('should delete the created key', async () => {
      if (!createdKeyId) return;
      const res = await request(BASE)
        .delete(`/api/api-keys/${createdKeyId}`)
        .set({ Authorization: `Bearer ${token}` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  it('should reject unauthenticated request', async () => {
    const res = await request(BASE).get('/api/api-keys');
    expect(res.status).toBe(401);
  });
});
