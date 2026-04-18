/**
 * Data Ingestion - Source Registration & Scheduling
 *
 * Registers all data scrapers with the ScraperManager
 * and provides scheduling configuration.
 */

import { scraperManager } from './scraperManager';
import { commodityPriceScraper } from './sources/commodityPrices';
import { weatherScraper } from './sources/weatherData';

export function registerAllScrapers(): void {
  scraperManager.registerSource('commodity_prices', commodityPriceScraper);
  scraperManager.registerSource('weather', weatherScraper);
}

export { scraperManager };
