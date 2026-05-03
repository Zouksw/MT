/**
 * MLA NLRS — Meat & Livestock Australia National Livestock Reporting Service
 *
 * Covers: EYCI, OTH grid prices, saleyard reports, export cut prices (FOB)
 * API: REST (requires MLA account) — falls back to estimates
 * Frequency: Daily
 * Key for AU factory-level pricing: OTH grid prices map to factory codes
 */

import type { Prisma } from "@prisma/client";
import { logger, prisma } from "@/lib";
import type { Scraper, ScraperResult } from "../scraperManager";

const MLA_API_BASE =
	process.env.MLA_API_BASE || "https://services.mla.com.au/api";
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

/**
 * Fetch OTH (over-the-hook) grid prices from MLA NLRS
 * These directly correspond to factory-level pricing in Australia
 */
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
		return [];
	}
}

/**
 * Fetch export beef cut FOB prices from MLA
 */
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
		return [];
	}
}

async function fetchMLAData(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	// Try live data first
	const [othPrices, exportPrices] = await Promise.all([
		fetchOTHGridPrices(),
		fetchExportCutPrices(),
	]);

	if (othPrices.length > 0 || exportPrices.length > 0) {
		// Process OTH grid prices → carcass-level factory prices
		for (const item of othPrices) {
			const auFactories = await prisma.factory.findMany({
				where: { country: "AU", active: true },
				take: 3,
			});

			const date = new Date(item.reportDate);
			date.setHours(0, 0, 0, 0);
			const audPerKg = item.gridPrice / 100; // c/kg → $/kg
			const usdPerKg = audPerKg * 0.65; // AUD→USD approx

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
					updated++;
				}
			}
		}

		// Process export cut FOB prices
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
				updated++;
			}
		}

		return { inserted, updated };
	}

	// Fallback: generate estimates for AU factories
	return generateMLAEstimates();
}

async function generateMLAEstimates(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	const auFactories = await prisma.factory.findMany({
		where: { country: "AU", active: true },
	});

	if (auFactories.length === 0) return { inserted: 0, updated: 0 };

	const exportCuts: Record<string, { fob: number; grade: string }> = {
		RIB_EYE_ROLL: { fob: 17.5, grade: "Grain-fed M3+" },
		STRIPLOIN: { fob: 14.8, grade: "Grain-fed M3+" },
		TENDERLOIN: { fob: 30.0, grade: "Grain-fed M3+" },
		BRISKET_NAVEL: { fob: 8.5, grade: "Grain-fed" },
		CHUCK_ROLL: { fob: 9.2, grade: "Grain-fed" },
		TOPSIDE: { fob: 6.8, grade: "Grass-fed" },
		SILVERSIDE: { fob: 6.3, grade: "Grass-fed" },
		OUTSIDE_SKIRT: { fob: 12.5, grade: "Grain-fed" },
		SHORT_RIBS: { fob: 14.0, grade: "Grain-fed" },
		TONGUE: { fob: 9.0, grade: "Grass-fed" },
		KNUCKLE: { fob: 7.0, grade: "Grass-fed" },
		BLADE: { fob: 9.8, grade: "Grain-fed" },
	};

	const now = new Date();
	for (let d = 0; d < 30; d++) {
		const date = new Date(now.getTime() - (29 - d) * 24 * 60 * 60 * 1000);

		for (const factory of auFactories) {
			for (const [cutCode, info] of Object.entries(exportCuts)) {
				const jitter = (Math.random() - 0.5) * info.fob * 0.03;
				const price = parseFloat((info.fob + jitter).toFixed(2));

				try {
					await prisma.beefCutPrice.upsert({
						where: {
							factoryId_cutCode_date_source: {
								factoryId: factory.id,
								cutCode,
								date,
								source: "mla_nlrs_est",
							},
						},
						update: { price },
						create: {
							factoryId: factory.id,
							cutCode,
							price,
							currency: "USD",
							unit: "USD/kg FOB",
							source: "mla_nlrs_est",
							date,
							grade: info.grade,
							metadata: { estimated: true },
						},
					});
					inserted++;
				} catch {
					updated++;
				}
			}
		}
	}

	logger.info(`[MLA_NLRS] Estimates: ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

export const mlaNlrsScraper: Scraper = {
	name: "mla_nlrs",
	fetch: fetchMLAData,
};
