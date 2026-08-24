/**
 * Monthly verification-lifecycle smoke (round-130 batch 6b-4) — controlled
 * end-to-end acceptance on the LIVE database: a backdated monthly prediction
 * for beef_carcass_us must survive every sweep (mark-unverifiable, expire)
 * and reach status='verified' with real MAPE via verifyDuePredictions.
 *
 * This is the "first monthly prediction reaches verified" hard acceptance,
 * constructed (IMPROVEMENT-PLAN 批 6b): real maturity takes horizon months of
 * wall-clock time, so we backdate a row whose window already holds 3 real
 * monthly actuals (2026-05..07 PBEEFUSDM closes) and run the EXACT sweep
 * sequence server.ts runs (mark → expire → restore → verify).
 *
 * The probe row uses modelId containing 'test' (EXCLUDE_TEST_ARTIFACTS keeps
 * it out of accuracy aggregates) and is DELETED at the end — zero residue.
 *
 * Exit 0 = lifecycle proven; 1 = any step failed.
 * Usage: cd backend && npx tsx scripts/verify-monthly-lifecycle.ts
 */

import { PrismaClient } from "@prisma/client";
import {
	expireWindowElapsedPredictions,
	markUnverifiablePredictions,
	restoreVerifiablePredictions,
	verifyDuePredictions,
} from "@/services/mapeTracking";

const prisma = new PrismaClient();
const SMOKE_MODEL = "cadence-lifecycle-smoke-test";

async function main() {
	const beef = await prisma.commodity.findUnique({ where: { slug: "beef_carcass_us" } });
	if (!beef) throw new Error("beef_carcass_us not found");

	// Anchor 2026-05-01, horizon 3 → window [2026-05, 2026-09): the three
	// real PBEEFUSDM closes 05/06/07 are the actuals (Aug has not published).
	const actuals = await prisma.commodityPrice.findMany({
		where: {
			commodityId: beef.id,
			interval: "monthly",
			date: { gte: new Date("2026-05-01"), lt: new Date("2026-09-01") },
		},
		orderBy: { date: "asc" },
		select: { date: true, close: true },
	});
	if (actuals.length < 3)
		throw new Error(`expected >=3 in-window monthly actuals, got ${actuals.length}`);
	const closes = actuals.map((a) => Number(a.close));

	// Backdated probe: logged 2026-04-20 (past the 10d verify cutoff), window
	// matured 2026-08-01 (anchor + 3 months), forecast == actuals → MAPE 0.
	const row = await prisma.predictionLog.create({
		data: {
			modelId: SMOKE_MODEL,
			commodityId: beef.id,
			horizon: 3,
			predictedValues: closes,
			status: "completed",
			predictedAt: new Date("2026-04-20T00:00:00Z"),
			forecastStartAt: new Date("2026-05-01T00:00:00Z"),
			interval: "monthly",
		},
	});
	const status = () =>
		prisma.predictionLog.findUnique({
			where: { id: row.id },
			select: { status: true, mape: true, actualValues: true },
		});

	try {
		console.log(
			`probe row ${row.id} | in-window monthly actuals: ${actuals.map((a) => `${a.date.toISOString().slice(0, 7)}=${a.close}`).join(", ")}`,
		);

		// Sweep gauntlet in server.ts order — each must leave the row alone
		// (healthy monthly source: latest point 2026-07-01, 53d < 60d window;
		// window end 2026-08-01 + 60d grace not yet elapsed).
		await markUnverifiablePredictions();
		let s = await status();
		console.log(`after mark-unverifiable : ${s?.status}`);
		if (s?.status !== "completed") return fail("mark-unverifiable froze a healthy monthly row");

		await expireWindowElapsedPredictions();
		await restoreVerifiablePredictions();
		s = await status();
		console.log(`after expire/restore    : ${s?.status}`);
		if (s?.status !== "completed") return fail("expire drained a healthy monthly window");

		const verified = await verifyDuePredictions();
		s = await status();
		console.log(`after verify (n=${verified})  : ${s?.status} mape=${s?.mape}`);
		if (s?.status !== "verified") return fail("monthly prediction did not reach verified");
		if (Number(s?.mape) !== 0) return fail(`expected MAPE 0 (perfect forecast), got ${s?.mape}`);
		if (JSON.stringify(s?.actualValues) !== JSON.stringify(closes))
			return fail("actualValues not the paired monthly closes");

		console.log(
			"ok    monthly lifecycle verified: completed → (mark/expire survive) → verified, MAPE 0",
		);
		return 0;
	} finally {
		await prisma.predictionLog.deleteMany({ where: { id: row.id, modelId: SMOKE_MODEL } });
		console.log("ok    probe row deleted (zero residue)");
	}
}

function fail(msg: string): number {
	console.error(`FAIL  ${msg}`);
	return 1;
}

main()
	.then((code) => process.exit(code ?? 0))
	.catch((e) => {
		console.error("FAIL", e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
