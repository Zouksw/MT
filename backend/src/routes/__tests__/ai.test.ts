/**
 * Signals/AI Route Integration Tests
 *
 * Tests real /api/signals endpoints against a running backend.
 * Verifies model listing, signal generation, accuracy, and correlation.
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const ADMIN_EMAIL = 'admin@trademind.com';
const ADMIN_PASSWORD = 'Admin123!';
const REAL_DB_URL = 'postgresql://iotdb_user:iotdb_password@localhost:5432/iotdb_enhanced';
const BASE = `http://localhost:${process.env.PORT || 8000}`;

let dbAvailable = false;
let token: string;

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

async function getAdminToken(): Promise<string> {
  const res = await request(BASE)
    .post('/api/auth/login')
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  return res.body.data.token;
}

describe('Signals/AI Routes (Integration)', () => {
  beforeAll(async () => {
    dbAvailable = await checkDatabase();
    if (!dbAvailable) return;
    token = await getAdminToken();
  });

  beforeEach(() => {
    if (!dbAvailable) vi.skip();
  });

  it('should return real model list (7 models)', async () => {
    const res = await request(BASE)
      .get('/api/signals/models')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.models.length).toBe(7);
    expect(res.body.data.count).toBe(7);

    // Models are string IDs (e.g. "arima", "holtwinters")
    expect(typeof res.body.data.models[0]).toBe('string');
  });

  it('should return accuracy data from real MAPE tracking', async () => {
    const res = await request(BASE)
      .get('/api/signals/models/accuracy')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('accuracy');
    expect(res.body.data).toHaveProperty('days');
  });

  it('should generate real signal for a commodity', async () => {
    const res = await request(BASE)
      .get('/api/signals/wheat_cme?timeseriesPath=root.trading.wheat_cme.price&horizon=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('type');
    expect(['BUY', 'SELL', 'HOLD']).toContain(res.body.data.type);
    expect(res.body.data).toHaveProperty('confidence');
    expect(res.body.data).toHaveProperty('individualSignals');
    expect(res.body.data.individualSignals).toHaveLength(7);
  });

  it('should return model accuracy for specific model', async () => {
    const modelsRes = await request(BASE)
      .get('/api/signals/models')
      .set('Authorization', `Bearer ${token}`);

    const modelId = modelsRes.body.data.models[0];

    const res = await request(BASE)
      .get(`/api/signals/models/${modelId}/accuracy`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return correlation matrix', async () => {
    const res = await request(BASE)
      .get('/api/signals/correlation/matrix?commodities=wheat_cme,corn_cme,gold_cme&window=30')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return backtest results', async () => {
    const modelsRes = await request(BASE)
      .get('/api/signals/models')
      .set('Authorization', `Bearer ${token}`);

    const modelId = modelsRes.body.data.models[0];

    const res = await request(BASE)
      .get(`/api/signals/models/${modelId}/backtest`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('should return predictions with pagination', async () => {
    const modelsRes = await request(BASE)
      .get('/api/signals/models')
      .set('Authorization', `Bearer ${token}`);

    const modelId = modelsRes.body.data.models[0];

    const res = await request(BASE)
      .get(`/api/signals/models/${modelId}/predictions?limit=10`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('predictions');
    expect(res.body.data).toHaveProperty('total');
  });
});
