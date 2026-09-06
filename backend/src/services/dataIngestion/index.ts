/**
 * Data Ingestion - Source Registration & Scheduling
 *
 * Registers all data scrapers with the ScraperManager
 * and provides scheduling configuration.
 */

import { scraperManager } from "./scraperManager";
import { abaresScraper } from "./sources/abaresData";
import { argentinaExportsScraper } from "./sources/argentinaExports";
import { balticDryScraper } from "./sources/balticDry";
import { cepeaScraper } from "./sources/cepeaData";
import { cmeFuturesScraper } from "./sources/cmeFutures";
import { commodityPriceScraper } from "./sources/commodityPrices";
import { comtradeMirrorScraper } from "./sources/comtradeMirror";
import { dceFuturesScraper } from "./sources/dceFutures";
import { faoPriceScraper } from "./sources/faoPrices";
import { fredScraper } from "./sources/fredData";
import { ibgeSidraScraper } from "./sources/ibgeSidra";
import { mlaNlrsScraper } from "./sources/mlaNlrs";
import { secexScraper } from "./sources/secexData";
import { shippingIndexScraper } from "./sources/shippingIndex";
import { usdaAmsScraper } from "./sources/usdaAms";
import { usdaImportBeefScraper } from "./sources/usdaImportBeef";
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
	// "inac" decommissioned 2026-08-15: www.inac.gub.uy hangs (connection
	// timeout on every path, direct AND via the mihomo exit — only the gub.uy
	// portal answers). Every daily cycle burned a timed-out fetch to report
	// success+0 rows. Source file kept for a future revival; re-register in
	// both places (here + DAILY_SOURCES in server.ts) if the site returns.
	scraperManager.registerSource("mla_nlrs", mlaNlrsScraper);
	scraperManager.registerSource("secex", secexScraper);
	scraperManager.registerSource("abares", abaresScraper);
	// Argentina monthly meat-rubro FOB exports (SSPM/INDEC ICA via
	// datos.gob.ar, keyless) — the deliberate degradation tier for AR's
	// missing Comtrade monthlies: product family × world, no destination
	// cross (registered gap; V8 批2, round-151).
	scraperManager.registerSource("argentina_exports", argentinaExportsScraper);
	// Brazil official quarterly bovine slaughter (IBGE SIDRA t/1092, keyless —
	// the only one of the four round-157-verified official APIs with zero
	// dependencies; round-158 批B). MarketFactor analysis face, not a
	// prediction series.
	scraperManager.registerSource("ibge_sidra", ibgeSidraScraper);
	scraperManager.registerSource("usda_ams", usdaAmsScraper);
	// Weekly US import manufacturing-beef benchmark (NW_LS421 PDF, keyless —
	// the MARS API behind usda_ams is key-gated and mymarketnews hosts are
	// egress-blocked from this machine; V7 批1, round-149).
	scraperManager.registerSource("usda_import_beef", usdaImportBeefScraper);
	scraperManager.registerSource("usda_psd", usdaPsdScraper);

	// Tier 3 — China import data
	// "china_customs_stats" decommissioned 2026-08-31 (V8 批0, D23): its
	// stats.customs.gov.cn endpoint was fabricated (never produced a row) and
	// the host is egress-blocked — every daily run paid a timeout to report
	// success+0 rows. Replaced by comtrade_mirror (partner-reported exports
	// to China, keyless). Source file kept; re-register in both places (here
	// + DAILY_SOURCES in server.ts) only after the official portal becomes
	// reachable AND the real endpoint contract is verified.
	// "china_wholesale" decommissioned 2026-09-06 (round-155): the domestic
	// (CN-market) dimension was removed from the product — the platform is
	// beef-foreign-trade only. The source was additionally dead the whole
	// time (mara.gov.cn egress-blocked, zero rows ever). Source file kept;
	// do NOT re-register unless the domestic dimension is reinstated AND the
	// host becomes reachable.
	scraperManager.registerSource("comtrade_mirror", comtradeMirrorScraper);

	// Tier 4 — Shipping & logistics
	scraperManager.registerSource("baltic_dry", balticDryScraper);
	scraperManager.registerSource("shipping_index", shippingIndexScraper);

	// Tier 5 — Macro & auxiliary
	scraperManager.registerSource("world_bank", worldBankScraper);
	scraperManager.registerSource("weather", weatherScraper);
}

export { scraperManager };
