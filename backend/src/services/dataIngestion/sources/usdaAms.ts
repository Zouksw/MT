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

import { logger, prisma } from "@/lib";
import { json, upsertPrice } from "../helpers";
import type { Scraper, ScraperResult } from "../scraperManager";

// Price-field candidates per report. MARS names its weighted-average price
// field `weight_avg_price`; the cutout composite is `cutout_value` ($/cwt).
// NEVER add total_loads / total_value / grade_volume here — those are
// quantities (loads traded, aggregate dollars), not prices. The original
// single-field config mapped beef_cutout→total_loads and
// boxed_beef_choice→total_value, which would have written cart-load counts
// and million-dollar aggregates into USD/cwt price rows (audit C5, round-104).
// All four commodities are unit USD/cwt, so the raw $/cwt value is written
// unconverted.
const AMS_REPORTS: Record<string, { reportId: string; slug: string; priceFields: string[] }> = {
	live_cattle_us: {
		reportId: "LM_CT101",
		slug: "live_cattle_us",
		priceFields: ["weight_avg_price", "weighted_avg", "avg_price"],
	},
	beef_cutout: {
		reportId: "LM_XB403",
		slug: "beef_cutout_us",
		priceFields: ["cutout_value", "weight_avg_price"],
	},
	feeder_cattle_us: {
		reportId: "LM_CT105",
		slug: "feeder_cattle_us",
		priceFields: ["weight_avg_price", "weighted_avg", "avg_price"],
	},
	boxed_beef_choice: {
		reportId: "LM_XB459",
		slug: "boxed_beef_choice",
		priceFields: ["weight_avg_price", "weighted_avg", "avg_price"],
	},
};

/**
 * First price-like value among the candidate fields: finite number > 0.
 * Returns null when the row carries none of them (row is then skipped —
 * honest absence, never a fabricated or quantity-derived price).
 */
export function pickAMSPrice(row: AMSReportRow, priceFields: string[]): number | null {
	for (const field of priceFields) {
		const value = Number(row[field]);
		if (Number.isFinite(value) && value > 0) return value;
	}
	return null;
}

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

		const price = pickAMSPrice(latest, config.priceFields);
		if (price === null) continue;

		const result = await upsertPrice({
			commodityId: commodity.id,
			date,
			source: "usda_ams",
			// USDA AMS reports a single daily reported price, not intraday OHLC.
			// Write open=high=low=close so the chart shows the honest flat candle.
			open: price,
			high: price,
			low: price,
			close: price,
			volume: null,
			metadata: { reportId: config.reportId, reportDate: dateStr },
		});
		inserted += result.inserted;
		updated += result.updated;
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
		const price = pickAMSPrice(row, ["weight_avg_price", "weighted_avg", "avg_price", "price"]);
		if (!cutName || price === null) continue;

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
					metadata: json({
						rawName: cutName,
						originalUnit: "USD/cwt",
						originalPrice: price,
					}),
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
	requiresKey: "USDA_MARS_API_KEY",
};
