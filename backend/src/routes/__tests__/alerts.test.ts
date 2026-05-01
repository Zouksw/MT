/**
 * Alerts Route Integration Tests
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const REAL_DB_URL = 'postgresql://iotdb_user:iotdb_password@localhost:5432/iotdb_enhanced';
const BASE = `http://localhost:${process.env.PORT || 8000}`;

let prisma: PrismaClient;
let dbAvailable = false;
let token: string;

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

describe('Alerts Routes (Integration)', () => {
  beforeAll(async () => {
    dbAvailable = await checkDatabase();
    if (!dbAvailable) return;
    prisma = new PrismaClient({ log: ['error'], datasources: { db: { url: REAL_DB_URL } } });
    token = await getAdminToken();
  });

  beforeEach(() => { if (!dbAvailable) vi.skip(); });

  describe('GET /api/alerts', () => {
    it('should return alerts list', async () => {
      const res = await request(BASE)
        .get('/api/alerts')
        .set({ Authorization: `Bearer ${token}` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('alerts');
      expect(res.body.data).toHaveProperty('total');
      expect(typeof res.body.data.total).toBe('number');
    });

    it('should support limit param', async () => {
      const res = await request(BASE)
        .get('/api/alerts?limit=5')
        .set({ Authorization: `Bearer ${token}` });

      expect(res.status).toBe(200);
      expect(res.body.data.alerts.length).toBeLessThanOrEqual(5);
    });
  });

  describe('GET /api/alerts/stats', () => {
    it('should return alert statistics', async () => {
      const res = await request(BASE)
        .get('/api/alerts/stats')
        .set({ Authorization: `Bearer ${token}` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('PATCH /api/alerts/read-all', () => {
    it('should mark all alerts as read', async () => {
      const res = await request(BASE)
        .patch('/api/alerts/read-all')
        .set({ Authorization: `Bearer ${token}` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  it('should reject unauthenticated request', async () => {
    const res = await request(BASE).get('/api/alerts');
    expect(res.status).toBe(401);
  });
});
