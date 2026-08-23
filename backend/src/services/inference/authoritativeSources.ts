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

import { prisma } from "@/lib";

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
 *                       source now writes converted USD values (round-100
 *                       swapped the dead Stooq upstream for Yahoo Finance —
 *                       same native units, priceFactor 0.01 intact), but its
 *                       post-fix history starts 2026-08-14 at one bar/day.
 *                       usda_ams stays authoritative until cme accumulates
 *                       enough post-fix rows to out-length it; revisit then.
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

/**
 * The set of commodity slugs known to have a multi-source conflict (the keys
 * of AUTHORITATIVE_SOURCES). Exposed so raw-SQL callers (e.g. watchlistService)
 * can split their batched queries into conflict vs non-conflict sets.
 */
export function getConflictSlugs(): string[] {
	return Object.keys(AUTHORITATIVE_SOURCES);
}

/**
 * Batch-fetch the latest daily close per commodity via `DISTINCT ON`, applying
 * authoritative-source resolution per commodity.
 *
 * This replaces the older `batchLatestPriceWhere` + `findMany` + JS-dedupe
 * pattern, which fetched the ENTIRE daily history for every commodity (65k+
 * rows) into Node just to keep one row per commodity. `DISTINCT ON` lets
 * Postgres collapse to one row per commodity before any rows cross the wire.
 *
 * Source resolution: conflict commodities (brl_usd/corn_cme/natural_gas_cme)
 * are split out and queried with their authoritative source filter, so that
 * brl_usd reads fred (~5.0) not exchange_rate_api (~0.2). Plain commodities
 * get one unfiltered `DISTINCT ON` query.
 *
 * Monthly fallback (round-129 batch 7): commodities with no daily rows
 * (monthly-only series like beef_carcass_us / the world_bank group) fall back
 * to their latest MONTHLY close — previously they resolved to "no price at
 * all", so list/quotes surfaces showed them as price-less. The returned
 * `interval` field tells callers which cadence the row belongs to.
 *
 * @param commodities - the commodity set (id + slug) to resolve latest prices for
 * @returns Map<commodityId, { close, date, interval }>
 */
export async function batchLatestPrices(
	commodities: ReadonlyArray<{ id: string; slug: string }>,
): Promise<Map<string, { close: number; date: Date; interval: string }>> {
	const out = new Map<string, { close: number; date: Date; interval: string }>();
	if (commodities.length === 0) return out;

	// Partition into plain ids (no conflict) and conflict ids grouped by source.
	const plainIds: string[] = [];
	const bySource = new Map<string, string[]>();
	for (const c of commodities) {
		const source = getAuthoritativeSource(c.slug);
		if (!source) {
			plainIds.push(c.id);
		} else {
			const bucket = bySource.get(source);
			if (bucket) bucket.push(c.id);
			else bySource.set(source, [c.id]);
		}
	}

	// Plain commodities: one DISTINCT ON query, no source filter.
	if (plainIds.length > 0) {
		const rows = await prisma.$queryRaw<
			Array<{ commodityId: string; close: number; date: Date; interval: string }>
		>`
      SELECT DISTINCT ON (commodity_id) commodity_id AS "commodityId", close, date, interval
      FROM commodity_prices
      WHERE commodity_id = ANY(${plainIds}::text[]) AND interval = 'daily'
      ORDER BY commodity_id, date DESC
    `;
		for (const p of rows)
			out.set(p.commodityId, { close: p.close, date: p.date, interval: p.interval });
	}

	// Conflict commodities: one DISTINCT ON query per authoritative source,
	// restricted to that source so the wrong source's rows never enter.
	for (const [source, ids] of bySource) {
		const rows = await prisma.$queryRaw<
			Array<{ commodityId: string; close: number; date: Date; interval: string }>
		>`
      SELECT DISTINCT ON (commodity_id) commodity_id AS "commodityId", close, date, interval
      FROM commodity_prices
      WHERE commodity_id = ANY(${ids}::text[]) AND interval = 'daily' AND source = ${source}
      ORDER BY commodity_id, date DESC
    `;
		for (const p of rows)
			out.set(p.commodityId, { close: p.close, date: p.date, interval: p.interval });
	}

	// Monthly fallback for commodities the daily queries could not resolve.
	// Mirrors the source partition: one plain query + per-conflict-source
	// queries, all restricted to the still-missing ids.
	const missing = commodities.filter((c) => !out.has(c.id));
	if (missing.length > 0) {
		const missingPlain = missing.filter((c) => !getAuthoritativeSource(c.slug)).map((c) => c.id);
		if (missingPlain.length > 0) {
			const rows = await prisma.$queryRaw<
				Array<{ commodityId: string; close: number; date: Date; interval: string }>
			>`
        SELECT DISTINCT ON (commodity_id) commodity_id AS "commodityId", close, date, interval
        FROM commodity_prices
        WHERE commodity_id = ANY(${missingPlain}::text[]) AND interval = 'monthly'
        ORDER BY commodity_id, date DESC
      `;
			for (const p of rows)
				out.set(p.commodityId, { close: p.close, date: p.date, interval: p.interval });
		}
		const missingBySource = new Map<string, string[]>();
		for (const c of missing) {
			const source = getAuthoritativeSource(c.slug);
			if (!source) continue;
			const bucket = missingBySource.get(source);
			if (bucket) bucket.push(c.id);
			else missingBySource.set(source, [c.id]);
		}
		for (const [source, ids] of missingBySource) {
			const rows = await prisma.$queryRaw<
				Array<{ commodityId: string; close: number; date: Date; interval: string }>
			>`
        SELECT DISTINCT ON (commodity_id) commodity_id AS "commodityId", close, date, interval
        FROM commodity_prices
        WHERE commodity_id = ANY(${ids}::text[]) AND interval = 'monthly' AND source = ${source}
        ORDER BY commodity_id, date DESC
      `;
			for (const p of rows)
				out.set(p.commodityId, { close: p.close, date: p.date, interval: p.interval });
		}
	}

	return out;
}
