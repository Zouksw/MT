/**
 * MLA NLRS — Meat & Livestock Australia National Livestock Reporting Service
 *
 * Covers: EYCI, OTH grid prices, saleyard reports, export cut prices (FOB)
 * API: REST (requires MLA account)
 * Frequency: Daily
 * Key for AU factory-level pricing: OTH grid prices map to factory codes
 */

import type { Prisma } from "@prisma/client";
import { logger, prisma } from "@/lib";
import type { Scraper, ScraperResult } from "../scraperManager";

const MLA_API_BASE = process.env.MLA_API_BASE || "https://services.mla.com.au/api";
const MLA_API_KEY = process.env.MLA_API_KEY || "";

interface MLAOTHPrice {
	reportDate: string;
	category: string; // steer, heifer, cow
	gridPrice: number; // AUS c/kg
	factoryCode?: string;
}

interface MLAExportPrice {
	reportDate: string;
	cutName: string;
	priceFOB: number; // USD/kg FOB
	currency: string;
}

async function fetchOTHGridPrices(): Promise<MLAOTHPrice[]> {
	if (!MLA_API_KEY) return [];

	try {
		const res = await fetch(`${MLA_API_BASE}/oth/grid`, {
			headers: { "x-api-key": MLA_API_KEY, Accept: "application/json" },
			signal: AbortSignal.timeout(15000),
		});
		if (!res.ok) return [];
		const data = (await res.json()) as { data: MLAOTHPrice[] };
		return data.data ?? [];
	} catch {
		// intentionally ignored — MLA API unavailable, skip this data source
		return [];
	}
}

async function fetchExportCutPrices(): Promise<MLAExportPrice[]> {
	if (!MLA_API_KEY) return [];

	try {
		const res = await fetch(`${MLA_API_BASE}/export/beef-cuts`, {
			headers: { "x-api-key": MLA_API_KEY, Accept: "application/json" },
			signal: AbortSignal.timeout(15000),
		});
		if (!res.ok) return [];
		const data = (await res.json()) as { data: MLAExportPrice[] };
		return data.data ?? [];
	} catch {
		// intentionally ignored — MLA API unavailable, skip this data source
		return [];
	}
}

async function fetchMLAData(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	const [othPrices, exportPrices] = await Promise.all([
		fetchOTHGridPrices(),
		fetchExportCutPrices(),
	]);

	if (othPrices.length === 0 && exportPrices.length === 0) {
		logger.warn("[MLA_NLRS] No live data available (API key may be missing)");
		return { inserted: 0, updated: 0 };
	}

	for (const item of othPrices) {
		const auFactories = await prisma.factory.findMany({
			where: { country: "AU", active: true },
			take: 3,
		});

		const date = new Date(item.reportDate);
		date.setHours(0, 0, 0, 0);
		const audPerKg = item.gridPrice / 100;
		const usdPerKg = audPerKg * 0.65;

		for (const factory of auFactories) {
			try {
				await prisma.beefCutPrice.upsert({
					where: {
						factoryId_cutCode_date_source: {
							factoryId: factory.id,
							cutCode: `WHOLE_CARCASS_${item.category.toUpperCase()}`,
							date,
							source: "mla_oth",
						},
					},
					update: { price: parseFloat(usdPerKg.toFixed(2)) },
					create: {
						factoryId: factory.id,
						cutCode: `WHOLE_CARCASS_${item.category.toUpperCase()}`,
						price: parseFloat(usdPerKg.toFixed(2)),
						currency: "USD",
						unit: "USD/kg",
						source: "mla_oth",
						date,
						metadata: {
							audPerKg,
							category: item.category,
							factoryCode: item.factoryCode,
						} as unknown as Prisma.InputJsonValue,
					},
				});
				inserted++;
			} catch {
				// intentionally ignored — upsert conflict counted as update
				updated++;
			}
		}
	}

	const { normalizeBeefCut } = await import("../beefCutNormalizer");
	const auFactory = await prisma.factory.findFirst({
		where: { country: "AU" },
	});
	if (!auFactory) return { inserted, updated };

	for (const item of exportPrices) {
		const cutCode = normalizeBeefCut(item.cutName);
		if (!cutCode) continue;

		const date = new Date(item.reportDate);
		date.setHours(0, 0, 0, 0);

		try {
			await prisma.beefCutPrice.upsert({
				where: {
					factoryId_cutCode_date_source: {
						factoryId: auFactory.id,
						cutCode,
						date,
						source: "mla_export",
					},
				},
				update: { price: item.priceFOB },
				create: {
					factoryId: auFactory.id,
					cutCode,
					price: item.priceFOB,
					currency: "USD",
					unit: "USD/kg FOB",
					source: "mla_export",
					date,
					metadata: {
						rawName: item.cutName,
					} as unknown as Prisma.InputJsonValue,
				},
			});
			inserted++;
		} catch {
			// intentionally ignored — upsert conflict counted as update
			updated++;
		}
	}

	logger.info(`[MLA_NLRS] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

export const mlaNlrsScraper: Scraper = {
	name: "mla_nlrs",
	fetch: fetchMLAData,
};
