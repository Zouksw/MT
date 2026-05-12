/**
 * INAC — Instituto Nacional de Carnes (Uruguay)
 *
 * Covers: Monthly export data by market, plant-level export volumes, cut-level FOB prices
 * Source: https://www.inac.gub.uy/ (public data portal)
 * Free, public data — scraped from website
 * Frequency: Monthly
 */

import type { Prisma } from "@prisma/client";
import { logger, prisma } from "@/lib";
import type { Scraper, ScraperResult } from "../scraperManager";

const INAC_EXPORT_URL = "https://www.inac.gub.uy/estadisticas/exportaciones.html";

async function fetchINACData(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	try {
		const res = await fetch(INAC_EXPORT_URL, {
			headers: {
				Accept: "text/html",
				"User-Agent": "Mozilla/5.0 (compatible; MT/1.0)",
			},
			signal: AbortSignal.timeout(15000),
		});

		if (res.ok) {
			const html = await res.text();
			const tableMatches = html.matchAll(/<tr[^>]*>[\s\S]*?<\/tr>/gi);
			for (const match of tableMatches) {
				const row = match[0];
				const cells = row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi);
				const cellValues = Array.from(cells).map((c) => c[1].replace(/<[^>]+>/g, "").trim());
				if (cellValues.length >= 4) {
					const [cutName, _market, _volume, priceStr] = cellValues;
					const price = parseFloat(priceStr.replace(/[^\d.,]/g, "").replace(",", "."));
					if (Number.isNaN(price) || !cutName) continue;

					const { normalizeBeefCut } = await import("../beefCutNormalizer");
					const cutCode = normalizeBeefCut(cutName);
					if (!cutCode) continue;

					const uyFactory = await prisma.factory.findFirst({
						where: { country: "UY" },
					});
					if (!uyFactory) continue;

					const date = new Date();
					date.setDate(1);
					date.setHours(0, 0, 0, 0);

					try {
						await prisma.beefCutPrice.upsert({
							where: {
								factoryId_cutCode_date_source: {
									factoryId: uyFactory.id,
									cutCode,
									date,
									source: "inac",
								},
							},
							update: { price },
							create: {
								factoryId: uyFactory.id,
								cutCode,
								price,
								currency: "USD",
								unit: "USD/kg FOB",
								source: "inac",
								date,
								metadata: {
									rawName: cutName,
								} as unknown as Prisma.InputJsonValue,
							},
						});
						inserted++;
					} catch {
						updated++;
					}
				}
			}
		}
	} catch (err) {
		logger.warn(`[INAC] Live fetch failed: ${err instanceof Error ? err.message : err}`);
	}

	if (inserted === 0 && updated === 0) {
		logger.warn("[INAC] No data fetched from live source");
	}

	return { inserted, updated };
}

export const inacScraper: Scraper = {
	name: "inac",
	fetch: fetchINACData,
};
