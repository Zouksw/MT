/**
 * Data Fetcher — multi-source unit-conflict regression test (KNOWN-ISSUES R2).
 *
 * The seeded `brl_usd` commodity (id 6f68943c-...) is written by two sources
 * with conflicting direction/magnitude:
 *   - exchange_rate_api  ≈ 0.20 (34 rows, inverted: 1/BRL)
 *   - fred DEXBZUS       ≈ 5.0  (7910 rows, correct: BRL per USD)
 *
 * Before the fix, getCommodityPriceValues fetched by commodityId alone and
 * returned BOTH sources interleaved by date desc → training mixed 0.2 with 5.0
 * (32× off) and MAPE for brl_usd was ~96%. After the fix, the fetcher consults
 * the authoritative-source resolver and returns ONLY fred's magnitude.
 *
 * This test is read-only against seed data (creates nothing), so it is safe to
 * run in any environment that has the brl_usd seed. It skips cleanly if the DB
 * or the seed row is unavailable.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib";
import { getCommodityPriceValues } from "@/services/inference/data-fetcher";

const BRL_USD_SLUG = "brl_usd";

describe("getCommodityPriceValues — authoritative-source filtering (seeded brl_usd)", () => {
	let commodityId: string | null = null;
	let hasConflictSources = false;

	beforeAll(async () => {
		const commodity = await prisma.commodity.findUnique({
			where: { slug: BRL_USD_SLUG },
			select: { id: true },
		});
		commodityId = commodity?.id ?? null;
		if (!commodityId) return;

		// Confirm the seeded multi-source conflict is actually present.
		const groups = await prisma.commodityPrice.groupBy({
			by: ["source"],
			where: { commodityId },
			_count: true,
		});
		const sources = groups.map((g) => g.source);
		hasConflictSources = sources.includes("fred") && sources.includes("exchange_rate_api");
	});

	it("returns ONLY the authoritative source (fred ≈ 5.0), never the inverted exchange_rate_api ≈ 0.2", async () => {
		if (!commodityId || !hasConflictSources) return; // skip if seed absent
		const { values } = await getCommodityPriceValues(commodityId, 200);
		expect(values.length).toBeGreaterThan(0);
		// fred rows are ≈ 5.0; exchange_rate_api rows are ≈ 0.2. After the fix
		// NO returned value may be near 0.2 — that would mean the inverted
		// source leaked into the training series.
		const leakedInverted = values.filter((v) => v < 1.0);
		expect(leakedInverted).toEqual([]);
		// And the values should cluster around the fred magnitude (≥ 1.0).
		const allFredMagnitude = values.every((v) => v >= 1.0);
		expect(allFredMagnitude).toBe(true);
	});
});
