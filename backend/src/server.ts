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
import { MS_PER_HOUR, MS_PER_MINUTE } from "@/lib/constants";
import { evaluateAlertRules } from "@/services/alert-rules";
import { bridgeBeefPrices } from "@/services/beefPriceBridge";
import { registerAllScrapers, scraperManager } from "@/services/dataIngestion";
import { classifyIngestionStatus } from "@/services/dataIngestion/helpers";
import type { ScraperResult } from "@/services/dataIngestion/scraperManager";
import {
	invalidatePollutedPredictions,
	markUnverifiablePredictions,
	restorePostFixConflictPredictions,
	restoreVerifiablePredictions,
	verifyDuePredictions,
} from "@/services/mapeTracking";
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
				// Shared 0-row honesty contract (helpers.classifyIngestionStatus):
				// skipped/error → "error", 0-row → "warning", wrote rows → "success".
				// Centralized so the scheduled path, manual single-source refresh,
				// and refresh-all all record the same status for the same outcome.
				const { status, errorMessage } = classifyIngestionStatus(result);
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
		// "inac" removed 2026-08-15 — www.inac.gub.uy hangs on every path
		// (direct + via proxy), so each run paid a fetch timeout to report
		// success+0 rows. Registration commented out in
		// dataIngestion/index.ts; restore both together if the site returns.
		"abares",
		"china_customs_stats",
		"secex",
		"usda_ams",
	];
	setInterval(() => runSourcesAndLog(DAILY_SOURCES, "Daily refresh"), DAILY);

	// Every 6 hours: auto-verify predictions whose forecast horizon has
	// elapsed, computing MAPE against actual prices so backtest/accuracy have
	// real data. Runs immediately on startup (to catch up after downtime).
	//
	// Cadence raised 24h → 6h (round-46): the verification loop was falling
	// behind — 106k completed vs 673 verified (0.6%). At 5k/24h that's a 53-day
	// drain; at 5k/6h it's under 2 weeks. Each run is bounded by the take cap.
	const VERIFICATION_INTERVAL = 6 * MS_PER_HOUR;
	const runVerification = async () => {
		try {
			const n = await verifyDuePredictions();
			logger.info(`📊 Auto-verified ${n} due predictions (MAPE accuracy update)`);
		} catch (err) {
			logger.warn(`📊 Prediction verification failed: ${err}`);
		}
	};
	setTimeout(runVerification, 15000); // 15s delay lets scrapers finish first
	setInterval(runVerification, VERIFICATION_INTERVAL);

	// One-shot (startup): mark predictions trained on polluted pre-fix data as
	// `stale` so they don't inject bogus ~96% MAPE into the accuracy averages.
	// See invalidatePollutedPredictions docs for the unrecoverable-data reasoning.
	// ROUND41_FIX_TS = the commit-41 timestamp; predictions older than this for
	// the 3 conflict commodities trained on conflicting-source data.
	const ROUND41_FIX_TS = new Date("2026-07-27T11:26:00Z");
	const runPollutionInvalidation = async () => {
		try {
			const n = await invalidatePollutedPredictions(ROUND41_FIX_TS);
			if (n > 0) logger.info(`📊 Marked ${n} polluted predictions as stale (pre-fix data)`);
			// Symmetric restore: a prior run left post-fix conflict-commodity
			// predictions stuck at `stale` (they trained on the
			// authoritative-source-filtered series and are legitimate, but
			// verifyDuePredictions only reads `completed`, so they were trapped).
			// Restored rows re-enter the verification queue so brl_usd /
			// corn_cme / natural_gas_cme accuracy can populate. Idempotent.
			const restored = await restorePostFixConflictPredictions(ROUND41_FIX_TS);
			if (restored > 0)
				logger.info(
					`📊 Restored ${restored} post-fix conflict-commodity predictions stale→completed`,
				);
		} catch (err) {
			logger.warn(`📊 Pollution invalidation failed: ${err}`);
		}
	};
	setTimeout(runPollutionInvalidation, 20000);

	// One-shot (startup): mark frozen-commodity completed predictions as
	// `unverifiable` so they exit the verifyDuePredictions queue. Without this,
	// ~92k predictions for commodities whose data source died months ago
	// (wheat_cn/gold_lbma/etc., latest price 2026-04-29) are re-read every 6h
	// verify cycle and always fail no-actuals — wasting the 5000-row batch on
	// rows that can never verify, starving real chronos candidates. Runs AFTER
	// pollution invalidation (20s) so the stale-marking settles first. See
	// markUnverifiablePredictions docs for the batch detection logic. Idempotent.
	const runMarkUnverifiable = async () => {
		try {
			const n = await markUnverifiablePredictions();
			if (n > 0) logger.info(`📊 Marked ${n} frozen-commodity predictions as unverifiable`);
		} catch (err) {
			logger.warn(`📊 markUnverifiable failed: ${err}`);
		}

		// Reclaim falsely-unverifiable rows: markUnverifiable is point-in-time
		// and irreversible, so a commodity whose source later revives (e.g.
		// beef_carcass_us during a transient FRED lag) leaves legitimately-
		// verifiable predictions stranded. Runs right after marking so the
		// mark pass settles genuinely-frozen rows first; this pass then restores
		// rows whose commodity now has post-prediction actuals. Idempotent.
		try {
			const restored = await restoreVerifiablePredictions();
			if (restored > 0)
				logger.info(
					`📊 Restored ${restored} revived-source predictions from unverifiable → completed`,
				);
		} catch (err) {
			logger.warn(`📊 restoreVerifiable failed: ${err}`);
		}
	};
	setTimeout(runMarkUnverifiable, 25000);

	// Every 10 minutes: evaluate user-defined alert rules against latest prices.
	// This closes the loop that previously made alert rules a dead-end feature
	// (rules could be created but nothing evaluated them). Runs on a shorter
	// cadence than verification because price thresholds are time-sensitive.
	//
	// Bug fix (round-44): was `10 * MS_PER_HOUR` = 10 HOURS despite the "10 min"
	// comment — alerts fired 60× slower than intended. MS_PER_MINUTE, not
	// MS_PER_HOUR, matches the documented cadence and the price-threshold intent.
	const ALERT_EVAL_INTERVAL = 10 * MS_PER_MINUTE; // 10 min
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

// ─── Global error handlers ────────────────────────────────────────────────
// Without these, a single floating promise rejection (e.g. a fire-and-forget
// async call missing .catch()) crashes the entire process — taking down the
// HTTP server, all WebSocket connections, and every background cron (scrapers,
// MAPE verification, alert evaluation, beef bridge). Node's default since v15
// is to terminate on unhandled rejections. These handlers log the cause with
// a full stack trace so operators can diagnose the root cause, then exit
// cleanly (PM2 restarts the process). We do NOT swallow — swallowing hides
// bugs and can leave the process in an inconsistent state.
process.on("unhandledRejection", (reason, promise) => {
	logger.error("[FATAL] Unhandled Promise rejection — process will exit", {
		reason: reason instanceof Error ? reason.message : String(reason),
		stack: reason instanceof Error ? reason.stack : undefined,
	});
	// Give the logger time to flush, then exit (PM2 restarts).
	setImmediate(() => process.exit(1));
});

process.on("uncaughtException", (error) => {
	logger.error("[FATAL] Uncaught exception — process will exit", {
		message: error.message,
		stack: error.stack,
	});
	setImmediate(() => process.exit(1));
});

start();
