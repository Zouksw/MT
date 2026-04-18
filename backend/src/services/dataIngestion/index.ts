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

export function registerAllScrapers(): void {
  scraperManager.registerSource('commodity_prices', commodityPriceScraper);
  scraperManager.registerSource('weather', weatherScraper);
  scraperManager.registerSource('usda_ams', usdaAmsScraper);
  scraperManager.registerSource('fao_prices', faoPriceScraper);
}

export { scraperManager };
