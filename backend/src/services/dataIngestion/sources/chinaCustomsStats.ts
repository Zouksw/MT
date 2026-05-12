/**
 * China Customs Import Statistics (中国海关总署进口统计数据)
 *
 * Fetches monthly beef import data from China Customs statistics portal.
 * Portal: stats.customs.gov.cn
 *
 * HS Codes: 0201 (fresh/chilled), 0202 (frozen), 0206 (offal)
 * Countries: Brazil, Australia, Uruguay, Argentina, New Zealand, USA
 *
 * Data stored as MarketFactor (type: 'import_0201/0202/0206')
 * source: 'china_customs_stats'
 */

import { logger } from "@/lib";
import { monthRange, parseMonth, upsertFactor } from "../helpers";
import type { Scraper, ScraperResult } from "../scraperManager";

const HS_CODES = [
	{ code: "0201", label: "fresh_chilled_beef" },
	{ code: "0202", label: "frozen_beef" },
	{ code: "0206", label: "beef_offal" },
];

const COUNTRIES: Record<string, string> = {
	巴西: "BR",
	澳大利亚: "AU",
	乌拉圭: "UY",
	阿根廷: "AR",
	新西兰: "NZ",
	美国: "US",
};

async function fetchChinaCustomsStats(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	const end = new Date();
	const start = new Date();
	start.setMonth(start.getMonth() - 12);
	const periods = monthRange(start, end);

	for (const hs of HS_CODES) {
		try {
			const params = new URLSearchParams({
				currency: "USD",
				startMonth: periods[0],
				endMonth: periods[periods.length - 1],
				hsCode: hs.code,
				tradeType: "I",
				unit: "KG",
			});

			const res = await fetch(`https://stats.customs.gov.cn/api/trade/query?${params}`, {
				headers: {
					Accept: "application/json",
					"User-Agent": "MT/1.0",
					Referer: "https://stats.customs.gov.cn/",
				},
				signal: AbortSignal.timeout(20000),
			});

			if (!res.ok) {
				logger.warn(`[CUSTOMS_STATS] HS ${hs.code} returned ${res.status}`);
				continue;
			}

			const data = (await res.json()) as {
				data?: Array<{ month?: string; partner?: string; qty?: number; val?: number }>;
			};

			for (const row of data.data ?? []) {
				if (!row.qty || !row.val || !row.month) continue;

				const cc =
					Object.entries(COUNTRIES).find(([cn]) => row.partner?.includes(cn))?.[1] ?? "OTHER";
				const date = parseMonth(row.month);
				if (!date) continue;

				const unitPrice = row.val / (row.qty / 1000);
				const r = await upsertFactor({
					type: `import_${hs.code}`,
					region: `CN←${cc}`,
					date,
					value: unitPrice,
					unit: "USD/ton",
					source: "china_customs_stats",
					metadata: {
						hsCode: hs.code,
						quantityKg: row.qty,
						valueUsd: row.val,
						country: cc,
						month: row.month,
					},
				});
				inserted += r.inserted;
				updated += r.updated;
			}
		} catch (err) {
			logger.warn(
				`[CUSTOMS_STATS] HS ${hs.code} failed: ${err instanceof Error ? err.message : err}`,
			);
		}
	}

	if (inserted + updated === 0) {
		logger.info("[CUSTOMS_STATS] No data fetched — portal may require interactive session or VPN");
	}

	logger.info(`[CUSTOMS_STATS] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

export const chinaCustomsStatsScraper: Scraper = {
	name: "china_customs_stats",
	fetch: fetchChinaCustomsStats,
};
