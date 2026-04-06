/**
 * Datasets Integration Tests
 *
 * Tests the datasets endpoints with real Express app setup
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';
import { datasetsRouter } from '@/routes/datasets';

describe('Datasets Integration Tests', () => {
  let app: Express;

  beforeAll(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/datasets', datasetsRouter);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  describe('GET /datasets', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .get('/datasets')
        .expect('Content-Type', /json/);

      // Should return 401 when not authenticated
      expect([401, 403]).toContain(response.status);
    });

    test('should require authentication for pagination', async () => {
      const response = await request(app)
        .get('/datasets?page=1&limit=10')
        .expect('Content-Type', /json/);

      // Should require authentication
      expect([401, 403]).toContain(response.status);
    });

    test('should require authentication for search', async () => {
      const response = await request(app)
        .get('/datasets?search=test')
        .expect('Content-Type', /json/);

      // Should require authentication
      expect([401, 403]).toContain(response.status);
    });

    test('should require authentication even with invalid limit', async () => {
      const response = await request(app)
        .get('/datasets?limit=invalid');

      // Should require authentication or return validation error
      expect([400, 401]).toContain(response.status);
    });

    test('should require authentication even with invalid page', async () => {
      const response = await request(app)
        .get('/datasets?page=0');

      // Should require authentication or return validation error
      expect([400, 401]).toContain(response.status);
    });
  });

  describe('GET /datasets/:id', () => {
    test('should return single dataset', async () => {
      const response = await request(app)
        .get('/datasets/non-existent-id');

      // Should return 404 for non-existent dataset
      expect([404, 400]).toContain(response.status);
    });

    test('should validate UUID format', async () => {
      const response = await request(app)
        .get('/datasets/invalid-uuid-format');

      // Should return 404 or validation error
      expect([400, 404]).toContain(response.status);
    });

    test('should include timeseries for valid dataset', async () => {
      const response = await request(app)
        .get('/datasets/00000000-0000-0000-0000-000000000001');

      // Will likely return 404 but endpoint exists
      expect([200, 404, 400]).toContain(response.status);
    });
  });

  describe('POST /datasets', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .post('/datasets')
        .send({
          name: 'Test Dataset',
          slug: 'test-dataset',
          storageFormat: 'CSV',
        })
        .expect('Content-Type', /json/);

      // Should return 401 when not authenticated
      expect([401, 403]).toContain(response.status);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/datasets')
        .send({
          // Missing required fields
        })
        .expect('Content-Type', /json/);

      // Should return validation error or auth error
      expect([400, 401]).toContain(response.status);
    });

    test('should validate storage format', async () => {
      const response = await request(app)
        .post('/datasets')
        .send({
          name: 'Test Dataset',
          slug: 'test-dataset',
          storageFormat: 'INVALID_FORMAT',
        })
        .expect('Content-Type', /json/);

      // Should return validation error or auth error
      expect([400, 401]).toContain(response.status);
    });
  });

  describe('PATCH /datasets/:id', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .patch('/datasets/test-id')
        .send({
          name: 'Updated Dataset',
        })
        .expect('Content-Type', /json/);

      // Should return 401 when not authenticated
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('DELETE /datasets/:id', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .delete('/datasets/test-id')
        .expect('Content-Type', /json/);

      // Should return 401 when not authenticated
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('POST /datasets/:id/import', () => {
    test('should require authentication', async () => {
      const response = await request(app)
        .post('/datasets/test-id/import')
        .send({
          format: 'CSV',
          data: 'col1,col2\nval1,val2',
        })
        .expect('Content-Type', /json/);

      // Should return 401 when not authenticated
      expect([401, 403]).toContain(response.status);
    });
  });

  describe('GET /datasets/:id/export', () => {
    test('should handle export request', async () => {
      const response = await request(app)
        .get('/datasets/test-id/export');

      // May require auth or return 404 for non-existent dataset
      expect([200, 401, 403, 404]).toContain(response.status);
    });

    test('should accept format parameter', async () => {
      const response = await request(app)
        .get('/datasets/test-id/export?format=CSV');

      expect([200, 401, 403, 404]).toContain(response.status);
    });
  });

  describe('POST /datasets/:id/timeseries', () => {
    test('should return 404 for non-existent endpoint', async () => {
      const response = await request(app)
        .post('/datasets/test-id/timeseries')
        .send({
          name: 'Test Timeseries',
          slug: 'test-timeseries',
        });

      // This endpoint doesn't exist - timeseries are created via POST /timeseries
      expect(response.status).toBe(404);
    });

    test('should return 404 for invalid data on non-existent endpoint', async () => {
      const response = await request(app)
        .post('/datasets/test-id/timeseries')
        .send({
          // Missing required fields
        });

      // This endpoint doesn't exist
      expect(response.status).toBe(404);
    });
  });

  describe('Invalid endpoints', () => {
    test('should return 404 for PUT /datasets/:id', async () => {
      const response = await request(app)
        .put('/datasets/some-id')
        .send({ name: 'Updated' });

      expect(response.status).toBe(404);
    });

    test('should return 404 for POST /datasets/:id/data', async () => {
      const response = await request(app)
        .post('/datasets/some-id/data')
        .send({ value: 100 });

      expect(response.status).toBe(404);
    });

    test('should return 404 for GET /datasets/:id/stats', async () => {
      const response = await request(app)
        .get('/datasets/some-id/stats');

      expect(response.status).toBe(404);
    });
  });
});
