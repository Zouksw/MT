/**
 * One-time backfill script: fetch historical FRED daily series via public CSV.
 *
 * The live scraper (cmeFutures.ts) only fetches the last 7 days on each run.
 * This script backfills from 2024-01-01 to today so that AI prediction models
 * have enough historical data for training/backtesting.
 *
 * Usage:
 *   cd backend && npx tsx -r dotenv/config src/scripts/backfillFred.ts
 *
 * FRED CSV endpoint requires no API key:
 *   https://fred.stlouisfed.org/graph/fredgraph.csv?id=SERIES_ID&cosd=YYYYMMDD&coed=YYYYMMDD
 */

import { logger, prisma } from "@/lib";
import { ensureCommodity, formatDateYMD, upsertPrice } from "@/services/dataIngestion/helpers";

const BACKFILL_START = "2024-01-01";

const FRED_SERIES: Record<
	string,
	{
		seriesId: string;
		slug: string;
		name: string;
		category: string;
		unit: string;
		currency?: string;
	}
> = {
	BEEF: {
		seriesId: "CBBTCUSD",
		slug: "beef_carcass_us",
		name: "US Beef Carcass Price (FRED)",
		category: "beef_cuts",
		unit: "USD/cwt",
	},
	USDCNY: {
		seriesId: "DEXCHUS",
		slug: "usd_cny",
		name: "USD/CNY Exchange Rate (FRED)",
		category: "forex",
		unit: "CNY/USD",
		currency: "CNY",
	},
	BRLUSD: {
		seriesId: "DEXBZUS",
		slug: "brl_usd",
		name: "BRL/USD Exchange Rate (FRED)",
		category: "forex",
		unit: "BRL/USD",
	},
	AUDUSD: {
		seriesId: "DEXUSAL",
		slug: "aud_usd",
		name: "AUD/USD Exchange Rate (FRED)",
		category: "forex",
		unit: "AUD/USD",
	},
	EURUSD: {
		seriesId: "DEXUSEU",
		slug: "eur_usd",
		name: "EUR/USD Exchange Rate (FRED)",
		category: "forex",
		unit: "EUR/USD",
	},
	CL: {
		seriesId: "DCOILWTICO",
		slug: "crude_oil_cme",
		name: "Crude Oil WTI (FRED)",
		category: "energy",
		unit: "USD/bbl",
	},
	NG: {
		seriesId: "DHHNGSP",
		slug: "natural_gas_cme",
		name: "Natural Gas Henry Hub (FRED)",
		category: "energy",
		unit: "USD/MMBtu",
	},
};

async function backfillSeries(
	config: (typeof FRED_SERIES)[string],
): Promise<{ inserted: number; updated: number; skipped: number }> {
	const endDate = formatDateYMD(new Date());

	const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${config.seriesId}&cosd=${BACKFILL_START.replace(/-/g, "")}&coed=${endDate}`;

	logger.info(
		`[Backfill] Fetching ${config.seriesId} → ${config.slug} (${BACKFILL_START} to today)`,
	);

	const res = await fetch(url, {
		headers: { "User-Agent": "MT/1.0" },
		signal: AbortSignal.timeout(30000),
	});
	if (!res.ok) {
		logger.warn(`[Backfill] ${config.seriesId}: HTTP ${res.status}`);
		return { inserted: 0, updated: 0, skipped: 0 };
	}

	const text = await res.text();
	const lines = text.trim().split("\n");
	if (lines.length < 2) {
		logger.warn(`[Backfill] ${config.seriesId}: no data rows`);
		return { inserted: 0, updated: 0, skipped: 0 };
	}

	const commodity = await ensureCommodity({
		slug: config.slug,
		name: config.name,
		category: config.category,
		unit: config.unit,
		currency: config.currency ?? "USD",
		metadata: { source: "fred", seriesId: config.seriesId },
	});

	let inserted = 0;
	let updated = 0;
	let skipped = 0;

	// Skip header row
	for (let i = 1; i < lines.length; i++) {
		const cols = lines[i].split(",");
		if (cols.length < 2) continue;

		const dateStr = cols[0].trim();
		const valueStr = cols[1].trim();
		// FRED uses "." for missing values
		if (!valueStr || valueStr === ".") {
			skipped++;
			continue;
		}

		const value = parseFloat(valueStr);
		if (Number.isNaN(value) || !dateStr) continue;

		const date = new Date(`${dateStr}T00:00:00Z`);
		if (Number.isNaN(date.getTime())) continue;

		const r = await upsertPrice({
			commodityId: commodity.id,
			date,
			source: "fred",
			open: value,
			high: value,
			low: value,
			close: value,
			volume: null,
			metadata: { seriesId: config.seriesId, source: "fred_csv_backfill" },
		});
		inserted += r.inserted;
		updated += r.updated;
	}

	logger.info(
		`[Backfill] ${config.seriesId} → ${config.slug}: ${inserted} inserted, ${updated} updated, ${skipped} skipped (${lines.length - 1} rows)`,
	);
	return { inserted, updated, skipped };
}

async function main() {
	logger.info(`[Backfill] Starting FRED historical backfill from ${BACKFILL_START}`);

	let totalInserted = 0;
	let totalUpdated = 0;

	for (const [, config] of Object.entries(FRED_SERIES)) {
		try {
			const r = await backfillSeries(config);
			totalInserted += r.inserted;
			totalUpdated += r.updated;
		} catch (err) {
			logger.error(
				`[Backfill] ${config.seriesId} failed: ${err instanceof Error ? err.message : err}`,
			);
		}
	}

	logger.info(
		`[Backfill] Done — ${totalInserted} inserted, ${totalUpdated} updated across ${Object.keys(FRED_SERIES).length} series`,
	);
}

main()
	.catch((e) => {
		logger.error("[Backfill] Fatal error:", e);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
