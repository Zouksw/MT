/**
 * CEPEA/B3 — Brazilian Beef Price Index
 *
 * Covers: Boi Gordo (fat ox) daily price (BRL/arroba), export FOB prices
 * Source: https://www.cepea.esalq.usp.br/br/indicador/boi-gordo.aspx
 * Free, public data — scraped from website
 * Frequency: Daily
 */

import { logger } from "@/lib";
import { ensureCommodity, latestUsdRate, upsertPrice } from "../helpers";
import type { Scraper, ScraperResult } from "../scraperManager";

const CEPEA_URL = "https://www.cepea.esalq.usp.br/br/indicador/boi-gordo.aspx";

async function fetchCepeaData(): Promise<ScraperResult> {
	let inserted = 0;
	const updated = 0;

	try {
		const res = await fetch(CEPEA_URL, {
			headers: {
				Accept: "text/html",
				"User-Agent": "Mozilla/5.0 (compatible; MT/1.0)",
			},
			signal: AbortSignal.timeout(15000),
		});

		if (res.ok) {
			const html = await res.text();
			const priceMatch = html.match(/R\$\s*([\d.,]+)\s*\/@/);
			if (priceMatch) {
				const brlPerArroba = parseFloat(priceMatch[1].replace(".", "").replace(",", "."));
				if (!Number.isNaN(brlPerArroba)) {
					// Live BRL→USD from the brl_usd series — the previous
					// hardcoded 0.18 drifted up to ~8% (round-104). No rate
					// → omit usdPerKg from metadata (honest absence).
					const usdPerBrl = await latestUsdRate("brl_usd");
					const usdPerKg = usdPerBrl !== null ? (brlPerArroba / 14.688) * usdPerBrl : null;

					const commodity = await ensureCommodity({
						slug: "boi_gordo_br",
						name: "Boi Gordo (Brazil Fat Ox)",
						nameCn: "巴西肥牛指数",
						category: "live_cattle",
						unit: "BRL/arroba",
						currency: "BRL",
						metadata: { source: "cepea" },
					});

					const date = new Date();
					date.setHours(0, 0, 0, 0);

					const priceResult = await upsertPrice({
						commodityId: commodity.id,
						date,
						interval: "daily",
						// CEPEA publishes one indicator value per day — write the
						// honest flat candle (round-104), not ±0.5% fabricated
						// wicks.
						open: brlPerArroba,
						high: brlPerArroba,
						low: brlPerArroba,
						close: brlPerArroba,
						source: "cepea",
						metadata: {
							brlPerArroba,
							...(usdPerKg !== null ? { usdPerKg: parseFloat(usdPerKg.toFixed(2)) } : {}),
						},
					});
					inserted += priceResult.inserted;
				}
			}
		}
	} catch (err) {
		logger.warn(`[CEPEA] Live fetch failed: ${err instanceof Error ? err.message : err}`);
	}

	if (inserted === 0 && updated === 0) {
		logger.warn("[CEPEA] No data fetched from live source");
	}

	return { inserted, updated };
}

export const cepeaScraper: Scraper = {
	name: "cepea",
	fetch: fetchCepeaData,
};
