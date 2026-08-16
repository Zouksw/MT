/**
 * MLA NLRS — Meat & Livestock Australia National Livestock Reporting Service
 *
 * Covers: EYCI, OTH grid prices, saleyard reports, export cut prices (FOB)
 * API: REST (requires MLA account)
 * Frequency: Daily
 * Key for AU factory-level pricing: OTH grid prices map to factory codes
 */

import { logger, prisma } from "@/lib";
import { json, latestUsdRate } from "../helpers";
import { scraperFetch } from "../http";
import type { Scraper, ScraperResult } from "../scraperManager";

const MLA_API_BASE = process.env.MLA_API_BASE || "https://services.mla.com.au/api";
const MLA_API_KEY = process.env.MLA_API_KEY || "";

// The OTH grid is a NATIONAL indicator — it belongs to no specific plant.
// Before round-104 it was fanned out to `take: 3` arbitrary AU factories
// (nondeterministic order, no orderBy), fabricating identical factory-level
// prices for whichever plants the query happened to return. Rows now go to
// one dedicated national factory (created lazily); an item that names a
// factoryCode still targets that plant directly.
const AU_NATIONAL_FACTORY_CODE = "AU-NAT-MLA";

async function ensureNationalAuFactory() {
	const existing = await prisma.factory.findUnique({
		where: { code: AU_NATIONAL_FACTORY_CODE },
	});
	if (existing) return existing;
	return prisma.factory.create({
		data: {
			code: AU_NATIONAL_FACTORY_CODE,
			name: "MLA National Average (OTH grid)",
			country: "AU",
			active: true,
			metadata: json({ synthetic: true, note: "national aggregate, not a plant" }),
		},
	});
}

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
		const res = await scraperFetch(`${MLA_API_BASE}/oth/grid`, {
			headers: { "x-api-key": MLA_API_KEY, Accept: "application/json" },
			timeoutMs: 15000,
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
		const res = await scraperFetch(`${MLA_API_BASE}/export/beef-cuts`, {
			headers: { "x-api-key": MLA_API_KEY, Accept: "application/json" },
			timeoutMs: 15000,
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

	// Live AUD→USD from the aud_usd series — the hardcoded 0.65 drifted up
	// to ~8% (round-104). Without a rate the OTH rows are skipped entirely
	// (honest absence beats a mis-converted USD/kg price); export FOB prices
	// are natively USD and unaffected.
	const usdPerAud = await latestUsdRate("aud_usd");
	if (usdPerAud === null && othPrices.length > 0) {
		logger.warn("[MLA_NLRS] No aud_usd rate available — skipping OTH grid rows");
	}
	const nationalFactory = await ensureNationalAuFactory();

	for (const item of othPrices) {
		if (usdPerAud === null) break;

		const date = new Date(item.reportDate);
		date.setHours(0, 0, 0, 0);
		const audPerKg = item.gridPrice / 100;
		const usdPerKg = audPerKg * usdPerAud;

		// Per-item factory resolution: an explicit factoryCode targets that
		// plant; otherwise the national aggregate factory.
		const factory = item.factoryCode
			? ((await prisma.factory.findUnique({ where: { code: item.factoryCode } })) ??
				nationalFactory)
			: nationalFactory;

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
					metadata: json({
						audPerKg,
						category: item.category,
						factoryCode: item.factoryCode,
						national: factory.id === nationalFactory.id,
					}),
				},
			});
			inserted++;
		} catch {
			// intentionally ignored — upsert conflict counted as update
			updated++;
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
					metadata: json({
						rawName: item.cutName,
					}),
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
	requiresKey: "MLA_API_KEY",
};
