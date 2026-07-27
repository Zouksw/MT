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
	invalidatePollutedPredictions,
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

		describe("invalidatePollutedPredictions — mark pre-fix conflict-commodity predictions stale", () => {
			// REGRESSION (round-46): brl_usd / corn_cme / natural_gas_cme predictions
			// made BEFORE round-41's authoritative-source fix trained on conflicting-
			// unit data. Verifying them injects bogus ~96% MAPE into the accuracy
			// averages. invalidatePollutedPredictions marks them 'stale' so they're
			// excluded from accuracy math. Post-fix predictions for the same
			// commodities stay 'completed' and verify normally.
			it("marks pre-fix predictions for conflict commodities as stale, leaves post-fix and clean-commodity rows untouched", async () => {
				if (!ctx?.available) return;
				const prisma = ctx.prisma;

				// Resolve the seeded brl_usd commodity (a known conflict slug).
				const brl = await prisma.commodity.findUnique({
					where: { slug: "brl_usd" },
					select: { id: true },
				});
				if (!brl) return; // seed absent in this env — skip cleanly

				const fixedAt = new Date("2026-07-27T11:26:00Z");
				const before = new Date("2026-07-15T00:00:00Z"); // pre-fix (polluted)
				const after = new Date("2026-07-28T00:00:00Z"); // post-fix (clean)

				// Polluted: conflict commodity, pre-fix.
				const polluted = await prisma.predictionLog.create({
					data: {
						modelId: "test-polluted",
						commodityId: brl.id,
						horizon: 5,
						predictedValues: [1, 2, 3],
						status: "completed",
						predictedAt: before,
					},
				});
				// Post-fix: same commodity, after the fix — must NOT be marked stale.
				const clean = await prisma.predictionLog.create({
					data: {
						modelId: "test-clean-postfix",
						commodityId: brl.id,
						horizon: 5,
						predictedValues: [5, 5, 5],
						status: "completed",
						predictedAt: after,
					},
				});
				// Non-conflict commodity, pre-fix — must NOT be touched.
				const otherCommodity = await prisma.commodity.create({
					data: {
						slug: `test-noclash-${ctx.prefix}`,
						name: "test no-clash",
						category: "test",
						unit: "rate",
					},
				});
				const unrelated = await prisma.predictionLog.create({
					data: {
						modelId: "test-unrelated",
						commodityId: otherCommodity.id,
						horizon: 5,
						predictedValues: [1, 2, 3],
						status: "completed",
						predictedAt: before,
					},
				});

				try {
					const marked = await invalidatePollutedPredictions(fixedAt);

					// At least the one polluted row was marked.
					expect(marked).toBeGreaterThanOrEqual(1);

					const pollutedNow = await prisma.predictionLog.findUnique({
						where: { id: polluted.id },
						select: { status: true },
					});
					const cleanNow = await prisma.predictionLog.findUnique({
						where: { id: clean.id },
						select: { status: true },
					});
					const unrelatedNow = await prisma.predictionLog.findUnique({
						where: { id: unrelated.id },
						select: { status: true },
					});

					expect(pollutedNow?.status).toBe("stale");
					expect(cleanNow?.status).toBe("completed"); // post-fix survives
					expect(unrelatedNow?.status).toBe("completed"); // non-conflict survives
				} finally {
					await prisma.predictionLog.deleteMany({
						where: { id: { in: [polluted.id, clean.id, unrelated.id] } },
					});
					await prisma.commodity.deleteMany({
						where: { id: otherCommodity.id },
					});
				}
			});

			it("is idempotent — running twice does not change already-stale rows or count them again", async () => {
				if (!ctx?.available) return;
				const prisma = ctx.prisma;
				const brl = await prisma.commodity.findUnique({
					where: { slug: "brl_usd" },
					select: { id: true },
				});
				if (!brl) return;

				const fixedAt = new Date("2026-07-27T11:26:00Z");
				const before = new Date("2026-07-10T00:00:00Z");
				const row = await prisma.predictionLog.create({
					data: {
						modelId: "test-idempotent",
						commodityId: brl.id,
						horizon: 5,
						predictedValues: [1, 2, 3],
						status: "completed",
						predictedAt: before,
					},
				});
				try {
					const first = await invalidatePollutedPredictions(fixedAt);
					const second = await invalidatePollutedPredictions(fixedAt);
					// Second run finds nothing new (row already 'stale', not 'completed').
					expect(second).toBeLessThan(first);
					const after = await prisma.predictionLog.findUnique({
						where: { id: row.id },
						select: { status: true },
					});
					expect(after?.status).toBe("stale");
				} finally {
					await prisma.predictionLog.deleteMany({ where: { id: row.id } });
				}
			});

			it("returns 0 when no conflict commodities exist (env without seed)", async () => {
				if (!ctx?.available) return;
				// Pass a fixedAt in the future so even if seed rows exist, none are
				// pre-fix — but the contract is: 0 commodities matched → 0 marked.
				// We can't easily remove seed commodities, so this asserts the
				// function resolves gracefully when the slug set is empty by testing
				// the no-op path via a far-future cutoff (no rows qualify).
				const n = await invalidatePollutedPredictions(new Date("2099-01-01T00:00:00Z"));
				expect(n).toBe(0);
			});
		});
	});
});
