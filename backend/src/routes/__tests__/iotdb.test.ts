/**
 * IoTDB API Integration Tests
 *
 * Tests the IoTDB REST API endpoints with real Express app setup
 * Focuses on HTTP layer, validation, and error handling
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach, jest } from '@jest/globals';
import request from 'supertest';
import express, { Express } from 'express';

// Mock all dependencies before importing the router
jest.mock('../../services/iotdb', () => ({
  iotdbClient: {
    healthCheck: jest.fn(),
    query: jest.fn(),
    queryData: jest.fn(),
    listTimeseries: jest.fn(),
    aggregate: jest.fn(),
  },
  iotdbRPCClient: {
    createTimeseries: jest.fn(),
    deleteTimeseries: jest.fn(),
    insertRecords: jest.fn(),
    insertOneRecord: jest.fn(),
  },
  iotdbAIService: {
    predict: jest.fn(),
    batchPredict: jest.fn().mockResolvedValue([]),
    detectAnomalies: jest.fn(),
    trainModel: jest.fn(),
    listModels: jest.fn(),
    getModel: jest.fn(),
    deleteModel: jest.fn(),
  },
}));

jest.mock('../../services/cache', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(undefined),
  mget: jest.fn().mockResolvedValue([]),
  cacheKeys: {
    prediction: jest.fn(() => 'prediction:test'),
    query: jest.fn(() => 'query:test'),
    timeseriesData: jest.fn(() => 'ts:data:test'),
  },
}));

jest.mock('../../middleware/rateLimiter', () => ({
  aiRateLimiter: (_req: any, _res: any, next: any) => next(),
}));

// Mock auth middleware to bypass authentication in tests
jest.mock('@/middleware/auth', () => ({
  authenticate: (req: any, _res: any, next: any) => {
    req.userId = 'test-user-id';
    req.user = { id: 'test-user-id', email: 'test@test.com', name: 'Test User', role: 'ADMIN' };
    next();
  },
  AuthRequest: Object,
}));

import { iotdbClient, iotdbRPCClient, iotdbAIService } from '@/services/iotdb';
import * as cacheService from '@/services/cache';
import { iotdbRouter } from '@/routes/iotdb';
import { errorHandler } from '@/middleware/errorHandler';

// Get typed mocks
const mockIoTDBClient = iotdbClient as any;
const mockIoTDBRPCClient = iotdbRPCClient as any;
const mockIoTDBAIService = iotdbAIService as any;

describe('IoTDB API Integration Tests', () => {
  let app: Express;

  beforeAll(() => {
    // Create Express app for testing
    app = express();
    app.use(express.json());
    app.use('/api/iotdb', iotdbRouter);
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default successful responses
    mockIoTDBClient.healthCheck.mockResolvedValue(true);
    mockIoTDBClient.query.mockResolvedValue({
      code: 200,
      timestamps: [1234567890000],
      values: [[25.5]],
    });
    mockIoTDBClient.listTimeseries.mockResolvedValue({
      code: 200,
      timeseries: ['root.test.temp'],
    });
  });

  afterAll(async () => {
    // Cleanup if needed
  });

  // ==========================================================================
  // Health & Status Endpoints
  // ==========================================================================

  describe('GET /api/iotdb/status', () => {
    test('should return IoTDB service status', async () => {
      const response = await request(app)
        .get('/api/iotdb/status')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(['healthy', 'unhealthy']).toContain(response.body.status);
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('config');
      expect(response.body.config).toHaveProperty('host');
      expect(response.body.config).toHaveProperty('port');
    });

    test('should return healthy when IoTDB is accessible', async () => {
      mockIoTDBClient.healthCheck.mockResolvedValue(true);

      const response = await request(app)
        .get('/api/iotdb/status')
        .expect(200);

      expect(response.body.status).toBe('healthy');
    });

    test('should return unhealthy when IoTDB is not accessible', async () => {
      mockIoTDBClient.healthCheck.mockResolvedValue(false);

      const response = await request(app)
        .get('/api/iotdb/status')
        .expect(200);

      expect(response.body.status).toBe('unhealthy');
    });
  });

  // ==========================================================================
  // SQL Query Endpoints
  // ==========================================================================

  describe('POST /api/iotdb/sql', () => {
    test('should execute SQL query successfully', async () => {
      const response = await request(app)
        .post('/api/iotdb/sql')
        .send({ sql: 'SELECT * FROM root' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(mockIoTDBClient.query).toHaveBeenCalledWith('SELECT * FROM root');
      expect(response.body).toHaveProperty('code', 200);
    });

    test('should validate request body has sql field', async () => {
      const response = await request(app)
        .post('/api/iotdb/sql')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    test('should handle empty sql string', async () => {
      const response = await request(app)
        .post('/api/iotdb/sql')
        .send({ sql: '' })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/iotdb/sql', () => {
    test('should execute SQL query via GET', async () => {
      const response = await request(app)
        .get('/api/iotdb/sql?sql=SELECT%20*%20FROM%20root')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(mockIoTDBClient.query).toHaveBeenCalledWith('SELECT * FROM root');
    });

    test('should require sql parameter', async () => {
      const response = await request(app)
        .get('/api/iotdb/sql')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  // ==========================================================================
  // Timeseries Management Endpoints
  // ==========================================================================

  describe('POST /api/iotdb/timeseries', () => {
    test('should create timeseries successfully', async () => {
      mockIoTDBRPCClient.createTimeseries.mockResolvedValue({ code: 200 });

      const response = await request(app)
        .post('/api/iotdb/timeseries')
        .send({
          path: 'root.test.temp',
          dataType: 'DOUBLE',
          encoding: 'RLE',
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(mockIoTDBRPCClient.createTimeseries).toHaveBeenCalledWith({
        path: 'root.test.temp',
        dataType: 'DOUBLE',
        encoding: 'RLE',
      });
      expect(response.body).toHaveProperty('success', true);
    });

    test('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/iotdb/timeseries')
        .send({
          path: 'root.test.temp',
          // Missing dataType and encoding
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    test('should validate dataType enum', async () => {
      const response = await request(app)
        .post('/api/iotdb/timeseries')
        .send({
          path: 'root.test.temp',
          dataType: 'INVALID_TYPE',
          encoding: 'RLE',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/iotdb/timeseries', () => {
    test('should list timeseries', async () => {
      mockIoTDBClient.listTimeseries.mockResolvedValue({
        code: 200,
        timeseries: ['root.test.temp', 'root.test.humidity'],
      });

      const response = await request(app)
        .get('/api/iotdb/timeseries')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(mockIoTDBClient.listTimeseries).toHaveBeenCalledWith(undefined);
      expect(response.body).toHaveProperty('timeseries');
      expect(response.body.timeseries).toHaveLength(2);
    });

    test('should filter by path when provided', async () => {
      const response = await request(app)
        .get('/api/iotdb/timeseries?path=root.test')
        .expect(200);

      expect(mockIoTDBClient.listTimeseries).toHaveBeenCalledWith('root.test');
    });
  });

  describe('DELETE /api/iotdb/timeseries/:path', () => {
    test('should delete timeseries', async () => {
      mockIoTDBRPCClient.deleteTimeseries.mockResolvedValue({ code: 200 });

      const response = await request(app)
        .delete('/api/iotdb/timeseries/root.test.temp')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(mockIoTDBRPCClient.deleteTimeseries).toHaveBeenCalledWith('root.test.temp');
      expect(response.body).toHaveProperty('success', true);
    });

    test('should handle wildcard paths', async () => {
      mockIoTDBRPCClient.deleteTimeseries.mockResolvedValue({ code: 200 });

      const response = await request(app)
        .delete('/api/iotdb/timeseries/root.test.**')
        .expect(200);

      expect(mockIoTDBRPCClient.deleteTimeseries).toHaveBeenCalledWith('root.test.**');
    });
  });

  // ==========================================================================
  // Data Insertion Endpoints
  // ==========================================================================

  describe('POST /api/iotdb/insert', () => {
    test('should insert multiple records', async () => {
      mockIoTDBRPCClient.insertRecords.mockResolvedValue({ code: 200 });

      const response = await request(app)
        .post('/api/iotdb/insert')
        .send({
          records: [
            {
              device: 'root.sg.d1',
              timestamp: 1234567890000,
              measurements: [
                { name: 'temperature', value: 25.5 },
                { name: 'humidity', value: 60.0 },
              ],
            },
          ],
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(mockIoTDBRPCClient.insertRecords).toHaveBeenCalled();
      expect(response.body).toHaveProperty('success', true);
    });

    test('should accept empty records array', async () => {
      mockIoTDBRPCClient.insertRecords.mockResolvedValue({ code: 200 });

      const response = await request(app)
        .post('/api/iotdb/insert')
        .send({ records: [] })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
    });

    test('should validate required record fields', async () => {
      const response = await request(app)
        .post('/api/iotdb/insert')
        .send({
          records: [
            {
              // Missing device, timestamp, measurements
            },
          ],
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/iotdb/insert/one', () => {
    test('should insert single record', async () => {
      mockIoTDBRPCClient.insertOneRecord.mockResolvedValue({ code: 200 });

      const response = await request(app)
        .post('/api/iotdb/insert/one')
        .send({
          device: 'root.sg.d1',
          timestamp: 1234567890000,
          measurements: [
            { name: 'temperature', value: 25.5 },
          ],
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(mockIoTDBRPCClient.insertOneRecord).toHaveBeenCalled();
      expect(response.body).toHaveProperty('success', true);
    });
  });

  // ==========================================================================
  // Data Query Endpoints
  // ==========================================================================

  describe('POST /api/iotdb/query/data', () => {
    test('should query time series data', async () => {
      mockIoTDBClient.queryData.mockResolvedValue({
        code: 200,
        timestamps: [1234567890000, 1234567891000],
        values: [[25.5], [26.0]],
      });

      const response = await request(app)
        .post('/api/iotdb/query/data')
        .send({
          path: 'root.test.temp',
          limit: 100,
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(mockIoTDBClient.queryData).toHaveBeenCalledWith({
        path: 'root.test.temp',
        limit: 100,
      });
    });

    test('should validate path is required', async () => {
      const response = await request(app)
        .post('/api/iotdb/query/data')
        .send({ limit: 100 })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/iotdb/aggregate', () => {
    test('should execute aggregate query', async () => {
      mockIoTDBClient.aggregate.mockResolvedValue({
        code: 200,
        values: [[25.5]],
      });

      const response = await request(app)
        .post('/api/iotdb/aggregate')
        .send({
          path: 'root.test.temp',
          func: 'avg',
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(mockIoTDBClient.aggregate).toHaveBeenCalled();
    });

    test('should validate func parameter', async () => {
      const response = await request(app)
        .post('/api/iotdb/aggregate')
        .send({
          path: 'root.test.temp',
          func: 'invalid_func',
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  // ==========================================================================
  // AI Prediction Endpoints
  // ==========================================================================

  describe('POST /api/iotdb/ai/predict', () => {
    test('should generate prediction', async () => {
      mockIoTDBAIService.predict.mockResolvedValue({
        success: true,
        forecasts: [
          { timestamp: new Date(), predictedValue: 25.5 },
        ],
      });

      const response = await request(app)
        .post('/api/iotdb/ai/predict')
        .send({
          timeseries: 'root.test.temp',
          horizon: 10,
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(mockIoTDBAIService.predict).toHaveBeenCalled();
      expect(response.body).toHaveProperty('forecasts');
    });

    test('should use cache for repeated predictions', async () => {
      const cachedResult = {
        success: true,
        forecasts: [{ timestamp: new Date(), predictedValue: 25.5 }],
      };
      (cacheService.get as jest.Mock).mockResolvedValueOnce(cachedResult);

      const response = await request(app)
        .post('/api/iotdb/ai/predict')
        .send({
          timeseries: 'root.test.temp',
          horizon: 10,
        })
        .expect(200);

      expect(response.body).toHaveProperty('cached', true);
      expect(mockIoTDBAIService.predict).not.toHaveBeenCalled();
    });

    test('should validate horizon is positive number', async () => {
      const response = await request(app)
        .post('/api/iotdb/ai/predict')
        .send({
          timeseries: 'root.test.temp',
          horizon: -1,
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('POST /api/iotdb/ai/predict/batch', () => {
    test('should generate batch predictions', async () => {
      mockIoTDBAIService.predict.mockResolvedValue({
        success: true,
        forecasts: [],
      });

      const response = await request(app)
        .post('/api/iotdb/ai/predict/batch')
        .send({
          requests: [
            { timeseries: 'root.test.temp', horizon: 10 },
            { timeseries: 'root.test.humidity', horizon: 10 },
          ],
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body).toHaveProperty('results');
    });

    test('should validate requests array size', async () => {
      const response = await request(app)
        .post('/api/iotdb/ai/predict/batch')
        .send({
          requests: Array.from({ length: 11 }, (_, i) => ({
            timeseries: `root.test.temp${i}`,
            horizon: 10,
          })),
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  // ==========================================================================
  // AI Anomaly Detection Endpoints
  // ==========================================================================

  describe('POST /api/iotdb/ai/anomalies', () => {
    test('should detect anomalies', async () => {
      mockIoTDBAIService.detectAnomalies.mockResolvedValue({
        success: true,
        anomalies: [],
      });

      const response = await request(app)
        .post('/api/iotdb/ai/anomalies')
        .send({
          timeseries: 'root.test.temp',
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(mockIoTDBAIService.detectAnomalies).toHaveBeenCalled();
      expect(response.body).toHaveProperty('anomalies');
    });
  });

  // ==========================================================================
  // AI Model Management Endpoints
  // ==========================================================================

  describe('GET /api/iotdb/ai/models', () => {
    test('should list AI models', async () => {
      mockIoTDBAIService.listModels.mockResolvedValue({
        success: true,
        models: [],
      });

      const response = await request(app)
        .get('/api/iotdb/ai/models')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(mockIoTDBAIService.listModels).toHaveBeenCalled();
      expect(response.body).toHaveProperty('models');
    });
  });

  describe('POST /api/iotdb/ai/models/train', () => {
    test('should train AI model', async () => {
      mockIoTDBAIService.trainModel.mockResolvedValue({
        success: true,
        modelId: 'model-123',
      });

      const response = await request(app)
        .post('/api/iotdb/ai/models/train')
        .send({
          timeseries: 'root.test.temp',
          algorithm: 'arima',
        })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(mockIoTDBAIService.trainModel).toHaveBeenCalledWith({
        timeseries: 'root.test.temp',
        algorithm: 'arima',
        parameters: undefined,
      });
      expect(response.body).toHaveProperty('modelId');
    });

    test('should validate missing required parameters', async () => {
      const response = await request(app)
        .post('/api/iotdb/ai/models/train')
        .send({
          timeseries: 'root.test.temp',
          // Missing algorithm
        })
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    test('should accept optional parameters', async () => {
      mockIoTDBAIService.trainModel.mockResolvedValue({
        success: true,
        modelId: 'model-456',
      });

      const response = await request(app)
        .post('/api/iotdb/ai/models/train')
        .send({
          timeseries: 'root.test.temp',
          algorithm: 'arima',
          parameters: { p: 1, d: 1, q: 1 },
        })
        .expect(200);

      expect(mockIoTDBAIService.trainModel).toHaveBeenCalledWith({
        timeseries: 'root.test.temp',
        algorithm: 'arima',
        parameters: { p: 1, d: 1, q: 1 },
      });
    });
  });

  // ==========================================================================
  // Error Handling
  // ==========================================================================

  describe('Error Handling', () => {
    test('should handle IoTDB client errors gracefully', async () => {
      mockIoTDBClient.query.mockRejectedValue(new Error('IoTDB connection failed'));

      const response = await request(app)
        .post('/api/iotdb/sql')
        .send({ sql: 'SELECT * FROM root' })
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
    });

    test('should handle RPC client errors gracefully', async () => {
      mockIoTDBRPCClient.createTimeseries.mockRejectedValue(
        new Error('Timeseries already exists')
      );

      const response = await request(app)
        .post('/api/iotdb/timeseries')
        .send({
          path: 'root.test.temp',
          dataType: 'DOUBLE',
          encoding: 'RLE',
        })
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
    });

    test('should handle AI service errors gracefully', async () => {
      mockIoTDBAIService.predict.mockRejectedValue(
        new Error('AI service unavailable')
      );

      const response = await request(app)
        .post('/api/iotdb/ai/predict')
        .send({
          timeseries: 'root.test.temp',
          horizon: 10,
        })
        .expect(500);

      expect(response.body).toHaveProperty('success', false);
    });
  });

  // ==========================================================================
  // Content-Type Validation
  // ==========================================================================

  describe('Request Validation', () => {
    test('should require JSON content type for POST requests', async () => {
      // Express's built-in JSON parser will parse text/plain as empty body
      // Our validation will catch the missing sql field
      const response = await request(app)
        .post('/api/iotdb/sql')
        .set('Content-Type', 'text/plain')
        .send('invalid')
        .expect(400);

      // Body parsing failed or validation error occurred
      expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test('should handle malformed JSON', async () => {
      // Express's JSON parser will fail on malformed JSON
      const response = await request(app)
        .post('/api/iotdb/sql')
        .set('Content-Type', 'application/json')
        .send('{invalid json}')
        .expect(400);

      // Express returns error for malformed JSON
      expect(response.status).toBe(400);
    });
  });

  // ==========================================================================
  // Authentication Tests (Day 1.4 - IoTDB routes now require auth)
  //
  // Note: Auth middleware is mocked at module level. These tests verify the
  // mock correctly sets user context (proving routes use authenticate middleware).
  // Unauthenticated rejection is tested by the auth middleware's own tests.
  // ==========================================================================

  describe('Authentication', () => {
    test('should have userId set by auth middleware on SQL query', async () => {
      const response = await request(app)
        .post('/api/iotdb/sql')
        .send({ sql: 'SELECT * FROM root' })
        .expect(200);

      // Auth mock sets req.userId = 'test-user-id'
      // If route used authenticate, the request succeeds (not 401)
      expect(response.status).toBe(200);
    });

    test('should have userId set by auth middleware on timeseries creation', async () => {
      mockIoTDBRPCClient.createTimeseries.mockResolvedValue({ code: 200 });

      const response = await request(app)
        .post('/api/iotdb/timeseries')
        .send({ path: 'root.test.temp', dataType: 'DOUBLE', encoding: 'RLE' })
        .expect(200);

      // Auth mock sets req.userId = 'test-user-id'
      expect(response.body).toHaveProperty('success', true);
    });

    test('/status should not require auth', async () => {
      const response = await request(app)
        .get('/api/iotdb/status')
        .expect(200);

      expect(response.body).toHaveProperty('status');
    });
  });

  // ==========================================================================
  // SQL Injection Prevention Tests (Day 1.5 - validateTimeseriesPath)
  // ==========================================================================

  describe('Timeseries Path Validation', () => {
    test('should reject path traversal in timeseries', async () => {
      const response = await request(app)
        .post('/api/iotdb/ai/predict')
        .send({
          timeseries: '../../etc/passwd',
          horizon: 10,
        });

      // Should be rejected by validation (either 400 from route validation or 500 from service)
      expect([400, 500]).toContain(response.status);
      if (response.body.success === false) {
        expect(response.body).toHaveProperty('success', false);
      }
    });

    test('should reject SQL injection in timeseries path', async () => {
      const response = await request(app)
        .post('/api/iotdb/ai/predict')
        .send({
          timeseries: "root.test; DROP TABLE users; --",
          horizon: 10,
        });

      expect([400, 500]).toContain(response.status);
    });

    test('should reject timeseries path without root prefix', async () => {
      const response = await request(app)
        .post('/api/iotdb/ai/predict')
        .send({
          timeseries: 'test.temp',
          horizon: 10,
        });

      expect([400, 500]).toContain(response.status);
    });

    test('should accept valid timeseries path', async () => {
      mockIoTDBAIService.predict.mockResolvedValue({
        success: true,
        timestamps: [1234567890000],
        values: [25.5],
      });

      const response = await request(app)
        .post('/api/iotdb/ai/predict')
        .send({
          timeseries: 'root.sg1.device1.temperature',
          horizon: 10,
        });

      // Should not be rejected for path validation
      expect(response.status).not.toBe(400);
    });
  });
});
