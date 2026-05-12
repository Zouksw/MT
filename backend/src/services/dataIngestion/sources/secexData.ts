/**
 * Brazil SECEX Export Data (巴西外贸秘书处出口数据)
 *
 * Monthly Brazilian beef export: volume, value, unit price by destination.
 * Portal: comexstat.mdic.gov.br
 * HS: 0201 (fresh), 0202 (frozen)
 *
 * Data stored as MarketFactor (type: 'export_0201/0202')
 * source: 'secex'
 */

import { logger } from "@/lib";
import { monthRange, parseMonth, upsertFactor } from "../helpers";
import type { Scraper, ScraperResult } from "../scraperManager";

const HS_CODES = ["0201", "0202"];

async function fetchSECEX(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	const end = new Date();
	const start = new Date();
	start.setMonth(start.getMonth() - 12);

	for (const hsCode of HS_CODES) {
		try {
			const res = await fetch("https://comexstat.mdic.gov.br/api/comexstat/data/product", {
				method: "POST",
				headers: { "Content-Type": "application/json", Accept: "application/json" },
				body: JSON.stringify({
					interval: "month",
					"flow-type": "export",
					"ncm-list": [hsCode],
					"period-list": monthRange(start, end),
					"unit-measure": "kg",
					option: "all",
				}),
				signal: AbortSignal.timeout(30000),
			});

			if (!res.ok) {
				logger.warn(`[SECEX] HS ${hsCode} returned ${res.status}`);
				continue;
			}

			const data = (await res.json()) as {
				data?: Array<{ coPais?: string; month?: string; kg?: number; fobValue?: number }>;
			};

			for (const row of data.data ?? []) {
				if (!row.kg || !row.fobValue || !row.month) continue;
				const date = parseMonth(row.month);
				if (!date) continue;

				const unitPrice = row.fobValue / (row.kg / 1000);
				const r = await upsertFactor({
					type: `export_${hsCode}`,
					region: `BR→${row.coPais ?? "OTHER"}`,
					date,
					value: unitPrice,
					unit: "USD/ton FOB",
					source: "secex",
					metadata: {
						hsCode,
						quantityKg: row.kg,
						valueUsd: row.fobValue,
						destination: row.coPais,
						month: row.month,
					},
				});
				inserted += r.inserted;
				updated += r.updated;
			}
		} catch (err) {
			logger.warn(`[SECEX] HS ${hsCode} failed: ${err instanceof Error ? err.message : err}`);
		}
	}

	if (inserted + updated === 0)
		logger.info("[SECEX] No data fetched — API may need VPN or specific parameters");
	logger.info(`[SECEX] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

export const secexScraper: Scraper = { name: "secex", fetch: fetchSECEX };
