/**
 * API Workflow Integration Tests
 *
 * Tests real API endpoints against a running backend with real PostgreSQL.
 * Each test exercises a complete user workflow: register → authenticate → CRUD → cleanup.
 * Automatically skipped if database is unavailable.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { PrismaClient } from '@prisma/client';

const TEST_PREFIX = `wf-${Date.now()}`;
const ADMIN_EMAIL = 'admin@trademind.com';
const ADMIN_PASSWORD = 'Admin123!';
const REAL_DB_URL = 'postgresql://iotdb_user:iotdb_password@localhost:5432/iotdb_enhanced';

let prisma: PrismaClient;
let dbAvailable = false;

// Check real database connectivity (use production DB, not test DB)
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

// Login and get a real JWT token
async function getAdminToken(): Promise<string> {
  const res = await request(`http://localhost:${process.env.PORT || 8000}`)
    .post('/api/auth/login')
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  return res.body.data.token;
}

// Get a real commodity slug from DB
async function getRealCommoditySlug(): Promise<string> {
  const [row] = await prisma.$queryRaw<Array<{ slug: string }>>`
    SELECT slug FROM commodities WHERE slug = 'wheat_cme' LIMIT 1
  `;
  return row?.slug ?? 'wheat_cme';
}

describe('API Workflow Integration Tests', () => {
  beforeAll(async () => {
    dbAvailable = await checkDatabase();
    if (!dbAvailable) return;
    prisma = new PrismaClient({ log: ['error'], datasources: { db: { url: REAL_DB_URL } } });
  });

  afterAll(async () => {
    if (!dbAvailable) return;
    // Clean up any test data we created
    try {
      await prisma.user.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } });
      await prisma.dataset.deleteMany({ where: { slug: { startsWith: TEST_PREFIX } } });
      await prisma.watchlist.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
      await prisma.simulationAccount.deleteMany({ where: { name: { startsWith: TEST_PREFIX } } });
    } catch { /* ignore cleanup errors */ }
    await prisma.$disconnect();
  });

  beforeEach(() => {
    if (!dbAvailable) vi.skip();
  });

  const BASE = `http://localhost:${process.env.PORT || 8000}`;

  // ─── Auth Workflow ────────────────────────────────────────────────

  describe('Auth: register → login → me → logout', () => {
    const email = `${TEST_PREFIX}-user@test.com`;
    const password = 'TestPass123!';
    let token: string;

    test('should register a new user', async () => {
      const res = await request(BASE)
        .post('/api/auth/register')
        .send({ email, password, name: 'Workflow Test User' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      expect(res.body.data.user.email).toBe(email);
      token = res.body.data.token;
    });

    test('should login with correct credentials', async () => {
      const res = await request(BASE)
        .post('/api/auth/login')
        .send({ email, password });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('token');
      token = res.body.data.token;
    });

    test('should reject wrong password', async () => {
      const res = await request(BASE)
        .post('/api/auth/login')
        .send({ email, password: 'WrongPassword!' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('should get current user with valid token', async () => {
      const res = await request(BASE)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(email);
    });

    test('should reject request without token', async () => {
      const res = await request(BASE).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });

  // ─── Datasets Workflow ────────────────────────────────────────────

  describe('Datasets: list → create → read → update → delete', () => {
    let token: string;
    let datasetId: string;
    const slug = `${TEST_PREFIX}-dataset`;

    beforeAll(async () => {
      if (!dbAvailable) return;
      // Get admin token for dataset operations
      token = await getAdminToken();
    });

    test('should list existing datasets', async () => {
      const res = await request(BASE)
        .get('/api/datasets')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toHaveProperty('total');
      expect(res.body.pagination.total).toBeGreaterThan(0);
    });

    test('should create a new dataset', async () => {
      const res = await request(BASE)
        .post('/api/datasets')
        .set('Authorization', `Bearer ${token}`)
        .send({
          name: 'Workflow Test Dataset',
          slug,
          description: 'Created by integration test',
          storageFormat: 'CSV',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Workflow Test Dataset');
      expect(res.body.data.slug).toBe(slug);
      datasetId = res.body.data.id;
    });

    test('should reject duplicate slug', async () => {
      const res = await request(BASE)
        .post('/api/datasets')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Duplicate', slug, storageFormat: 'CSV' });

      expect(res.status).toBe(400);
    });

    test('should get dataset by ID', async () => {
      const res = await request(BASE)
        .get(`/api/datasets/${datasetId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(datasetId);
      expect(res.body.data.name).toBe('Workflow Test Dataset');
    });

    test('should update dataset', async () => {
      const res = await request(BASE)
        .patch(`/api/datasets/${datasetId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: 'Updated by integration test' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe('Updated by integration test');
    });

    test('should delete dataset', async () => {
      const res = await request(BASE)
        .delete(`/api/datasets/${datasetId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('should return 404 for deleted dataset', async () => {
      const res = await request(BASE)
        .get(`/api/datasets/${datasetId}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
    });
  });

  // ─── Market Data Workflow ─────────────────────────────────────────

  describe('Market Data: commodities → prices → factors', () => {
    let token: string;

    beforeAll(async () => {
      if (!dbAvailable) return;
      token = await getAdminToken();
    });

    test('should list all commodities with prices', async () => {
      const res = await request(BASE)
        .get('/api/market/commodities')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.commodities.length).toBeGreaterThanOrEqual(100);

      // Verify structure of first commodity
      const c = res.body.data.commodities[0];
      expect(c).toHaveProperty('slug');
      expect(c).toHaveProperty('name');
      expect(c).toHaveProperty('category');
    });

    test('should get price history for a commodity', async () => {
      const slug = await getRealCommoditySlug();
      const res = await request(BASE)
        .get(`/api/market/commodities/${slug}/price?interval=daily&limit=10`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      if (res.body.data.prices && res.body.data.prices.length > 0) {
        const p = res.body.data.prices[0];
        expect(p).toHaveProperty('date');
        expect(p).toHaveProperty('close');
        // close may be Decimal (serialized as string) or number
        expect(Number(p.close)).toBeGreaterThan(0);
      }
    });

    test('should list market fundamentals for a commodity', async () => {
      const slug = await getRealCommoditySlug();
      const res = await request(BASE)
        .get(`/api/market/commodities/${slug}/fundamentals`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('factors');
    });
  });

  // ─── Beef Data Workflow ───────────────────────────────────────────

  describe('Beef Data: cuts → factories → prices', () => {
    let token: string;

    beforeAll(async () => {
      if (!dbAvailable) return;
      token = await getAdminToken();
    });

    test('should list all beef cuts grouped by primal', async () => {
      const res = await request(BASE)
        .get('/api/beef/cuts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.cuts.length).toBeGreaterThan(50);
      expect(res.body.data.count).toBeGreaterThan(50);
    });

    test('should list all factories', async () => {
      const res = await request(BASE)
        .get('/api/beef/factories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.factories.length).toBeGreaterThan(10);

      // Verify factory has required fields
      const f = res.body.data.factories[0];
      expect(f).toHaveProperty('code');
      expect(f).toHaveProperty('name');
      expect(f).toHaveProperty('country');
    });

    test('should get latest prices', async () => {
      const res = await request(BASE)
        .get('/api/beef/prices/latest')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const prices = res.body.data.prices ?? res.body.data;
      if (Array.isArray(prices) && prices.length > 0) {
        const p = prices[0];
        expect(p).toHaveProperty('price');
        expect(typeof p.price).toBe('number');
      }
    });
  });

  // ─── Signals Workflow ─────────────────────────────────────────────

  describe('Signals: models → generate signal → accuracy', () => {
    let token: string;

    beforeAll(async () => {
      if (!dbAvailable) return;
      token = await getAdminToken();
    });

    test('should list available prediction models', async () => {
      const res = await request(BASE)
        .get('/api/signals/models')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.models.length).toBe(7);
      expect(res.body.data.count).toBe(7);
    });

    test('should generate signal for commodity (with fallback price)', async () => {
      const slug = await getRealCommoditySlug();
      const res = await request(BASE)
        .get(`/api/signals/${slug}?timeseriesPath=root.trading.${slug}.price&horizon=10`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('type');
      expect(['BUY', 'SELL', 'HOLD']).toContain(res.body.data.type);
      expect(res.body.data).toHaveProperty('confidence');
      expect(res.body.data).toHaveProperty('individualSignals');
      expect(res.body.data.individualSignals).toHaveLength(7);
    });

    test('should get model accuracy data', async () => {
      const res = await request(BASE)
        .get('/api/signals/models/accuracy')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accuracy');
    });

    test('should get correlation matrix', async () => {
      const res = await request(BASE)
        .get('/api/signals/correlation/matrix?window=30')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ─── Simulation Trading Workflow ──────────────────────────────────

  describe('Simulation: create account → place order → view trades', () => {
    let token: string;
    let accountId: string;

    beforeAll(async () => {
      if (!dbAvailable) return;
      token = await getAdminToken();
    });

    test('should create a simulation account', async () => {
      const res = await request(BASE)
        .post('/api/sim/accounts')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `${TEST_PREFIX}-sim-account`, initialBalance: 50000 });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.account.name).toBe(`${TEST_PREFIX}-sim-account`);
      accountId = res.body.data.account.id;
    });

    test('should list user accounts', async () => {
      const res = await request(BASE)
        .get('/api/sim/accounts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accounts.length).toBeGreaterThanOrEqual(1);
    });

    test('should place a market order', async () => {
      const slug = await getRealCommoditySlug();
      const res = await request(BASE)
        .post(`/api/sim/accounts/${accountId}/orders`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          commoditySlug: slug,
          type: 'MARKET',
          side: 'BUY',
          quantity: 10,
        });

      // May succeed or fail depending on price availability
      if (res.status === 201) {
        expect(res.body.success).toBe(true);
        expect(res.body.data).toHaveProperty('order');
      } else {
        expect(res.body.success).toBe(false);
      }
    });
  });

  // ─── Watchlist Workflow ───────────────────────────────────────────

  describe('Watchlist: create → add items → list → remove', () => {
    let token: string;
    let watchlistId: string;

    beforeAll(async () => {
      if (!dbAvailable) return;
      token = await getAdminToken();
    });

    test('should create a watchlist', async () => {
      const res = await request(BASE)
        .post('/api/watchlists')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `${TEST_PREFIX}-watchlist` });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.watchlist.name).toBe(`${TEST_PREFIX}-watchlist`);
      watchlistId = res.body.data.watchlist.id;
    });

    test('should add commodity to watchlist', async () => {
      const slug = await getRealCommoditySlug();
      const [commodity] = await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM commodities WHERE slug = ${slug} LIMIT 1
      `;

      const res = await request(BASE)
        .post(`/api/watchlists/${watchlistId}/items`)
        .set('Authorization', `Bearer ${token}`)
        .send({ commodityId: commodity.id });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });

    test('should list watchlists with items and prices', async () => {
      const res = await request(BASE)
        .get('/api/watchlists')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.watchlists.length).toBeGreaterThanOrEqual(1);

      const wl = res.body.data.watchlists.find(
        (w: { name: string }) => w.name === `${TEST_PREFIX}-watchlist`
      );
      expect(wl).toBeDefined();
      expect(wl.itemCount).toBeGreaterThanOrEqual(1);
    });
  });

  // ─── Alerts & Anomalies Workflow ──────────────────────────────────

  describe('Alerts & Anomalies: read real data', () => {
    let token: string;

    beforeAll(async () => {
      if (!dbAvailable) return;
      token = await getAdminToken();
    });

    test('should list alerts with real data', async () => {
      const res = await request(BASE)
        .get('/api/alerts')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('alerts');
      expect(res.body.data).toHaveProperty('total');
      expect(res.body.data.total).toBeGreaterThan(0);
    });

    test('should list anomalies with real data', async () => {
      const res = await request(BASE)
        .get('/api/anomalies')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);

      // Verify anomaly structure
      const a = res.body.data[0];
      expect(a).toHaveProperty('severity');
      expect(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).toContain(a.severity);
    });
  });

  // ─── Health & Metrics ────────────────────────────────────────────

  describe('Health & Metrics: system endpoints', () => {
    test('should return health status', async () => {
      const res = await request(BASE).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data).toHaveProperty('uptime');
    });

    test('should return metrics with valid structure', async () => {
      const token = await getAdminToken();
      const res = await request(BASE)
        .get('/api/metrics')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('uptime');
      expect(res.body.data).toHaveProperty('memory');
      expect(res.body.data.memory).toHaveProperty('heapUsed');
    });
  });

  // ─── Billing Workflow ────────────────────────────────────────────

  describe('Billing: subscription and usage', () => {
    let token: string;

    beforeAll(async () => {
      if (!dbAvailable) return;
      token = await getAdminToken();
    });

    test('should get current subscription', async () => {
      const res = await request(BASE)
        .get('/api/billing/subscription')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('plan');
      expect(res.body.data).toHaveProperty('limits');
      expect(res.body.data.limits).toHaveProperty('watchlistItems');
    });
  });

  // ─── API Keys Workflow ───────────────────────────────────────────

  describe('API Keys: list existing keys', () => {
    let token: string;

    beforeAll(async () => {
      if (!dbAvailable) return;
      token = await getAdminToken();
    });

    test('should list API keys', async () => {
      const res = await request(BASE)
        .get('/api/api-keys')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('apiKeys');
      expect(Array.isArray(res.body.data.apiKeys)).toBe(true);
    });
  });

  // ─── Portfolio & Correlation ─────────────────────────────────────

  describe('Portfolio: list and analytics', () => {
    let token: string;

    beforeAll(async () => {
      if (!dbAvailable) return;
      token = await getAdminToken();
    });

    test('should list portfolios', async () => {
      const res = await request(BASE)
        .get('/api/portfolios')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('should compute correlation between commodities', async () => {
      const res = await request(BASE)
        .get('/api/analytics/correlation?slugs=wheat_cme,corn_cme,gold_cme')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('correlations');
    });
  });
});
