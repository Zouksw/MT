/**
 * DCE (Dalian Commodity Exchange) + CZCE (Zhengzhou Commodity Exchange) Futures
 *
 * Fetches daily settlement data from Chinese futures exchanges.
 * DCE: soybean meal, corn, palm oil, iron ore, coke
 * CZCE: cotton, sugar, wheat, rapeseed oil, methanol
 *
 * Uses public exchange data endpoints.
 * Data stored as CommodityPrice with source: 'dce' / 'czce'.
 */

import type { Prisma } from "@prisma/client";
import { logger, prisma } from "@/lib";
import type { Scraper, ScraperResult } from "../scraperManager";

const DCE_PRODUCTS: Record<
	string,
	{
		slug: string;
		name: string;
		nameCn: string;
		unit: string;
		basePrice: number;
	}
> = {
	m: {
		slug: "soybean_meal_dce",
		name: "Soybean Meal (DCE)",
		nameCn: "豆粕（大商所）",
		unit: "CNY/ton",
		basePrice: 3200,
	},
	c: {
		slug: "corn_dce",
		name: "Corn (DCE)",
		nameCn: "玉米（大商所）",
		unit: "CNY/ton",
		basePrice: 2450,
	},
	p: {
		slug: "palm_oil_dce",
		name: "Palm Oil (DCE)",
		nameCn: "棕榈油（大商所）",
		unit: "CNY/ton",
		basePrice: 8200,
	},
	i: {
		slug: "iron_ore_dce",
		name: "Iron Ore (DCE)",
		nameCn: "铁矿石（大商所）",
		unit: "CNY/ton",
		basePrice: 780,
	},
	j: {
		slug: "coke_dce",
		name: "Coke (DCE)",
		nameCn: "焦炭（大商所）",
		unit: "CNY/ton",
		basePrice: 2200,
	},
	y: {
		slug: "soybean_oil_dce",
		name: "Soybean Oil (DCE)",
		nameCn: "豆油（大商所）",
		unit: "CNY/ton",
		basePrice: 7800,
	},
};

const CZCE_PRODUCTS: Record<
	string,
	{
		slug: string;
		name: string;
		nameCn: string;
		unit: string;
		basePrice: number;
	}
> = {
	CF: {
		slug: "cotton_czce",
		name: "Cotton (CZCE)",
		nameCn: "棉花（郑商所）",
		unit: "CNY/ton",
		basePrice: 14800,
	},
	SR: {
		slug: "sugar_czce",
		name: "Sugar (CZCE)",
		nameCn: "白糖（郑商所）",
		unit: "CNY/ton",
		basePrice: 6200,
	},
	WH: {
		slug: "wheat_czce",
		name: "Strong Wheat (CZCE)",
		nameCn: "强麦（郑商所）",
		unit: "CNY/ton",
		basePrice: 3100,
	},
	TA: {
		slug: "pta_czce",
		name: "PTA (CZCE)",
		nameCn: "PTA（郑商所）",
		unit: "CNY/ton",
		basePrice: 5600,
	},
};

async function fetchDCEFutures(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	// Fetch DCE data
	for (const [symbol, config] of Object.entries(DCE_PRODUCTS)) {
		try {
			const url = `http://www.dce.com.cn/publicweb/quotesdata/jsp/settlement/${symbol}.json`;
			const res = await fetch(url, {
				headers: { Accept: "application/json", "User-Agent": "MT/1.0" },
				signal: AbortSignal.timeout(10000),
			});

			if (!res.ok) continue;
			const data = (await res.json()) as {
				data?: Array<{
					settlement: string;
					date: string;
					open: string;
					high: string;
					low: string;
					volume: string;
				}>;
			};
			if (!data.data?.length) continue;

			const frontMonth = data.data[0];
			const settle = parseFloat(frontMonth.settlement);
			if (Number.isNaN(settle)) continue;

			const date = new Date(`${frontMonth.date}T00:00:00Z`);
			if (Number.isNaN(date.getTime())) continue;

			const result = await upsertFuturesPrice(
				config,
				settle,
				frontMonth,
				"dce",
			);
			inserted += result.inserted;
			updated += result.updated;
		} catch (err) {
			logger.warn(
				`[DCE] ${symbol} failed: ${err instanceof Error ? err.message : err}`,
			);
		}
	}

	// Fetch CZCE data
	for (const [symbol, config] of Object.entries(CZCE_PRODUCTS)) {
		try {
			const url = `http://www.czce.com.cn/cnjysj/ccpm/${symbol}.json`;
			const res = await fetch(url, {
				headers: { Accept: "application/json", "User-Agent": "MT/1.0" },
				signal: AbortSignal.timeout(10000),
			});

			if (!res.ok) continue;
			const data = (await res.json()) as {
				data?: Array<{
					settlement: string;
					date: string;
					open: string;
					high: string;
					low: string;
				}>;
			};
			if (!data.data?.length) continue;

			const frontMonth = data.data[0];
			const settle = parseFloat(frontMonth.settlement);
			if (Number.isNaN(settle)) continue;

			const date = new Date(`${frontMonth.date}T00:00:00Z`);
			if (Number.isNaN(date.getTime())) continue;

			const result = await upsertFuturesPrice(
				config,
				settle,
				frontMonth,
				"czce",
			);
			inserted += result.inserted;
			updated += result.updated;
		} catch (err) {
			logger.warn(
				`[CZCE] ${symbol} failed: ${err instanceof Error ? err.message : err}`,
			);
		}
	}

	logger.info(`[DCE/CZCE] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

async function upsertFuturesPrice(
	config: {
		slug: string;
		name: string;
		nameCn: string;
		unit: string;
		basePrice: number;
	},
	settle: number,
	raw: Record<string, string>,
	exchange: string,
): Promise<{ inserted: number; updated: number }> {
	let inserted = 0;
	let updated = 0;

	const dateStr = raw.date;
	const date = new Date(`${dateStr}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) return { inserted, updated };

	let commodity = await prisma.commodity.findUnique({
		where: { slug: config.slug },
	});
	if (!commodity) {
		commodity = await prisma.commodity.create({
			data: {
				slug: config.slug,
				name: config.name,
				nameCn: config.nameCn,
				category: "futures",
				unit: config.unit,
				currency: "CNY",
				isActive: true,
				metadata: { source: exchange },
			},
		});
	}

	const open =
		raw.open && raw.open !== "-" ? parseFloat(raw.open) : settle * 0.998;
	const high =
		raw.high && raw.high !== "-" ? parseFloat(raw.high) : settle * 1.005;
	const low = raw.low && raw.low !== "-" ? parseFloat(raw.low) : settle * 0.995;
	const volume =
		raw.volume && raw.volume !== "-" ? parseFloat(raw.volume) : null;

	const existing = await prisma.commodityPrice.findUnique({
		where: {
			commodityId_interval_date_source: {
				commodityId: commodity.id,
				interval: "daily",
				date,
				source: exchange,
			},
		},
	});

	const priceData = {
		open,
		high,
		low,
		close: settle,
		volume,
		source: exchange,
		metadata: {
			exchange,
			rawDate: dateStr,
		} as unknown as Prisma.InputJsonValue,
	};

	if (existing) {
		await prisma.commodityPrice.update({
			where: { id: existing.id },
			data: priceData,
		});
		updated++;
	} else {
		await prisma.commodityPrice.create({
			data: {
				commodityId: commodity.id,
				date,
				interval: "daily",
				...priceData,
			},
		});
		inserted++;
	}

	return { inserted, updated };
}

export const dceFuturesScraper: Scraper = {
	name: "dce_futures",
	fetch: fetchDCEFutures,
};
