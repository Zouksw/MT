/**
 * MAPE Tracking — Real Database Integration Tests
 *
 * Tests prediction lifecycle: log → verify → accuracy.
 * Uses createTestContext to get a prisma connected to the real DB.
 * Note: mapeTracking service functions import the global prisma singleton,
 * which in test env points to iotdb_test. This test verifies the service
 * logic works end-to-end against the test DB.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import {
  logPrediction,
  verifyPrediction,
  getModelAccuracy,
  getAllModelAccuracy,
} from '@/services/mapeTracking';
import { createTestContext, destroyTestContext, type TestContext } from '@/test/helpers/testContext';

describe('MAPE Tracking (real DB)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestContext('mape');
    if (!ctx.available) return;
  });

  afterAll(async () => {
    await destroyTestContext(ctx);
  });

  beforeEach(() => {
    if (!ctx?.available) vi.skip();
  });

  describe('logPrediction + verifyPrediction', () => {
    it('should log and verify a prediction with MAPE', async () => {
      const id = await logPrediction({
        modelId: 'test-model-mape',
        commodityId: 'test-commodity-mape',
        timeseriesPath: 'root.test.mape.price',
        horizon: 5,
        predictedValues: [100, 200, 300],
      });

      expect(id).toBeDefined();

      const result = await verifyPrediction(id, [105, 195, 310]);
      expect(result).not.toBeNull();
      expect(result!.mape).toBeGreaterThan(0);
      expect(result!.mape).toBeLessThan(10);
    });

    it('should compute MAPE of 0 for perfect predictions', async () => {
      const id = await logPrediction({
        modelId: 'test-model-perfect',
        commodityId: 'test-commodity-perfect',
        timeseriesPath: 'root.test.perfect.price',
        horizon: 3,
        predictedValues: [100, 200, 300],
      });

      const result = await verifyPrediction(id, [100, 200, 300]);
      expect(result!.mape).toBe(0);
    });

    it('should return null for non-existent prediction', async () => {
      const result = await verifyPrediction('nonexistent-id', [100]);
      expect(result).toBeNull();
    });

    it('should handle predictions with bounds and confidence', async () => {
      const id = await logPrediction({
        modelId: 'test-model-bounds',
        commodityId: 'test-commodity-bounds',
        timeseriesPath: 'root.test.bounds.price',
        horizon: 10,
        predictedValues: [100, 102, 104, 106, 108],
        lowerBounds: [95, 97, 99, 101, 103],
        upperBounds: [105, 107, 109, 111, 113],
        confidence: 0.85,
      });

      expect(id).toBeDefined();

      const result = await verifyPrediction(id, [101, 103, 105, 107, 109]);
      expect(result).not.toBeNull();
      expect(result!.mape).toBeGreaterThan(0);
    });
  });

  describe('getModelAccuracy', () => {
    it('should return accuracy structure', async () => {
      const accuracy = await getModelAccuracy('test-model-mape');
      expect(accuracy).toBeDefined();
      expect(accuracy).toHaveProperty('modelId');
      expect(accuracy).toHaveProperty('avgMape');
      expect(accuracy).toHaveProperty('predictionCount');
      expect(accuracy).toHaveProperty('verifiedCount');
    });
  });

  describe('getAllModelAccuracy', () => {
    it('should return array of model accuracies', async () => {
      const all = await getAllModelAccuracy();
      expect(Array.isArray(all)).toBe(true);
    });
  });
});
