/**
 * Beef price freshness — the honesty framework for /beef price data.
 *
 * PROBLEM
 * BeefCutPrice holds a mix of (a) real scraper output, (b) bridge-proxy rows
 * copied from CommodityPrice (a carcass aggregate masquerading as a cut price),
 * and (c) synthetic seed snapshots. Without a machine-readable freshness tag,
 * the UI cannot tell the user "this number is live" vs "this is an 87-day-old
 * demo snapshot" — which is the platform's core credibility problem.
 *
 * CONTRACT (3 tiers)
 *   live     — real scraper output, recent. source is NOT a bridge/seed and
 *              the row's date is within FRESH_WINDOW_DAYS of today.
 *   proxy    — bridge:commodity:* rows. A real upstream close was copied into
 *              BeefCutPrice, but the upstream itself may be an aggregate (e.g.
 *              beef_carcass_us), so the price is a proxy for the cut, not a
 *              direct cut quote. Surfaced distinctly so users/callers can
 *              exclude proxies from training sets.
 *   snapshot — everything else: seed data, or real data older than
 *              STALE_WINDOW_DAYS. The fallback honest label.
 *
 * GATING
 *   bridge:*  → always proxy (regardless of age — a fresh bridge row is still
 *               a proxy, not a direct quote).
 *   else      → live if date within FRESH_WINDOW_DAYS, else snapshot if older
 *               than STALE_WINDOW_DAYS. Between the two windows it's still
 *               treated as live (recent enough to trust).
 *
 * This is a pure function — no DB, no IO — so it is trivially unit-testable
 * and can be applied to any BeefCutPrice row shape on the read path.
 */

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
