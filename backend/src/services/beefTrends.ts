/**
 * Beef price trend computation (PRODUCT-SPEC §5.1 design completeness).
 *
 * The dashboard hero (进口均价 / 国产均价 cards) shows current average prices
 * but, per the spec mockup, should ALSO show a period-over-period delta
 * (↓1.2% / ↑0.5%). Until round-57 the backend returned only the latest-day
 * rows, so the frontend hard-coded `null` trends (useDashboardStats.ts) and
 * the StatCard hid its trend badge — a visible design gap.
 *
 * This module computes the origin-split trend: given the latest-day price
 * rows and the previous-distinct-day rows, return the % change in the
 * imported-average and domestic-average. "Previous distinct day" (not
 * "7 days ago") is used because beef data is often daily-but-irregular;
 * falling back to the actual prior available day gives an honest delta
 * even when the cadence isn't exactly 7 days.
 */

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
