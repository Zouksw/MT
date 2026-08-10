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

/**
 * Build a Prisma `where` fragment for a BATCHED "latest price per commodity"
 * query across many commodities at once, applying authoritative-source
 * resolution per commodity.
 *
 * Round-67: several readers (signals batch, marketService listCommodities,
 * watchlistService) fetch the latest close across a set of commodityIds in one
 * query. Without per-commodity source filtering, conflict commodities
 * (brl_usd / corn_cme / natural_gas_cme) resolve to whichever source wrote
 * most recently — e.g. brl_usd gets exchange_rate_api's inverted ~0.2 instead
 * of fred's correct ~5.0. Spreading `authoritativeSourceWhere` is impossible
 * here because each commodity may need a different source (or none).
 *
 * This helper partitions the input into:
 *   - plain commodityIds (slug has no declared conflict → read all sources)
 *   - conflict commodityIds grouped by their authoritative source
 * and emits a single `where` clause with OR branches so the caller keeps one
 * query. Returns `undefined` when `commodities` is empty so the caller can
 * short-circuit. Pair the result with {@link dedupeLatestByCommodity} on the
 * rows to collapse multiple source rows per commodity to one (newest date).
 *
 * @param commodities - the commodity set to fetch latest prices for
 */
export function batchLatestPriceWhere(
	commodities: ReadonlyArray<{ id: string; slug: string }>,
): { OR: Array<Record<string, unknown>> } | { commodityId: { in: string[] } } | undefined {
	if (commodities.length === 0) return undefined;

	// Partition: plain ids (no conflict) and conflict ids grouped by source.
	const plainIds: string[] = [];
	// source → commodityIds that resolve to that source.
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

	// Fast path: no conflict commodities at all → simple IN, no OR needed.
	if (bySource.size === 0) {
		return { commodityId: { in: plainIds } };
	}

	// Build OR branches: one per (source → ids), plus one plain-IN for the
	// non-conflict ids (if any). Each branch is a distinct where fragment.
	const branches: Array<Record<string, unknown>> = [];
	if (plainIds.length > 0) {
		branches.push({ commodityId: { in: plainIds } });
	}
	for (const [source, ids] of bySource) {
		branches.push({ commodityId: { in: ids }, source });
	}
	return { OR: branches };
}

/**
 * Collapse a batched latest-price query's rows to one row per commodity (the
 * newest by date). Pairs with {@link batchLatestPriceWhere}: the where-clause
 * may still return multiple rows per commodity (different sources for plain
 * commodities, or multiple dates), so this picks the most recent per id.
 *
 * The caller typically does:
 *   const rows = await prisma.commodityPrice.findMany({
 *     where: { ...batchLatestPriceWhere(commodities), interval: "daily" },
 *     orderBy: { date: "desc" },
 *   });
 *   const latestByCommodity = dedupeLatestByCommodity(rows);
 */
export function dedupeLatestByCommodity<T extends { commodityId: string; date: Date }>(
	rows: ReadonlyArray<T>,
): Map<string, T> {
	const out = new Map<string, T>();
	for (const r of rows) {
		// rows are expected ordered date desc; keep the first seen per id.
		if (!out.has(r.commodityId)) out.set(r.commodityId, r);
	}
	return out;
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
 * are split out and queried with their authoritative source filter, so
 * brl_usd reads fred (~5.0) not exchange_rate_api (~0.2). Plain commodities
 * get one unfiltered `DISTINCT ON` query.
 *
 * @param commodities - the commodity set (id + slug) to resolve latest prices for
 * @returns Map<commodityId, { close, date }>
 */
export async function batchLatestPrices(
	commodities: ReadonlyArray<{ id: string; slug: string }>,
): Promise<Map<string, { close: number; date: Date }>> {
	const out = new Map<string, { close: number; date: Date }>();
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
		const rows = await prisma.$queryRaw<Array<{ commodityId: string; close: number; date: Date }>>`
      SELECT DISTINCT ON (commodity_id) commodity_id AS "commodityId", close, date
      FROM commodity_prices
      WHERE commodity_id = ANY(${plainIds}::text[]) AND interval = 'daily'
      ORDER BY commodity_id, date DESC
    `;
		for (const p of rows) out.set(p.commodityId, { close: p.close, date: p.date });
	}

	// Conflict commodities: one DISTINCT ON query per authoritative source,
	// restricted to that source so the wrong source's rows never enter.
	for (const [source, ids] of bySource) {
		const rows = await prisma.$queryRaw<Array<{ commodityId: string; close: number; date: Date }>>`
      SELECT DISTINCT ON (commodity_id) commodity_id AS "commodityId", close, date
      FROM commodity_prices
      WHERE commodity_id = ANY(${ids}::text[]) AND interval = 'daily' AND source = ${source}
      ORDER BY commodity_id, date DESC
    `;
		for (const p of rows) out.set(p.commodityId, { close: p.close, date: p.date });
	}

	return out;
}
