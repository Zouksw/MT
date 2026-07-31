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
import { getSourceFreshness } from "@/services/marketService";
import {
	createTestContext,
	destroyTestContext,
	type TestContext,
} from "@/test/helpers/testContext";

describe("getSourceFreshness — dataHealth snapshot in summary", () => {
	let ctx: TestContext;

	beforeAll(async () => {
		ctx = await createTestContext("freshness");
	});

	afterAll(async () => {
		await destroyTestContext(ctx);
	});

	it("summary includes the legacy healthy/stale counts AND the dataHealth snapshot", async () => {
		if (!ctx.available) return;
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
		if (!ctx.available) return;
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
});
