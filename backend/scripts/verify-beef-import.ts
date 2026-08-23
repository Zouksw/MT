/**
 * Beef import verifier — one-command post-import validation (round-129 batch 10).
 *
 * Packages the hand-written SQL from docs/guides/WEEKLY-DATA-IMPORT.md §五 and
 * adds two checks the runbook lacked: row delta vs the last run (baseline in
 * /root/.mt-healthcheck/beef-import-baseline.json) and factory/cut coverage.
 *
 * Exit code 0 = no FAIL (WARN allowed); 1 = FAIL (duplicates found or no data).
 * Usage: cd backend && npx tsx scripts/verify-beef-import.ts
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASELINE_FILE = "/root/.mt-healthcheck/beef-import-baseline.json";
const W = (m: string) => console.log(`WARN  ${m}`);
const F = (m: string) => console.log(`FAIL  ${m}`);
const I = (m: string) => console.log(`ok    ${m}`);

async function main() {
	let failures = 0;

	// 1) Coverage & freshness per source.
	const bySource = await prisma.$queryRaw<
		Array<{ source: string; n: bigint; latest: Date }>
	>`SELECT source, count(*) n, max(date) latest FROM beef_cut_prices GROUP BY 1 ORDER BY latest DESC`;
	if (bySource.length === 0) {
		F("beef_cut_prices is EMPTY — no import has landed");
		failures++;
	}
	for (const r of bySource) {
		const days = Math.floor((Date.now() - r.latest.getTime()) / 86400000);
		const line = `source=${r.source} rows=${r.n} latest=${r.latest.toISOString().slice(0, 10)} (${days}d old)`;
		if (days > 7) W(`${line} — older than a weekly rhythm`);
		else I(line);
	}

	// 2) Date spread this ISO week (runbook expects 5–7 distinct quote dates
	// after a real weekly import; 0 means this week hasn't been imported).
	const [weekDates] = await prisma.$queryRaw<Array<{ d: bigint }>>`
		SELECT count(DISTINCT date) d FROM beef_cut_prices
		WHERE date >= date_trunc('week', current_date)`;
	const d = Number(weekDates?.d ?? 0);
	if (d === 0) W("0 distinct dates this week — weekly import not done yet (runbook §三)");
	else if (d < 5) W(`only ${d} distinct dates this week (a full week usually has 5-7)`);
	else I(`${d} distinct quote dates this week`);

	// 3) Duplicate key detection (factory+cut+date+source must be unique).
	const dupes = await prisma.$queryRaw<
		Array<{ factoryId: string; cutCode: string; date: Date; source: string; n: bigint }>
	>`SELECT "factoryId", "cutCode", date, source, count(*) n FROM beef_cut_prices
	  GROUP BY 1,2,3,4 HAVING count(*) > 1 LIMIT 5`;
	if (dupes.length > 0) {
		F(
			`${dupes.length}+ duplicate (factory,cut,date,source) groups — first: ${dupes[0].factoryId}/${dupes[0].cutCode}/${dupes[0].date.toISOString().slice(0, 10)}/${dupes[0].source} x${dupes[0].n}`,
		);
		failures++;
	} else {
		I("no duplicate (factory,cut,date,source) groups");
	}

	// 4) Row delta vs last run (NEW — the runbook had no way to see whether a
	// re-import actually added rows). First run just records the baseline.
	const [total] = await prisma.$queryRaw<
		Array<{ n: bigint }>
	>`SELECT count(*) n FROM beef_cut_prices`;
	const totalRows = Number(total?.n ?? 0);
	mkdirSync("/root/.mt-healthcheck", { recursive: true });
	let baselineSeen = false;
	try {
		const prev = Number(JSON.parse(readFileSync(BASELINE_FILE, "utf8")).rows ?? 0);
		baselineSeen = true;
		const delta = totalRows - prev;
		if (delta > 0) I(`row delta vs last verify: +${delta} (${prev} -> ${totalRows})`);
		else if (delta === 0)
			W(`row delta vs last verify: 0 (${totalRows} rows) — re-import was a pure no-op?`);
		else
			W(
				`row delta vs last verify: ${delta} (${prev} -> ${totalRows}) — rows REMOVED since last verify`,
			);
	} catch {
		I(`baseline recorded: ${totalRows} rows (first run — no delta yet)`);
	}
	writeFileSync(BASELINE_FILE, JSON.stringify({ rows: totalRows, at: new Date().toISOString() }));

	// 5) Coverage (NEW): active factories & cuts over the last 14 days.
	const [cov] = await prisma.$queryRaw<Array<{ f: bigint; c: bigint }>>`
		SELECT count(DISTINCT "factoryId") f, count(DISTINCT "cutCode") c
		FROM beef_cut_prices WHERE date >= current_date - interval '14 days'`;
	const factories = Number(cov?.f ?? 0);
	const cuts = Number(cov?.c ?? 0);
	if (factories === 0 || cuts === 0) {
		W(`last-14d coverage: ${factories} factories / ${cuts} cuts — nothing recent`);
	} else {
		I(`last-14d coverage: ${factories} factories / ${cuts} cuts`);
	}

	console.log(baselineSeen ? "" : "");
	console.log(failures === 0 ? "RESULT: PASS (warnings allowed — see above)" : "RESULT: FAIL");
	process.exitCode = failures === 0 ? 0 : 1;
}

main()
	.catch((err) => {
		console.error("verify-beef-import crashed:", err);
		process.exitCode = 1;
	})
	.finally(() => prisma.$disconnect());
