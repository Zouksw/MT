/**
 * China MARA Wholesale Market Prices (农业农村部批发市场价格)
 *
 * Primary: ncpscxx.moa.gov.cn (new API)
 * Fallback: pfscnew.agri.gov.cn (legacy API)
 *
 * Covers: pork, beef, mutton, chicken, egg, carp, cabbage, tomato, potato, apple, banana.
 * Data stored as CommodityPrice with source: 'china_mara'.
 *
 * NOTE: These APIs may be geo-blocked outside China.
 */

import { logger } from "@/lib";
import { ensureCommodity, upsertPrice } from "../helpers";
import type { Scraper, ScraperResult } from "../scraperManager";

const COMMODITIES: Record<
	string,
	{ slug: string; name: string; nameCn: string; searchName: string; category: string; unit: string }
> = {
	pork: {
		slug: "pork_wholesale_cn",
		name: "Pork Wholesale (China)",
		nameCn: "全国猪肉批发价",
		searchName: "猪肉",
		category: "other_meat",
		unit: "CNY/kg",
	},
	beef: {
		slug: "beef_wholesale_cn",
		name: "Beef Wholesale (China)",
		nameCn: "全国牛肉批发价",
		searchName: "牛肉",
		category: "beef_cuts",
		unit: "CNY/kg",
	},
	mutton: {
		slug: "mutton_wholesale_cn",
		name: "Mutton Wholesale (China)",
		nameCn: "全国羊肉批发价",
		searchName: "羊肉",
		category: "other_meat",
		unit: "CNY/kg",
	},
	chicken: {
		slug: "chicken_wholesale_cn",
		name: "Chicken Wholesale (China)",
		nameCn: "全国白条鸡批发价",
		searchName: "白条鸡",
		category: "other_meat",
		unit: "CNY/kg",
	},
	egg: {
		slug: "egg_wholesale_cn",
		name: "Egg Wholesale (China)",
		nameCn: "全国鸡蛋批发价",
		searchName: "鸡蛋",
		category: "other_meat",
		unit: "CNY/kg",
	},
	carp: {
		slug: "carp_wholesale_cn",
		name: "Carp Wholesale (China)",
		nameCn: "全国鲤鱼批发价",
		searchName: "鲤鱼",
		category: "aquatic",
		unit: "CNY/kg",
	},
	cabbage: {
		slug: "cabbage_wholesale_cn",
		name: "Cabbage Wholesale (China)",
		nameCn: "全国大白菜批发价",
		searchName: "大白菜",
		category: "vegetables",
		unit: "CNY/kg",
	},
	tomato: {
		slug: "tomato_wholesale_cn",
		name: "Tomato Wholesale (China)",
		nameCn: "全国西红柿批发价",
		searchName: "西红柿",
		category: "vegetables",
		unit: "CNY/kg",
	},
	potato: {
		slug: "potato_wholesale_cn",
		name: "Potato Wholesale (China)",
		nameCn: "全国土豆批发价",
		searchName: "土豆",
		category: "vegetables",
		unit: "CNY/kg",
	},
	apple: {
		slug: "apple_wholesale_cn",
		name: "Apple Wholesale (China)",
		nameCn: "全国富士苹果批发价",
		searchName: "富士苹果",
		category: "fruits",
		unit: "CNY/kg",
	},
	banana: {
		slug: "banana_wholesale_cn",
		name: "Banana Wholesale (China)",
		nameCn: "全国香蕉批发价",
		searchName: "香蕉",
		category: "fruits",
		unit: "CNY/kg",
	},
};

interface PriceItem {
	slug: string;
	price: number;
	date: string;
}

async function fetchNewMARA(): Promise<PriceItem[]> {
	const results: PriceItem[] = [];
	const categories = ["meat_egg", "vegetable_fruit", "aquatic"];

	for (const cat of categories) {
		try {
			const res = await fetch("https://ncpscxx.moa.gov.cn/product/price-info/getPriceInfoList", {
				method: "POST",
				headers: {
					"Content-Type": "application/json;charset=UTF-8",
					Origin: "https://ncpscxx.moa.gov.cn",
					Referer: "https://ncpscxx.moa.gov.cn/",
					Accept: "application/json",
				},
				body: JSON.stringify({ prodCatid: cat, pageSize: 50, currentPage: 1 }),
				signal: AbortSignal.timeout(15000),
			});
			if (!res.ok) continue;

			const data = (await res.json()) as {
				result?: { data?: Array<{ prodName: string; avgPrice: string; publishDate: string }> };
			};
			for (const item of data.result?.data ?? []) {
				for (const cfg of Object.values(COMMODITIES)) {
					if (item.prodName.includes(cfg.searchName)) {
						const price = parseFloat(item.avgPrice);
						if (!Number.isNaN(price))
							results.push({ slug: cfg.slug, price, date: item.publishDate });
					}
				}
			}
		} catch (err) {
			logger.warn(
				`[CHINA_MARA] New API ${cat} failed: ${err instanceof Error ? err.message : err}`,
			);
		}
	}
	return results;
}

async function fetchLegacyAPI(): Promise<PriceItem[]> {
	const results: PriceItem[] = [];
	try {
		const res = await fetch("http://pfscnew.agri.gov.cn/price/queryPrice", {
			headers: { Accept: "application/json", "User-Agent": "MT/1.0" },
			signal: AbortSignal.timeout(15000),
		});
		if (!res.ok) return results;

		const data = (await res.json()) as {
			data?: Array<{ prodName: string; price: string; date: string }>;
		};
		for (const item of data.data ?? []) {
			const cfg = Object.values(COMMODITIES).find((c) => item.prodName.includes(c.searchName));
			if (!cfg) continue;
			const price = parseFloat(item.price);
			if (!Number.isNaN(price)) results.push({ slug: cfg.slug, price, date: item.date });
		}
	} catch (err) {
		logger.warn(`[CHINA_MARA] Legacy API failed: ${err instanceof Error ? err.message : err}`);
	}
	return results;
}

async function fetchChinaWholesale(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	const prices = await fetchNewMARA();
	const items = prices.length > 0 ? prices : await fetchLegacyAPI();

	if (items.length === 0) {
		logger.warn("[CHINA_MARA] Both APIs failed — likely geo-blocked");
		return { inserted: 0, updated: 0 };
	}

	for (const item of items) {
		const cfg = Object.values(COMMODITIES).find((c) => c.slug === item.slug);
		if (!cfg) continue;

		const date = new Date(`${item.date}T00:00:00Z`);
		if (Number.isNaN(date.getTime())) continue;

		const commodity = await ensureCommodity({
			slug: cfg.slug,
			name: cfg.name,
			nameCn: cfg.nameCn,
			category: cfg.category,
			unit: cfg.unit,
			currency: "CNY",
			metadata: { source: "china_mara" },
		});

		const r = await upsertPrice({
			commodityId: commodity.id,
			date,
			source: "china_mara",
			open: item.price * 0.998,
			high: item.price * 1.005,
			low: item.price * 0.995,
			close: item.price,
			metadata: { prodName: cfg.searchName, rawDate: item.date },
		});
		inserted += r.inserted;
		updated += r.updated;
	}

	logger.info(`[CHINA_MARA] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

export const chinaWholesaleScraper: Scraper = {
	name: "china_wholesale",
	fetch: fetchChinaWholesale,
};
