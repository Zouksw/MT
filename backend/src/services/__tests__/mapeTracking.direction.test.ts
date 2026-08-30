/**
 * Direction-hit stats (round-137 批4) — read-side derivation, no schema
 * change. Two layers pinned here:
 *   1. directionVerdict (pure): backtest-aligned semantics — sign of the
 *      end-of-horizon move vs the anchor; flat (sign 0) rows are null
 *      (excluded from the denominator), never counted as misses;
 *   2. getModelDirectionStats (real-DB, mt_test): anchor = last close
 *      STRICTLY before the forecast window (cadence-matched), cut: series /
 *      array-mismatch / anchor-less rows shrink the denominator silently.
 *
 * Fixtures live under a prefix WITHOUT the "test" token on purpose: the
 * aggregation's own NOT ILIKE '%test%' guard must let them through (the
 * guard exists for OTHER suites' leaked artifacts).
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { directionVerdict, getModelDirectionStats } from "@/services/mapeTracking";
import {
	createTestContext,
	destroyTestContext,
	type TestContext,
} from "@/test/helpers/testContext";

const DAY = 86400000;

describe("directionVerdict (pure — backtest-aligned semantics)", () => {
	it("hit when predicted and actual moved the same way vs anchor", () => {
		expect(directionVerdict(105, 110, 100)).toBe(true); // both up
		expect(directionVerdict(95, 90, 100)).toBe(true); // both down
	});

	it("miss when predicted and actual disagree", () => {
		expect(directionVerdict(115, 108, 110)).toBe(false); // pred up, actual down
		expect(directionVerdict(90, 120, 110)).toBe(false); // pred down, actual up
	});

	it("flat prediction (naive repeats the anchor) is null — excluded, not a miss", () => {
		expect(directionVerdict(100, 110, 100)).toBeNull();
	});

	it("flat actual is null — no direction happened to hit", () => {
		expect(directionVerdict(110, 100, 100)).toBeNull();
	});

	it("non-finite input is null", () => {
		expect(directionVerdict(Number.NaN, 110, 100)).toBeNull();
		expect(directionVerdict(110, Number.POSITIVE_INFINITY, 100)).toBeNull();
	});
});

describe("getModelDirectionStats — real-DB read-side aggregation (批4)", () => {
	let ctx: TestContext;

	beforeAll(async () => {
		ctx = await createTestContext("direction-accuracy");
		if (!ctx.available)
			throw new Error(
				"mapeTracking.direction: integration suite requires PostgreSQL+Redis. Start them or run only unit tests — a silent skip would report false-green.",
			);
	});

	afterAll(async () => {
		if (ctx.available) {
			await ctx.prisma.commodityPrice.deleteMany({
				where: { commodityId: { startsWith: ctx.prefix } },
			});
			await ctx.prisma.commodity.deleteMany({
				where: { id: { startsWith: ctx.prefix } },
			});
		}
		await destroyTestContext(ctx);
	});

	it("derives hit/miss from end-of-horizon values vs the pre-window anchor; flat/mismatch/cut/anchor-less rows excluded", async () => {
		const modelId = `${ctx.prefix}-model`;
		const today = Date.UTC(2026, 7, 30); // fixture clock independence: relative to row dates below
		const day = (offset: number) => new Date(today - offset * DAY);

		// Daily commodity with closes A0=100 (oldest), A1=110, A2=120.
		const commodityId = `${ctx.prefix}-daily`;
		await ctx.prisma.commodity.create({
			data: {
				id: commodityId,
				slug: commodityId,
				name: "dir",
				category: "macro",
				unit: "USD",
				currency: "USD",
			},
		});
		for (const [off, close] of [
			[3, 100],
			[2, 110],
			[1, 120],
		] as const) {
			await ctx.prisma.commodityPrice.create({
				data: {
					commodityId,
					date: day(off),
					interval: "daily",
					close,
					source: "direction-test-fixture",
				},
			});
		}

		const log = (data: {
			commodityId: string;
			predictedValues: number[];
			actualValues: number[];
			forecastStartAt: Date;
			interval?: string;
		}) =>
			ctx.prisma.predictionLog.create({
				data: {
					modelId,
					status: "verified",
					verifiedAt: new Date(),
					predictedAt: data.forecastStartAt,
					horizon: 1,
					...data,
				},
			});

		// 1 HIT: window starts at A1 (anchor=A0=100); pred up, actual up.
		await log({
			commodityId,
			predictedValues: [105],
			actualValues: [110],
			forecastStartAt: day(2),
		});
		// 2 MISS: window starts at A2 (anchor=A1=110); pred up, actual down.
		await log({
			commodityId,
			predictedValues: [115],
			actualValues: [108],
			forecastStartAt: day(1),
		});
		// 3 FLAT pred (naive repeats anchor 110) — excluded from denominator.
		await log({
			commodityId,
			predictedValues: [110],
			actualValues: [120],
			forecastStartAt: day(1),
		});
		// 4 SHORT actuals (weekend-gap shape): paired at the last COMMON step
		// (index 0 here) — pred up, actual down vs anchor 110 → miss. Same
		// overlap convention MAPE scores.
		await log({
			commodityId,
			predictedValues: [112, 115],
			actualValues: [108],
			forecastStartAt: day(1),
		});
		// 5 cut: series — no anchor source, excluded.
		await log({
			commodityId: `cut:${ctx.prefix}-f1:BRISKET`,
			predictedValues: [105],
			actualValues: [110],
			forecastStartAt: day(2),
		});
		// 6 no anchor: window predates the first price point by 30d (buffer 14d).
		await log({
			commodityId,
			predictedValues: [105],
			actualValues: [110],
			forecastStartAt: day(33),
		});

		const stats = await getModelDirectionStats(modelId, commodityId, 30);
		// rows 1 (hit) + 2 (miss) + 4 (miss at the common step) judged → 1/3
		// (rate is rounded to 4dp by the implementation).
		expect(stats.directionCount).toBe(3);
		expect(stats.directionHitRate).toBeCloseTo(1 / 3, 4);
	});

	it("anchors a monthly row to the monthly close (cadence-matched anchor)", async () => {
		const modelId = `${ctx.prefix}-m-model`;
		const commodityId = `${ctx.prefix}-monthly`;
		const monthStart = (offset: number) => {
			const now = new Date();
			return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1));
		};

		await ctx.prisma.commodity.create({
			data: {
				id: commodityId,
				slug: commodityId,
				name: "dir-m",
				category: "macro",
				unit: "USD",
				currency: "USD",
			},
		});
		// Monthly closes: M-3 = 200 (anchor), M-2 = 190, M-1 = 210.
		for (const [off, close] of [
			[-3, 200],
			[-2, 190],
			[-1, 210],
		] as const) {
			await ctx.prisma.commodityPrice.create({
				data: {
					commodityId,
					date: monthStart(off),
					interval: "monthly",
					close,
					source: "direction-test-fixture",
				},
			});
		}

		// Window starts M-2 (anchor = M-3 = 200): pred up (210), actual down (190) → miss.
		await ctx.prisma.predictionLog.create({
			data: {
				modelId,
				commodityId,
				horizon: 1,
				interval: "monthly",
				predictedValues: [210],
				actualValues: [190],
				status: "verified",
				verifiedAt: new Date(),
				predictedAt: monthStart(-2),
				forecastStartAt: monthStart(-2),
			},
		});

		const stats = await getModelDirectionStats(modelId, commodityId, 30);
		expect(stats.directionCount).toBe(1);
		expect(stats.directionHitRate).toBe(0);
	});

	it("returns null rate when nothing is judgeable", async () => {
		const stats = await getModelDirectionStats(`${ctx.prefix}-empty-model`, undefined, 30);
		expect(stats.directionHitRate).toBeNull();
		expect(stats.directionCount).toBe(0);
	});
});

describe("getModelDirectionStats — provenance guards (first live run's lessons)", () => {
	let ctx: TestContext;

	beforeAll(async () => {
		ctx = await createTestContext("direction-provenance");
		if (!ctx.available)
			throw new Error(
				"mapeTracking.direction: integration suite requires PostgreSQL+Redis. Start them or run only unit tests — a silent skip would report false-green.",
			);
	});

	afterAll(async () => {
		if (ctx.available) {
			await ctx.prisma.commodityPrice.deleteMany({
				where: { commodityId: { startsWith: ctx.prefix } },
			});
			await ctx.prisma.commodity.deleteMany({
				where: { id: { startsWith: ctx.prefix } },
			});
		}
		await destroyTestContext(ctx);
	});

	it("naive_forecaster is excluded at the model level (flat by construction)", async () => {
		// Even with a PERFECT single-source anchor that the values repeat
		// exactly, naive must report no judged rows: read-side value-level
		// flatness detection is unreproducible under multi-source/backfilled
		// anchors (live proof: aud_usd 0/730 exact matches), so the rule is
		// enforced by definition — the backtest's "— (flat)" conclusion.
		const modelId = "naive_forecaster";
		const commodityId = `${ctx.prefix}-naivecom`;
		const t0 = Date.now() - 5 * DAY;
		await ctx.prisma.commodity.create({
			data: {
				id: commodityId,
				slug: commodityId,
				name: "nv",
				category: "macro",
				unit: "USD",
				currency: "USD",
			},
		});
		for (const [off, close] of [
			[2, 100],
			[1, 100],
		] as const) {
			await ctx.prisma.commodityPrice.create({
				data: {
					commodityId,
					date: new Date(t0 + off * DAY),
					interval: "daily",
					close,
					source: "provenance-fixture",
				},
			});
		}
		const start = new Date(t0 + 1 * DAY); // anchor = the 100 at t0+1d? last close < start = t0-1d... see below
		await ctx.prisma.predictionLog.create({
			data: {
				modelId,
				commodityId,
				horizon: 1,
				predictedValues: [100],
				actualValues: [110],
				status: "verified",
				verifiedAt: new Date(),
				predictedAt: start,
				forecastStartAt: start,
			},
		});
		const stats = await getModelDirectionStats(modelId, commodityId, 30);
		expect(stats.directionHitRate).toBeNull();
		expect(stats.directionCount).toBe(0);
	});

	it("excludes rows whose anchor window mixes undeclared sources (no unambiguous anchor)", async () => {
		const modelId = `${ctx.prefix}-amb-model`;
		const commodityId = `${ctx.prefix}-ambcom`;
		const t0 = Date.now() - 5 * DAY;
		await ctx.prisma.commodity.create({
			data: {
				id: commodityId,
				slug: commodityId,
				name: "amb",
				category: "macro",
				unit: "USD",
				currency: "USD",
			},
		});
		// Two sources with DIFFERENT closes on overlapping days — same shape
		// as aud_usd (fred@00:00 vs exchange_rate_api@16:00). No authority
		// mapping exists for this fixture slug → ambiguous → excluded.
		for (const [off, close, source] of [
			[2, 100, "prov-a"],
			[2.5, 105, "prov-b"], // later same-window row from another source
			[1, 110, "prov-a"],
		] as const) {
			await ctx.prisma.commodityPrice.create({
				data: {
					commodityId,
					date: new Date(t0 + off * DAY),
					interval: "daily",
					close,
					source,
				},
			});
		}
		await ctx.prisma.predictionLog.create({
			data: {
				modelId,
				commodityId,
				horizon: 1,
				predictedValues: [115],
				actualValues: [120],
				status: "verified",
				verifiedAt: new Date(),
				predictedAt: new Date(t0 + 1 * DAY),
				forecastStartAt: new Date(t0 + 1 * DAY),
			},
		});
		const stats = await getModelDirectionStats(modelId, commodityId, 30);
		expect(stats.directionHitRate).toBeNull();
		expect(stats.directionCount).toBe(0);
	});
});
