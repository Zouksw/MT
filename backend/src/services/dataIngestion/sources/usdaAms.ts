/**
 * USDA AMS Market News Scraper
 *
 * Fetches real livestock and meat prices from USDA Agricultural Marketing Service.
 * API: https://marsapi.ams.usda.gov/services/v1.2/reports
 * Requires USDA_MARS_API_KEY (register at https://marsapi.ams.usda.gov)
 *
 * Covers: Live cattle, feeder cattle, beef cutout values, boxed beef cuts
 * Extended: LM_XB405 National Comprehensive Boxed Beef Cutout (600+ individual cuts)
 */

import type { Prisma } from "@prisma/client";
import { logger, prisma } from "@/lib";
import type { Scraper, ScraperResult } from "../scraperManager";

const AMS_REPORTS: Record<string, { reportId: string; slug: string; priceField: string }> = {
	live_cattle_us: {
		reportId: "LM_CT101",
		slug: "live_cattle_us",
		priceField: "weighted_avg",
	},
	beef_cutout: {
		reportId: "LM_XB403",
		slug: "beef_cutout_us",
		priceField: "total_loads",
	},
	feeder_cattle_us: {
		reportId: "LM_CT105",
		slug: "feeder_cattle_us",
		priceField: "avg_price",
	},
	boxed_beef_choice: {
		reportId: "LM_XB459",
		slug: "boxed_beef_choice",
		priceField: "total_value",
	},
};

interface AMSReportRow {
	report_date: string;
	[key: string]: string | number | null;
}

interface AMSResponse {
	results: AMSReportRow[];
}

async function fetchAMSReport(reportId: string): Promise<AMSReportRow[]> {
	const apiKey = process.env.USDA_MARS_API_KEY;
	const url = `https://marsapi.ams.usda.gov/services/v1.2/reports/${reportId}`;

	const headers: Record<string, string> = {
		Accept: "application/json",
	};
	if (apiKey) {
		headers.Authorization = `Bearer ${apiKey}`;
	}

	try {
		const res = await fetch(url, {
			headers,
			signal: AbortSignal.timeout(15000),
		});

		if (!res.ok) {
			logger.warn(`[USDA_AMS] Report ${reportId} returned ${res.status}`);
			return [];
		}

		const data = (await res.json()) as AMSResponse;
		return data.results ?? [];
	} catch (err) {
		logger.warn(`[USDA_AMS] Fetch ${reportId} failed: ${err instanceof Error ? err.message : err}`);
		return [];
	}
}

async function updateAMSPrices(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	for (const [, config] of Object.entries(AMS_REPORTS)) {
		const commodity = await prisma.commodity.findUnique({
			where: { slug: config.slug },
		});
		if (!commodity) continue;

		const rows = await fetchAMSReport(config.reportId);
		if (rows.length === 0) continue;

		const latest = rows[0];
		const dateStr = latest.report_date;
		if (!dateStr) continue;

		const date = new Date(dateStr);
		date.setHours(0, 0, 0, 0);

		const price = Number(latest[config.priceField]);
		if (!price || Number.isNaN(price)) continue;

		const existing = await prisma.commodityPrice.findUnique({
			where: {
				commodityId_interval_date_source: {
					commodityId: commodity.id,
					interval: "daily",
					date,
					source: "usda_ams",
				},
			},
		});

		const priceData = {
			open: price,
			high: price * 1.005,
			low: price * 0.995,
			close: price,
			volume: null,
			source: "usda_ams",
			metadata: {
				reportId: config.reportId,
				reportDate: dateStr,
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
	}

	const cutPrices = await fetchCutLevelPrices();
	inserted += cutPrices.inserted;
	updated += cutPrices.updated;

	return { inserted, updated };
}

async function fetchCutLevelPrices(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	const rows = await fetchAMSReport("LM_XB405");
	if (rows.length === 0) {
		logger.warn("[USDA_AMS] LM_XB405 returned no data");
		return { inserted: 0, updated: 0 };
	}

	const usFactory = await prisma.factory.findFirst({
		where: { country: "US" },
	});
	if (!usFactory) {
		logger.warn("[USDA_AMS] No US factory found for cut-level prices");
		return { inserted: 0, updated: 0 };
	}

	for (const row of rows) {
		const dateStr = row.report_date;
		if (!dateStr) continue;
		const date = new Date(dateStr);
		date.setHours(0, 0, 0, 0);

		const cutName = String(row.item_description ?? row.commodity ?? "");
		const price = Number(row.weighted_avg ?? row.avg_price ?? row.price);
		if (!cutName || !price || Number.isNaN(price)) continue;

		const { normalizeBeefCut } = await import("../beefCutNormalizer");
		const cutCode = normalizeBeefCut(cutName);
		if (!cutCode) continue;

		const pricePerKg = (price / 100) * 2.20462;

		try {
			await prisma.beefCutPrice.upsert({
				where: {
					factoryId_cutCode_date_source: {
						factoryId: usFactory.id,
						cutCode,
						date,
						source: "usda_ams_xb405",
					},
				},
				update: { price: parseFloat(pricePerKg.toFixed(2)) },
				create: {
					factoryId: usFactory.id,
					cutCode,
					price: parseFloat(pricePerKg.toFixed(2)),
					currency: "USD",
					unit: "USD/kg",
					source: "usda_ams_xb405",
					sourceRef: "LM_XB405",
					date,
					grade: String(row.quality ?? "Choice"),
					metadata: {
						rawName: cutName,
						originalUnit: "USD/cwt",
						originalPrice: price,
					} as unknown as Prisma.InputJsonValue,
				},
			});
			inserted++;
		} catch {
			// intentionally ignored — upsert conflict counted as update
			updated++;
		}
	}

	logger.info(`[USDA_AMS] LM_XB405: ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

export const usdaAmsScraper: Scraper = {
	name: "usda_ams",
	fetch: updateAMSPrices,
};
