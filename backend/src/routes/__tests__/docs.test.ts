/**
 * Docs Route Tests
 */

import { describe, test, expect, beforeAll, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';

jest.mock('swagger-ui-express', () => ({
  serve: [(_req: any, _res: any, next: any) => next()],
  setup: (spec: any) => (_req: any, res: any) => {
    res.send('<!DOCTYPE html><html>Swagger UI</html>');
  },
}));

jest.mock('@/config/swagger', () => ({
  default: JSON.parse(JSON.stringify({
    openapi: '3.0.0',
    info: { title: 'TradeMind AI API', version: '1.0.0' },
    paths: {},
  })),
}));

import docsRouter from '@/routes/docs';

describe('Docs Routes', () => {
  let app: Express;

  beforeAll(() => {
    app = express();
    app.use('/api/docs', docsRouter);
  });

  test('GET /api/docs should return swagger UI', async () => {
    const response = await request(app)
      .get('/api/docs')
      .expect(200);
  });

  test('GET /api/docs/json should return swagger spec as JSON', async () => {
    const response = await request(app)
      .get('/api/docs/json')
      .expect(200);

    // res.send() passes through mock object directly
    expect(response.headers['content-type']).toContain('application/json');
  });
});
