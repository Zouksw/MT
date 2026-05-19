/**
 * World Bank Pink Sheet Commodity Prices
 *
 * Monthly commodity price data from the World Bank.
 * API: https://api.worldbank.org/v2/commodity
 * Free, no API key required.
 *
 * Covers: 70+ commodities including crude oil, copper, soybeans, wheat,
 * cotton, gold, natural gas, coffee, sugar, and more.
 */

import type { Prisma } from "@prisma/client";
import { logger, prisma } from "@/lib";
import type { Scraper, ScraperResult } from "../scraperManager";

// World Bank commodity code → our slug mapping
const WB_COMMODITIES: Record<string, { slug: string; name: string; unit: string }> = {
	// Energy
	CRUDE_WTI: {
		slug: "crude_oil_wti",
		name: "Crude Oil (WTI)",
		unit: "USD/bbl",
	},
	CRUDE_BRENT: {
		slug: "crude_oil_brent",
		name: "Crude Oil (Brent)",
		unit: "USD/bbl",
	},
	CRUDE_DUBAI: {
		slug: "crude_oil_dubai",
		name: "Crude Oil (Dubai)",
		unit: "USD/bbl",
	},
	NATURAL_GAS: {
		slug: "natural_gas_us",
		name: "Natural Gas (US)",
		unit: "USD/MMBtu",
	},
	COAL_AUS: {
		slug: "coal_australia",
		name: "Coal (Australia)",
		unit: "USD/ton",
	},

	// Metals
	COPPER: { slug: "copper_lme", name: "Copper (LME)", unit: "USD/ton" },
	ALUMINUM: { slug: "aluminum_lme", name: "Aluminum (LME)", unit: "USD/ton" },
	IRON_ORE: {
		slug: "iron_ore_cfr",
		name: "Iron Ore (CFR China)",
		unit: "USD/ton",
	},
	TIN: { slug: "tin_lme", name: "Tin (LME)", unit: "USD/ton" },
	NICKEL: { slug: "nickel_lme", name: "Nickel (LME)", unit: "USD/ton" },
	ZINC: { slug: "zinc_lme", name: "Zinc (LME)", unit: "USD/ton" },
	LEAD: { slug: "lead_lme", name: "Lead (LME)", unit: "USD/ton" },
	GOLD: { slug: "gold_lbma", name: "Gold (LBMA)", unit: "USD/troy oz" },
	SILVER: { slug: "silver_lbma", name: "Silver (LBMA)", unit: "USD/troy oz" },
	PLATINUM: {
		slug: "platinum_lbma",
		name: "Platinum (LBMA)",
		unit: "USD/troy oz",
	},

	// Grains & Oilseeds
	SOYBEANS: { slug: "soybeans_cbOT", name: "Soybeans (CBOT)", unit: "USD/ton" },
	SOYBEAN_MEAL: {
		slug: "soybean_meal_cbOT",
		name: "Soybean Meal (CBOT)",
		unit: "USD/ton",
	},
	SOYBEAN_OIL: {
		slug: "soybean_oil_cbOT",
		name: "Soybean Oil (CBOT)",
		unit: "USD/ton",
	},
	WHEAT_US: { slug: "wheat_us_srw", name: "Wheat (US SRW)", unit: "USD/ton" },
	WHEAT_HRW: { slug: "wheat_us_hrw", name: "Wheat (US HRW)", unit: "USD/ton" },
	CORN: { slug: "corn_cbOT", name: "Corn (CBOT)", unit: "USD/ton" },
	RICE: { slug: "rice_thai", name: "Rice (Thai 5%)", unit: "USD/ton" },
	BARLEY: { slug: "barley", name: "Barley", unit: "USD/ton" },
	SORGHUM: { slug: "sorghum", name: "Sorghum", unit: "USD/ton" },

	// Soft Commodities
	SUGAR_EU: { slug: "sugar_world", name: "Sugar (World)", unit: "USD/kg" },
	COFFEE_ARAB: {
		slug: "coffee_arabica",
		name: "Coffee (Arabica)",
		unit: "USD/kg",
	},
	COFFEE_ROB: {
		slug: "coffee_robusta",
		name: "Coffee (Robusta)",
		unit: "USD/kg",
	},
	COCOA: { slug: "cocoa", name: "Cocoa", unit: "USD/kg" },
	TEA: { slug: "tea_mombasa", name: "Tea (Mombasa)", unit: "USD/kg" },
	COTTON: {
		slug: "cotton_cotlook",
		name: "Cotton (Cotlook A)",
		unit: "USD/kg",
	},
	RUBBER: { slug: "rubber_tsr20", name: "Rubber (TSR20)", unit: "USD/kg" },

	// Meat & Dairy
	BEEF_AU: { slug: "beef_australia", name: "Beef (Australia)", unit: "USD/kg" },
	BEEF_US: { slug: "beef_us_choice", name: "Beef (US Choice)", unit: "USD/kg" },
	CHICKEN: { slug: "chicken_whole", name: "Chicken (Whole)", unit: "USD/kg" },
	LAMB: {
		slug: "lamb_new_zealand",
		name: "Lamb (New Zealand)",
		unit: "USD/kg",
	},
	SHRIMP: {
		slug: "shrimp_latam",
		name: "Shrimp (Latin America)",
		unit: "USD/kg",
	},
	BUTTER: { slug: "butter", name: "Butter", unit: "USD/ton" },
	MILK_POWDER: { slug: "milk_powder", name: "Milk Powder", unit: "USD/ton" },

	// Fertilizers
	UREA: { slug: "urea", name: "Urea", unit: "USD/ton" },
	DAP: {
		slug: "diammonium_phosphate",
		name: "DAP Fertilizer",
		unit: "USD/ton",
	},
	POTASH: { slug: "potassium_chloride", name: "Potash (MOP)", unit: "USD/ton" },
	TSP: {
		slug: "triple_superphosphate",
		name: "TSP Fertilizer",
		unit: "USD/ton",
	},

	// Indices
	COMMODITY_INDEX: {
		slug: "commodity_price_index",
		name: "Commodity Price Index",
		unit: "index",
	},
};

interface WBCommodityResponse {
	page: number;
	pages: number;
	total: number;
	per_page: string;
	records: Array<{
		date: string; // YYYY or YYYY.MM format
		value: string | null;
		unit: string;
		commodity: string;
		commodity_code: string;
	}>;
}

async function fetchWorldBankData(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	// Try the original commodity endpoint
	const urls = [
		"https://api.worldbank.org/v2/commodity?format=json&per_page=5000&date=2020:2026",
		"https://api.worldbank.org/v2/sources/40/data?format=json&per_page=5000&date=2020:2026",
	];

	let records: WBCommodityResponse["records"] = [];

	for (const url of urls) {
		try {
			const res = await fetch(url, {
				headers: { Accept: "application/json" },
				signal: AbortSignal.timeout(30000),
			});

			if (!res.ok) continue;

			const data = (await res.json()) as [WBCommodityResponse, WBCommodityResponse["records"]];
			if (Array.isArray(data?.[1]) && data[1].length > 0) {
				records = data[1];
				break;
			}
		} catch {
			// intentionally ignored — try next URL fallback
		}
	}

	if (records.length === 0) {
		logger.warn("[WORLD_BANK] All API endpoints failed — data unavailable");
		return { inserted: 0, updated: 0 };
	}

	// Group records by commodity code
	const grouped = new Map<string, typeof records>();
	for (const record of records) {
		if (!record.value || !record.date) continue;
		const code = record.commodity_code || record.commodity;
		if (!grouped.has(code)) grouped.set(code, []);
		grouped.get(code)?.push(record);
	}

	// Process each known commodity
	for (const [code, config] of Object.entries(WB_COMMODITIES)) {
		const matchingRecords = [...grouped.entries()].flatMap(([recCode, recs]) =>
			recCode.toUpperCase().includes(code.toUpperCase()) ? recs : [],
		);

		if (matchingRecords.length === 0) continue;

		// Find or create commodity
		let commodity = await prisma.commodity.findUnique({
			where: { slug: config.slug },
		});
		if (!commodity) {
			commodity = await prisma.commodity.create({
				data: {
					slug: config.slug,
					name: config.name,
					category: categorizeSlug(config.slug),
					unit: config.unit,
					currency: "USD",
					isActive: true,
					metadata: { source: "world_bank", wbCode: code },
				},
			});
		}

		// Sort records by date (newest first)
		const sorted = matchingRecords
			.filter((r) => r.value && r.date)
			.sort((a, b) => b.date.localeCompare(a.date));

		// Insert last 24 months of data
		const recentRecords = sorted.slice(0, 24);
		for (const record of recentRecords) {
			// WB dates can be "YYYY" or "YYYY.MM" or "YYYYMMM"
			const date = parseWBDate(record.date);
			if (!date) continue;

			const price = parseFloat(record.value ?? "");
			if (Number.isNaN(price) || price <= 0) continue;

			const existing = await prisma.commodityPrice.findUnique({
				where: {
					commodityId_interval_date_source: {
						commodityId: commodity.id,
						interval: "monthly",
						date,
						source: "world_bank",
					},
				},
			});

			const priceData = {
				open: price,
				high: price * 1.02,
				low: price * 0.98,
				close: price,
				volume: null,
				source: "world_bank",
				metadata: {
					wbCode: code,
					wbDate: record.date,
					unit: record.unit,
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
						interval: "monthly",
						...priceData,
					},
				});
				inserted++;
			}
		}
	}

	logger.info(`[WORLD_BANK] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

function categorizeSlug(slug: string): string {
	if (slug.includes("crude") || slug.includes("natural_gas") || slug.includes("coal"))
		return "energy";
	if (
		slug.includes("copper") ||
		slug.includes("aluminum") ||
		slug.includes("iron") ||
		slug.includes("lme") ||
		slug.includes("gold") ||
		slug.includes("silver") ||
		slug.includes("platinum") ||
		slug.includes("nickel") ||
		slug.includes("zinc") ||
		slug.includes("lead") ||
		slug.includes("tin")
	)
		return "metals";
	if (
		slug.includes("urea") ||
		slug.includes("phosphate") ||
		slug.includes("potassium") ||
		slug.includes("potash") ||
		slug.includes("tsp")
	)
		return "fertilizer";
	if (
		slug.includes("beef") ||
		slug.includes("chicken") ||
		slug.includes("lamb") ||
		slug.includes("shrimp") ||
		slug.includes("butter") ||
		slug.includes("milk")
	)
		return "meat_dairy";
	if (
		slug.includes("sugar") ||
		slug.includes("coffee") ||
		slug.includes("cocoa") ||
		slug.includes("tea") ||
		slug.includes("cotton") ||
		slug.includes("rubber")
	)
		return "soft_commodities";
	if (
		slug.includes("soybean") ||
		slug.includes("wheat") ||
		slug.includes("corn") ||
		slug.includes("rice") ||
		slug.includes("barley") ||
		slug.includes("sorghum")
	)
		return "grain";
	if (slug.includes("index")) return "indices";
	return "other";
}

function parseWBDate(dateStr: string): Date | null {
	// "2024" → Jan 1
	if (/^\d{4}$/.test(dateStr)) {
		return new Date(`${dateStr}-01-01T00:00:00Z`);
	}
	// "2024.01" or "2024M01" → that month
	const match = dateStr.match(/^(\d{4})[.M](\d{2})$/);
	if (match) {
		const [, year, month] = match;
		return new Date(`${year}-${month}-01T00:00:00Z`);
	}
	// "2024Jan" format
	const monthNames = [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	];
	const monthMatch = dateStr.match(/^(\d{4})([A-Z][a-z]{2})$/);
	if (monthMatch) {
		const monthIdx = monthNames.indexOf(monthMatch[2]);
		if (monthIdx >= 0) {
			return new Date(`${monthMatch[1]}-${String(monthIdx + 1).padStart(2, "0")}-01T00:00:00Z`);
		}
	}
	return null;
}

export const worldBankScraper: Scraper = {
	name: "world_bank",
	fetch: fetchWorldBankData,
};
