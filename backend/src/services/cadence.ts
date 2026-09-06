/**
 * Series-cadence policy (round-129 batch 6a).
 *
 * The ONE place cadence-derived thresholds live. Interval logic used to be
 * scattered and daily-only (freshness board, scheduler gate, MAPE actuals,
 * correlation, analytics); monthly-only series — beef_carcass_us (IMF
 * PBEEFUSDM), the world_bank group — were invisible to all of them. This
 * module centralizes the threshold policy; the call sites keep their own
 * query shapes.
 *
 * Thresholds = one publication rhythm of tolerance ABOVE the normal point-age
 * ceiling (a missed publication must not fire, two in a row must):
 *  - daily: 7 days (unchanged historical STALE_WINDOW_DAYS semantics)
 *  - monthly: 90 days. Round-132 measured the real rhythm from
 *    commodity_prices (created_at − date): steady-state first-ingest lag is
 *    44–53d (point dated M-01 appears mid/late M+1), so the newest healthy
 *    point ages 45d→~76d across a cycle; 60d (the round-129/131 value,
 *    "2× rhythm") misclassified every healthy monthly series as stale for
 *    roughly the back half of each cycle — live proof: beef_carcass_us
 *    (latest 2026-07-01) crossed 60d on 2026-08-30 while its source is
 *    healthy (next release ~mid-September). 90d = 45d lag + 31d rhythm +
 *    ~2wk slip margin; observed late backfills (83–114d) are catch-ups of
 *    ALREADY-published points, not the newest point's age.
 *
 * Deletion test: remove this module and the thresholds scatter back into N
 * callers — it earns its keep as the single policy seam.
 */

export type SeriesInterval = "daily" | "weekly" | "monthly";

/** Days after a series' latest point beyond which it counts as stale. */
export function stalenessWindowDays(interval: string): number {
	switch (interval) {
		case "monthly":
			return 90;
		case "weekly":
			return 21;
		default:
			return 7;
	}
}

/** Publication-rhythm exceptions (round-158 批C): series whose POINTS are
 * daily-spaced but whose UPSTREAM publishes them in a weekly batch. Measured
 * live (psql 2026-09-06/07): the FRED H.10 FX trio (DEXCHUS/DEXBZUS/DEXUSEU
 * → usd_cny/brl_usd/eur_usd) delivers consecutive business-day rows that all
 * land at once on the weekly release — in a healthy cycle the newest point
 * ages 9–10d by Sun, tripping the 7d daily window every Fri–Sun (the
 * freshness board flagged usd_cny/brl_usd stale on 2026-09-06 with perfectly
 * healthy data). 14d = one publication rhythm + slip margin, the same "one
 * rhythm of tolerance" policy as the monthly 90d: a genuinely missed release
 * still fires. */
const PUBLICATION_WINDOW_DAYS: Record<string, number> = {
	usd_cny: 14,
	brl_usd: 14,
	eur_usd: 14,
};

/** Staleness window for a specific commodity slug: the publication-rhythm
 * override when one is registered, else the cadence default. Only freshness
 * surfacing (boards/digest) should pass the slug — prediction/scheduling
 * gates keep calling stalenessWindowDays(interval) so a data-lag quirk can
 * never loosen the model-side gates. */
export function stalenessWindowDaysForSeries(interval: string, slug?: string | null): number {
	if (slug && PUBLICATION_WINDOW_DAYS[slug] !== undefined) {
		return PUBLICATION_WINDOW_DAYS[slug];
	}
	return stalenessWindowDays(interval);
}

/** Display unit for horizon STEPS of a series cadence (ADR-0001 ①): a
 * monthly series' horizon 10 is ten MONTHS, not ten days. Unknown/legacy
 * (undefined) cadences default to day — the pre-ADR display semantics. */
export function horizonUnitOf(interval: string | null | undefined): "day" | "month" {
	return interval === "monthly" ? "month" : "day";
}

/** Forecast horizons (steps) a subscribed series refreshes each cycle
 * (round-136 批0c / D5). Daily keeps the historical 10-day default; monthly
 * uses 1 and 3 — next month + next quarter. A monthly horizon counts MONTHS
 * (ADR-0001 ①), so the previously inherited 10 meant TEN MONTHS: the first
 * beef verification could not land before anchor+10 (2027-05). [1, 3] puts
 * the first rolling evidence at 2026-09/2026-11 instead. Existing horizon-10
 * rows stay valid — long horizons verify on their own schedule. */
export function forecastHorizons(interval: string): number[] {
	return interval === "monthly" ? [1, 3] : [10];
}

/** Rolling-accuracy window (days) for consensus quality weights, scaled to
 * the series cadence (round-137 批2). A 30d window holds dozens of verified
 * rows for a daily series, but monthly verification matures only ~9 rows/
 * month for the whole 7-model pool (H∈{1,3}) — a monthly series needs a
 * proportionally longer window for per-series champion routing to clear
 * MIN_SERIES_VERIFIED_TO_ACTIVATE: 180d ≈ 6 maturity months (~50 rows at
 * steady state). */
export function accuracyWindowDays(interval: string): number {
	switch (interval) {
		case "monthly":
			return 180;
		case "weekly":
			return 90;
		default:
			return 30;
	}
}
