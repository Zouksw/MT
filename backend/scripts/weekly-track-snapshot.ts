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

	const [beefRows, beefNextDue, beefLatestPoint] = await Promise.all([
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
