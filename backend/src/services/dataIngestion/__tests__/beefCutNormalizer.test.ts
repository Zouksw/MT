/**
 * Beef Cut Normalizer tests (round-144, D13).
 *
 * Guards the taxonomy invariants that everything downstream depends on:
 * scrapers (mlaNlrs/usdaAms) and the CSV import trust normalizeBeefCut to
 * return a canonical cutCode that seed's beefCutTaxonomy upsert also knows.
 * The "beef cheek" → OFFAL dead-alias bug (value not in CUT_MAPPINGS, rows
 * silently invisible downstream) is the pinned regression.
 */

import { describe, expect, it } from "vitest";
import { ALIASES, getAllCutMappings, normalizeBeefCut } from "../beefCutNormalizer";

const canonicalCodes = new Set(getAllCutMappings().map((m) => m.cutCode));

describe("beefCutNormalizer — dead-alias guard (D13)", () => {
	it("every alias value resolves to a canonical cutCode", () => {
		const dead = Object.entries(ALIASES).filter(([, code]) => !canonicalCodes.has(code));
		// A dead alias is silently corrosive: the scraper writes rows under a
		// cutCode that no taxonomy entry, cut list, or forecast path knows.
		expect(dead).toEqual([]);
	});

	it('normalizes "beef cheek" to the canonical BEEF_CHEEK (not OFFAL)', () => {
		expect(normalizeBeefCut("beef cheek")).toBe("BEEF_CHEEK");
	});

	it("BEEF_CHEEK is a canonical Offal entry with all four language names", () => {
		const cheek = getAllCutMappings().find((m) => m.cutCode === "BEEF_CHEEK");
		expect(cheek).toBeDefined();
		expect(cheek?.primal).toBe("Offal");
		expect(cheek?.nameEn).toBe("Beef Cheek");
		expect(cheek?.nameZh).toBe("牛颊肉");
		expect(cheek?.nameEs).toBe("Cachete");
		expect(cheek?.namePt).toBe("Bochecha");
	});

	it("every canonical cutCode normalizes from its own English name", () => {
		const misses = getAllCutMappings()
			.filter((m) => normalizeBeefCut(m.nameEn) !== m.cutCode)
			.map((m) => `${m.nameEn} → ${normalizeBeefCut(m.nameEn)}`);
		expect(misses).toEqual([]);
	});
});
