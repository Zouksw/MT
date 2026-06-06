/**
 * Baltic Dry Index (BDI) — Shipping Cost Indicator
 *
 * Primary: Baltic Exchange API (often unavailable)
 * Fallback: FRED series BALTIC_DRY (requires FRED_API_KEY)
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

	// Primary: Baltic Exchange API
	try {
		const res = await fetch("https://api.balticexchange.com/api/v1/bdi/latest", {
			headers: { Accept: "application/json", "User-Agent": "MT/1.0" },
			signal: AbortSignal.timeout(15000),
		});
		if (res.ok) {
			const data = (await res.json()) as {
				date: string;
				value: number;
				cape: number;
				panamax: number;
				supramax: number;
				change: number;
			};
			const date = new Date(`${data.date}T00:00:00Z`);
			if (!Number.isNaN(data.value) && !Number.isNaN(date.getTime())) {
				const commodity = await ensureCommodity({
					slug: BDI_SLUG,
					name: "Baltic Dry Index",
					nameCn: "波罗的海干散货指数",
					category: "shipping",
					unit: "index",
					metadata: { source: "baltic" },
				});
				const r = await upsertPrice({
					commodityId: commodity.id,
					date,
					source: "baltic",
					open: data.value + (data.change ?? 0),
					high: data.value * 1.01,
					low: data.value * 0.99,
					close: data.value,
					metadata: {
						cape: data.cape,
						panamax: data.panamax,
						supramax: data.supramax,
						change: data.change,
						dataSource: "baltic_exchange",
					},
				});
				inserted += r.inserted;
				updated += r.updated;
			}
		}
	} catch (error) {
		logger.info("[BDI] Baltic Exchange API unavailable, trying FRED", error);
	}

	// Fallback: FRED
	const fredKey = process.env.FRED_API_KEY;
	if (fredKey) {
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
						open: value,
						high: value * 1.01,
						low: value * 0.99,
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
	}

	logger.info(`[BDI] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

export const balticDryScraper: Scraper = { name: "baltic_dry", fetch: fetchBalticDry };
