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
import { evaluateAlertRules } from "@/services/alert-rules";
import { bridgeBeefPrices } from "@/services/beefPriceBridge";
import { registerAllScrapers, scraperManager } from "@/services/dataIngestion";
import type { ScraperResult } from "@/services/dataIngestion/scraperManager";
import { verifyDuePredictions } from "@/services/mapeTracking";
import {
	scheduleBeefCutPredictions,
	schedulePredictionsFromPostgreSQL,
} from "@/services/predictionCache";
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
				// A thrown source is a hard failure (parse error, network down,
				// unexpected exception) — NOT the same as "ran but produced 0 rows".
				// Mark it with the error message so the status classification below
				// records it as `error` on the freshness board. Without this flag a
				// thrown source fell into the {inserted:0,updated:0} → warning
				// branch, masking total failures as low-data warnings.
				const msg = err instanceof Error ? err.message : String(err);
				results[name] = { inserted: 0, updated: 0, error: msg };
				logger.error(`📊 [${label}] ${name} failed: ${msg}`);
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
				} else if (result.error) {
					// Thrown source (caught in the run loop above) — hard failure.
					status = "error";
					errorMessage = result.error;
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
			// Dual-backend: also schedule beef CUT predictions (cut:{factoryId}:
			// {cutCode} virtual keys). Shares the same 30-min refresh timer.
			try {
				const cutCount = await scheduleBeefCutPredictions();
				logger.info(`🥩 Scheduled cut predictions for ${cutCount} beef cut series`);
			} catch (err) {
				logger.warn(`🥩 Cut prediction scheduling skipped: ${err}`);
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

	// Daily: trade statistics, beef supply chain, official reports.
	// NOTE: "argentina" removed 2026-07-19 — it was listed here but never
	// registered in index.ts registerAllScrapers (no argentinaData.ts in src/,
	// only a stale dist/ artifact), so every daily run threw
	// "Unknown source: argentina". Re-add only alongside a real registration.
	const DAILY_SOURCES = [
		"world_bank",
		"usda_psd",
		"mla_nlrs",
		"cepea",
		"inac",
		"abares",
		"china_customs_stats",
		"secex",
		"usda_ams",
	];
	setInterval(() => runSourcesAndLog(DAILY_SOURCES, "Daily refresh"), DAILY);

	// Daily: auto-verify predictions whose forecast horizon has elapsed,
	// computing MAPE against actual prices so backtest/accuracy have real data.
	// Runs immediately on startup (to catch up after downtime) then every 24h.
	const DAILY_MS = 24 * MS_PER_HOUR;
	const runVerification = async () => {
		try {
			const n = await verifyDuePredictions();
			logger.info(`📊 Auto-verified ${n} due predictions (MAPE accuracy update)`);
		} catch (err) {
			logger.warn(`📊 Prediction verification failed: ${err}`);
		}
	};
	setTimeout(runVerification, 15000); // 15s delay lets scrapers finish first
	setInterval(runVerification, DAILY_MS);

	// Every 10 minutes: evaluate user-defined alert rules against latest prices.
	// This closes the loop that previously made alert rules a dead-end feature
	// (rules could be created but nothing evaluated them). Runs on a shorter
	// cadence than verification because price thresholds are time-sensitive.
	const ALERT_EVAL_INTERVAL = 10 * MS_PER_HOUR; // 10 min
	const runAlertEvaluation = async () => {
		try {
			const n = await evaluateAlertRules();
			if (n > 0) logger.info(`🔔 Alert rules: ${n} triggered this cycle`);
		} catch (err) {
			logger.warn(`🔔 Alert rule evaluation failed: ${err}`);
		}
	};
	setTimeout(runAlertEvaluation, 30000); // 30s delay lets scrapers finish first
	setInterval(runAlertEvaluation, ALERT_EVAL_INTERVAL);

	// Every 6 hours: bridge fresh CommodityPrice closes into BeefCutPrice so the
	// /beef page (which reads only BeefCutPrice) isn't stuck on stale seed data.
	// The bridge is idempotent and scoped to slugs with unambiguous cutCode
	// mappings — see services/beefPriceBridge.ts for the conservative scope and
	// the source=bridge:commodity:<slug> convention.
	const BEEF_BRIDGE_INTERVAL = 6 * MS_PER_HOUR;
	const runBeefBridge = async () => {
		try {
			const { copied, skipped } = await bridgeBeefPrices();
			logger.info(`🥩 Beef price bridge: ${copied} copied, ${skipped} skipped`);
		} catch (err) {
			logger.warn(`🥩 Beef price bridge failed: ${err}`);
		}
	};
	setTimeout(runBeefBridge, 45000); // 45s — after scrapers + alerts settle
	setInterval(runBeefBridge, BEEF_BRIDGE_INTERVAL);
}

start();
