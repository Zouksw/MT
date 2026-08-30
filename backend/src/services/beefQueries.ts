/**
 * Beef queries — read side of the beef domain (round-117 merge).
 * Sections: aggregation (by-country) · cutSeries (series read) · trends · freshness.
 * Exports unchanged from the four source modules.
 */

import { prisma } from "@/lib";
// ---------------------------------------------------------------------------
// beefAggregation
// ---------------------------------------------------------------------------

export interface CountryAggregate {
	country: string;
	avgPrice: number;
	minPrice: number;
	maxPrice: number;
	cutCount: number;
	factoryCount: number;
	topCuts: Array<{ cutCode: string; price: number }>;
}

export interface BeefByCountryResult {
	countries: CountryAggregate[];
	date: Date | null;
	count: number;
}

/**
 * Aggregate the latest BeefCutPrice snapshot by factory country.
 *
 * Picks the single most-recent date with data (apples-to-apples across
 * countries — mixing dates would skew the averages), then groups rows by
 * country and computes per-country avg/min/max price, unique cut count,
 * factory count, and a per-cut breakdown (top priced cuts, capped).
 *
 * @param source    Optional source filter (restricts both the latest-date
 *                  lookup and the row fetch to one data source).
 * @param cutsLimit Max number of per-cut entries per country (default 5,
 *                  capped at 20). Mirrors the `?cuts=` query param.
 */
export async function aggregateBeefByCountry(
	source?: string,
	cutsLimit: number = 5,
): Promise<BeefByCountryResult> {
	const limit = Math.min(cutsLimit, 20);

	// Find the most recent date with data, then aggregate on that date.
	const latest = await prisma.beefCutPrice.findFirst({
		where: source ? { source } : {},
		orderBy: { date: "desc" },
		select: { date: true },
	});
	if (!latest) {
		return { countries: [], date: null, count: 0 };
	}

	const rows = await prisma.beefCutPrice.findMany({
		where: {
			date: latest.date,
			...(source ? { source } : {}),
		},
		include: { factory: { select: { country: true, code: true, name: true } } },
	});

	// Group by country → aggregate + per-cut breakdown.
	const byCountry = new Map<
		string,
		{
			country: string;
			prices: number[];
			cuts: Map<string, number>;
			factories: Set<string>;
		}
	>();
	for (const r of rows) {
		const country = r.factory?.country ?? "?";
		const price = typeof r.price === "number" ? r.price : Number(r.price);
		if (!Number.isFinite(price)) continue;
		let bucket = byCountry.get(country);
		if (!bucket) {
			bucket = { country, prices: [], cuts: new Map(), factories: new Set() };
			byCountry.set(country, bucket);
		}
		bucket.prices.push(price);
		// Keep the first price per cutCode within a country.
		if (!bucket.cuts.has(r.cutCode)) bucket.cuts.set(r.cutCode, price);
		if (r.factory?.code) bucket.factories.add(r.factory.code);
	}

	const countries: CountryAggregate[] = Array.from(byCountry.values())
		.map((b) => {
			const sum = b.prices.reduce((s, p) => s + p, 0);
			const avg = b.prices.length > 0 ? sum / b.prices.length : 0;
			const min = b.prices.length > 0 ? Math.min(...b.prices) : 0;
			const max = b.prices.length > 0 ? Math.max(...b.prices) : 0;
			const topCuts = Array.from(b.cuts.entries())
				// highest price first; cutCode as deterministic tiebreaker
				// (equal prices otherwise order by map insertion = row order)
				.sort((a, z) => z[1] - a[1] || a[0].localeCompare(z[0]))
				.slice(0, limit)
				.map(([cutCode, price]) => ({ cutCode, price: Math.round(price * 100) / 100 }));
			return {
				country: b.country,
				avgPrice: Math.round(avg * 100) / 100,
				minPrice: Math.round(min * 100) / 100,
				maxPrice: Math.round(max * 100) / 100,
				cutCount: b.cuts.size,
				factoryCount: b.factories.size,
				topCuts,
			};
		})
		.sort((a, b) => a.country.localeCompare(b.country));

	return { countries, date: latest.date, count: countries.length };
}
// ---------------------------------------------------------------------------
// beefCutSeries
// ---------------------------------------------------------------------------

export interface BeefCutSeriesOptions {
	factoryId: string;
	cutCode: string;
	/** Max number of trailing daily points to fetch (default 200). */
	limit?: number;
	/** Include bridge:commodity:* proxy rows. Default false (honest path). */
	includeBridge?: boolean;
}

/**
 * Build the virtual cache/pipeline key for a (factoryId, cutCode) series.
 * Stable: the same inputs always produce the same key.
 */
export function cutSeriesKey(factoryId: string, cutCode: string): string {
	return `cut:${factoryId}:${cutCode}`;
}

/** True iff `key` is a virtual cut-series key (vs a real commodityId). */
export function isCutSeriesKey(key: string): boolean {
	return key.startsWith("cut:");
}

/**
 * Extract a BeefCutPrice daily series for one (factoryId, cutCode) into the
 * {values, timestamps} shape the inference pipeline expects.
 *
 * Chronological order (oldest first), matching getCommodityPriceValues.
 * Throws on <2 points (the inference engine's minimum for fitting any model).
 */
export async function getBeefCutSeries(
	opts: BeefCutSeriesOptions,
): Promise<{ values: number[]; timestamps: number[] }> {
	const { factoryId, cutCode, limit = 200, includeBridge = false } = opts;

	const where = {
		factoryId,
		cutCode,
		...(includeBridge ? {} : { source: { not: { startsWith: "bridge:" } } }),
	};

	const rows = await prisma.beefCutPrice.findMany({
		where,
		orderBy: { date: "desc" },
		select: { price: true, date: true, source: true },
		take: limit,
	});

	// Chronological order (oldest first) for the forecasting models.
	rows.reverse();

	if (rows.length < 2) {
		throw new Error(
			`Insufficient beef cut data for ${cutCode}/factory ${factoryId}: ${rows.length} points` +
				(includeBridge ? "" : " (bridge proxies excluded)"),
		);
	}

	return {
		// price is Decimal(18,4) — coerce to number at the read boundary for
		// the inference pipeline (which takes number[]). Sub-$0.0001 precision
		// is preserved well within JS double range.
		values: rows.map((r) => Number(r.price)),
		timestamps: rows.map((r) => r.date.getTime()),
	};
}

/**
 * Resolve a virtual cut-series key back to its {factoryId, cutCode}.
 * Returns null if the key is not a cut key.
 */
export function parseCutSeriesKey(key: string): { factoryId: string; cutCode: string } | null {
	if (!isCutSeriesKey(key)) return null;
	// Format: cut:{factoryId}:{cutCode}. cutCode itself never contains ':'.
	// "cut:X:Y" → ["cut", "X", "Y"] = 3 parts.
	const parts = key.split(":");
	if (parts.length !== 3) return null;
	const [, factoryId, cutCode] = parts;
	if (!factoryId || !cutCode) return null;
	return { factoryId, cutCode };
}
// ---------------------------------------------------------------------------
// beefTrends
// ---------------------------------------------------------------------------

/**
 * One beef price row with just the fields the trend needs.
 * Matches the shape from /api/beef/prices/latest (price + factory.country).
 */
export interface TrendPriceRow {
	price: number;
	country?: string | null;
}

export interface BeefTrendSummary {
	/** Imported (non-CN) avg % change, latest vs previous day. Null if
	 * either period has no imported rows (can't compute a ratio). */
	importedTrendPct: number | null;
	/** Domestic (CN) avg % change, latest vs previous day. */
	domesticTrendPct: number | null;
	/** Date of the latest period (ISO). Null if no latest rows. */
	latestDate: string | null;
	/** Date of the previous period used for the delta (ISO). Null if none. */
	previousDate: string | null;
}

/**
 * Compute the origin-split average for a set of rows.
 * Imported = country !== "CN" (BR/AU/AR/UY/US/...), domestic = country === "CN".
 */
function originSplitAvg(rows: TrendPriceRow[]): {
	importedAvg: number | null;
	domesticAvg: number | null;
} {
	let importedSum = 0;
	let importedCount = 0;
	let domesticSum = 0;
	let domesticCount = 0;
	for (const r of rows) {
		if (!Number.isFinite(r.price) || r.price <= 0) continue;
		const country = (r.country ?? "").trim();
		if (country === "CN") {
			domesticSum += r.price;
			domesticCount++;
		} else if (country) {
			importedSum += r.price;
			importedCount++;
		}
	}
	return {
		importedAvg: importedCount > 0 ? importedSum / importedCount : null,
		domesticAvg: domesticCount > 0 ? domesticSum / domesticCount : null,
	};
}

/**
 * % change from `prev` to `curr`, rounded to 1 decimal. Null if either is
 * null/zero (can't divide). Negative = price fell, positive = rose.
 */
function pctChange(curr: number | null, prev: number | null): number | null {
	if (curr === null || prev === null || prev === 0) return null;
	return Math.round(((curr - prev) / prev) * 1000) / 10;
}

/**
 * Compute the origin-split trend from latest + previous period rows.
 *
 * Pure function — the route layer does the two DB queries (latest date +
 * previous distinct date) and passes the row sets here. This makes the math
 * unit-testable without touching a database.
 */
export function computeBeefTrend(
	latestRows: TrendPriceRow[],
	previousRows: TrendPriceRow[],
	latestDate: Date | null,
	previousDate: Date | null,
): BeefTrendSummary {
	const curr = originSplitAvg(latestRows);
	const prev = originSplitAvg(previousRows);
	return {
		importedTrendPct: pctChange(curr.importedAvg, prev.importedAvg),
		domesticTrendPct: pctChange(curr.domesticAvg, prev.domesticAvg),
		latestDate: latestDate ? latestDate.toISOString() : null,
		previousDate: previousDate ? previousDate.toISOString() : null,
	};
}
// ---------------------------------------------------------------------------
// beefFreshness
// ---------------------------------------------------------------------------

/** The freshness tier assigned to a beef price row. */
export type BeefFreshness = "live" | "proxy" | "snapshot";

/** A row younger than this (days) counts as live (non-bridge). */
export const FRESH_WINDOW_DAYS = 3;
/** A row older than this (days) is always snapshot, even if non-bridge. */
export const STALE_WINDOW_DAYS = 7;

/** Sources prefixed with this are bridge proxies (see beefPriceBridge.ts). */
export const BRIDGE_SOURCE_PREFIX = "bridge:";
/** Seed sources (synthetic snapshots written by prisma/seed.ts). */
export const SEED_SOURCE_PREFIX = "seed";

export interface FreshnessInput {
	/** The BeefCutPrice.source column value. */
	source: string;
	/** The BeefCutPrice.date column value (UTC midnight expected). */
	date: Date;
}

export interface FreshnessOutput {
	freshness: BeefFreshness;
	/** Echoed back for the UI badge subtitle / tooltip. */
	dataDate: Date;
	/** Human-readable reason, for tooltips and logging. */
	reason: string;
}

/**
 * Classify a single beef price row's freshness. Pure function.
 *
 * @param input.source  the row's `source` column
 * @param input.date    the row's `date` column
 * @param now           injection point for tests (defaults to real now)
 */
export function classifyBeefFreshness(
	input: FreshnessInput,
	now: Date = new Date(),
): FreshnessOutput {
	const { source, date } = input;
	const ageDays = Math.floor((now.getTime() - date.getTime()) / 86_400_000);

	// 1. Bridge rows are ALWAYS proxy — a fresh bridge row is still an aggregate
	//    proxy, never a direct cut quote. This takes precedence over age.
	if (source.startsWith(BRIDGE_SOURCE_PREFIX)) {
		return {
			freshness: "proxy",
			dataDate: date,
			reason: `bridged from upstream commodity (proxy, age ${ageDays}d)`,
		};
	}

	// 2. Seed rows are always snapshot, regardless of age.
	if (source.startsWith(SEED_SOURCE_PREFIX)) {
		return {
			freshness: "snapshot",
			dataDate: date,
			reason: `synthetic seed snapshot (age ${ageDays}d)`,
		};
	}

	// 3. Real scraper output — gate on age.
	if (ageDays <= STALE_WINDOW_DAYS) {
		return {
			freshness: "live",
			dataDate: date,
			reason: `real scraper output, age ${ageDays}d`,
		};
	}

	return {
		freshness: "snapshot",
		dataDate: date,
		reason: `real source but stale (age ${ageDays}d > ${STALE_WINDOW_DAYS}d)`,
	};
}

/**
 * Attach freshness to an array of price rows (read-path helper).
 * Mutates nothing — returns a new array with `freshness`/`dataDate`/`reason`
 * added to each row.
 */
export function withFreshness<T extends { source: string; date: Date }>(
	rows: T[],
	now: Date = new Date(),
): Array<T & FreshnessOutput> {
	return rows.map((row) => ({ ...row, ...classifyBeefFreshness(row, now) }));
}

/**
 * Global page-level freshness verdict — used for the "demo snapshot mode"
 * banner on /beef. If EVERY row on the page is snapshot/proxy (none live),
 * the platform is not showing real-time data and must say so.
 */
export function pageFreshnessSummary<T extends { source: string; date: Date }>(
	rows: T[],
	now: Date = new Date(),
): {
	allStale: boolean;
	liveCount: number;
	proxyCount: number;
	snapshotCount: number;
	latestDate: Date | null;
} {
	const tagged = withFreshness(rows, now);
	let live = 0;
	let proxy = 0;
	let snapshot = 0;
	let latestDate: Date | null = null;
	for (const r of tagged) {
		if (r.freshness === "live") live++;
		else if (r.freshness === "proxy") proxy++;
		else snapshot++;
		if (!latestDate || r.dataDate > latestDate) latestDate = r.dataDate;
	}
	return {
		allStale: live === 0 && proxy + snapshot > 0,
		liveCount: live,
		proxyCount: proxy,
		snapshotCount: snapshot,
		latestDate,
	};
}
