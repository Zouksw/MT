/**
 * Monthly-cadence verification lifecycle (ADR-0001 ②) — real-DB integration.
 *
 * Pins the four sweep paths' monthly branches that the pre-ADR code broke:
 *   1. verifyDuePredictions: a matured monthly prediction verifies against
 *      MONTHLY actuals in a months-wide window (the daily-only probe used to
 *      find 0 actuals → never verified);
 *   2. markUnverifiablePredictions Pass A/B: a healthy monthly series
 *      (latest point ≤60d old) is NOT frozen (the daily-only probe used to
 *      freeze pure-monthly commodities ~10 days in — the round-129 B1
 *      blocker), while a genuinely dead one IS;
 *   3. expireWindowElapsedPredictions: monthly windows elapse in months with
 *      a 60d grace;
 *   4. restoreVerifiablePredictions → verifyDuePredictions: a backfilled
 *      monthly window revives and verifies — the full
 *      expire → backfill → restore → verified lifecycle, i.e. the batch-6b
 *      hard acceptance ("first monthly prediction reaches verified")
 *      constructed repeatably.
 *
 * Fixtures are throwaway commodities with controlled monthly histories;
 * cleanup deletes prediction rows → prices → commodity per test.
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
	expireWindowElapsedPredictions,
	markUnverifiablePredictions,
	restoreVerifiablePredictions,
	verifyDuePredictions,
} from "@/services/mapeTracking";
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

const DAY = 86400000;

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

async function makeMonthlyPrediction(
	ctx: TestContext,
	commodityId: string,
	opts: { horizon: number; forecastStartAt?: Date; predictedAt: Date; values: number[] },
) {
	return ctx.prisma.predictionLog.create({
		data: {
			modelId: "monthly-lifecycle-test",
			commodityId,
			horizon: opts.horizon,
			predictedValues: opts.values,
			status: "completed",
			predictedAt: opts.predictedAt,
			forecastStartAt: opts.forecastStartAt ?? undefined,
			interval: "monthly",
		},
	});
}

async function cleanupCommodity(ctx: TestContext, commodityId: string) {
	await ctx.prisma.predictionLog.deleteMany({ where: { commodityId } });
	await ctx.prisma.commodityPrice.deleteMany({ where: { commodityId } });
	await ctx.prisma.commodity.deleteMany({ where: { id: commodityId } });
}

describe("Monthly cadence — verification lifecycle (ADR-0001)", () => {
	let ctx: TestContext;

	beforeAll(async () => {
		ctx = await createTestContext("monthly-mape");
		if (!ctx.available)
			throw new Error(
				"mapeTracking.monthly: integration suite requires PostgreSQL+Redis. Start them or run only unit tests — a silent skip would report false-green.",
			);
	});

	afterAll(async () => {
		await destroyTestContext(ctx);
	});

	it("verifyDuePredictions verifies a matured monthly prediction against monthly actuals (perfect forecast → MAPE 0)", async () => {
		// Six monthly points M-6..M-1. The prediction was made at M-4 for the
		// M-3..M-1 steps (horizon 3) with the exact actual closes.
		const closes = [100, 101, 102, 103, 104, 105];
		const points = [-6, -5, -4, -3, -2, -1].map((m, i) => ({
			date: monthStart(m),
			close: closes[i],
		}));
		const c = await makeMonthlyCommodity(ctx, "verify", points);
		const prediction = await makeMonthlyPrediction(ctx, c.id, {
			horizon: 3,
			forecastStartAt: monthStart(-3),
			predictedAt: monthStart(-4),
			values: [103, 104, 105],
		});

		try {
			const n = await verifyDuePredictions();
			expect(n).toBeGreaterThanOrEqual(1);

			const after = await ctx.prisma.predictionLog.findUnique({
				where: { id: prediction.id },
				select: { status: true, mape: true, actualValues: true },
			});
			expect(after?.status).toBe("verified");
			expect(Number(after?.mape)).toBe(0);
			// Pairing check: actuals are the M-3..M-1 closes in order.
			expect(after?.actualValues).toEqual([103, 104, 105]);
		} finally {
			await cleanupCommodity(ctx, c.id);
		}
	});

	it("verifyDuePredictions skips a monthly row whose horizon has not matured (months, not days)", async () => {
		// Predicted 30 days ago with horizon 10 (= 10 MONTHS): the daily
		// arithmetic would call it due; monthly maturity says ~9 more months.
		const c = await makeMonthlyCommodity(ctx, "immature", [
			{ date: monthStart(-3), close: 100 },
			{ date: monthStart(-2), close: 101 },
			{ date: monthStart(-1), close: 102 },
		]);
		const prediction = await makeMonthlyPrediction(ctx, c.id, {
			horizon: 10,
			forecastStartAt: monthStart(0),
			predictedAt: new Date(Date.now() - 30 * DAY),
			values: [1, 2, 3],
		});

		try {
			await verifyDuePredictions();
			const after = await ctx.prisma.predictionLog.findUnique({
				where: { id: prediction.id },
				select: { status: true },
			});
			expect(after?.status).toBe("completed"); // not due, not verified
		} finally {
			await cleanupCommodity(ctx, c.id);
		}
	});

	it("Pass A does NOT freeze a healthy monthly series — the round-129 B1 regression (daily-only probe used to freeze pure-monthly commodities)", async () => {
		// Prediction 35d ago, horizon 1 → matured in monthly terms. Two alive
		// shapes, both wall-clock-relative so the fixture never decays past the
		// 60d window (calendar-anchored monthStart dates rotted on 2026-08-30):
		//  a) publish-lag grace — latest point 40d old (OLDER than the
		//     prediction) but still inside the 60d monthly window → alive;
		//  b) actuals arriving — latest point 30d old (NEWER than the
		//     prediction) → actuals exist after the prediction → alive.
		// The pre-ADR probe read daily prices only, found none, and marked
		// rows like these unverifiable.
		const grace = await makeMonthlyCommodity(ctx, "alive-grace", [
			{ date: new Date(Date.now() - 70 * DAY), close: 100 },
			{ date: new Date(Date.now() - 40 * DAY), close: 101 },
		]);
		const arriving = await makeMonthlyCommodity(ctx, "alive-arriving", [
			{ date: new Date(Date.now() - 70 * DAY), close: 200 },
			{ date: new Date(Date.now() - 30 * DAY), close: 201 },
		]);
		const gracePrediction = await makeMonthlyPrediction(ctx, grace.id, {
			horizon: 1,
			forecastStartAt: monthStart(0),
			predictedAt: new Date(Date.now() - 35 * DAY),
			values: [101],
		});
		const arrivingPrediction = await makeMonthlyPrediction(ctx, arriving.id, {
			horizon: 1,
			forecastStartAt: monthStart(0),
			predictedAt: new Date(Date.now() - 35 * DAY),
			values: [201],
		});

		try {
			await markUnverifiablePredictions();
			const afterGrace = await ctx.prisma.predictionLog.findUnique({
				where: { id: gracePrediction.id },
				select: { status: true },
			});
			expect(afterGrace?.status).toBe("completed");
			const afterArriving = await ctx.prisma.predictionLog.findUnique({
				where: { id: arrivingPrediction.id },
				select: { status: true },
			});
			expect(afterArriving?.status).toBe("completed");
		} finally {
			await cleanupCommodity(ctx, grace.id);
			await cleanupCommodity(ctx, arriving.id);
		}
	});

	it("Pass A freezes a monthly series whose source has been dead >60d (nothing publishable remains)", async () => {
		// Latest (and only) monthly point 100d ago (> 60d monthly window);
		// prediction 35d ago with horizon 1 (matured). No post-prediction
		// actuals can exist AND the source is confirmed dead.
		const c = await makeMonthlyCommodity(ctx, "deadA", [
			{ date: new Date(Date.now() - 100 * DAY), close: 100 },
		]);
		const prediction = await makeMonthlyPrediction(ctx, c.id, {
			horizon: 1,
			forecastStartAt: new Date(Date.now() - 35 * DAY),
			predictedAt: new Date(Date.now() - 35 * DAY),
			values: [100],
		});

		try {
			await markUnverifiablePredictions();
			const after = await ctx.prisma.predictionLog.findUnique({
				where: { id: prediction.id },
				select: { status: true },
			});
			expect(after?.status).toBe("unverifiable");
		} finally {
			await cleanupCommodity(ctx, c.id);
		}
	});

	it("Pass B uses the 60d monthly window: a ~70d-old latest point freezes, a ~30d-old one does not", async () => {
		// Both predictions are NEWER than the 10d due cutoff → only Pass B
		// can touch them. The price point predates both predictions, so the
		// only differentiator is the cadence staleness window (60d monthly).
		const deadish = await makeMonthlyCommodity(ctx, "deadB", [
			{ date: new Date(Date.now() - 70 * DAY), close: 100 },
		]);
		const deadishPrediction = await makeMonthlyPrediction(ctx, deadish.id, {
			horizon: 10,
			predictedAt: new Date(Date.now() - 5 * DAY),
			values: [1, 2, 3],
		});
		const aliveish = await makeMonthlyCommodity(ctx, "aliveB", [
			{ date: new Date(Date.now() - 30 * DAY), close: 100 },
		]);
		const aliveishPrediction = await makeMonthlyPrediction(ctx, aliveish.id, {
			horizon: 10,
			predictedAt: new Date(Date.now() - 5 * DAY),
			values: [1, 2, 3],
		});

		try {
			await markUnverifiablePredictions();
			const statuses = await ctx.prisma.predictionLog.findMany({
				where: { id: { in: [deadishPrediction.id, aliveishPrediction.id] } },
				select: { id: true, status: true },
			});
			const byId = new Map(statuses.map((s) => [s.id, s.status]));
			expect(byId.get(deadishPrediction.id)).toBe("unverifiable");
			expect(byId.get(aliveishPrediction.id)).toBe("completed");
		} finally {
			await cleanupCommodity(ctx, deadish.id);
			await cleanupCommodity(ctx, aliveish.id);
		}
	});

	it("full monthly lifecycle: expire (zombie window) → backfill → restore → verified — the batch-6b hard acceptance, repeatably", async () => {
		// Anchor M-6, horizon 3 → window [M-6, M-2). Only ONE in-window point
		// exists (M-5) — under the bar of 3 — and the window + 60d grace has
		// long elapsed → the expire sweep must drain it to unverifiable.
		const c = await makeMonthlyCommodity(ctx, "lifecycle", [
			{ date: monthStart(-7), close: 99 },
			{ date: monthStart(-5), close: 101 },
		]);
		const prediction = await makeMonthlyPrediction(ctx, c.id, {
			horizon: 3,
			forecastStartAt: monthStart(-6),
			predictedAt: monthStart(-7),
			values: [101, 102, 103],
		});

		try {
			await expireWindowElapsedPredictions();
			let row = await ctx.prisma.predictionLog.findUnique({
				where: { id: prediction.id },
				select: { status: true },
			});
			expect(row?.status).toBe("unverifiable");

			// Backfill the missing M-4 / M-3 points → the window now holds 3
			// actuals → restore revives the row, verify matures it.
			await ctx.prisma.commodityPrice.createMany({
				data: [
					{
						commodityId: c.id,
						date: monthStart(-4),
						interval: "monthly",
						close: 102,
						source: "test",
					},
					{
						commodityId: c.id,
						date: monthStart(-3),
						interval: "monthly",
						close: 103,
						source: "test",
					},
				],
			});
			const restored = await restoreVerifiablePredictions();
			expect(restored).toBeGreaterThanOrEqual(1);
			row = await ctx.prisma.predictionLog.findUnique({
				where: { id: prediction.id },
				select: { status: true },
			});
			expect(row?.status).toBe("completed");

			await verifyDuePredictions();
			row = await ctx.prisma.predictionLog.findUnique({
				where: { id: prediction.id },
				select: { status: true, mape: true, actualValues: true },
			});
			expect(row?.status).toBe("verified");
			// Forecast [101,102,103] vs actuals [M-5,M-4,M-3] = [101,102,103].
			expect(Number(row?.mape)).toBe(0);
			expect(row?.actualValues).toEqual([101, 102, 103]);
		} finally {
			await cleanupCommodity(ctx, c.id);
		}
	});
});
