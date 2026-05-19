/**
 * Shanghai Shipping Exchange Index (上海航运交易所运价指数)
 *
 * Fetches CCFI and SCFI data. Key routes: South America, Oceania.
 * Portal: www.sse.net.cn
 *
 * Data stored as MarketFactor (type: 'shipping_cost')
 */

import { logger } from "@/lib";
import { upsertFactor } from "../helpers";
import type { Scraper, ScraperResult } from "../scraperManager";

const SCFI_ROUTES: Record<string, string> = {
	Europe: "CN→EUROPE",
	Mediterranean: "CN→MEDITERRANEAN",
	"North America": "CN→NA",
	"South America": "CN→SA",
	Australia: "CN→OCEANIA",
	WestAfrica: "CN→W_AFRICA",
	PersianGulf: "CN→MIDDLE_EAST",
};

const CCFI_ROUTES: Record<string, string> = {
	南美: "CN→SA_EAST",
	澳新: "CN→OCEANIA",
};

async function extractDate(html: string): Promise<Date | null> {
	const m = html.match(/(\d{4})[年-](\d{1,2})[月-](\d{1,2})/);
	if (!m) return null;
	return new Date(`${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}T00:00:00Z`);
}

function extractValue(html: string, pattern: RegExp): number | null {
	const m = html.match(pattern);
	if (!m) return null;
	const v = parseFloat(m[1].replace(",", ""));
	return Number.isNaN(v) ? null : v;
}

async function fetchPage(path: string): Promise<string | null> {
	try {
		const res = await fetch(`https://www.sse.net.cn${path}`, {
			headers: {
				Accept: "text/html",
				"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
			},
			signal: AbortSignal.timeout(15000),
		});
		return res.ok ? await res.text() : null;
	} catch {
		// intentionally ignored — network error, return null to skip
		return null;
	}
}

async function fetchShippingIndex(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	const [scfiHtml, ccfiHtml] = await Promise.all([
		fetchPage("/index/scfi"),
		fetchPage("/index/ccfi"),
	]);

	for (const [html, source] of [
		[scfiHtml, "scfi"],
		[ccfiHtml, "ccfi"],
	] as const) {
		if (!html) {
			logger.warn(`[SHIPPING] ${source.toUpperCase()} page unavailable`);
			continue;
		}

		const date = await extractDate(html);
		if (!date) {
			logger.warn(`[SHIPPING] ${source.toUpperCase()} no date found`);
			continue;
		}

		// Composite index
		const compositePattern =
			source === "scfi" ? /综合指数[^\d]*(\d+[.,]\d+)/ : /(?:综合指数|CCFI)[^\d]*(\d+[.,]\d+)/;
		const composite = extractValue(html, compositePattern);
		if (composite) {
			const r = await upsertFactor({
				type: "shipping_cost",
				region: `${source.toUpperCase()}_COMPOSITE`,
				date,
				value: composite,
				unit: "index",
				source,
			});
			inserted += r.inserted;
			updated += r.updated;
		}

		// Route-specific indices
		const routes = source === "scfi" ? SCFI_ROUTES : CCFI_ROUTES;
		for (const [name, region] of Object.entries(routes)) {
			const pattern = new RegExp(`${name}[^\\d]*(\\d+[\\.,]\\d+)`, "i");
			const val = extractValue(html, pattern);
			if (val) {
				const r = await upsertFactor({
					type: "shipping_cost",
					region,
					date,
					value: val,
					unit: "index",
					source,
				});
				inserted += r.inserted;
				updated += r.updated;
			}
		}
	}

	if (inserted + updated === 0) logger.warn("[SHIPPING] No data fetched from SSE");
	logger.info(`[SHIPPING] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

export const shippingIndexScraper: Scraper = { name: "shipping_index", fetch: fetchShippingIndex };
