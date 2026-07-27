/**
 * MAPE Tracking — Real Database Integration Tests
 *
 * Tests prediction lifecycle: log → verify → accuracy.
 * Uses createTestContext to get a prisma connected to the real DB.
 * Note: mapeTracking service functions import the global prisma singleton,
 * which in test env points to mt_test. This test verifies the service
 * logic works end-to-end against the test DB.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	getAllModelAccuracy,
	getModelAccuracy,
	logPrediction,
	verifyDuePredictions,
	verifyPrediction,
} from "@/services/mapeTracking";
import {
	createTestContext,
	destroyTestContext,
	type TestContext,
} from "@/test/helpers/testContext";

describe("MAPE Tracking (real DB)", () => {
	let ctx: TestContext;

	beforeAll(async () => {
		ctx = await createTestContext("mape");
		if (!ctx.available) return;
	});

	afterAll(async () => {
		await destroyTestContext(ctx);
	});

	beforeEach(() => {
		if (!ctx?.available) return;
	});

	describe("logPrediction + verifyPrediction", () => {
		it("should log and verify a prediction with MAPE", async () => {
			const id = await logPrediction({
				modelId: "test-model-mape",
				commodityId: "test-commodity-mape",
				timeseriesPath: "root.test.mape.price",
				horizon: 5,
				predictedValues: [100, 200, 300],
			});

			expect(id).toBeDefined();

			const result = await verifyPrediction(id, [105, 195, 310]);
			expect(result).not.toBeNull();
			expect(result?.mape).toBeGreaterThan(0);
			expect(result?.mape).toBeLessThan(10);
		});

		it("should compute MAPE of 0 for perfect predictions", async () => {
			const id = await logPrediction({
				modelId: "test-model-perfect",
				commodityId: "test-commodity-perfect",
				timeseriesPath: "root.test.perfect.price",
				horizon: 3,
				predictedValues: [100, 200, 300],
			});

			const result = await verifyPrediction(id, [100, 200, 300]);
			expect(result?.mape).toBe(0);
		});

		it("should return null for non-existent prediction", async () => {
			const result = await verifyPrediction("nonexistent-id", [100]);
			expect(result).toBeNull();
		});

		it("should handle predictions with bounds and confidence", async () => {
			const id = await logPrediction({
				modelId: "test-model-bounds",
				commodityId: "test-commodity-bounds",
				timeseriesPath: "root.test.bounds.price",
				horizon: 10,
				predictedValues: [100, 102, 104, 106, 108],
				lowerBounds: [95, 97, 99, 101, 103],
				upperBounds: [105, 107, 109, 111, 113],
				confidence: 0.85,
			});

			expect(id).toBeDefined();

			const result = await verifyPrediction(id, [101, 103, 105, 107, 109]);
			expect(result).not.toBeNull();
			expect(result?.mape).toBeGreaterThan(0);
		});
	});

	describe("getModelAccuracy", () => {
		it("should return accuracy structure", async () => {
			const accuracy = await getModelAccuracy("test-model-mape");
			expect(accuracy).toBeDefined();
			expect(accuracy).toHaveProperty("modelId");
			expect(accuracy).toHaveProperty("avgMape");
			expect(accuracy).toHaveProperty("predictionCount");
			expect(accuracy).toHaveProperty("verifiedCount");
		});
	});

	describe("getAllModelAccuracy", () => {
		it("should return array of model accuracies", async () => {
			const all = await getAllModelAccuracy();
			expect(Array.isArray(all)).toBe(true);
		});
	});

	describe("verifyDuePredictions — cut-series keys (chronos on BeefCutPrice)", () => {
		// REGRESSION: cut-series predictions are logged with a virtual
		// commodityId `cut:{factoryId}:{cutCode}`. verifyDuePredictions
		// previously read actuals ONLY from CommodityPrice, so every cut
		// prediction hit 0 actuals → chronos MAPE was never computable. This
		// test locks in the fix: actuals for a cut: key must come from
		// BeefCutPrice.
		it("verifies a cut-keyed prediction using BeefCutPrice actuals", async () => {
			if (!ctx?.available) return;

			const prisma = ctx.prisma;
			const suffix = `${ctx.prefix}-cutvfy`;

			// Create a factory + BeefCutTaxonomy row so BeefCutPrice FKs resolve.
			const factory = await prisma.factory.create({
				data: { code: `FCT-${suffix}`, name: `Test ${suffix}`, country: "BR" },
			});
			const cutCode = `TESTCUT_${suffix.toUpperCase()}`;
			try {
				await prisma.beefCutTaxonomy.upsert({
					where: { cutCode },
					update: {},
					create: {
						cutCode,
						nameEn: `Test Cut ${suffix}`,
						primal: "Test",
					},
				});

				// A prediction made 365 days ago — very old so it sorts first
				// (verifyDuePredictions processes oldest-first, take 2000) and
				// is well beyond the horizon=7 + MAX_HORIZON_DAYS=10 cutoff.
				const predictedAt = new Date(Date.now() - 365 * 86400000);
				const cutKey = `cut:${factory.id}:${cutCode}`;
				const log = await prisma.predictionLog.create({
					data: {
						modelId: "chronos_tiny",
						commodityId: cutKey,
						timeseriesPath: cutKey,
						horizon: 7,
						predictedValues: [10.0, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6],
						status: "completed",
						predictedAt,
					},
				});

				// Insert BeefCutPrice actuals dated AFTER predictedAt. These are
				// the rows verifyDuePredictions must now read for a cut: key.
				const actualPrices = [10.5, 10.6, 10.7, 10.8, 10.9, 11.0, 11.1];
				for (let i = 0; i < actualPrices.length; i++) {
					await prisma.beefCutPrice.create({
						data: {
							factoryId: factory.id,
							cutCode,
							price: actualPrices[i],
							source: `test-${suffix}`,
							date: new Date(predictedAt.getTime() + (i + 1) * 86400000),
						},
					});
				}

				// Debug: confirm the row is eligible (status completed, old enough).
				const eligibleCount = await prisma.predictionLog.count({
					where: {
						commodityId: cutKey,
						status: "completed",
						predictedAt: { lte: new Date(Date.now() - 10 * 86400000) },
					},
				});
				expect(eligibleCount).toBe(1);

				await verifyDuePredictions();

				// The prediction must now be verified with a real MAPE.
				const verified = await prisma.predictionLog.findUnique({
					where: { id: log.id },
					select: { status: true, mape: true, actualValues: true },
				});
				expect(verified?.status).toBe("verified");
				expect(verified?.mape).not.toBeNull();
				expect(verified?.actualValues).not.toBeNull();
			} finally {
				// Clean up the rows this test created (testContext doesn't cover
				// BeefCutPrice/PredictionLog/Factory).
				await prisma.beefCutPrice.deleteMany({
					where: { source: `test-${suffix}` },
				});
				await prisma.predictionLog.deleteMany({
					where: { commodityId: { startsWith: `cut:${factory.id}:` } },
				});
				await prisma.beefCutTaxonomy.deleteMany({ where: { cutCode } });
				await prisma.factory.deleteMany({ where: { code: `FCT-${suffix}` } });
			}
		});
	});
});
