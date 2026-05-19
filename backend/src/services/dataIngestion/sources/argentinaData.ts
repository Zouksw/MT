/**
 * Argentina Beef Export Data (阿根廷牛肉出口数据)
 *
 * Monthly Argentine beef export stats from INDEC/CICCRA.
 * Argentina exports ~70% of beef to China.
 *
 * NOTE: INDEC publishes Excel, which we can't parse without xlsx library.
 * CICCRA may require VPN. This scraper will log and return empty until
 * we add xlsx parsing or a suitable API is found.
 *
 * Data stored as MarketFactor (type: 'export_beef')
 * source: 'argentina_indec'
 */

import { logger } from "@/lib";
import type { Scraper, ScraperResult } from "../scraperManager";

async function fetchArgentina(): Promise<ScraperResult> {
	// INDEC provides Excel files only — need xlsx parser to automate.
	// For now this is a documented placeholder that logs the status.
	logger.info(
		"[ARGENTINA] INDEC data requires Excel parser — not yet automated. Consider manual CSV import.",
	);
	return { inserted: 0, updated: 0 };
}

export const argentinaScraper: Scraper = { name: "argentina", fetch: fetchArgentina };
