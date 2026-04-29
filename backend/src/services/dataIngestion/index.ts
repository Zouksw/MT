/**
 * Data Ingestion - Source Registration & Scheduling
 *
 * Registers all data scrapers with the ScraperManager
 * and provides scheduling configuration.
 */

import { scraperManager } from './scraperManager';
import { commodityPriceScraper } from './sources/commodityPrices';
import { weatherScraper } from './sources/weatherData';
import { usdaAmsScraper } from './sources/usdaAms';
import { faoPriceScraper } from './sources/faoPrices';
import { worldBankScraper } from './sources/worldBankPrices';
import { usdaPsdScraper } from './sources/usdaPsd';
import { fredScraper } from './sources/fredData';
import { cmeFuturesScraper } from './sources/cmeFutures';
import { abaresScraper } from './sources/abaresData';
import { chinaWholesaleScraper } from './sources/chinaWholesale';
import { chinaCustomsScraper } from './sources/chinaCustoms';
import { dceFuturesScraper } from './sources/dceFutures';
import { balticDryScraper } from './sources/balticDry';

export function registerAllScrapers(): void {
  // Tier 1 — Original sources
  scraperManager.registerSource('commodity_prices', commodityPriceScraper);
  scraperManager.registerSource('weather', weatherScraper);
  scraperManager.registerSource('usda_ams', usdaAmsScraper);
  scraperManager.registerSource('fao_prices', faoPriceScraper);

  // Tier 1 — Public data sources
  scraperManager.registerSource('world_bank', worldBankScraper);
  scraperManager.registerSource('usda_psd', usdaPsdScraper);
  scraperManager.registerSource('fred', fredScraper);

  // Tier 2 — Exchange / scraping sources
  scraperManager.registerSource('cme_futures', cmeFuturesScraper);
  scraperManager.registerSource('abares', abaresScraper);
  scraperManager.registerSource('china_wholesale', chinaWholesaleScraper);

  // Tier 3 — Advanced data sources
  scraperManager.registerSource('china_customs', chinaCustomsScraper);
  scraperManager.registerSource('dce_futures', dceFuturesScraper);
  scraperManager.registerSource('baltic_dry', balticDryScraper);
}

export { scraperManager };
