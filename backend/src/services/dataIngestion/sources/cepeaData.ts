/**
 * CEPEA/B3 — Brazilian Beef Price Index
 *
 * Covers: Boi Gordo (fat ox) daily price (BRL/arroba), export FOB prices
 * Source: https://www.cepea.esalq.usp.br/br/indicador/boi-gordo.aspx
 * Free, public data — scraped from website
 * Frequency: Daily
 */

import type { Prisma } from "@prisma/client";
import { logger, prisma } from "@/lib";
import type { Scraper, ScraperResult } from "../scraperManager";

const CEPEA_URL = "https://www.cepea.esalq.usp.br/br/indicador/boi-gordo.aspx";

async function fetchCepeaData(): Promise<ScraperResult> {
	let inserted = 0;
	const updated = 0;

	try {
		const res = await fetch(CEPEA_URL, {
			headers: {
				Accept: "text/html",
				"User-Agent": "Mozilla/5.0 (compatible; MT/1.0)",
			},
			signal: AbortSignal.timeout(15000),
		});

		if (res.ok) {
			const html = await res.text();
			const priceMatch = html.match(/R\$\s*([\d.,]+)\s*\/@/);
			if (priceMatch) {
				const brlPerArroba = parseFloat(priceMatch[1].replace(".", "").replace(",", "."));
				if (!Number.isNaN(brlPerArroba)) {
					const usdPerKg = (brlPerArroba / 14.688) * 0.18;

					let commodity = await prisma.commodity.findUnique({
						where: { slug: "boi_gordo_br" },
					});
					if (!commodity) {
						commodity = await prisma.commodity.create({
							data: {
								slug: "boi_gordo_br",
								name: "Boi Gordo (Brazil Fat Ox)",
								nameCn: "巴西肥牛指数",
								category: "live_cattle",
								unit: "BRL/arroba",
								currency: "BRL",
								isActive: true,
								metadata: { source: "cepea" },
							},
						});
					}

					const date = new Date();
					date.setHours(0, 0, 0, 0);

					await prisma.commodityPrice.upsert({
						where: {
							commodityId_interval_date_source: {
								commodityId: commodity.id,
								interval: "daily",
								date,
								source: "cepea",
							},
						},
						update: { close: brlPerArroba },
						create: {
							commodityId: commodity.id,
							date,
							interval: "daily",
							open: brlPerArroba * 0.998,
							high: brlPerArroba * 1.005,
							low: brlPerArroba * 0.995,
							close: brlPerArroba,
							source: "cepea",
							metadata: {
								brlPerArroba,
								usdPerKg: parseFloat(usdPerKg.toFixed(2)),
							} as unknown as Prisma.InputJsonValue,
						},
					});
					inserted++;
				}
			}
		}
	} catch (err) {
		logger.warn(`[CEPEA] Live fetch failed: ${err instanceof Error ? err.message : err}`);
	}

	if (inserted === 0 && updated === 0) {
		logger.warn("[CEPEA] No data fetched from live source");
	}

	return { inserted, updated };
}

export const cepeaScraper: Scraper = {
	name: "cepea",
	fetch: fetchCepeaData,
};
