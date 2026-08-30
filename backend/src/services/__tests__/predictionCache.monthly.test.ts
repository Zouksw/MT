/**
 * Monthly-cadence subscription & refresh gating (ADR-0001 ④⑤).
 *
 * Real-DB integration: covers the three pieces that admit a monthly series
 * into the prediction loop without the ~336-rows/day duplicate pathology —
 *   1. monthlyNewPointState: the "new actual point since the newest logged
 *      forecast?" predicate,
 *   2. logPrediction's monthly dedup guard (returns the existing row id
 *      instead of duplicating),
 *   3. schedulePredictionsFromPostgreSQL's monthly predicate (latest point
 *      ≤90d AND ≥3 points → subscribed as interval="monthly").
 *
 * Fixtures are throwaway commodities with controlled monthly price history;
 * cleanup deletes prices → commodity → prediction rows per test.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { logPrediction, monthlyNewPointState } from "@/services/mapeTracking";
import {
	getSubscribedCommodities,
	schedulePredictionsFromPostgreSQL,
	unsubscribeCommodity,
} from "@/services/predictionCache";
import {
	createTestContext,
	destroyTestContext,
	type TestContext,
} from "@/test/helpers/testContext";

/** UTC midnight of the first day of the month `offset` months from now. */
function monthStart(offset = 0): Date {
	const now = new Date();
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
}

async function makeMonthlyCommodity(
	ctx: TestContext,
	slug: string,
	points: Array<{ date: Date; close: number }>,
) {
	const commodity = await ctx.prisma.commodity.create({
		data: {
			id: `${ctx.prefix}-${slug}`,
			slug: `${ctx.prefix}-${slug}`,
			name: slug,
			category: "test",
			unit: "USD",
			currency: "USD",
			isActive: true,
		},
	});
	for (const p of points) {
		await ctx.prisma.commodityPrice.create({
			data: {
				commodityId: commodity.id,
				date: p.date,
				interval: "monthly",
				close: p.close,
				source: "test",
			},
		});
	}
	return commodity;
}

async function cleanupCommodity(ctx: TestContext, commodityId: string) {
	await ctx.prisma.predictionLog.deleteMany({ where: { commodityId } });
	await ctx.prisma.commodityPrice.deleteMany({ where: { commodityId } });
	await ctx.prisma.commodity.deleteMany({ where: { id: commodityId } });
}

describe("Monthly cadence — subscription & refresh gating (ADR-0001)", () => {
	let ctx: TestContext;

	beforeAll(async () => {
		ctx = await createTestContext("monthly-cache");
		if (!ctx.available)
			throw new Error(
				"predictionCache.monthly: integration suite requires PostgreSQL+Redis. Start them or run only unit tests — a silent skip would report false-green.",
			);
	});

	afterAll(async () => {
		await destroyTestContext(ctx);
	});

	describe("monthlyNewPointState", () => {
		it("reports hasNewPoint=true when nothing is logged yet (first prediction always logs)", async () => {
			const c = await makeMonthlyCommodity(ctx, "pred-empty", [
				{ date: monthStart(0), close: 100 },
			]);
			try {
				const state = await monthlyNewPointState(c.id);
				expect(state).toEqual({ hasNewPoint: true, newestRowId: null });
			} finally {
				await cleanupCommodity(ctx, c.id);
			}
		});

		it("reports hasNewPoint=false while the latest actual predates the newest forecast's first step", async () => {
			const c = await makeMonthlyCommodity(ctx, "pred-stable", [
				{ date: monthStart(-2), close: 100 },
				{ date: monthStart(-1), close: 101 },
				{ date: monthStart(0), close: 102 },
			]);
			try {
				// Forecast made off the monthStart(0) point → first step is
				// monthStart(+1). The newest actual (monthStart(0)) predates it →
				// every model would retrain on identical data.
				const row = await ctx.prisma.predictionLog.create({
					data: {
						modelId: "monthly-pred-test",
						commodityId: c.id,
						horizon: 10,
						predictedValues: [1, 2, 3],
						status: "completed",
						forecastStartAt: monthStart(1),
						interval: "monthly",
					},
				});
				const state = await monthlyNewPointState(c.id);
				expect(state.hasNewPoint).toBe(false);
				expect(state.newestRowId).toBe(row.id);
			} finally {
				await cleanupCommodity(ctx, c.id);
			}
		});

		it("flips to hasNewPoint=true once an actual lands at/after the forecast's first step", async () => {
			const c = await makeMonthlyCommodity(ctx, "pred-grow", [
				{ date: monthStart(-1), close: 100 },
				{ date: monthStart(0), close: 101 },
			]);
			try {
				await ctx.prisma.predictionLog.create({
					data: {
						modelId: "monthly-pred-test",
						commodityId: c.id,
						horizon: 10,
						predictedValues: [1, 2, 3],
						status: "completed",
						forecastStartAt: monthStart(1),
						interval: "monthly",
					},
				});
				expect((await monthlyNewPointState(c.id)).hasNewPoint).toBe(false);
				// New monthly point lands (the one the forecast was FOR):
				await ctx.prisma.commodityPrice.create({
					data: {
						commodityId: c.id,
						date: monthStart(1),
						interval: "monthly",
						close: 103,
						source: "test",
					},
				});
				expect((await monthlyNewPointState(c.id)).hasNewPoint).toBe(true);
			} finally {
				await cleanupCommodity(ctx, c.id);
			}
		});
	});

	describe("logPrediction monthly dedup guard (ADR-0001 ④)", () => {
		it("returns the existing row id on a no-new-point re-log, and logs a fresh row once a new point lands", async () => {
			const c = await makeMonthlyCommodity(ctx, "dedup", [
				{ date: monthStart(-1), close: 100 },
				{ date: monthStart(0), close: 101 },
			]);
			try {
				const base = {
					modelId: "monthly-dedup-test",
					commodityId: c.id,
					horizon: 10,
					predictedValues: [1, 2, 3],
					forecastStartAt: monthStart(1),
					interval: "monthly" as const,
				};
				const id1 = await logPrediction(base);
				// Same training data (latest actual monthStart(0) < first step
				// monthStart(1)) → dedup, not a duplicate row.
				const id2 = await logPrediction(base);
				expect(id2).toBe(id1);
				expect(await ctx.prisma.predictionLog.count({ where: { commodityId: c.id } })).toBe(1);

				// A new actual point arrives → next log is a genuinely new row.
				await ctx.prisma.commodityPrice.create({
					data: {
						commodityId: c.id,
						date: monthStart(1),
						interval: "monthly",
						close: 103,
						source: "test",
					},
				});
				const id3 = await logPrediction(base);
				expect(id3).not.toBe(id1);
				expect(await ctx.prisma.predictionLog.count({ where: { commodityId: c.id } })).toBe(2);
			} finally {
				await cleanupCommodity(ctx, c.id);
			}
		});

		it("does not guard daily-cadence rows (identical params re-log, as today)", async () => {
			const c = await makeMonthlyCommodity(ctx, "daily-nodedup", [
				{ date: monthStart(0), close: 100 },
			]);
			try {
				const base = {
					modelId: "daily-nodedup-test",
					commodityId: c.id,
					horizon: 10,
					predictedValues: [1, 2, 3],
				};
				const id1 = await logPrediction(base);
				const id2 = await logPrediction(base);
				expect(id2).not.toBe(id1); // daily path keeps unconditional create
				expect(await ctx.prisma.predictionLog.count({ where: { commodityId: c.id } })).toBe(2);
			} finally {
				await cleanupCommodity(ctx, c.id);
			}
		});

		it("批0c: the dedup guard is per (model × horizon) — horizon 1 and 3 both log on the same training state", async () => {
			// Monthly series subscribe [1, 3] months (cadence.forecastHorizons).
			// The pre-批0c guard keyed on (commodity, model) only, so after the
			// horizon-1 row landed, the horizon-3 log of the SAME training state
			// was swallowed as a "duplicate" — the horizon-3 verification window
			// would never open.
			const c = await makeMonthlyCommodity(ctx, "multih", [
				{ date: monthStart(-1), close: 100 },
				{ date: monthStart(0), close: 101 },
			]);
			try {
				const base = {
					modelId: "monthly-multih-test",
					commodityId: c.id,
					predictedValues: [1, 2, 3],
					forecastStartAt: monthStart(1),
					interval: "monthly" as const,
				};
				const h1 = await logPrediction({ ...base, horizon: 1 });
				const h3 = await logPrediction({ ...base, horizon: 3 });
				expect(h3).not.toBe(h1); // distinct horizons are distinct rows
				expect(await ctx.prisma.predictionLog.count({ where: { commodityId: c.id } })).toBe(2);

				// Same horizon re-log on unchanged data still dedups per horizon.
				const h1again = await logPrediction({ ...base, horizon: 1 });
				expect(h1again).toBe(h1);
				expect(await ctx.prisma.predictionLog.count({ where: { commodityId: c.id } })).toBe(2);

				// The guard's horizon dimension is observable via
				// monthlyNewPointState: horizon 1 has a row anchored at M+1
				// (no new point since), horizon 10 has no rows (new point).
				expect((await monthlyNewPointState(c.id, "monthly-multih-test", 1)).hasNewPoint).toBe(
					false,
				);
				expect((await monthlyNewPointState(c.id, "monthly-multih-test", 10)).hasNewPoint).toBe(
					true,
				);
			} finally {
				await cleanupCommodity(ctx, c.id);
			}
		});
	});

	describe("schedulePredictionsFromPostgreSQL monthly predicate (ADR-0001 ⑤)", () => {
		it("subscribes a healthy monthly series (latest ≤90d, ≥3 points) and skips stale/thin ones", async () => {
			// Healthy: latest point ~30d old (inside the 90d window), 4 points.
			const healthy = await makeMonthlyCommodity(ctx, "sched-healthy", [
				{ date: monthStart(-3), close: 100 },
				{ date: monthStart(-2), close: 101 },
				{ date: monthStart(-1), close: 102 },
				{ date: monthStart(0), close: 103 },
			]);
			// Stale: latest ~120d old (> 90d staleness window) despite 4 points.
			const stale = await makeMonthlyCommodity(ctx, "sched-stale", [
				{ date: monthStart(-6), close: 100 },
				{ date: monthStart(-5), close: 101 },
				{ date: monthStart(-4), close: 102 },
				{ date: monthStart(-3), close: 103 },
			]);
			// Thin: latest point fresh but only 2 points total.
			const thin = await makeMonthlyCommodity(ctx, "sched-thin", [
				{ date: monthStart(-1), close: 100 },
				{ date: monthStart(0), close: 101 },
			]);

			try {
				await schedulePredictionsFromPostgreSQL();
				const subscribed = getSubscribedCommodities();
				expect(subscribed).toContain(healthy.id);
				expect(subscribed).not.toContain(stale.id);
				expect(subscribed).not.toContain(thin.id);
			} finally {
				// Module state cleanup: drop the fixture from the subscription
				// map so later suites start clean.
				unsubscribeCommodity(healthy.id);
				await cleanupCommodity(ctx, healthy.id);
				await cleanupCommodity(ctx, stale.id);
				await cleanupCommodity(ctx, thin.id);
			}
		});

		it("does NOT subscribe a dual-cadence commodity (stale daily rows + monthly rows) — effective cadence is daily (round-132)", async () => {
			// Live defect this pins: the LME/world-bank group carries 180 STALE
			// daily rows alongside its monthly history. The daily loop skips
			// them (daily data >7d old), the fetcher still reads the daily rows
			// (fallback only fires on ZERO daily rows) → logs stamp 'daily' →
			// the monthly new-point guard never finds a monthly-stamped row →
			// 30-min recompute on frozen inputs (~1.9k redundant rows/series in
			// 6 days, 2026-08-24..30). The predicate must require NO daily rows.
			const dual = await makeMonthlyCommodity(ctx, "sched-dual", [
				{ date: monthStart(-2), close: 100 },
				{ date: monthStart(-1), close: 101 },
				{ date: monthStart(0), close: 102 },
			]);
			// Old daily history (way outside the 7d daily window).
			for (const d of [-30, -29, -28]) {
				await ctx.prisma.commodityPrice.create({
					data: {
						commodityId: dual.id,
						date: new Date(Date.now() + d * 86400000),
						interval: "daily",
						close: 99,
						source: "test",
					},
				});
			}
			try {
				await schedulePredictionsFromPostgreSQL();
				expect(getSubscribedCommodities()).not.toContain(dual.id);
			} finally {
				unsubscribeCommodity(dual.id);
				await cleanupCommodity(ctx, dual.id);
			}
		});

		it("evicts an existing monthly subscription whose commodity gained daily rows (self-heal, round-132)", async () => {
			// Start pure-monthly → subscribed; then (stale) daily rows appear —
			// the fetcher's effective cadence flips to daily, so the monthly sub
			// must go. Stale rows keep the daily loop out of the picture, which
			// is also the live defect's exact shape; fresh daily rows would add
			// a legitimate DAILY subscription (id-only accessor can't tell the
			// two apart, and that case is already the dual-cadence exclusion).
			const flip = await makeMonthlyCommodity(ctx, "sched-flip", [
				{ date: monthStart(-2), close: 100 },
				{ date: monthStart(-1), close: 101 },
				{ date: monthStart(0), close: 102 },
			]);
			try {
				await schedulePredictionsFromPostgreSQL();
				expect(getSubscribedCommodities()).toContain(flip.id);
				// Stale daily history lands (a dead source's rows got imported).
				for (const d of [-30, -29, -28]) {
					await ctx.prisma.commodityPrice.create({
						data: {
							commodityId: flip.id,
							date: new Date(Date.now() + d * 86400000),
							interval: "daily",
							close: 99,
							source: "test",
						},
					});
				}
				await schedulePredictionsFromPostgreSQL();
				expect(getSubscribedCommodities()).not.toContain(flip.id);
			} finally {
				unsubscribeCommodity(flip.id);
				await cleanupCommodity(ctx, flip.id);
			}
		});
	});
});
