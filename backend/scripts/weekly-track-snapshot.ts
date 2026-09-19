/**
 * Weekly track-record snapshot (IMPROVEMENT-PLAN v3.1.0 批5, merging the
 * v3.0.0 "track-record 周度快照物料" item) — material for a weekly
 * publishing ritual: the 30-day model leaderboard (median MAPE + direction
 * hit), the beef monthly verification state (rows by status/horizon, next
 * maturity dates), and a pointer to the frozen backtest evidence. Writes
 * docs/snapshots/track-record-YYYY-MM-DD.md — dated filename = append-only
 * history, one file per run, no overwrites.
 *
 * Read-only against the DB; safe to run any time.
 * Usage: cd backend && npx tsx scripts/weekly-track-snapshot.ts
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { getAllModelAccuracy } from "@/services/mapeTracking";

const prisma = new PrismaClient();
const BEEF_SLUG = "beef_carcass_us";

async function main() {
	const beef = await prisma.commodity.findUnique({ where: { slug: BEEF_SLUG } });
	if (!beef) throw new Error(`${BEEF_SLUG} not found`);

	const accuracy = await getAllModelAccuracy(undefined, 30);

	const [beefRows, beefNextDue, beefLatestPoint, familyVerified] = await Promise.all([
		prisma.$queryRaw<Array<{ status: string; horizon: number; n: bigint }>>`
			SELECT status, horizon, count(*) AS n
			FROM prediction_logs
			WHERE commodity_id = ${beef.id} AND interval = 'monthly'
			GROUP BY 1, 2 ORDER BY 1, 2`,
		prisma.$queryRaw<Array<{ due: Date }>>`
			SELECT min(forecast_start_at + make_interval(months => horizon)) AS due
			FROM prediction_logs
			WHERE commodity_id = ${beef.id} AND interval = 'monthly' AND status = 'completed'`,
		prisma.commodityPrice.findFirst({
			where: { commodityId: beef.id, interval: "monthly" },
			orderBy: { date: "desc" },
			select: { date: true, close: true },
		}),
		// Beef-FAMILY verified overview (round-164 批0a): the first live beef
		// verifications (beef_retail_us, 2026-09-12) must appear here, not
		// only the benchmark's still-pending state.
		prisma.$queryRaw<
			Array<{
				slug: string;
				n: bigint;
				min_mape: number | null;
				max_mape: number | null;
				last: Date | null;
			}>
		>`
			SELECT c.slug, count(*) AS n, min(pl.mape) AS min_mape, max(pl.mape) AS max_mape, max(pl.verified_at) AS last
			FROM prediction_logs pl JOIN commodities c ON c.id = pl.commodity_id
			WHERE c.slug LIKE 'beef%' AND pl.status = 'verified'
			  AND pl.verified_at > now() - interval '30 days'
			GROUP BY c.slug ORDER BY c.slug`,
	]);

	const backtestPath = new URL(
		"../docs/backtests/beef-monthly-2026-08.md",
		`file://${process.cwd()}/`,
	).pathname;
	const backtestMd5 = existsSync(backtestPath)
		? createHash("md5").update(readFileSync(backtestPath)).digest("hex")
		: null;

	const pct = (r: number | null) => (r == null ? "—" : `${(r * 100).toFixed(1)}%`);
	const lines: string[] = [];
	lines.push(`# Track record snapshot — ${new Date().toISOString().slice(0, 10)}`);
	lines.push("");
	lines.push(
		`> Generated ${new Date().toISOString()} by backend/scripts/weekly-track-snapshot.ts (read-only).`,
	);
	lines.push(
		"> 与公开页 /ai/track-record 同源（30d 窗）；方向口径 = 末步涨跌符号 vs 窗前 anchor，flat 排除。",
	);
	lines.push(
		"> 混源序列按权威源声明取数（v3.2.0 批2 起 18 slugs 已声明）；未声明混源组无明确 anchor，方向整组排除、MAPE 不受影响。",
	);
	lines.push("");
	lines.push("## Model leaderboard — 30d verified window");
	lines.push("");
	lines.push("| model | median MAPE | direction hit | judged n | verified n |");
	lines.push("|---|---|---|---|---|");
	for (const a of [...accuracy].sort((x, y) => (x.medianMape ?? 999) - (y.medianMape ?? 999))) {
		lines.push(
			`| ${a.modelId} | ${a.medianMape ?? "—"} | ${pct(a.directionHitRate)} | ${a.directionCount} | ${a.verifiedCount} |`,
		);
	}
	lines.push("");
	lines.push(`## 牛肉专段 — ${BEEF_SLUG}（IMF PBEEFUSDM 月度基准）`);
	lines.push("");
	lines.push(
		`- 最新月度数据点：${beefLatestPoint ? `${beefLatestPoint.date.toISOString().slice(0, 10)} = ${beefLatestPoint.close}` : "—"} USD/吨`,
	);
	lines.push(
		`- 下一个滚动验证到期：${beefNextDue[0]?.due ? new Date(beefNextDue[0].due).toISOString().slice(0, 10) : "—"}（最早的 anchor + horizon 月度行）`,
	);
	lines.push("- 月度预测行分布（status × horizon）：");
	for (const r of beefRows) {
		lines.push(`  - ${r.status} / H=${r.horizon}: ${r.n}`);
	}
	lines.push(
		"- 回测证据（冻结）：docs/backtests/beef-monthly-2026-08.md" +
			(backtestMd5 ? `（md5 ${backtestMd5}）` : "（文件缺失）"),
	);
	lines.push(
		"- 校准证据（round-164 批0b）：docs/backtests/beef-monthly-consensus-calibration-2026-09.md（共识残差分位 → 共识卡校准 90% 区间）",
	);
	lines.push("");
	lines.push("### 牛肉家族 verified — 30d 窗");
	lines.push("");
	if (familyVerified.length === 0) {
		lines.push("- 尚无牛肉家族 verified 行（月度实际值落地后进入此段）。");
	} else {
		for (const r of familyVerified) {
			const mape =
				r.min_mape == null || r.max_mape == null
					? "—"
					: `${Number(r.min_mape).toFixed(2)}–${Number(r.max_mape).toFixed(2)}%`;
			lines.push(
				`- ${r.slug}: ${r.n} 行，MAPE ${mape}，最新验证 ${r.last ? new Date(r.last).toISOString().slice(0, 10) : "—"}`,
			);
		}
	}
	lines.push("");

	const outPath = new URL(
		`../docs/snapshots/track-record-${new Date().toISOString().slice(0, 10)}.md`,
		`file://${process.cwd()}/`,
	).pathname;
	mkdirSync(new URL(".", `file://${outPath}`).pathname, { recursive: true });
	writeFileSync(outPath, lines.join("\n"));
	console.log(`ok    snapshot written: ${outPath} (${lines.length} lines)`);
}

main()
	.then(() => prisma.$disconnect())
	.catch((e) => {
		console.error("FAIL", e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
