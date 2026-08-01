/**
 * World Bank / FRED monthly — config contract + source attribution (round-58).
 *
 * worldBankPrices.ts historically had two latent honesty bugs (both fixed):
 *
 *  1. Dead-path mislead: `fetchWorldBankData` fetched the World Bank API and,
 *     when reachable, set `wbSuccess=true`, logged "API restored — using
 *     primary source", and then SKIPPED the FRED write block — returning
 *     {inserted:0, updated:0} while claiming success. The WB API currently
 *     404s (so the dead path was dormant), but the structure silently wrote
 *     nothing the moment WB came back. Fixed: FRED now runs unconditionally;
 *     the WB fetch is a diagnostic liveness probe only.
 *
 *  2. Source misattribution: `fetchFredMonthly` wrote rows with
 *     `source: "world_bank"` even though the data is a FRED CSV download. The
 *     user-visible data-sources board labelled FRED rows as "World Bank Pink
 *     Sheet". Fixed: source is now "fred".
 *
 * These tests pin the FRED_MONTHLY config shape and the per-series contracts so
 * a regression that drops a series, mis-spells a slug, or flips the source
 * back to "world_bank" fails loudly. Mirrors the cmeFutures priceFactor
 * contract-test convention (pure config assertions, no DB / no network).
 */

import { describe, expect, it } from "vitest";
import { FRED_MONTHLY } from "@/services/dataIngestion/sources/worldBankPrices";

describe("FRED_MONTHLY config contract", () => {
	const entries = Object.entries(FRED_MONTHLY);

	it("covers the expected macro-commodity series (energy + metals + grains + softs)", () => {
		// A regression that accidentally deletes a category would drop the count
		// and break this. The current set is 12 series across 4 categories.
		expect(entries.length).toBeGreaterThanOrEqual(12);

		const categories = new Set(entries.map(([, c]) => c.category));
		expect(categories.has("energy")).toBe(true);
		expect(categories.has("metals")).toBe(true);
		expect(categories.has("grain")).toBe(true);
		expect(categories.has("soft_commodities")).toBe(true);
	});

	it("every series has all required fields (no undefined sneaks in)", () => {
		for (const [key, config] of entries) {
			expect(config.seriesId, `${key}.seriesId`).toBeTruthy();
			expect(config.slug, `${key}.slug`).toBeTruthy();
			expect(config.name, `${key}.name`).toBeTruthy();
			expect(config.category, `${key}.category`).toBeTruthy();
			expect(config.unit, `${key}.unit`).toBeTruthy();
		}
	});

	it("slugs are lowercase snake_case (pin the canonical form, prevent case drift)", () => {
		// e.g. "crude_oil_wti" not "crude_oil_WTI". The slug is the stable
		// identity joined to commodity_prices; mixed case would create orphan
		// commodities on re-ingest.
		for (const [key, config] of entries) {
			expect(config.slug, `${key}.slug`).toMatch(/^[a-z0-9_]+$/);
		}
	});

	it("seriesIds are the FRED monthly codes (uppercase alpha+digits)", () => {
		// FRED series IDs like POILWTIUSDM, PCOPPUSDM, IR14280. Pinning the
		// shape catches a typo that would silently 404 the CSV download.
		for (const [key, config] of entries) {
			expect(config.seriesId, `${key}.seriesId`).toMatch(/^[A-Z0-9]+$/);
		}
	});

	it("every commodity unit carries a real dimension (USD-prefixed), not a bare number", () => {
		// Units drive the "how is this price denominated?" display + the
		// authoritative-source unit-conflict guards. A bare/empty unit would
		// make a price ambiguous.
		for (const [key, config] of entries) {
			expect(config.unit, `${key}.unit`).toMatch(/(USD|cents)\//);
		}
	});
});

/**
 * Source-attribution guard.
 *
 * The code fix writes `source: "fred"` inside fetchFredMonthly. That string is
 * not reachable from a pure-config import (it's a literal inside the function),
 * so this test reads the source file and asserts the literal is present — a
 * static guard that fails if someone flips it back to "world_bank". This is
 * deliberately a file-content assertion, not a runtime one, because the
 * function writes to the DB.
 */
describe("FRED source attribution (round-58 honesty fix)", () => {
	it("fetchFredMonthly writes source='fred', not 'world_bank'", async () => {
		const fs = await import("node:fs/promises");
		const path = await import("node:path");
		const file = path.join(__dirname, "..", "worldBankPrices.ts");
		const src = await fs.readFile(file, "utf8");

		// Locate the upsertPrice call inside fetchFredMonthly and assert its
		// source field. The literal must be "fred".
		const upsertBlock = src.match(/source:\s*"([^"]+)",\s*\n\s*open:\s*value,/);
		expect(upsertBlock, "expected to find the upsertPrice source field").not.toBeNull();
		expect(upsertBlock?.[1]).toBe("fred");
		// And the old misattribution must not be present in the write path.
		expect(src).not.toContain('source: "world_bank"');
	});
});
