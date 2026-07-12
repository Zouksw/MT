/**
 * Shared number formatters for MT.
 *
 * ONE source of truth for price / percent / compact display. Replaces the ~30
 * files of ad-hoc `toFixed(2)` / `$${x}` string concatenation with locale-aware
 * Intl.NumberFormat calls that are consistent, testable, and SSR-safe.
 *
 * Design rules (PRODUCT-SPEC, FRONTEND-IMPROVEMENT-PLAN):
 *  - Beef prices are USD/kg. formatPrice() always renders the currency symbol + unit.
 *  - Percent values are passed as fractions (0.78) OR already-scaled (78.3) — each
 *    helper is explicit about which it expects so callers can't mix them up.
 *  - Compact formatting is for large counts (price records, total lbs) only.
 */

const locales = "en-US";

// --- Price (USD/kg, the beef default) ----------------------------------------

const priceFormatter = new Intl.NumberFormat(locales, {
	minimumFractionDigits: 2,
	maximumFractionDigits: 2,
});

/**
 * Format a beef price as `$4.52`.
 * Pass `includeUnit` (default true) to append `/kg`.
 */
export function formatPrice(value: number | null | undefined, includeUnit = true): string {
	if (value == null || Number.isNaN(value)) return "--";
	const formatted = priceFormatter.format(value);
	return includeUnit ? `$${formatted}/kg` : `$${formatted}`;
}

/**
 * Format a price range as `$4.20 — $4.80`.
 * Pass `includeUnit` (default true) to append `/kg` once at the end.
 */
export function formatPriceRange(
	min: number | null | undefined,
	max: number | null | undefined,
	includeUnit = true,
): string {
	const lo = formatPrice(min, false);
	const hi = formatPrice(max, false);
	if (lo === "--" && hi === "--") return "--";
	const unit = includeUnit ? "/kg" : "";
	return `${lo} — ${hi}${unit}`;
}

// --- Percent -----------------------------------------------------------------

/**
 * Format a fractional value (0–1) as a whole-percent string: `78%`.
 * Use for confidence, anomaly probability, coverage — anything stored as a fraction.
 *
 *     formatPercent(0.783)        → "78%"
 *     formatPercent(0.783, 1)     → "78.3%"
 */
export function formatPercent(fraction: number | null | undefined, fractionDigits = 0): string {
	if (fraction == null || Number.isNaN(fraction)) return "--";
	const pct = new Intl.NumberFormat(locales, {
		style: "percent",
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	}).format(fraction);
	return pct;
}

/**
 * Format an already-scaled percent number (78.3) as `78.3%`.
 * Use when the value is already in percent units (e.g. MAPE 5.2%, day change +2.3%).
 *
 *     formatPercentValue(5.21, 1)  → "5.2%"
 *     formatPercentValue(2.3, 1)   → "2.3%"
 */
export function formatPercentValue(value: number | null | undefined, fractionDigits = 1): string {
	if (value == null || Number.isNaN(value)) return "--";
	const formatter = new Intl.NumberFormat(locales, {
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	});
	return `${formatter.format(value)}%`;
}

/**
 * Format a signed percent change with a leading sign: `+2.3%` / `-1.1%`.
 * Pass the value already scaled to percent units.
 */
export function formatSignedPercent(value: number | null | undefined, fractionDigits = 1): string {
	if (value == null || Number.isNaN(value)) return "--";
	const sign = value > 0 ? "+" : "";
	return `${sign}${formatPercentValue(value, fractionDigits)}`;
}

// --- Compact (large counts) --------------------------------------------------

const compactFormatter = new Intl.NumberFormat(locales, {
	notation: "compact",
	maximumFractionDigits: 1,
});

/**
 * Format a large count compactly: `12.3K`, `1.2M`.
 * Use for record counts, total lbs — not for prices.
 */
export function formatCompact(value: number | null | undefined): string {
	if (value == null || Number.isNaN(value)) return "--";
	return compactFormatter.format(value);
}

/**
 * Format an integer count with thousands separators: `1,234`.
 * Falls back to compact notation above the threshold (default 100k).
 */
export function formatCount(value: number | null | undefined, compactAbove = 100_000): string {
	if (value == null || Number.isNaN(value)) return "--";
	if (Math.abs(value) >= compactAbove) return compactFormatter.format(value);
	return new Intl.NumberFormat(locales).format(value);
}

// --- Raw decimal (model values, weights) -------------------------------------

/**
 * Format a raw decimal number with a fixed precision: `4.52`.
 * Use for non-price numerics (weights, model outputs without currency).
 *
 *     formatDecimal(4.5219, 2)  → "4.52"
 *     formatDecimal(0.00042, 4) → "0.0004"
 */
export function formatDecimal(value: number | null | undefined, fractionDigits = 2): string {
	if (value == null || Number.isNaN(value)) return "--";
	return new Intl.NumberFormat(locales, {
		minimumFractionDigits: fractionDigits,
		maximumFractionDigits: fractionDigits,
	}).format(value);
}

/**
 * Normalize a value that might be a Prisma Decimal, a string, or a number
 * into a plain number. Returns NaN for null/undefined/unparseable input.
 *
 *     toNum(dec)      → number
 *     toNum("4.52")   → 4.52
 *     toNum(null)     → NaN
 */
export function toNum(value: number | string | { toNumber(): number } | null | undefined): number {
	if (value == null) return Number.NaN;
	if (typeof value === "number") return value;
	if (typeof value === "string") return Number.parseFloat(value);
	if (typeof value.toNumber === "function") return value.toNumber();
	return Number.NaN;
}
