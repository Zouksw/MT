/**
 * MT Platform — runtime entry point.
 *
 * This module assembles the app via `createApp()` (from app.ts, which has no
 * process-level side effects) and starts the HTTP listener plus background
 * jobs (data scrapers, prediction queue, tiered refresh crons). Everything
 * with side effects lives inside functions so importing this module alone does
 * not start servers or timers.
 */

import { logger, prisma } from "@/lib";
import { MS_PER_HOUR } from "@/lib/constants";
import { registerAllScrapers, scraperManager } from "@/services/dataIngestion";
import type { ScraperResult } from "@/services/dataIngestion/scraperManager";
import { verifyDuePredictions } from "@/services/mapeTracking";
import { schedulePredictionsFromPostgreSQL } from "@/services/predictionCache";
import { createApp } from "./app";
import { config } from "./lib";

// Assemble the Express app + HTTP server + Socket.IO (no side effects here).
const { httpServer } = createApp();

// ─── Background jobs ──────────────────────────────────────────────────────

const HOURLY = MS_PER_HOUR;
const SIX_HOURS = 6 * HOURLY;
const DAILY = 24 * HOURLY;

async function runSourcesAndLog(sourceNames: string[], label: string) {
	try {
		const results: Record<string, ScraperResult> = {};
		for (const name of sourceNames) {
			try {
				results[name] = await scraperManager.runSource(name);
			} catch (err) {
				results[name] = { inserted: 0, updated: 0 };
				logger.error(`📊 [${label}] ${name} failed: ${err}`);
			}
		}
		const summary = Object.entries(results)
			.map(([name, r]) => `${name}: ${r.inserted}+${r.updated}`)
			.join("; ");
		logger.info(`📊 ${label}: ${summary}`);

		for (const [source, result] of Object.entries(results)) {
			try {
				// Skipped (e.g. missing API key) is a distinct state from "ran but
				// produced nothing" — record it as an error with the reason so the
				// freshness board surfaces dormant sources instead of masking them.
				let status: string;
				let errorMessage: string | undefined;
				if (result.skipped) {
					status = "error";
					errorMessage = result.skipReason ?? "skipped";
				} else if (result.inserted === 0 && result.updated === 0) {
					status = "warning";
				} else {
					status = "success";
				}
				await prisma.ingestionLog.create({
					data: {
						source,
						status,
						inserted: result.inserted,
						updated: result.updated,
						errorMessage,
					},
				});
			} catch (err) {
				logger.warn(`Failed to log ingestion for ${source}: ${err}`);
			}
		}
	} catch (err) {
		logger.error(`📊 ${label} failed: ${err}`);
	}
}

/**
 * Start the HTTP listener and all background work (scrapers, prediction queue,
 * tiered data-refresh crons). Called once from the process entry point below.
 */
function start(): void {
	httpServer.listen(config.server.port, () => {
		logger.info(`🚀 Server running on http://localhost:${config.server.port}`);
		logger.info(`📡 WebSocket server ready`);
		logger.info(`🌍 Environment: ${config.server.nodeEnv}`);

		// Initialize data scrapers
		registerAllScrapers();
		logger.info("📊 Data scrapers registered");

		// Run initial data fetch (don't block server startup)
		scraperManager
			.runAll()
			.then(async (results) => {
				const summary = Object.entries(results)
					.map(
						([name, r]) =>
							`${name}: ${"error" in r ? "error" : `${r.inserted} inserted, ${r.updated} updated`}`,
					)
					.join("; ");
				logger.info(`📊 Initial data fetch: ${summary}`);

				// Log to IngestionLog
				for (const [source, result] of Object.entries(results)) {
					try {
						if ("error" in result) {
							await prisma.ingestionLog.create({
								data: { source, status: "error", errorMessage: result.error },
							});
						} else {
							await prisma.ingestionLog.create({
								data: {
									source,
									status: "success",
									inserted: result.inserted,
									updated: result.updated,
								},
							});
						}
					} catch (err) {
						logger.warn(`Initial ingestion log failed: ${err}`);
					}
				}
			})
			.catch((err) => {
				logger.error(`📊 Initial data fetch failed: ${err}`);
			});

		// Schedule AI predictions from PostgreSQL (async, non-blocking)
		setTimeout(async () => {
			try {
				const count = await schedulePredictionsFromPostgreSQL();
				logger.info(`🤖 Scheduled predictions for ${count} commodities (every 30 min)`);
			} catch (err) {
				logger.warn(`🤖 Prediction scheduling skipped: ${err}`);
			}
		}, 5000);
	});

	// Hourly: exchange rates, China wholesale
	const HOURLY_SOURCES = ["commodity_prices", "china_wholesale"];
	setInterval(() => runSourcesAndLog(HOURLY_SOURCES, "Hourly refresh"), HOURLY);

	// Every 6 hours: futures, shipping, FRED, FAO, Baltic Dry, weather
	const SIX_HOUR_SOURCES = [
		"cme_futures",
		"dce_futures",
		"fred",
		"fao_prices",
		"baltic_dry",
		"shipping_index",
		"weather",
	];
	setInterval(() => runSourcesAndLog(SIX_HOUR_SOURCES, "6-hour refresh"), SIX_HOURS);

	// Daily: trade statistics, beef supply chain, official reports
	const DAILY_SOURCES = [
		"world_bank",
		"usda_psd",
		"mla_nlrs",
		"cepea",
		"inac",
		"abares",
		"china_customs_stats",
		"secex",
		"argentina",
		"usda_ams",
	];
	setInterval(() => runSourcesAndLog(DAILY_SOURCES, "Daily refresh"), DAILY);

	// Daily: auto-verify predictions whose forecast horizon has elapsed,
	// computing MAPE against actual prices so backtest/accuracy have real data.
	const DAILY_MS = 24 * MS_PER_HOUR;
	setInterval(async () => {
		try {
			const n = await verifyDuePredictions();
			logger.info(`📊 Auto-verified ${n} due predictions (MAPE accuracy update)`);
		} catch (err) {
			logger.warn(`📊 Prediction verification failed: ${err}`);
		}
	}, DAILY_MS);
}

start();
