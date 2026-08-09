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
	markUnverifiablePredictions,
	restorePostFixConflictPredictions,
	restoreVerifiablePredictions,
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
		if (!ctx.available)
			throw new Error(
				"mapeTracking: integration suite requires PostgreSQL+Redis. Start them (docker-compose up) or run only unit tests — a silent skip would report false-green.",
			);
	});

	afterAll(async () => {
		await destroyTestContext(ctx);
	});

	beforeEach(() => {});

	describe("logPrediction + verifyPrediction", () => {
		// These cases log under literal "test-commodity-*" commodityIds (no
		// ctx.prefix), so destroyTestContext's prefix sweep does NOT reclaim
		// them. Without this afterEach they leak into production
		// prediction_logs after every test run — the root cause of the
		// test-artifact pollution fixed in Layer 1-3 (see KNOWN-ISSUES).
		// deleteMany is idempotent and cheap; the EXCLUDE_TEST_ARTIFACTS filter
		// in getModelAccuracy is the read-side defense, but this stops the
		// pollution at the source.
		afterEach(async () => {
			try {
				await ctx.prisma.predictionLog.deleteMany({
					where: { commodityId: { startsWith: "test-commodity-" } },
				});
			} catch {
				/* best-effort cleanup */
			}
		});

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
		// Self-contained fixture: create + verify a row in this scope, then
		// clean it up. Previously these tests read LEAKED rows from prior runs
		// (commodityId "test-commodity-mape"), which (a) polluted production
		// prediction_logs and (b) made the test depend on stale state. The
		// EXCLUDE_TEST_ARTIFACTS filter in getModelAccuracy now rejects any
		// commodityId containing "test" (case-insensitive), so a fixture with a
		// "test" token would be filtered out and the assertions would fail.
		// Using a ctx.prefix-derived commodityId keeps the fixture counted AND
		// lets destroyTestContext clean it up centrally (no per-test cleanup).
		// NB: derived inside each test (not at describe-body top level) because
		// ctx is assigned in beforeAll, which runs AFTER collection — reading
		// ctx.prefix at module-load time throws "Cannot read 'prefix' of
		// undefined".
		const fx = () => ({
			model: `${ctx.prefix}-fx-model`,
			commodity: `${ctx.prefix}-fx-commodity`,
		});
		let fxLogId: string | undefined;

		afterEach(async () => {
			// Defensive local cleanup in addition to destroyTestContext's
			// prefix-based sweep, so a failure mid-suite doesn't leak between
			// the getModelAccuracy cases (they share the fx commodity).
			if (!ctx?.available || !fxLogId) return;
			try {
				await ctx.prisma.predictionLog.deleteMany({
					where: { commodityId: { startsWith: `${ctx.prefix}-fx-` } },
				});
			} catch {
				/* best-effort cleanup */
			}
			fxLogId = undefined;
		});

		it("should return accuracy structure", async () => {
			const { model, commodity } = fx();
			fxLogId = await logPrediction({
				modelId: model,
				commodityId: commodity,
				timeseriesPath: "root.fx.accuracy",
				horizon: 3,
				predictedValues: [100, 110, 120],
			});
			await verifyPrediction(fxLogId, [105, 112, 122]);

			const accuracy = await getModelAccuracy(model);
			expect(accuracy).toBeDefined();
			expect(accuracy.modelId).toBe(model);
			expect(accuracy).toHaveProperty("avgMape");
			expect(accuracy).toHaveProperty("predictionCount");
			expect(accuracy).toHaveProperty("verifiedCount");
		});

		// REGRESSION: lastVerifiedAt is the freshness signal the accuracy
		// comparison page needs to distinguish a frozen historical MAPE from an
		// actively-verified model. It must be present (null only when there are
		// zero verified rows) and, when verified rows exist, be an ISO timestamp.
		it("exposes lastVerifiedAt as a freshness signal (ISO string when verified rows exist)", async () => {
			const { model, commodity } = fx();
			fxLogId = await logPrediction({
				modelId: model,
				commodityId: commodity,
				timeseriesPath: "root.fx.freshness",
				horizon: 3,
				predictedValues: [100, 110, 120],
			});
			await verifyPrediction(fxLogId, [105, 112, 122]);

			const accuracy = await getModelAccuracy(model);
			expect(accuracy).toHaveProperty("lastVerifiedAt");
			// The fixture row we just verified is counted, so this must be a
			// parseable ISO timestamp, not null.
			expect(accuracy.lastVerifiedAt).not.toBeNull();
			expect(() => new Date(accuracy.lastVerifiedAt as string).getTime()).not.toThrow();
		});

		// DEFENSE: the EXCLUDE_TEST_ARTIFACTS filter must keep test-fixture
		// pollution out of production accuracy reads. A row whose commodityId
		// contains "test" (any case) must NOT be counted even when verified.
		it("excludes verified rows whose commodityId contains 'test' (test-artifact pollution defense)", async () => {
			// Seed a verified row under a TEST-bearing commodityId using a
			// distinct model so it can't bleed into other cases. The commodityId
			// is prefixed with ctx.prefix so destroyTestContext reclaims it even
			// if this test errors before its own cleanup runs.
			const polluteModel = `${ctx.prefix}-fx-pollute`;
			const polluteCommodity = `${ctx.prefix}-test-pollution-guard`;
			const id = await logPrediction({
				modelId: polluteModel,
				commodityId: polluteCommodity,
				timeseriesPath: "root.fx.pollute",
				horizon: 3,
				predictedValues: [100, 110, 120],
			});
			await verifyPrediction(id, [105, 112, 122]);
			try {
				const accuracy = await getModelAccuracy(polluteModel);
				// The verified row exists in the table …
				const rawCount = await ctx.prisma.predictionLog.count({
					where: { modelId: polluteModel, status: "verified" },
				});
				expect(rawCount).toBeGreaterThanOrEqual(1);
				// … but the accuracy read must exclude it (verifiedCount 0,
				// avgMape null) because the commodityId bears "test".
				expect(accuracy.verifiedCount).toBe(0);
				expect(accuracy.avgMape).toBeNull();
			} finally {
				await ctx.prisma.predictionLog.deleteMany({
					where: { commodityId: polluteCommodity },
				});
			}
		});
	});

	describe("getAllModelAccuracy", () => {
		it("should return array of model accuracies", async () => {
			const all = await getAllModelAccuracy();
			expect(Array.isArray(all)).toBe(true);
		});

		// REGRESSION: getAllModelAccuracy must forward last7dMape/last30dMape/
		// lastVerifiedAt (previously dropped at this boundary) and tag each row
		// with isPrimary so the comparison page can split the chronos ensemble
		// (primary consensus) from statistical baselines. chronos_* → true,
		// everything else → false.
		it("forwards freshness fields + isPrimary role tag per model", async () => {
			const all = await getAllModelAccuracy();
			expect(all.length).toBeGreaterThan(0);
			for (const row of all) {
				expect(row).toHaveProperty("last7dMape");
				expect(row).toHaveProperty("last30dMape");
				expect(row).toHaveProperty("lastVerifiedAt");
				expect(row).toHaveProperty("isPrimary");
				expect(typeof row.isPrimary).toBe("boolean");
				// chronos ensemble is the primary consensus; stats are baselines.
				expect(row.isPrimary).toBe(row.modelId.startsWith("chronos_"));
			}
			// The primary chronos models must be present and tagged true.
			const chronos = all.filter((r) => r.modelId.startsWith("chronos_"));
			expect(chronos.length).toBeGreaterThan(0);
			expect(chronos.every((r) => r.isPrimary)).toBe(true);
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

		// REGRESSION (round-86): cut MAPE actuals must exclude bridge:commodity:*
		// proxy rows. The training side (getBeefCutSeries) defaults to
		// includeBridge=false; without the matching read-side filter, a cut
		// forecast trained on real scraper rows got "verified" against bridge
		// proxies (a carcass aggregate copied in by beefPriceBridge) — the cut
		// analog of the brl_usd authoritative-source bug.
		it("excludes bridge: source rows when reading cut actuals", async () => {
			const prisma = ctx.prisma;
			const suffix = `${ctx.prefix}-cutbridge`;

			const factory = await prisma.factory.create({
				data: { code: `FBG-${suffix}`, name: `Test ${suffix}`, country: "BR" },
			});
			const cutCode = `BRGECUT_${suffix.toUpperCase()}`;
			try {
				await prisma.beefCutTaxonomy.upsert({
					where: { cutCode },
					update: {},
					create: { cutCode, nameEn: `Bridge Cut ${suffix}`, primal: "Test" },
				});

				const predictedAt = new Date(Date.now() - 365 * 86400000);
				const cutKey = `cut:${factory.id}:${cutCode}`;
				// Prediction of a flat 10.0 across horizon 3.
				const log = await prisma.predictionLog.create({
					data: {
						modelId: "chronos_tiny",
						commodityId: cutKey,
						timeseriesPath: cutKey,
						horizon: 3,
						predictedValues: [10.0, 10.0, 10.0],
						status: "completed",
						predictedAt,
					},
				});

				// Real scraper rows at 10.5 (5% off prediction → MAPE 5%).
				for (let i = 0; i < 3; i++) {
					await prisma.beefCutPrice.create({
						data: {
							factoryId: factory.id,
							cutCode,
							price: 10.5,
							source: `test-real-${suffix}`,
							date: new Date(predictedAt.getTime() + (i + 1) * 86400000),
						},
					});
				}
				// Bridge proxy rows at 50.0 (a carcass aggregate, 400% off). If
				// these leak into actuals, MAPE would be ~400% instead of ~5%.
				for (let i = 0; i < 3; i++) {
					await prisma.beefCutPrice.create({
						data: {
							factoryId: factory.id,
							cutCode,
							price: 50.0,
							source: `bridge:commodity:fake-${suffix}`,
							date: new Date(predictedAt.getTime() + (i + 1) * 86400000),
						},
					});
				}

				await verifyDuePredictions();

				const verified = await prisma.predictionLog.findUnique({
					where: { id: log.id },
					select: { status: true, mape: true, actualValues: true },
				});
				expect(verified?.status).toBe("verified");
				// Actuals must be the 10.5 real rows, not the 50.0 bridge proxies.
				expect(verified?.actualValues).toEqual([10.5, 10.5, 10.5]);
				// MAPE ≈ 5% (|10.5-10.0|/10.5 * 100), NOT ~400% from bridge rows.
				expect(verified?.mape?.toNumber()).toBeLessThan(10);
			} finally {
				await prisma.beefCutPrice.deleteMany({
					where: { source: { startsWith: `test-real-${suffix}` } },
				});
				await prisma.beefCutPrice.deleteMany({
					where: { source: `bridge:commodity:fake-${suffix}` },
				});
				await prisma.predictionLog.deleteMany({
					where: { commodityId: { startsWith: `cut:${factory.id}:` } },
				});
				await prisma.beefCutTaxonomy.deleteMany({ where: { cutCode } });
				await prisma.factory.deleteMany({ where: { code: `FBG-${suffix}` } });
			}
		});

		// ─── Shared helpers for the conflict-prediction tests below ────────────
		// Both invalidatePollutedPredictions and restorePostFixConflictPredictions
		// seed rows against the seeded brl_usd commodity (a known conflict slug)
		// and clean them up afterward. These helpers absorb the repeated
		// findUnique(brl_usd) + create(predictionLog) + finally-deleteMany
		// scaffolding that the 5 tests below hand-rolled. Behaviour unchanged.
		const FIXED_AT = new Date("2026-07-27T11:26:00Z"); // round-41 authoritative-source fix timestamp

		async function getBrlUsdId(): Promise<string | null> {
			const brl = await ctx.prisma.commodity.findUnique({
				where: { slug: "brl_usd" },
				select: { id: true },
			});
			return brl?.id ?? null; // null → seed absent in this env → caller skips cleanly
		}

		// Seed a throwaway prediction_log row against a commodity. Common defaults
		// (horizon=5, predictedValues=[1,2,3]) match what every test below used.
		async function seedConflictRow(opts: {
			commodityId: string;
			modelId: string;
			status: "completed" | "stale" | "verified";
			predictedAt: Date;
			predictedValues?: number[];
			mape?: number;
			actualValues?: number[];
			verifiedAt?: Date;
		}) {
			return ctx.prisma.predictionLog.create({
				data: {
					modelId: opts.modelId,
					commodityId: opts.commodityId,
					horizon: 5,
					predictedValues: opts.predictedValues ?? [1, 2, 3],
					status: opts.status,
					predictedAt: opts.predictedAt,
					...(opts.mape != null ? { mape: opts.mape } : {}),
					...(opts.actualValues ? { actualValues: opts.actualValues } : {}),
					...(opts.verifiedAt ? { verifiedAt: opts.verifiedAt } : {}),
				},
			});
		}

		// Clean up the rows a test created (prediction_logs always; commodities
		// only when the test made a throwaway non-conflict commodity). Mirrors the
		// cleanup pattern already used by markUnverifiablePredictions' helper.
		async function cleanupConflictRows(ids: string[], commodityIds: string[] = []) {
			if (ids.length) await ctx.prisma.predictionLog.deleteMany({ where: { id: { in: ids } } });
			if (commodityIds.length) {
				await ctx.prisma.commodityPrice.deleteMany({
					where: { commodityId: { in: commodityIds } },
				});
				await ctx.prisma.commodity.deleteMany({ where: { id: { in: commodityIds } } });
			}
		}

		describe("invalidatePollutedPredictions — mark pre-fix conflict-commodity predictions stale", () => {
			// REGRESSION (round-46): brl_usd / corn_cme / natural_gas_cme predictions
			// made BEFORE round-41's authoritative-source fix trained on conflicting-
			// unit data. Verifying them injects bogus ~96% MAPE into the accuracy
			// averages. invalidatePollutedPredictions marks them 'stale' so they're
			// excluded from accuracy math. Post-fix predictions for the same
			// commodities stay 'completed' and verify normally.
			it("marks pre-fix predictions for conflict commodities as stale, leaves post-fix and clean-commodity rows untouched", async () => {
				const prisma = ctx.prisma;
				const brlId = await getBrlUsdId();
				if (!brlId) return; // seed absent in this env — skip cleanly

				const before = new Date("2026-07-15T00:00:00Z"); // pre-fix (polluted)
				const after = new Date("2026-07-28T00:00:00Z"); // post-fix (clean)

				// Polluted: conflict commodity, pre-fix.
				const polluted = await seedConflictRow({
					commodityId: brlId,
					modelId: "test-polluted",
					status: "completed",
					predictedAt: before,
				});
				// Post-fix: same commodity, after the fix — must NOT be marked stale.
				const clean = await seedConflictRow({
					commodityId: brlId,
					modelId: "test-clean-postfix",
					status: "completed",
					predictedAt: after,
					predictedValues: [5, 5, 5],
				});
				// Verified-but-polluted: pre-fix prediction ALREADY verified against
				// the wrong source (bogus ~96% MAPE). Must ALSO be marked stale —
				// otherwise it poisons accuracy averages (round-46 follow-up).
				const verifiedPolluted = await seedConflictRow({
					commodityId: brlId,
					modelId: "test-verified-polluted",
					status: "verified",
					predictedAt: before,
					predictedValues: [0.2, 0.2, 0.2],
					actualValues: [5.1, 5.1, 5.1],
					mape: 96.2,
					verifiedAt: before,
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
				const unrelated = await seedConflictRow({
					commodityId: otherCommodity.id,
					modelId: "test-unrelated",
					status: "completed",
					predictedAt: before,
				});

				try {
					const marked = await invalidatePollutedPredictions(FIXED_AT);
					// At least the one polluted row was marked.
					expect(marked).toBeGreaterThanOrEqual(1);

					const statuses = await prisma.predictionLog.findMany({
						where: { id: { in: [polluted.id, verifiedPolluted.id, clean.id, unrelated.id] } },
						select: { id: true, status: true },
					});
					const statusOf = (id: string) => statuses.find((r) => r.id === id)?.status;
					expect(statusOf(polluted.id)).toBe("stale");
					expect(statusOf(verifiedPolluted.id)).toBe("stale"); // verified-polluted also cleared
					expect(statusOf(clean.id)).toBe("completed"); // post-fix survives
					expect(statusOf(unrelated.id)).toBe("completed"); // non-conflict survives
				} finally {
					await cleanupConflictRows(
						[polluted.id, verifiedPolluted.id, clean.id, unrelated.id],
						[otherCommodity.id],
					);
				}
			});

			it("is idempotent — running twice does not change already-stale rows or count them again", async () => {
				const brlId = await getBrlUsdId();
				if (!brlId) return;

				const before = new Date("2026-07-10T00:00:00Z");
				const row = await seedConflictRow({
					commodityId: brlId,
					modelId: "test-idempotent",
					status: "completed",
					predictedAt: before,
				});
				try {
					const first = await invalidatePollutedPredictions(FIXED_AT);
					const second = await invalidatePollutedPredictions(FIXED_AT);
					// Second run finds nothing new (row already 'stale', not 'completed').
					expect(second).toBeLessThan(first);
					const after = await ctx.prisma.predictionLog.findUnique({
						where: { id: row.id },
						select: { status: true },
					});
					expect(after?.status).toBe("stale");
				} finally {
					await cleanupConflictRows([row.id]);
				}
			});

			it("returns 0 on the no-op path (fixedAt before any prediction)", async () => {
				// The contract: invalidatePollutedPredictions marks rows with
				// predictedAt < fixedAt. With fixedAt at the Unix epoch, NOTHING is
				// older → the update matches 0 rows regardless of seed state.
				// (The previous version used a far-FUTURE cutoff, which on the real
				// DB matched every conflict-commodity row and flaked against the
				// `expect 0` assertion. An epoch cutoff is the true no-op.)
				const n = await invalidatePollutedPredictions(new Date("1970-01-01T00:00:00Z"));
				expect(n).toBe(0);
			});
		});

		describe("restorePostFixConflictPredictions — recover mis-staled post-fix rows", () => {
			// REGRESSION (round-58): a historical run left ~531 post-fix chronos
			// predictions for the 3 conflict commodities stuck at status='stale'
			// even though they trained on the authoritative-source-filtered series.
			// Once stale, verifyDuePredictions (which reads status='completed')
			// never reclaimed them, so brl_usd / corn_cme / natural_gas_cme accuracy
			// never populated. restorePostFixConflictPredictions is the symmetric
			// inverse of invalidatePollutedPredictions: stale→completed ONLY for
			// predictedAt >= fixedAt on conflict slugs.
			it("restores post-fix stale rows to completed but leaves pre-fix stale rows stale", async () => {
				const prisma = ctx.prisma;
				const brlId = await getBrlUsdId();
				if (!brlId) return; // seed absent — skip cleanly

				const before = new Date("2026-07-15T00:00:00Z"); // pre-fix (genuinely polluted)
				const after = new Date("2026-07-28T00:00:00Z"); // post-fix (mis-staled)

				// Pre-fix row — was legitimately staled; must STAY stale.
				const preFix = await seedConflictRow({
					commodityId: brlId,
					modelId: "test-restore-prefix",
					status: "stale",
					predictedAt: before,
				});
				// Post-fix row — mis-staled; must be restored to completed.
				const postFix = await seedConflictRow({
					commodityId: brlId,
					modelId: "test-restore-postfix",
					status: "stale",
					predictedAt: after,
				});

				try {
					const restored = await restorePostFixConflictPredictions(FIXED_AT);
					// At least the postFix row should be counted.
					expect(restored).toBeGreaterThanOrEqual(1);

					const [preAfter, postAfter] = await prisma.predictionLog
						.findMany({
							where: { id: { in: [preFix.id, postFix.id] } },
							select: { id: true, status: true },
						})
						.then((rows) => [
							rows.find((r) => r.id === preFix.id)?.status,
							rows.find((r) => r.id === postFix.id)?.status,
						]);
					// Pre-fix stays stale (genuinely polluted, unrecoverable).
					expect(preAfter).toBe("stale");
					// Post-fix is restored to completed so verifyDuePredictions can pick it up.
					expect(postAfter).toBe("completed");
				} finally {
					await cleanupConflictRows([preFix.id, postFix.id]);
				}
			});

			it("is idempotent — a second run restores nothing", async () => {
				// First run restores whatever is mis-staled; second run must find
				// nothing (rows already completed, not stale).
				await restorePostFixConflictPredictions(FIXED_AT);
				const second = await restorePostFixConflictPredictions(FIXED_AT);
				expect(second).toBe(0);
			});
		});

		describe("markUnverifiablePredictions — drain frozen-commodity backlog", () => {
			// round-62: ~92k completed predictions for commodities whose data
			// source died months ago were re-read every 6h verify cycle and
			// always failed no-actuals. markUnverifiablePredictions detects them
			// (due + commodity has no post-prediction daily price) and marks
			// `unverifiable` so they exit the verifyDuePredictions queue.
			//
			// These tests create throwaway commodities with controlled price
			// history to simulate frozen vs fresh. Cleanup is per-test in finally.
			// NOTE: ctx.prisma is referenced inside each it/helper, not at
			// describe-body top level — ctx is only populated in beforeAll, which
			// runs after describe-body evaluation.

			// Helper: create a throwaway commodity + a prediction at a given date.
			async function makeCommodityWithPrediction(opts: {
				slug: string;
				predictedAt: Date;
				horizon?: number;
				// If provided, insert ONE daily price row at this date (simulates
				// the commodity's latest price). Omit → commodity has no prices.
				latestPriceDate?: Date;
			}) {
				const prisma = ctx.prisma;
				const commodity = await prisma.commodity.create({
					data: {
						id: `${ctx.prefix}-${opts.slug}`,
						slug: `${ctx.prefix}-${opts.slug}`,
						name: opts.slug,
						category: "test",
						unit: "USD",
						currency: "USD",
					},
				});
				if (opts.latestPriceDate) {
					await prisma.commodityPrice.create({
						data: {
							commodityId: commodity.id,
							date: opts.latestPriceDate,
							interval: "daily",
							close: 1,
							source: "test",
						},
					});
				}
				const prediction = await prisma.predictionLog.create({
					data: {
						modelId: "test-unverifiable",
						commodityId: commodity.id,
						horizon: opts.horizon ?? 10,
						predictedValues: [1, 2, 3],
						status: "completed",
						predictedAt: opts.predictedAt,
					},
				});
				return { commodity, prediction };
			}

			async function cleanup(ids: { commodityId?: string; predictionId?: string }[]) {
				const prisma = ctx.prisma;
				const predictionIds = ids.map((i) => i.predictionId).filter(Boolean) as string[];
				const commodityIds = ids.map((i) => i.commodityId).filter(Boolean) as string[];
				if (predictionIds.length)
					await prisma.predictionLog.deleteMany({ where: { id: { in: predictionIds } } });
				if (commodityIds.length) {
					// delete prices first (FK), then commodities
					await prisma.commodityPrice.deleteMany({ where: { commodityId: { in: commodityIds } } });
					await prisma.commodity.deleteMany({ where: { id: { in: commodityIds } } });
				}
			}

			it("marks a due completed prediction as unverifiable when its commodity has no post-prediction prices (frozen source)", async () => {
				const prisma = ctx.prisma;
				// Prediction made 30 days ago, horizon 10 → due (30 > 10).
				// Commodity's only price is BEFORE the prediction → no actuals.
				const oldDate = new Date(Date.now() - 30 * 86400000);
				const beforePrediction = new Date(oldDate.getTime() - 86400000);
				const { commodity, prediction } = await makeCommodityWithPrediction({
					slug: "frozen",
					predictedAt: oldDate,
					latestPriceDate: beforePrediction,
				});

				try {
					const n = await markUnverifiablePredictions();
					expect(n).toBeGreaterThanOrEqual(1);

					const after = await prisma.predictionLog.findUnique({
						where: { id: prediction.id },
						select: { status: true },
					});
					expect(after?.status).toBe("unverifiable");
				} finally {
					await cleanup([{ commodityId: commodity.id, predictionId: prediction.id }]);
				}
			});

			it("leaves a verifiable prediction (commodity has post-prediction prices) as completed", async () => {
				const prisma = ctx.prisma;
				// Prediction made 30 days ago, horizon 10 → due. But commodity
				// has a price AFTER the prediction → actuals exist → NOT frozen.
				const oldDate = new Date(Date.now() - 30 * 86400000);
				const afterPrediction = new Date(oldDate.getTime() + 5 * 86400000);
				const { commodity, prediction } = await makeCommodityWithPrediction({
					slug: "fresh",
					predictedAt: oldDate,
					latestPriceDate: afterPrediction,
				});

				try {
					await markUnverifiablePredictions();

					const after = await prisma.predictionLog.findUnique({
						where: { id: prediction.id },
						select: { status: true },
					});
					expect(after?.status).toBe("completed");
				} finally {
					await cleanup([{ commodityId: commodity.id, predictionId: prediction.id }]);
				}
			});

			it("is idempotent — a second run marks nothing new", async () => {
				const prisma = ctx.prisma;
				const oldDate = new Date(Date.now() - 30 * 86400000);
				const beforePrediction = new Date(oldDate.getTime() - 86400000);
				const { commodity, prediction } = await makeCommodityWithPrediction({
					slug: "idempotent",
					predictedAt: oldDate,
					latestPriceDate: beforePrediction,
				});

				try {
					const first = await markUnverifiablePredictions();
					expect(first).toBeGreaterThanOrEqual(1);
					// Second run: the row is now unverifiable, not completed → not matched.
					const second = await markUnverifiablePredictions();
					expect(second).toBeLessThan(first);

					const after = await prisma.predictionLog.findUnique({
						where: { id: prediction.id },
						select: { status: true },
					});
					expect(after?.status).toBe("unverifiable");
				} finally {
					await cleanup([{ commodityId: commodity.id, predictionId: prediction.id }]);
				}
			});

			it("does not touch cut-series predictions (their actuals live in BeefCutPrice)", async () => {
				const prisma = ctx.prisma;
				// A cut-series key prediction that is due — must NOT be swept into
				// the commodity-frozen bucket even if it has no CommodityPrice.
				// The key MUST start with "cut:" (the real virtual-key format) so
				// the NOT startsWith("cut:") filter excludes it.
				const oldDate = new Date(Date.now() - 30 * 86400000);
				const cutKey = `cut:${ctx.prefix}-FACTEST:CUTEST`;
				const prediction = await prisma.predictionLog.create({
					data: {
						modelId: "test-unverifiable-cut",
						commodityId: cutKey,
						horizon: 10,
						predictedValues: [1, 2, 3],
						status: "completed",
						predictedAt: oldDate,
					},
				});

				try {
					await markUnverifiablePredictions();

					const after = await prisma.predictionLog.findUnique({
						where: { id: prediction.id },
						select: { status: true },
					});
					// Must remain completed — cut-series are excluded by the
					// NOT startsWith("cut:") filter and verified via BeefCutPrice.
					expect(after?.status).toBe("completed");
				} finally {
					await prisma.predictionLog.deleteMany({ where: { id: prediction.id } });
				}
			});

			it("also marks within-cutoff completed predictions when source is frozen (round-66: lagging-source gap)", async () => {
				// round-66: Pass A only scans predictedAt <= now-10d (the due
				// cutoff). Pre-P1-gate stragglers with predictedAt INSIDE that
				// window were never reached, yet their source was already dead.
				// Pass B catches them: predictedAt > cutoff, latest price <=
				// predictedAt, AND latest price < now-STALE_WINDOW_DAYS(7).
				//
				// Setup: predictedAt = now-5d (WITHIN 10d cutoff → Pass A misses),
				// latestPriceDate = now-8d (BEFORE the prediction → no actuals,
				// AND older than the 7d stale window → source confirmed dead).
				const recentDate = new Date(Date.now() - 5 * 86400000);
				const stalePriceDate = new Date(Date.now() - 8 * 86400000);
				const { commodity, prediction } = await makeCommodityWithPrediction({
					slug: "lagging-frozen",
					predictedAt: recentDate,
					latestPriceDate: stalePriceDate,
				});

				try {
					const n = await markUnverifiablePredictions();
					expect(n).toBeGreaterThanOrEqual(1);

					const after = await ctx.prisma.predictionLog.findUnique({
						where: { id: prediction.id },
						select: { status: true },
					});
					// Pass B should have drained this lagging-frozen row.
					expect(after?.status).toBe("unverifiable");
				} finally {
					await cleanup([{ commodityId: commodity.id, predictionId: prediction.id }]);
				}
			});

			it("does NOT mark a within-cutoff prediction whose source is only briefly stale (round-66 recency guard)", async () => {
				// The source-dead recency guard (< now-7d) prevents false positives
				// on commodities whose latest price is a few days old but the
				// source is still effectively alive (weekend / 1-2d lag).
				//
				// Setup: predictedAt = now-5d (within cutoff), latestPriceDate =
				// now-6d (before the prediction but only 6d old → NOT yet stale).
				// → must stay completed; Pass B's source-dead guard rejects it.
				const recentDate = new Date(Date.now() - 5 * 86400000);
				const slightlyStalePrice = new Date(Date.now() - 6 * 86400000);
				const { commodity, prediction } = await makeCommodityWithPrediction({
					slug: "briefly-stale",
					predictedAt: recentDate,
					latestPriceDate: slightlyStalePrice,
				});

				try {
					await markUnverifiablePredictions();

					const after = await ctx.prisma.predictionLog.findUnique({
						where: { id: prediction.id },
						select: { status: true },
					});
					// Source only 6d stale (< STALE_WINDOW_DAYS 7) → not confirmed
					// dead → must remain completed to give actuals a chance.
					expect(after?.status).toBe("completed");
				} finally {
					await cleanup([{ commodityId: commodity.id, predictionId: prediction.id }]);
				}
			});
		});

		describe("restoreVerifiablePredictions — reclaim falsely-unverifiable rows when source revives", () => {
			// Regression (round-71, 2026-08-03): markUnverifiablePredictions is
			// point-in-time + irreversible. beef_carcass_us had ~738 chronos
			// predictions marked unverifiable during a transient FRED data lag;
			// when FRED published the lagged rows, those predictions now HAD
			// post-prediction actuals but stayed stranded (verifyDuePredictions
			// only reads `completed`). This function reclaims them.

			async function makeUnverifiableWithPrice(opts: {
				slug: string;
				predictedAt: Date;
				latestPriceDate: Date;
			}) {
				const prisma = ctx.prisma;
				const commodity = await prisma.commodity.create({
					data: {
						id: `${ctx.prefix}-${opts.slug}`,
						slug: `${ctx.prefix}-${opts.slug}`,
						name: opts.slug,
						category: "test",
						unit: "USD",
						currency: "USD",
					},
				});
				await prisma.commodityPrice.create({
					data: {
						commodityId: commodity.id,
						date: opts.latestPriceDate,
						interval: "daily",
						close: 1,
						source: "test",
					},
				});
				// Create the prediction already in `unverifiable` state —
				// simulates a row that markUnverifiable marked during a lag.
				const prediction = await prisma.predictionLog.create({
					data: {
						modelId: "test-restore",
						commodityId: commodity.id,
						horizon: 10,
						predictedValues: [1, 2, 3],
						status: "unverifiable",
						predictedAt: opts.predictedAt,
					},
				});
				return { commodity, prediction };
			}

			async function cleanupRestore(
				ids: {
					commodityId?: string;
					predictionId?: string;
				}[],
			) {
				const prisma = ctx.prisma;
				const predictionIds = ids.map((i) => i.predictionId).filter(Boolean) as string[];
				const commodityIds = ids.map((i) => i.commodityId).filter(Boolean) as string[];
				if (predictionIds.length)
					await prisma.predictionLog.deleteMany({ where: { id: { in: predictionIds } } });
				if (commodityIds.length) {
					await prisma.commodityPrice.deleteMany({
						where: { commodityId: { in: commodityIds } },
					});
					await prisma.commodity.deleteMany({ where: { id: { in: commodityIds } } });
				}
			}

			it("restores an unverifiable row to completed when its commodity now has a post-prediction actual (source revived)", async () => {
				// Prediction at now-30d (frozen when marked). Latest price is now
				// at now-5d — NEWER than the prediction → source revived → restore.
				const predictedAt = new Date(Date.now() - 30 * 86400000);
				const revivedPriceDate = new Date(Date.now() - 5 * 86400000);
				const { commodity, prediction } = await makeUnverifiableWithPrice({
					slug: "revived",
					predictedAt,
					latestPriceDate: revivedPriceDate,
				});

				try {
					const n = await restoreVerifiablePredictions();
					expect(n).toBeGreaterThanOrEqual(1);

					const after = await ctx.prisma.predictionLog.findUnique({
						where: { id: prediction.id },
						select: { status: true },
					});
					// Revived source → row reclaims to completed (re-enters verify queue).
					expect(after?.status).toBe("completed");
				} finally {
					await cleanupRestore([{ commodityId: commodity.id, predictionId: prediction.id }]);
				}
			});

			it("does NOT restore an unverifiable row whose commodity is still genuinely frozen (latest price still ≤ prediction)", async () => {
				// Prediction at now-30d. Latest price at now-35d — OLDER than the
				// prediction → source still dead → row must stay unverifiable.
				const predictedAt = new Date(Date.now() - 30 * 86400000);
				const stillFrozenPrice = new Date(Date.now() - 35 * 86400000);
				const { commodity, prediction } = await makeUnverifiableWithPrice({
					slug: "still-frozen",
					predictedAt,
					latestPriceDate: stillFrozenPrice,
				});

				try {
					await restoreVerifiablePredictions();

					const after = await ctx.prisma.predictionLog.findUnique({
						where: { id: prediction.id },
						select: { status: true },
					});
					// Source still dead → row stays unverifiable (honest).
					expect(after?.status).toBe("unverifiable");
				} finally {
					await cleanupRestore([{ commodityId: commodity.id, predictionId: prediction.id }]);
				}
			});

			it("is idempotent — a second run restores nothing (rows already completed)", async () => {
				const predictedAt = new Date(Date.now() - 30 * 86400000);
				const revivedPriceDate = new Date(Date.now() - 5 * 86400000);
				const { commodity, prediction } = await makeUnverifiableWithPrice({
					slug: "idempotent-restore",
					predictedAt,
					latestPriceDate: revivedPriceDate,
				});

				try {
					const first = await restoreVerifiablePredictions();
					expect(first).toBeGreaterThanOrEqual(1);
					// Second run: the row is now `completed`, not `unverifiable`
					// → not in the candidate set → returns less than first.
					const second = await restoreVerifiablePredictions();
					expect(second).toBeLessThan(first);
				} finally {
					await cleanupRestore([{ commodityId: commodity.id, predictionId: prediction.id }]);
				}
			});
		});
	});
});
