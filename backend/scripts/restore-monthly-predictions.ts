/**
 * 批0 one-off (round-136): recover the 2026-08-30 monthly freeze incident.
 *
 * 0a — restore the 42 wrongly-frozen monthly rows (6 series × 7 models,
 *      anchor 2026-07-31, horizon 10 → actionable 2027-08-29): the sweeps
 *      froze them when the six series' latest points (2026-07-01) crossed
 *      the OLD 60d staleness boundary mid publication cycle, hours before
 *      the 90d fix deployed. Runs the extended restoreVerifiablePredictions
 *      (批0b's self-heal clause), which reclaims unverifiable monthly rows
 *      whose window + grace has NOT elapsed — the recurring sweep now does
 *      this on its own; this script just doesn't wait 6h.
 * 0d — mark beef_carcass_us's 7 NULL-interval legacy rows (2026-08-23,
 *      horizon 6, pre-monthly-semantics era) `stale`: under daily semantics
 *      they can never verify (the series has no daily prices). Kept as
 *      history, excluded from accuracy math — same precedent as the R2
 *      polluted rows (invalidatePollutedPredictions).
 *
 * Controlled acceptance (verify-monthly-lifecycle.ts pattern): dry-run
 * SELECT first, act only on the exact expected shapes, verify after each
 * step. Idempotent — a second run finds 0 candidates in both steps and
 * still exits 0. Exit 1 = shape mismatch (inspect manually; nothing was
 * partially committed — each step is a single statement).
 *
 * Backup BEFORE running: pg_dump prediction_logs (see docs/CHANGELOG round
 * entry for the artifact path). Usage: cd backend && npx tsx scripts/restore-monthly-predictions.ts
 */

import { PrismaClient } from "@prisma/client";
import { stalenessWindowDays } from "@/services/cadence";
import { restoreVerifiablePredictions } from "@/services/mapeTracking";

const prisma = new PrismaClient();
const GRACE_DAYS = stalenessWindowDays("monthly");
/** Expected shapes, measured 2026-08-30 13:20 UTC (pre-script SELECT). */
const EXPECT_FROZEN_MONTHLY = 42; // 6 series × 7 models
const EXPECT_NULL_LEGACY = 7; // beef_carcass_us, horizon 6, interval NULL

/** Not-yet-actionable unverifiable monthly rows per series — 批0b's exact
 * reclaim predicate, mirrored in SQL for the dry-run count. */
function frozenMonthlyRowsQuery() {
	return prisma.$queryRaw<Array<{ slug: string; n: number }>>`
		SELECT c.slug, COUNT(*)::int AS n
		FROM prediction_logs AS pl
		JOIN commodities AS c ON c.id = pl.commodity_id
		WHERE pl.status = 'unverifiable'
			AND pl.interval = 'monthly'
			AND pl.commodity_id NOT LIKE 'cut:%'
			AND COALESCE(pl.forecast_start_at, pl.predicted_at)
				+ make_interval(months => pl.horizon::int)
				+ make_interval(days => ${GRACE_DAYS}::int)
				> (now() AT TIME ZONE 'utc')
		GROUP BY c.slug
		ORDER BY c.slug`;
}

function fail(msg: string): number {
	console.error(`FAIL  ${msg}`);
	return 1;
}

async function main(): Promise<number> {
	// ---------- 0a: restore wrongly-frozen not-yet-actionable monthly rows ----------
	const before = await frozenMonthlyRowsQuery();
	const beforeTotal = before.reduce((sum, r) => sum + r.n, 0);
	console.log(
		`[0a] not-yet-actionable unverifiable monthly rows: ${beforeTotal}` +
			(before.length > 0 ? ` (${before.map((r) => `${r.slug}=${r.n}`).join(", ")})` : ""),
	);
	if (beforeTotal === 0) {
		console.log("[0a] nothing to restore (already recovered) — ok");
	} else if (beforeTotal !== EXPECT_FROZEN_MONTHLY) {
		return fail(
			`expected ${EXPECT_FROZEN_MONTHLY} frozen monthly rows, found ${beforeTotal} — shape drifted, inspect before acting`,
		);
	} else {
		const restored = await restoreVerifiablePredictions();
		console.log(
			`[0a] restoreVerifiablePredictions touched ${restored} rows (incl. any backfilled windows)`,
		);
	}

	const afterFrozen = await frozenMonthlyRowsQuery();
	if (afterFrozen.length > 0) {
		return fail(
			`[0a] ${afterFrozen.length} series still frozen post-restore: ${JSON.stringify(afterFrozen)}`,
		);
	}
	const completed = await prisma.$queryRaw<Array<{ slug: string; n: number }>>`
		SELECT c.slug, COUNT(*)::int AS n
		FROM prediction_logs AS pl
		JOIN commodities AS c ON c.id = pl.commodity_id
		WHERE pl.status = 'completed' AND pl.interval = 'monthly'
			AND pl.commodity_id NOT LIKE 'cut:%'
		GROUP BY c.slug ORDER BY c.slug`;
	console.log(
		`[0a] monthly completed rows after restore: ${completed.map((r) => `${r.slug}=${r.n}`).join(", ")}`,
	);
	const shortSeries = completed.filter((r) => r.n < 7);
	if (shortSeries.length > 0) {
		return fail(
			`[0a] expected ≥7 completed monthly rows per series, short: ${JSON.stringify(shortSeries)}`,
		);
	}
	console.log("[0a] ok — all not-yet-actionable monthly rows back to completed");

	// ---------- 0d: beef NULL-interval legacy rows → stale ----------
	const beef = await prisma.commodity.findUnique({ where: { slug: "beef_carcass_us" } });
	if (!beef) return fail("beef_carcass_us not found");
	const legacyCount = await prisma.predictionLog.count({
		where: { commodityId: beef.id, interval: null, status: "unverifiable" },
	});
	console.log(`[0d] beef NULL-interval unverifiable rows: ${legacyCount}`);
	if (legacyCount === 0) {
		console.log("[0d] nothing to mark (already handled) — ok");
	} else if (legacyCount !== EXPECT_NULL_LEGACY) {
		return fail(
			`expected ${EXPECT_NULL_LEGACY} legacy rows, found ${legacyCount} — shape drifted, inspect before acting`,
		);
	} else {
		const marked = await prisma.predictionLog.updateMany({
			where: { commodityId: beef.id, interval: null, status: "unverifiable" },
			data: { status: "stale" },
		});
		console.log(`[0d] marked ${marked.count} rows stale`);
	}
	const remaining = await prisma.predictionLog.count({
		where: { commodityId: beef.id, interval: null, status: "unverifiable" },
	});
	if (remaining !== 0) return fail(`[0d] ${remaining} NULL-interval unverifiable rows remain`);

	console.log(
		"ok    batch-0a/0d recovery complete: monthly evidence chain restored, legacy rows archived as stale",
	);
	return 0;
}

main()
	.then((code) => process.exit(code ?? 0))
	.catch((e) => {
		console.error("FAIL", e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
