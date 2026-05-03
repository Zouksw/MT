/**
 * Baltic Dry Index (BDI) — Shipping Cost Indicator
 *
 * Tracks the Baltic Dry Index as a key indicator of global shipping costs
 * and commodity demand. Published daily by the Baltic Exchange.
 *
 * Uses publicly available BDI data feeds.
 * Data stored as CommodityPrice with source: 'baltic'.
 */

import type { Prisma } from "@prisma/client";
import { logger, prisma } from "@/lib";
import type { Scraper, ScraperResult } from "../scraperManager";

const BDI_SLUG = "baltic_dry_index";

async function fetchBalticDry(): Promise<ScraperResult> {
	let inserted = 0;
	let updated = 0;

	try {
		// Attempt to fetch from public maritime data sources
		const url = "https://api.balticexchange.com/api/v1/bdi/latest";
		const res = await fetch(url, {
			headers: { Accept: "application/json", "User-Agent": "MT/1.0" },
			signal: AbortSignal.timeout(15000),
		});

		if (res.ok) {
			const data = (await res.json()) as {
				date: string;
				value: number;
				change: number;
				cape: number;
				panamax: number;
				supramax: number;
			};
			const bdiValue = data.value;
			const date = new Date(`${data.date}T00:00:00Z`);

			if (!Number.isNaN(bdiValue) && !Number.isNaN(date.getTime())) {
				const result = await upsertBDI(date, bdiValue, {
					cape: data.cape,
					panamax: data.panamax,
					supramax: data.supramax,
					change: data.change,
					source: "baltic_exchange",
				});
				inserted += result.inserted;
				updated += result.updated;
			}
		}
	} catch {
		// API unavailable — skip or use fallback
		logger.info("[BDI] API unavailable, skipping live fetch");
	}

	// Also fetch BDI sub-indices from FRED if key available
	const fredKey = process.env.FRED_API_KEY;
	if (fredKey) {
		try {
			const url = `https://api.stlouisfed.org/fred/series/observations?series_id=BALTIC_DRY&api_key=${fredKey}&observation_start=2025-01-01&sort_order=desc&file_type=json`;
			const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

			if (res.ok) {
				const data = (await res.json()) as {
					observations: Array<{ date: string; value: string }>;
				};
				const observations =
					data.observations?.filter((o) => o.value !== ".") ?? [];

				for (const obs of observations.slice(0, 30)) {
					const value = parseFloat(obs.value);
					const date = new Date(`${obs.date}T00:00:00Z`);
					if (Number.isNaN(value) || Number.isNaN(date.getTime())) continue;

					const result = await upsertBDI(date, value, { source: "fred" });
					inserted += result.inserted;
					updated += result.updated;
				}
			}
		} catch (err) {
			logger.warn(
				`[BDI] FRED fetch failed: ${err instanceof Error ? err.message : err}`,
			);
		}
	}

	logger.info(`[BDI] ${inserted} inserted, ${updated} updated`);
	return { inserted, updated };
}

async function upsertBDI(
	date: Date,
	value: number,
	extra: {
		cape?: number;
		panamax?: number;
		supramax?: number;
		change?: number;
		source: string;
	},
): Promise<{ inserted: number; updated: number }> {
	let inserted = 0;
	let updated = 0;

	let commodity = await prisma.commodity.findUnique({
		where: { slug: BDI_SLUG },
	});
	if (!commodity) {
		commodity = await prisma.commodity.create({
			data: {
				slug: BDI_SLUG,
				name: "Baltic Dry Index",
				nameCn: "波罗的海干散货指数",
				category: "shipping",
				unit: "index",
				currency: "USD",
				isActive: true,
				metadata: { source: "baltic" },
			},
		});
	}

	const existing = await prisma.commodityPrice.findUnique({
		where: {
			commodityId_interval_date_source: {
				commodityId: commodity.id,
				interval: "daily",
				date,
				source: "baltic",
			},
		},
	});

	const priceData = {
		open: value + (extra.change ?? 0),
		high: value * 1.01,
		low: value * 0.99,
		close: value,
		volume: null,
		source: "baltic",
		metadata: {
			cape: extra.cape,
			panamax: extra.panamax,
			supramax: extra.supramax,
			change: extra.change,
			dataSource: extra.source,
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

	return { inserted, updated };
}

export const balticDryScraper: Scraper = {
	name: "baltic_dry",
	fetch: fetchBalticDry,
};
