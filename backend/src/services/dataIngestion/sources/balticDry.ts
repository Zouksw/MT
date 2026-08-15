/**
 * Baltic Dry Index (BDI) — Shipping Cost Indicator
 *
 * Source: FRED series BALTIC_DRY (requires FRED_API_KEY).
 *
 * round-63 (2026-08-02): removed the dead "primary" path —
 * api.balticexchange.com/api/v1/bdi/latest returns HTTP 404 unconditionally
 * (Baltic Exchange data is a paid subscription, not a public API). The path
 * could never succeed and wasted ~1.5s per run hitting a 404. FRED is the
 * only real source; it activates when FRED_API_KEY is set.
 *
 * Data stored as CommodityPrice with source: 'baltic'.
 */

import { logger } from "@/lib";
import { ensureCommodity, upsertPrice } from "../helpers";
import type { Scraper, ScraperResult } from "../scraperManager";

const BDI_SLUG = "baltic_dry_index";

async function fetchBalticDry(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	const fredKey = process.env.FRED_API_KEY;
	if (!fredKey) {
		logger.info("[BDI] FRED_API_KEY not set — skipping (no data source available)");
		return { inserted, updated };
	}

	try {
		const res = await fetch(
			`https://api.stlouisfed.org/fred/series/observations?series_id=BALTIC_DRY&api_key=${fredKey}&observation_start=2025-01-01&sort_order=desc&file_type=json`,
			{ signal: AbortSignal.timeout(10000) },
		);
		if (res.ok) {
			const data = (await res.json()) as { observations: Array<{ date: string; value: string }> };
			const commodity = await ensureCommodity({
				slug: BDI_SLUG,
				name: "Baltic Dry Index",
				nameCn: "波罗的海干散货指数",
				category: "shipping",
				unit: "index",
				metadata: { source: "baltic" },
			});

			for (const obs of data.observations.filter((o) => o.value !== ".").slice(0, 30)) {
				const value = parseFloat(obs.value);
				const date = new Date(`${obs.date}T00:00:00Z`);
				if (Number.isNaN(value) || Number.isNaN(date.getTime())) continue;

				const r = await upsertPrice({
					commodityId: commodity.id,
					date,
					source: "baltic",
					// Daily index — one value per day, write the honest flat
					// candle (round-104), not a fabricated ±1% band.
					open: value,
					high: value,
					low: value,
					close: value,
					metadata: { dataSource: "fred" },
				});
				inserted += r.inserted;
				updated += r.updated;
			}
		}
	} catch (err) {
		logger.warn(`[BDI] FRED fetch failed: ${err instanceof Error ? err.message : err}`);
	}

	logger.info(`[BDI] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

export const balticDryScraper: Scraper = { name: "baltic_dry", fetch: fetchBalticDry };
