/**
 * FAO Food Price Index Scraper
 *
 * Fetches food price indices from FAOSTAT.
 * API: https://fenixservices.fao.org/faostat/api/v1/en/data/CP
 * Free, no API key required.
 *
 * Covers: Food, Meat, Dairy, Cereals, Oils price indices
 */

import { logger, prisma } from "@/lib";
import { upsertPrice } from "../helpers";
import type { Scraper, ScraperResult } from "../scraperManager";

const FAO_INDICES: Record<string, { itemCode: string; slug: string }> = {
	food_index: { itemCode: "21012", slug: "fao_food_index" },
	meat_index: { itemCode: "21013", slug: "fao_meat_index" },
	dairy_index: { itemCode: "21014", slug: "fao_dairy_index" },
	cereals_index: { itemCode: "21015", slug: "fao_cereals_index" },
	oils_index: { itemCode: "21017", slug: "fao_oils_index" },
};

/**
 * Fetch with at most one retry, but ONLY for transient HTTP failures.
 *
 * Bug being fixed (round-63, 2026-08-02): the previous version retried
 * EVERY failure — deterministic server errors (5xx / 521-origin-down /
 * 404) AND network timeouts — with a 30s timeout. When the FAO origin
 * was unreachable from this host (HTTP 000 / connection timeout), 5
 * indices × 2 attempts × 30s + sleeps ≈ 272s, stalling the whole
 * scraper batch ~5 minutes every run. The scraper then returned 0 rows
 * but was logged "succeeded" by scraperManager — masking the outage as
 * a silent no-op.
 *
 * Fix strategy:
 * - Timeout cut 30s → 8s (aligns with the 10-15s convention in sibling
 *   scrapers; FAO returns JSON, 8s is ample for a healthy response).
 * - Network errors (timeout / DNS / refused): NO retry. If the host is
 *   unreachable, retrying 2s later hits the same condition; the retry
 *   only doubled the stall. (A flapping network would 50/50, but FAO
 *   is a single origin — it's either up or down, not flapping per-
 *   request.) Log once, return null.
 * - HTTP 429 (rate limit) / 5xx-other-than-521: retry once (these are
 *   conventionally transient and a retry is cheap when the host
 *   actually responded).
 * - HTTP 4xx-other-than-429 / 521 (Cloudflare origin-down): no retry
 *   (deterministic; the origin is hard-down, retrying cannot help).
 */
export async function fetchWithRetry(url: string): Promise<Response | null> {
	try {
		const res = await fetch(url, {
			headers: { Accept: "application/json" },
			signal: AbortSignal.timeout(8000),
		});
		if (res.ok) return res;

		// 429 and 5xx-except-521 are conventionally transient — one retry.
		const transient = res.status === 429 || (res.status >= 500 && res.status !== 521);
		if (transient) {
			logger.warn(`[FAO] API returned ${res.status} (retrying once)`);
			await new Promise((r) => setTimeout(r, 2000));
			try {
				const retry = await fetch(url, {
					headers: { Accept: "application/json" },
					signal: AbortSignal.timeout(8000),
				});
				if (retry.ok) return retry;
				logger.warn(`[FAO] Retry returned ${retry.status} (giving up)`);
			} catch (err) {
				logger.warn(`[FAO] Retry failed: ${err instanceof Error ? err.message : err}`);
			}
		} else {
			// 4xx / 521 — deterministic, no retry.
			logger.warn(`[FAO] API returned ${res.status} (not retried)`);
		}
		return null;
	} catch (err) {
		// Network timeout / DNS failure / connection refused — single
		// attempt, no retry. The host is unreachable; a 2s-later retry
		// hits the same condition and only doubles the stall.
		logger.warn(`[FAO] Fetch failed (not retried): ${err instanceof Error ? err.message : err}`);
		return null;
	}
}

async function fetchFAOPrices(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	for (const [, config] of Object.entries(FAO_INDICES)) {
		const commodity = await prisma.commodity.findUnique({ where: { slug: config.slug } });
		if (!commodity) continue;

		const url = `https://fenixservices.fao.org/faostat/api/v1/en/data/CP?area_code=351&item_code=${config.itemCode}&element_code=5510&year=2024,2025,2026&show_codes=true&show_unit=true`;
		const res = await fetchWithRetry(url);
		if (!res) continue;

		const data = (await res.json()) as {
			data?: Array<{ Year: string; Value: string; Flag: string }>;
		};
		const rows = data.data ?? [];
		if (rows.length === 0) continue;

		const latest = rows[rows.length - 1];
		const year = parseInt(latest.Year, 10);
		const value = parseFloat(latest.Value);
		if (!value || Number.isNaN(value) || !year) continue;

		// FAO data is annual — use Jan 1 of the year
		const date = new Date(year, 0, 1);

		const r = await upsertPrice({
			commodityId: commodity.id,
			date,
			interval: "yearly",
			source: "fao_faostat",
			open: value,
			high: value * 1.01,
			low: value * 0.99,
			close: value,
			metadata: { itemCode: config.itemCode, year, flag: latest.Flag },
		});
		inserted += r.inserted;
		updated += r.updated;
	}

	logger.info(`[FAO] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

export const faoPriceScraper: Scraper = { name: "fao_prices", fetch: fetchFAOPrices };
