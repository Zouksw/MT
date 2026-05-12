/**
 * Data Ingestion - Source Registration & Scheduling
 *
 * Registers all data scrapers with the ScraperManager
 * and provides scheduling configuration.
 */

import { scraperManager } from "./scraperManager";
import { abaresScraper } from "./sources/abaresData";
import { argentinaScraper } from "./sources/argentinaData";
import { balticDryScraper } from "./sources/balticDry";
import { cepeaScraper } from "./sources/cepeaData";
import { chinaCustomsStatsScraper } from "./sources/chinaCustomsStats";
import { chinaWholesaleScraper } from "./sources/chinaWholesale";
import { cmeFuturesScraper } from "./sources/cmeFutures";
import { commodityPriceScraper } from "./sources/commodityPrices";
import { dceFuturesScraper } from "./sources/dceFutures";
import { faoPriceScraper } from "./sources/faoPrices";
import { fredScraper } from "./sources/fredData";
import { inacScraper } from "./sources/inacData";
import { mlaNlrsScraper } from "./sources/mlaNlrs";
import { secexScraper } from "./sources/secexData";
import { shippingIndexScraper } from "./sources/shippingIndex";
import { usdaAmsScraper } from "./sources/usdaAms";
import { usdaPsdScraper } from "./sources/usdaPsd";
import { weatherScraper } from "./sources/weatherData";
import { worldBankScraper } from "./sources/worldBankPrices";

export function registerAllScrapers(): void {
	// Tier 1 — Core price & exchange data
	scraperManager.registerSource("commodity_prices", commodityPriceScraper);
	scraperManager.registerSource("cme_futures", cmeFuturesScraper);
	scraperManager.registerSource("dce_futures", dceFuturesScraper);
	scraperManager.registerSource("fred", fredScraper);
	scraperManager.registerSource("fao_prices", faoPriceScraper);

	// Tier 2 — Beef supply chain (country-level trade & production)
	scraperManager.registerSource("cepea", cepeaScraper);
	scraperManager.registerSource("inac", inacScraper);
	scraperManager.registerSource("mla_nlrs", mlaNlrsScraper);
	scraperManager.registerSource("secex", secexScraper);
	scraperManager.registerSource("argentina", argentinaScraper);
	scraperManager.registerSource("abares", abaresScraper);
	scraperManager.registerSource("usda_ams", usdaAmsScraper);
	scraperManager.registerSource("usda_psd", usdaPsdScraper);

	// Tier 3 — China domestic & import data
	scraperManager.registerSource("china_wholesale", chinaWholesaleScraper);
	scraperManager.registerSource("china_customs_stats", chinaCustomsStatsScraper);

	// Tier 4 — Shipping & logistics
	scraperManager.registerSource("baltic_dry", balticDryScraper);
	scraperManager.registerSource("shipping_index", shippingIndexScraper);

	// Tier 5 — Macro & auxiliary
	scraperManager.registerSource("world_bank", worldBankScraper);
	scraperManager.registerSource("weather", weatherScraper);
}

export { scraperManager };
