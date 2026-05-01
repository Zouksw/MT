/**
 * Correlation Analysis — Integration via HTTP
 *
 * Tests correlation endpoints against running backend with real commodity data.
 * Cannot test service functions directly because they use the global prisma
 * singleton (pointed at iotdb_test by test-setup, which has no commodity data).
 */

import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';

const BASE = `http://localhost:${process.env.PORT || 8000}`;

let serverAvailable = false;
let token: string;

describe('Correlation Analysis (HTTP Integration)', () => {
  beforeAll(async () => {
    try {
      const loginRes = await request(BASE)
        .post('/api/auth/login')
        .send({ email: 'admin@trademind.com', password: 'Admin123!' });
      if (loginRes.status === 200 && loginRes.body.data?.token) {
        token = loginRes.body.data.token;
        serverAvailable = true;
      }
    } catch { /* server not running */ }
  });

  beforeEach(() => { if (!serverAvailable) vi.skip(); });

  describe('GET /api/signals/commodities', () => {
    it('should return available commodities', async () => {
      const res = await request(BASE)
        .get('/api/signals/commodities')
        .set({ Authorization: `Bearer ${token}` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      if (res.body.data.length > 0) {
        expect(res.body.data[0]).toHaveProperty('slug');
      }
    });
  });

  describe('GET /api/signals/correlation', () => {
    it('should compute correlation between two commodities', async () => {
      const commRes = await request(BASE)
        .get('/api/signals/commodities')
        .set({ Authorization: `Bearer ${token}` });
      const commodities = commRes.body.data;
      if (commodities.length < 2) return;

      const res = await request(BASE)
        .get(`/api/signals/correlation?a=${commodities[0].slug}&b=${commodities[1].slug}`)
        .set({ Authorization: `Bearer ${token}` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('correlation');
      expect(typeof res.body.data.correlation).toBe('number');
      expect(res.body.data.correlation).toBeGreaterThanOrEqual(-1);
      expect(res.body.data.correlation).toBeLessThanOrEqual(1);
    });

    it('should reject missing query params', async () => {
      const res = await request(BASE)
        .get('/api/signals/correlation')
        .set({ Authorization: `Bearer ${token}` });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/signals/correlation/matrix', () => {
    it('should compute pairwise matrix', async () => {
      const commRes = await request(BASE)
        .get('/api/signals/commodities')
        .set({ Authorization: `Bearer ${token}` });
      const slugs = commRes.body.data.slice(0, 3).map((c: { slug: string }) => c.slug);
      if (slugs.length < 2) return;

      const res = await request(BASE)
        .get(`/api/signals/correlation/matrix?commodities=${slugs.join(',')}`)
        .set({ Authorization: `Bearer ${token}` });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('matrix');
    });
  });
});
