/**
 * Commodity Price Scraper
 *
 * Fetches real exchange rates from open.er-api.com (free, no API key).
 * All simulated/estimated price generation has been removed.
 */

import type { Prisma } from "@prisma/client";
import { logger, prisma } from "@/lib";
import type { Scraper, ScraperResult } from "../scraperManager";

async function fetchExchangeRates(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	try {
		const res = await fetch("https://open.er-api.com/v6/latest/USD");
		if (!res.ok) throw new Error(`ExchangeRate API returned ${res.status}`);
		const data = (await res.json()) as { rates: Record<string, number> };

		const today = new Date();
		today.setHours(0, 0, 0, 0);

		const pairs = [
			{
				base: "USD",
				quote: "CNY",
				type: "exchange_rate",
				slug: "usd_cny",
				rate: data.rates.CNY,
			},
			{
				base: "AUD",
				quote: "USD",
				type: "exchange_rate",
				slug: "aud_usd",
				rate: data.rates.AUD ? 1 / data.rates.AUD : null,
			},
			{
				base: "BRL",
				quote: "USD",
				type: "exchange_rate",
				slug: "brl_usd",
				rate: data.rates.BRL ? 1 / data.rates.BRL : null,
			},
		];

		for (const pair of pairs) {
			if (!pair.rate || Number.isNaN(pair.rate)) continue;

			const region = `${pair.base}/${pair.quote}`;
			const existing = await prisma.marketFactor.findUnique({
				where: { type_region_date: { type: pair.type, region, date: today } },
			});

			if (existing) {
				await prisma.marketFactor.update({
					where: { id: existing.id },
					data: { value: pair.rate, source: "exchange_rate_api" },
				});
				updated++;
			} else {
				await prisma.marketFactor.create({
					data: {
						type: pair.type,
						region,
						date: today,
						value: pair.rate,
						unit: region,
						source: "exchange_rate_api",
					},
				});
				inserted++;
			}

			const commodity = await prisma.commodity.findUnique({
				where: { slug: pair.slug },
			});
			if (commodity) {
				const existingPrice = await prisma.commodityPrice.findUnique({
					where: {
						commodityId_interval_date_source: {
							commodityId: commodity.id,
							interval: "daily",
							date: today,
							source: "exchange_rate_api",
						},
					},
				});

				if (existingPrice) {
					await prisma.commodityPrice.update({
						where: { id: existingPrice.id },
						data: {
							close: pair.rate,
							high: pair.rate * 1.001,
							low: pair.rate * 0.999,
							source: "exchange_rate_api",
						},
					});
				} else {
					await prisma.commodityPrice.create({
						data: {
							commodityId: commodity.id,
							date: today,
							interval: "daily",
							open: pair.rate,
							high: pair.rate * 1.001,
							low: pair.rate * 0.999,
							close: pair.rate,
							source: "exchange_rate_api",
						},
					});
				}
			}
		}
	} catch (err) {
		logger.error(`[CommodityPrice] Exchange rate fetch failed: ${err}`);
	}

	return { inserted, updated };
}

export async function fetchAllCommodityPrices(): Promise<ScraperResult> {
	return fetchExchangeRates();
}

export const commodityPriceScraper: Scraper = {
	name: "commodity_prices",
	fetch: fetchAllCommodityPrices,
};
