/**
 * ABARES Australian Agricultural Data
 *
 * Quarterly beef production, herd, slaughter, export from ABARES reports.
 * Portal: agriculture.gov.au/abares
 *
 * Attempts HTML scraping; falls back gracefully if page structure changes.
 * Data stored as MarketFactor (type: production/slaughter/export/price/herd)
 */

import { logger } from "@/lib";
import { upsertFactor } from "../helpers";
import type { Scraper, ScraperResult } from "../scraperManager";

const INDICATORS = [
	{
		pattern: /beef[^<]*production[^<]*(?:\d{4})[^<]*?(\d+[.,]\d+)/i,
		type: "production",
		unit: "kt",
	},
	{ pattern: /cattle[^<]*slaughter[^<]*?(\d+[.,]\d+)/i, type: "slaughter", unit: "million head" },
	{ pattern: /beef[^<]*export[^<]*?(\d+[.,]\d+)/i, type: "export", unit: "kt" },
	{ pattern: /adult[^<]*cattle[^<]*price[^<]*?(\d+[.,]\d+)/i, type: "price", unit: "AUD/kg" },
	{ pattern: /herd[^<]*size[^<]*?(\d+[.,]\d+)/i, type: "herd", unit: "million head" },
];

async function fetchABARESData(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	try {
		const res = await fetch(
			"https://www.agriculture.gov.au/abares/research-topics/agricultural-commodities",
			{
				headers: {
					Accept: "text/html",
					"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
				},
				signal: AbortSignal.timeout(20000),
			},
		);

		if (!res.ok) {
			logger.warn(`[ABARES] Page returned ${res.status}`);
			return { inserted, updated };
		}

		const html = await res.text();
		const dm = html.match(/(\d{4})[–-](\d{2,4})\s*(?:financial year|fiscal|quarter)/i);
		const year = dm ? parseInt(dm[1]) : new Date().getFullYear();
		const date = new Date(`${year}-07-01T00:00:00Z`);

		for (const ind of INDICATORS) {
			const m = html.match(ind.pattern);
			if (!m) continue;
			const value = parseFloat(m[1].replace(",", ""));
			if (Number.isNaN(value)) continue;

			const r = await upsertFactor({
				type: ind.type,
				region: "AU",
				date,
				value,
				unit: ind.unit,
				source: "abares",
				metadata: { fiscalYear: `${year}-${year + 1}` },
			});
			inserted += r.inserted;
			updated += r.updated;
		}
	} catch (err) {
		logger.warn(`[ABARES] Fetch failed: ${err instanceof Error ? err.message : err}`);
	}

	if (inserted + updated === 0)
		logger.info("[ABARES] No data fetched — report may need manual download");
	logger.info(`[ABARES] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

export const abaresScraper: Scraper = { name: "abares", fetch: fetchABARESData };
