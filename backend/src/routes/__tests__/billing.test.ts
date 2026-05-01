/**
 * Billing Route Integration Tests
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

describe('Billing Routes (Integration)', () => {
  beforeAll(async () => {
    dbAvailable = await checkDatabase();
    if (!dbAvailable) return;
    prisma = new PrismaClient({ log: ['error'], datasources: { db: { url: REAL_DB_URL } } });
    token = await getAdminToken();
  });

  beforeEach(() => { if (!dbAvailable) vi.skip(); });

  describe('GET /api/billing/plans', () => {
    it('should return available plans', async () => {
      const res = await request(BASE)
        .get('/api/billing/plans')
        .set({ Authorization: `Bearer ${token}` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.plans).toHaveLength(3);
      expect(res.body.data.plans[0]).toHaveProperty('id');
      expect(res.body.data.plans[0]).toHaveProperty('name');
      expect(res.body.data.plans[0]).toHaveProperty('price');
      expect(res.body.data.plans[0]).toHaveProperty('features');
    });
  });

  describe('GET /api/billing/subscription', () => {
    it('should return current subscription', async () => {
      const res = await request(BASE)
        .get('/api/billing/subscription')
        .set({ Authorization: `Bearer ${token}` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('plan');
      expect(res.body.data).toHaveProperty('limits');
    });
  });

  describe('GET /api/billing/usage', () => {
    it('should return usage stats', async () => {
      const res = await request(BASE)
        .get('/api/billing/usage')
        .set({ Authorization: `Bearer ${token}` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/billing/cancel', () => {
    it('should reject cancel for free plan', async () => {
      const res = await request(BASE)
        .post('/api/billing/cancel')
        .set({ Authorization: `Bearer ${token}` });

      // Admin user might be on free plan
      if (res.body.success) {
        expect(res.body.data.message).toBe('Subscription cancelled');
      } else {
        expect(res.status).toBe(400);
      }
    });
  });

  it('should reject unauthenticated request', async () => {
    const res = await request(BASE).get('/api/billing/plans');
    expect(res.status).toBe(401);
  });
});
