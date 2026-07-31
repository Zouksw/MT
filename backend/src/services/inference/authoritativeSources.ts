/**
 * Authoritative Source Resolution
 *
 * Some commodity slugs are written by multiple ingestion scrapers with
 * conflicting units / scale / direction (see docs/KNOWN-ISSUES.md R2):
 *
 *   brl_usd          — `exchange_rate_api` writes 1/BRL ≈ 0.20 (BRL→USD);
 *                      `fred` DEXBZUS writes ≈ 5.0 (USD→BRL, 30y series).
 *                      ~32× direction conflict.
 *   corn_cme         — `cme` futures in USD-cents/bu ≈ 473;
 *                      `usda_ams` cash in USD/bu ≈ 4.5.
 *                      ~100× unit conflict.
 *   natural_gas_cme  — `fred` DHHNGSP (Henry Hub spot) and `cme` futures
 *                      overlap with occasional spikes.
 *
 * Because CommodityPrice's unique key includes `source`
 * (`@@unique([commodityId, interval, date, source])`), conflicting sources
 * coexist in the same table. Any reader that fetches by commodityId alone
 * (training data, MAPE actuals, price history) silently mixes incompatible
 * units — predictions train on a Frankenstein series and MAPE is meaningless.
 *
 * This module is the single source of truth for which source is authoritative
 * for a given commodity. `getCommodityPriceValues` (training) and
 * `verifyDuePredictions` (actuals) both consult it so training and
 * verification read the same source — the MAPE loop becomes honest again.
 *
 * Commodities not listed here resolve to `null`, meaning "no preference —
 * read all sources" (the legacy behaviour), which is correct for the majority
 * of single-source commodities.
 */

/**
 * Map of commodity slug → authoritative source string.
 *
 * The key is the *slug* (stable, human-readable), resolved to a commodityId
 * at the call site, because commodityIds are random UUIDs that differ between
 * environments. Only slugs with a known multi-source conflict need an entry.
 *
 * Selection rationale (each picks the source with the longest, cleanest,
 * correctly-unitted daily series):
 *   - brl_usd         → fred DEXBZUS (30-year daily, official central-bank rate,
 *                       correct direction). exchange_rate_api's inverted value
 *                       is excluded from prediction training/verification.
 *   - corn_cme        → usda_ams (128 rows in correct USD/bu ≈ 4.5). The cme
 *                       source writes cents/bu and round-56 added a priceFactor
 *                       0.01 conversion, BUT Stooq (cme's upstream) is currently
 *                       blocked, so cme only has 2 stale pre-fix rows at 473.
 *                       usda_ams is the correct read until Stooq recovers and cme
 *                       writes fresh converted USD values. Revisit once cme has
 *                       post-fix rows.
 *   - natural_gas_cme → fred DHHNGSP (7400+ daily points vs cme's 2; the slug
 *                       gets a continuous history only from fred).
 */
const AUTHORITATIVE_SOURCES: Record<string, string> = {
	brl_usd: "fred",
	corn_cme: "usda_ams",
	natural_gas_cme: "fred",
};

/**
 * Resolve the authoritative source for a commodity.
 *
 * @param commoditySlug - the Commodity.slug (looked up by the caller)
 * @returns the authoritative source string, or `null` if the slug has no
 *   declared conflict (caller should read all sources as before).
 */
export function getAuthoritativeSource(commoditySlug: string | null | undefined): string | null {
	if (!commoditySlug) return null;
	return AUTHORITATIVE_SOURCES[commoditySlug] ?? null;
}

/**
 * Whether a commodity slug is known to have a multi-source unit conflict
 * (and therefore needs source-aware reading). Mainly for tests / diagnostics.
 */
export function hasSourceConflict(commoditySlug: string): boolean {
	return commoditySlug in AUTHORITATIVE_SOURCES;
}

/**
 * Build a Prisma `where` fragment that restricts a CommodityPrice query to the
 * authoritative source for the given slug, when one is declared.
 *
 * Usage:
 *   const prices = await prisma.commodityPrice.findMany({
 *     where: { commodityId, interval, ...authoritativeSourceWhere(slug) },
 *     ...
 *   });
 *
 * Returns `{}` (spread-safe, no-op) for single-source commodities so callers
 * keep their legacy read-all behaviour. Centralised so every direct
 * CommodityPrice reader applies the same resolution consistently.
 */
export function authoritativeSourceWhere(commoditySlug: string | null | undefined): {
	source?: string;
} {
	const source = getAuthoritativeSource(commoditySlug);
	return source ? { source } : {};
}
