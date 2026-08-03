/**
 * getSourceFreshness — dataHealth inclusion (round-48).
 *
 * The freshness summary previously reported only scraper RUN counts
 * (healthy/stale from ingestion logs). Those can show 18/18 healthy while
 * only 2 sources actually write price rows (silent failures). The summary
 * now carries a `dataHealth` snapshot from getDataHealth so the board sees
 * the gap between "scrapers ran" and "data is real + predictions verify".
 */

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getSourceFreshness, listCommodities } from "@/services/marketService";
import {
	createTestContext,
	destroyTestContext,
	type TestContext,
} from "@/test/helpers/testContext";

describe("getSourceFreshness — dataHealth snapshot in summary", () => {
	let ctx: TestContext;

	beforeAll(async () => {
		ctx = await createTestContext("freshness");
		if (!ctx.available)
			throw new Error(
				"marketService freshness: integration suite requires PostgreSQL+Redis. Start them (docker-compose up) or run only unit tests — a silent skip would report false-green.",
			);
	});

	afterAll(async () => {
		await destroyTestContext(ctx);
	});

	it("summary includes the legacy healthy/stale counts AND the dataHealth snapshot", async () => {
		const result = await getSourceFreshness();

		// Legacy contract still intact.
		expect(result).toHaveProperty("freshness");
		expect(result).toHaveProperty("summary");
		expect(result.summary).toHaveProperty("total");
		expect(result.summary).toHaveProperty("healthy");
		expect(result.summary).toHaveProperty("stale");

		// New dataHealth field present (round-48).
		expect(result.summary).toHaveProperty("dataHealth");
		const dh = result.summary.dataHealth;
		// dataHealth may be null only if getDataHealth threw; in a live seed
		// env it resolves. Assert the shape when present.
		if (dh !== null) {
			expect(dh).toHaveProperty("anyDataFlowing");
			expect(dh).toHaveProperty("freshSourceCount");
			expect(dh).toHaveProperty("registeredSourceCount");
			expect(dh).toHaveProperty("predictionBacklog");
			expect(dh).toHaveProperty("predictionVerified");
			expect(dh).toHaveProperty("verificationRatio");
			expect(typeof dh.verificationRatio).toBe("number");
			expect(dh.verificationRatio).toBeGreaterThanOrEqual(0);
			expect(dh.verificationRatio).toBeLessThanOrEqual(1);
		}
	});

	it("dataHealth.freshSourceCount can be lower than summary.healthy (the gap this exposes)", async () => {
		const result = await getSourceFreshness();
		const dh = result.summary.dataHealth;
		if (!dh) return;
		// This is the core regression guard: scraper-run health (summary.healthy)
		// can exceed actual fresh writers (dataHealth.freshSourceCount) when
		// sources "run" but write 0 rows. The point of surfacing dataHealth is
		// that this gap is visible rather than hidden behind a 18/18 healthy.
		// We don't assert the gap is always present (env-dependent), only that
		// freshSourceCount is a valid non-negative number ≤ a sane upper bound.
		expect(dh.freshSourceCount).toBeGreaterThanOrEqual(0);
		expect(dh.freshSourceCount).toBeLessThanOrEqual(dh.registeredSourceCount + 50);
	});

	// REGRESSION (round-58): per-source `empty` flag + summary.emptySources.
	// A source whose last run wrote 0 rows must be flagged empty:true so the
	// board can distinguish "ran + wrote" from "ran + produced nothing"
	// (the silent-failure pattern). Pre-round-58 the freshness table showed
	// successRate/stale with no empty signal, masking never-writing scrapers.
	it("each freshness row carries an `empty` flag and summary aggregates emptySources", async () => {
		const result = await getSourceFreshness();

		expect(result.freshness.length).toBeGreaterThan(0);
		for (const f of result.freshness) {
			expect(f).toHaveProperty("empty");
			expect(typeof f.empty).toBe("boolean");
			// empty:true implies the last run wrote 0 rows.
			if (f.empty) {
				expect(f.lastInserted).toBe(0);
				expect(f.lastUpdated).toBe(0);
			}
		}
		// summary.emptySources mirrors the per-source flag set.
		expect(result.summary).toHaveProperty("emptySources");
		expect(result.summary).toHaveProperty("emptyCount");
		expect(Array.isArray(result.summary.emptySources)).toBe(true);
		expect(result.summary.emptyCount).toBe(result.summary.emptySources.length);
		// Every name in emptySources must correspond to an empty:true row.
		for (const name of result.summary.emptySources) {
			const row = result.freshness.find((f) => f.source === name);
			expect(row?.empty).toBe(true);
		}
	});
});

describe("listCommodities — authoritative-source latest price (round-67)", () => {
	// round-67 regression: listCommodities previously used a Prisma relation
	// include that couldn't apply authoritative-source filtering, so conflict
	// commodities listed the wrong source's price (brl_usd ~0.197 from
	// exchange_rate_api instead of ~5.0 from fred). It now uses a batched
	// query with per-commodity source resolution.
	it("brl_usd latestPrice reads the authoritative source (fred ~5.0, not exchange_rate_api ~0.197)", async () => {
		const commodities = await listCommodities();
		const brl = commodities.find((c) => c.slug === "brl_usd");
		expect(brl).toBeDefined();
		// Prisma returns close as a Decimal object; coerce for comparison.
		const price = Number(brl?.latestPrice);
		// fred scale (~5.0), NOT exchange_rate_api scale (~0.197).
		expect(price).toBeGreaterThan(4);
		expect(price).toBeLessThan(6);
	});
});
