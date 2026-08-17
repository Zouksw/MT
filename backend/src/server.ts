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
	expireWindowElapsedPredictions,
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
import { type ScheduledJob, scheduleJobs } from "@/services/scheduler";
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
 * The background cadence inventory — every recurring and one-shot job in one
 * declarative table (round-105, audit batch 10a). Error isolation, startup
 * sequencing, overlap guards, and timer lifecycle live in
 * services/scheduler.ts; each body below is business logic plus its success
 * log only.
 *
 * The startup delays are load-bearing ordering, not cosmetic: scrapers run
 * first (runAll at boot), then prediction scheduling (5s), verification
 * catch-up (15s), pollution invalidation (20s) → mark-unverifiable (25s,
 * after stale-marking settles), alerts (30s), beef bridge (45s, after
 * scrapers + alerts settle).
 */
function backgroundJobs(): ScheduledJob[] {
	// Hourly: exchange rates, China wholesale
	const HOURLY_SOURCES = ["commodity_prices", "china_wholesale"];

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

	// Daily: trade statistics, beef supply chain, official reports.
	// NOTE: "argentina" removed 2026-07-19 — it was listed here but never
	// registered in index.ts registerAllScrapers (no argentinaData.ts in src/,
	// only a stale dist/ artifact), so every daily run threw
	// "Unknown source: argentina". Re-add only alongside a real registration.
	//
	// "inac" removed 2026-08-15 — www.inac.gub.uy hangs on every path
	// (direct + via proxy), so each run paid a fetch timeout to report
	// success+0 rows. Registration commented out in
	// dataIngestion/index.ts; restore both together if the site returns.
	const DAILY_SOURCES = [
		"world_bank",
		"usda_psd",
		"mla_nlrs",
		"cepea",
		"abares",
		"china_customs_stats",
		"secex",
		"usda_ams",
	];

	// ROUND41_FIX_TS = the commit-41 timestamp; predictions older than this for
	// the 3 conflict commodities trained on conflicting-source data.
	const ROUND41_FIX_TS = new Date("2026-07-27T11:26:00Z");

	return [
		// One-shot: subscribe commodities + cuts to the 30-min prediction
		// refresh (the refresh timer itself lives in predictionCache.ts).
		// Two separate jobs so a commodity-side failure can't skip the cut side
		// (the pre-refactor code had independent try/catch per call).
		{
			name: "prediction-scheduling",
			firstRunDelayMs: 5000,
			run: async () => {
				const count = await schedulePredictionsFromPostgreSQL();
				logger.info(`🤖 Scheduled predictions for ${count} commodities (every 30 min)`);
			},
		},
		{
			name: "cut-prediction-scheduling",
			firstRunDelayMs: 5000,
			run: async () => {
				const cutCount = await scheduleBeefCutPredictions();
				logger.info(`🥩 Scheduled cut predictions for ${cutCount} beef cut series`);
			},
		},

		{
			name: "hourly-refresh",
			intervalMs: HOURLY,
			run: () => runSourcesAndLog(HOURLY_SOURCES, "Hourly refresh"),
		},
		{
			name: "six-hour-refresh",
			intervalMs: SIX_HOURS,
			run: () => runSourcesAndLog(SIX_HOUR_SOURCES, "6-hour refresh"),
		},
		{
			name: "daily-refresh",
			intervalMs: DAILY,
			run: () => runSourcesAndLog(DAILY_SOURCES, "Daily refresh"),
		},

		// Every 6 hours: auto-verify predictions whose forecast horizon has
		// elapsed, computing MAPE against actual prices so backtest/accuracy
		// have real data. Runs immediately on startup (catch-up after downtime).
		//
		// Cadence raised 24h → 6h (round-46): the verification loop was falling
		// behind — 106k completed vs 673 verified (0.6%). At 5k/24h that's a
		// 53-day drain; at 5k/6h it's under 2 weeks. Each run is bounded by the
		// take cap.
		{
			name: "prediction-verification",
			firstRunDelayMs: 15000, // lets scrapers finish first
			intervalMs: 6 * MS_PER_HOUR,
			run: async () => {
				// Zombie-source drain FIRST (round-110): heartbeat commodities
				// (rare fresh-looking price rows, never ≥3 actuals in any 10-day
				// window) parked ~27k permanently-skippable rows inside the
				// oldest-first take:5000 candidate set, starving every real
				// candidate — chronos on fresh sources stopped verifying after
				// 2026-08-04. Expired rows exit the queue; the verify batch
				// below then spends its window on rows that can actually verify.
				const expired = await expireWindowElapsedPredictions();
				if (expired > 0)
					logger.info(`📊 Expired ${expired} window-elapsed predictions (zombie-source drain)`);
				const n = await verifyDuePredictions();
				logger.info(`📊 Auto-verified ${n} due predictions (MAPE accuracy update)`);
			},
		},

		// One-shot (startup): mark predictions trained on polluted pre-fix data
		// as `stale` so they don't inject bogus ~96% MAPE into the accuracy
		// averages. See invalidatePollutedPredictions docs for the
		// unrecoverable-data reasoning.
		{
			name: "pollution-invalidation",
			firstRunDelayMs: 20000,
			run: async () => {
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
			},
		},

		// One-shot (startup): mark frozen-commodity completed predictions as
		// `unverifiable` so they exit the verifyDuePredictions queue. Without
		// this, ~92k predictions for commodities whose data source died months
		// ago (wheat_cn/gold_lbma/etc., latest price 2026-04-29) are re-read
		// every 6h verify cycle and always fail no-actuals — wasting the
		// 5000-row batch on rows that can never verify, starving real chronos
		// candidates. Runs AFTER pollution invalidation (20s) so the
		// stale-marking settles first. See markUnverifiablePredictions docs
		// for the batch detection logic. Idempotent.
		{
			name: "mark-unverifiable",
			firstRunDelayMs: 25000,
			run: async () => {
				const n = await markUnverifiablePredictions();
				if (n > 0) logger.info(`📊 Marked ${n} frozen-commodity predictions as unverifiable`);

				// Reclaim falsely-unverifiable rows: markUnverifiable is
				// point-in-time and irreversible, so a commodity whose source
				// later revives (e.g. beef_carcass_us during a transient FRED
				// lag) leaves legitimately-verifiable predictions stranded.
				// Runs right after marking so the mark pass settles
				// genuinely-frozen rows first; this pass then restores rows
				// whose commodity now has post-prediction actuals. Idempotent.
				const restored = await restoreVerifiablePredictions();
				if (restored > 0)
					logger.info(
						`📊 Restored ${restored} revived-source predictions from unverifiable → completed`,
					);
			},
		},

		// Every 10 minutes: evaluate user-defined alert rules against latest
		// prices. This closes the loop that previously made alert rules a
		// dead-end feature (rules could be created but nothing evaluated them).
		// Shorter cadence than verification because price thresholds are
		// time-sensitive.
		//
		// Bug fix (round-44): was `10 * MS_PER_HOUR` = 10 HOURS despite the
		// "10 min" comment — alerts fired 60× slower than intended.
		// MS_PER_MINUTE, not MS_PER_HOUR, matches the documented cadence and
		// the price-threshold intent.
		{
			name: "alert-evaluation",
			firstRunDelayMs: 30000, // lets scrapers finish first
			intervalMs: 10 * MS_PER_MINUTE,
			run: async () => {
				const n = await evaluateAlertRules();
				if (n > 0) logger.info(`🔔 Alert rules: ${n} triggered this cycle`);
			},
		},

		// Every 6 hours: bridge fresh CommodityPrice closes into BeefCutPrice
		// so the /beef page (which reads only BeefCutPrice) isn't stuck on
		// stale seed data. The bridge is idempotent and scoped to slugs with
		// unambiguous cutCode mappings — see services/beefPriceBridge.ts for
		// the conservative scope and the source=bridge:commodity:<slug>
		// convention.
		{
			name: "beef-price-bridge",
			firstRunDelayMs: 45000, // after scrapers + alerts settle
			intervalMs: 6 * MS_PER_HOUR,
			run: async () => {
				const { copied, skipped } = await bridgeBeefPrices();
				logger.info(`🥩 Beef price bridge: ${copied} copied, ${skipped} skipped`);
			},
		},
	];
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

		// Arm every background job through the shared scheduler. The table
		// (backgroundJobs above) is the single cadence inventory; error
		// isolation, startup ordering, and overlap guards live in
		// services/scheduler.ts.
		scheduleJobs(backgroundJobs());
	});
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
