/**
 * Data-layer health observability.
 *
 * The infrastructure health check (`/health/ready`) reports database/redis/
 * inference as `true` — all of which can be up while the DATA layer is
 * silently failing: 17 of 19 scrapers dormant (missing API keys, Cloudflare
 * blocks, network unreachable), no fresh beef-cut prices for weeks, and a
 * 100k+ backlog of predictions that can never verify because their
 * commodities have no incoming actuals.
 *
 * This module makes that state visible. It computes a data-flow snapshot:
 *   - which sources wrote rows in the last N days (truly fresh vs dormant)
 *   - the prediction verification debt (completed vs verified, and the
 *     commodities stuck on no-actuals)
 *
 * Used by `/health/ready` so an operator sees "ready: true (infra) but
 * dataFresh: false" instead of a misleading all-green. No fixing here —
 * purely honest surfacing of existing state (PRODUCT-SPEC §六 trust repair).
 */

import { prisma } from "@/lib";
import { scraperManager } from "@/services/dataIngestion";
import { PredictionStatus as PS } from "@/services/predictionLifecycle";

export interface SourceFreshness {
	/** Scraper registration key (e.g. "fred", "cme_futures"). */
	source: string;
	/** Rows written to commodity_prices in the window (any source column). */
	commodityPriceRows: number;
	/** Rows written to beef_cut_prices in the window. */
	beefCutPriceRows: number;
	/** Most recent row date across both tables. */
	latestDate: Date | null;
	/** Scraper-reported status from scraperManager.getHealth(). */
	scraperStatus: string;
}

export interface DataHealthSnapshot {
	/** Wall-clock time of the snapshot. */
	asOf: Date;
	/** Freshness window in days (how recent a write must be to count as fresh). */
	windowDays: number;
	/** Per-source freshness rows (only sources that wrote ≥1 row in window, OR
	 * are registered scrapers — so dormant ones appear with 0 rows). */
	sources: SourceFreshness[];
	/** Count of sources that wrote ≥1 row in the window. */
	freshSourceCount: number;
	/** Count of registered scrapers (denominator for the fresh ratio). */
	registeredSourceCount: number;
	/** True iff at least one source wrote in the window (data is moving). */
	anyDataFlowing: boolean;
	/** Predictions awaiting verification (status='completed', horizon-elapsed). */
	predictionBacklog: number;
	/** Predictions successfully verified (status='verified'). */
	predictionVerified: number;
	/** Predictions marked stale (polluted / un-recoverable, excluded). */
	predictionStale: number;
	/** Predictions marked unverifiable (frozen-commodity data source; the
	 * prediction's horizon elapsed but its commodity received no new prices,
	 * so it can never be verified). Excluded from verificationRatio's
	 * denominator — they're not "debt" (which implies future verifiability),
	 * they're a dead-end. Tracked separately so operators can see how large
	 * the frozen-commodity backlog is. */
	predictionUnverifiable: number;
	/** Verified / (verified + backlog) ratio, 0–1. Lower = more debt.
	 * Denominator excludes unverifiable (frozen-source) rows. */
	verificationRatio: number;
	/** True iff verificationRatio is below 0.05 (severe debt signal). */
	hasVerificationDebt: boolean;
}

/**
 * Compute a data-health snapshot over the given freshness window.
 *
 * @param windowDays how recent a price write must be to count as "fresh"
 *   (default 3 — a source writing less often than that is effectively stale).
 */
export async function getDataHealth(windowDays = 3): Promise<DataHealthSnapshot> {
	const since = new Date(Date.now() - windowDays * 86400000);

	// Rows per source column in commodity_prices within the window.
	const cpBySource = await prisma.commodityPrice.groupBy({
		by: ["source"],
		where: { date: { gte: since } },
		_count: true,
	});
	const cpRows = new Map(cpBySource.map((r) => [r.source, r._count]));

	// Rows per source in beef_cut_prices within the window.
	const bcpBySource = await prisma.beefCutPrice.groupBy({
		by: ["source"],
		where: { date: { gte: since } },
		_count: true,
	});
	const bcpRows = new Map(bcpBySource.map((r) => [r.source, r._count]));

	// Latest write date per source across both tables. Uses raw SQL because
	// Prisma's groupBy can't return a max(Date) aggregate typed as Date across
	// two tables in one call; a UNION ALL + max() is the cheapest single round-trip.
	const latestRows = await prisma.$queryRaw<Array<{ source: string; latest: Date }>>`
		SELECT source, MAX(latest) AS latest FROM (
			SELECT source, MAX(date) AS latest FROM commodity_prices WHERE date >= ${since} GROUP BY source
			UNION ALL
			SELECT source, MAX(date) AS latest FROM beef_cut_prices WHERE date >= ${since} GROUP BY source
		) AS combined GROUP BY source`;
	const latestBySource = new Map<string, Date>();
	for (const r of latestRows) {
		if (r.latest) {
			const existing = latestBySource.get(r.source);
			if (!existing || r.latest > existing) latestBySource.set(r.source, r.latest);
		}
	}

	// Registered scrapers (the denominator). Map each to its freshness row,
	// including dormant ones (0 rows) so they're visible on the board.
	const scraperHealth = scraperManager.getHealth();
	const registeredSources = Object.keys(scraperHealth);

	// Also include any source column that wrote rows but isn't a registered
	// scraper (e.g. manual CSV import source, bridge: source) — those are real
	// data producers even if not on the scraper schedule.
	const writerSources = new Set<string>([...cpRows.keys(), ...bcpRows.keys()]);
	const allSources = new Set<string>([...registeredSources, ...writerSources]);

	const sources: SourceFreshness[] = [];
	for (const source of allSources) {
		const commodityPriceRows = cpRows.get(source) ?? 0;
		const beefCutPriceRows = bcpRows.get(source) ?? 0;
		const h = scraperHealth[source];
		const scraperStatus = h
			? h.skippedNoKey
				? "skipped_no_key"
				: h.emptyAfterRun
					? "empty"
					: h.success
						? "healthy"
						: h.lastRun
							? "error"
							: "pending"
			: "not_a_scraper";
		sources.push({
			source,
			commodityPriceRows,
			beefCutPriceRows,
			latestDate: latestBySource.get(source) ?? null,
			scraperStatus,
		});
	}
	// Sort: most rows first (freshest producers on top), dormant at the bottom.
	sources.sort(
		(a, b) =>
			b.commodityPriceRows + b.beefCutPriceRows - (a.commodityPriceRows + a.beefCutPriceRows),
	);

	const freshSourceCount = sources.filter(
		(s) => s.commodityPriceRows + s.beefCutPriceRows > 0,
	).length;

	// Prediction verification debt. Four buckets now: completed (backlog),
	// verified, stale (polluted-source), unverifiable (frozen-source). The
	// unverifiable bucket (round-62) holds predictions whose commodity data
	// source died before the horizon elapsed — they can NEVER verify, so they
	// are excluded from the verificationRatio denominator (otherwise ~92k
	// frozen rows kept the ratio pinned at 0.006, masking real debt).
	const [predictionBacklog, predictionVerified, predictionStale, predictionUnverifiable] =
		await Promise.all([
			prisma.predictionLog.count({ where: { status: PS.COMPLETED } }),
			prisma.predictionLog.count({ where: { status: PS.VERIFIED } }),
			prisma.predictionLog.count({ where: { status: PS.STALE } }),
			prisma.predictionLog.count({ where: { status: PS.UNVERIFIABLE } }),
		]);

	const verificationRatio =
		predictionVerified + predictionBacklog > 0
			? predictionVerified / (predictionVerified + predictionBacklog)
			: 0;

	return {
		asOf: new Date(),
		windowDays,
		sources,
		freshSourceCount,
		registeredSourceCount: registeredSources.length,
		anyDataFlowing: freshSourceCount > 0,
		predictionBacklog,
		predictionVerified,
		predictionStale,
		predictionUnverifiable,
		verificationRatio,
		hasVerificationDebt: verificationRatio < 0.05,
	};
}
