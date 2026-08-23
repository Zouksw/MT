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
 * Thresholds = ~2× the natural publication rhythm (a missed publication must
 * not fire, two in a row must):
 *  - daily: 7 days (unchanged historical STALE_WINDOW_DAYS semantics)
 *  - monthly: 60 days (FRED PBEEFUSDM publishes month M around mid-M+1, so
 *    normal point-date gaps reach ~45d; 60 sits above that worst case)
 *
 * Deletion test: remove this module and the thresholds scatter back into N
 * callers — it earns its keep as the single policy seam.
 */

export type SeriesInterval = "daily" | "weekly" | "monthly";

/** Days after a series' latest point beyond which it counts as stale. */
export function stalenessWindowDays(interval: string): number {
	switch (interval) {
		case "monthly":
			return 60;
		case "weekly":
			return 21;
		case "daily":
		default:
			return 7;
	}
}
