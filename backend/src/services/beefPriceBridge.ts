/**
 * Beef Price Bridge — CommodityPrice → BeefCutPrice.
 *
 * WHY THIS EXISTS
 * The /beef UI reads ONLY BeefCutPrice (see routes/beef.ts: prices, prices/latest,
 * prices/history). The 3 scrapers that write BeefCutPrice (INAC/MLA/USDA-AMS)
 * are dormant — MLA + USDA-AMS are key-gated off (MLA_API_KEY / USDA_MARS_API_KEY
 * empty in backend/.env), and INAC silently fails its HTML scrape every run.
 * Meanwhile CommodityPrice is LIVE (~65k rows, refreshed daily by working
 * scrapers) and holds fresh USD/kg closes for several beef commodities whose
 * cut identity is unambiguous. This bridge copies those fresh closes into
 * BeefCutPrice so the /beef page is no longer stuck on a 2026-04-30 seed snapshot.
 *
 * SCOPE — CONSERVATIVE
 * Only slugs with an UNAMBIGUOUS 1:1 mapping to a BeefCutTaxonomy.cutCode are
 * bridged. Ambiguous cuts (sirloin / shin / thick_flank / rump / oyster_blade /
 * round — multiple cutCodes fit) are deliberately skipped until each gets an
 * explicit manual decision; see the AMBIGUOUS block below. "boneless" / cutout
 * slugs have no cutCode at all (they're trade forms, not cuts).
 *
 * SOURCE CONVENTION
 * Bridged rows carry `source = "bridge:commodity:<slug>"`. This keeps them
 * distinct from real scraper output (mla_nlrs / usda_ams_xb405 / etc.) so a
 * consumer can always tell "this came from CommodityPrice" apart from "this
 * came from a primary cut-price source". If a real MLA/USDA scraper is wired
 * later, its rows use a different source string and never collide.
 *
 * IDEMPOTENT
 * bridgeBeefPrices() upserts on the existing unique key
 * [factoryId, cutCode, date, source]. Re-running with the same CommodityPrice
 * just rewrites the same row — safe to call from a timer.
 */

import { prisma } from "@/lib";
import { logger } from "@/lib/logger.js";

/** ISO 3166 alpha-3 (Commodity.originCountry) → alpha-2 (Factory.code prefix). */
export const ISO3_TO_ISO2: Record<string, string> = {
	AUS: "AU",
	BRA: "BR",
	ARG: "AR",
	URY: "UY",
	USA: "US",
	CN: "CN",
};

/**
 * The conservative slug → cutCode mapping. Each entry MUST have an unambiguous
 * justification (nameCn AND/OR an alias both pointing to the same cutCode).
 * Add a new entry only when you can cite the normalizer line that disambiguates.
 *
 * Justification sources (beefCutNormalizer.ts):
 *   - 牛腩 (brisket) → BRISKET_NAVEL  (the standard brisket cut for this platform)
 *   - alias "cube roll" + nameCn 眼肉 → RIB_EYE_ROLL
 *   - subcategory "topside" + nameCn 小米龙 → TOPSIDE
 */
export const SLUG_TO_CUTCODE: Record<string, string> = {
	// Brisket — nameCn 牛腩 across all three origins → BRISKET_NAVEL.
	aus_brisket_m7: "BRISKET_NAVEL",
	bra_brisket: "BRISKET_NAVEL",
	arg_brisket: "BRISKET_NAVEL",

	// Rib eye — alias "cube roll" + nameCn 眼肉 agree on RIB_EYE_ROLL.
	aus_cube_roll_m9: "RIB_EYE_ROLL",

	// Topside — subcategory exact + nameCn 小米龙 agree on TOPSIDE.
	bra_topside: "TOPSIDE",
};

// ─── DELIBERATELY NOT BRIDGED (document for a future round) ─────────────────
//
// AMBIGUOUS (multiple cutCodes fit — needs an explicit manual pick before adding):
//   aus_sirloin_m9  → STRIPLOIN (nameCn 西冷) vs SIRLOIN (subcategory)
//   aus_shin_m5     → FORESHANK vs HEEL_MUSCLE (both nameZh 牛腱)
//   aus_thick_flank_m7 → KNUCKLE vs TOPSIDE (no thick_flank cutCode)
//   aus_oyster_blade_m7 → BLADE (alias) vs HANGING_TENDER (nameEn alt)
//   aus_rump_m5     → RUMP (alias) vs CHUCK_TENDER (nameCn 黄瓜条)
//   bra_shin        → FORESHANK (see aus_shin_m5)
//   bra_round       → SILVERSIDE vs OUTSIDE_FLAT
//   arg_shin        → FORESHANK (see aus_shin_m5)
//   arg_forequarter → QUARTER_FRONT (carcass) vs FORESHANK (nameCn 前腱)
//   ury_thick_flank → KNUCKLE vs TOPSIDE
//   ury_shin        → FORESHANK (see aus_shin_m5)
//
// NO cutCode (trade form, not a cut):
//   bra_frozen_boneless, ury_boneless
//
// NO Factory (domestic CN + US cutout have factoryCode = null):
//   brisket_cn, shin_cn, sirloin_cn, fatty_brisket_cn, thick_flank_cn,
//   oyster_blade_cn, ribeye_cn, tenderloin_cn, beef_tripe_cn, beef_tendon_cn,
//   boxed_beef_choice, beef_cutout_us
// ----------------------------------------------------------------------------

export interface BridgeResult {
	copied: number;
	skipped: number;
}

/**
 * Copy the latest daily CommodityPrice.close for each mapped beef slug into
 * BeefCutPrice. Idempotent (upsert). Returns counts for logging.
 */
export async function bridgeBeefPrices(): Promise<BridgeResult> {
	let copied = 0;
	let skipped = 0;

	for (const [slug, cutCode] of Object.entries(SLUG_TO_CUTCODE)) {
		try {
			const commodity = await prisma.commodity.findUnique({
				where: { slug },
				select: { id: true, grade: true, originCountry: true, factoryCode: true },
			});
			if (!commodity || !commodity.factoryCode || !commodity.originCountry) {
				logger.debug(`[BEEF-BRIDGE] ${slug}: missing commodity/factory/origin — skipped`);
				skipped++;
				continue;
			}

			const iso2 = ISO3_TO_ISO2[commodity.originCountry];
			if (!iso2) {
				logger.debug(`[BEEF-BRIDGE] ${slug}: unknown origin ${commodity.originCountry} — skipped`);
				skipped++;
				continue;
			}

			// Factory.code is `<ISO2>-<factoryCode>`. The ISO2 prefix is what
			// disambiguates the `379` collision (BR-SIF379 vs UY-379); a bare
			// endsWith(factoryCode) would join to the wrong country.
			const factoryCode = `${iso2}-${commodity.factoryCode}`;
			const factory = await prisma.factory.findUnique({
				where: { code: factoryCode },
				select: { id: true },
			});
			if (!factory) {
				logger.debug(`[BEEF-BRIDGE] ${slug}: no Factory for ${factoryCode} — skipped`);
				skipped++;
				continue;
			}

			// Latest daily close for this commodity.
			const latest = await prisma.commodityPrice.findFirst({
				where: { commodityId: commodity.id, interval: "daily" },
				orderBy: { date: "desc" },
				take: 1,
				select: { close: true, date: true, source: true },
			});
			if (!latest || latest.close == null) {
				logger.debug(`[BEEF-BRIDGE] ${slug}: no daily CommodityPrice — skipped`);
				skipped++;
				continue;
			}

			const source = `bridge:commodity:${slug}`;
			await prisma.beefCutPrice.upsert({
				where: {
					factoryId_cutCode_date_source: {
						factoryId: factory.id,
						cutCode,
						date: latest.date,
						source,
					},
				},
				create: {
					factoryId: factory.id,
					cutCode,
					price: latest.close.toNumber(),
					currency: "USD",
					unit: "USD/kg",
					source,
					sourceRef: slug,
					date: latest.date,
					grade: commodity.grade ?? null,
				},
				update: {
					price: latest.close.toNumber(),
					grade: commodity.grade ?? null,
				},
			});
			copied++;
		} catch (err) {
			// One slug failing must not abort the rest.
			logger.warn(`[BEEF-BRIDGE] ${slug}: error — skipped (${err})`);
			skipped++;
		}
	}

	return { copied, skipped };
}
