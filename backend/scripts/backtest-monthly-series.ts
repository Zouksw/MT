/**
 * 批1 (round-136) — rolling-origin backtest on the IMF beef benchmark
 * (beef_carcass_us / PBEEFUSDM, monthly). IMPROVEMENT-PLAN v3.1.0 批1.
 *
 * What it answers (the plan's two open questions):
 *   ① Is chronos really worse than naive ON BEEF monthly data? (the current
 *      elimination verdict comes from the FX/CME daily pool — potentially
 *      unfair and unfounded for beef);
 *   ② Where is the predictability ceiling of a monthly macro series? If
 *      everyone ≈ naive, the honest conclusion is "statistical baseline is
 *      optimal" and the brand story pivots to "verifiable" — which is an
 *      answer, not a failure.
 *
 * Method: expanding-window rolling origin over the last N monthly points.
 * For each (origin, horizon H ∈ {1,3}) and each consensus-pool model
 * (getAllModels(), 7): train on values[0..origin), predict H steps, score
 * against the actuals — MAPE (same definition as the verification loop:
 * mean over overlapping steps), direction hit (sign of last-step change vs
 * the anchor/training-last point), and interval coverage (share of steps
 * inside [lower, upper] at confidence_level 0.9, matching the production
 * conformal α=0.1 narrative — though NOTE: production calibrates intervals
 * via intervalCalibration on verified residuals; this script reads the
 * ENGINE-native bounds, so coverage here is the uncalibrated baseline).
 *
 * Purity: pure inference, zero training, zero DB writes — reads the series
 * via getCommodityPriceValues (same fetch semantics as the production
 * prediction path, authoritative-source filter included) and calls the
 * inference client directly. Nothing touches prediction_logs or Redis.
 *
 * Determinism (批1 prerequisite, commit 760f825): chronos calls are payload-
 * seeded and the harness issues them SEQUENTIALLY, so re-running reproduces
 * bit-identical numbers. Statistical models are deterministic by nature.
 *
 * Usage:  cd backend && npx tsx scripts/backtest-monthly-series.ts [--origins=N] [--out=PATH] [--json=PATH]
 * Exit 0 = report written; 1 = setup failure.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { PrismaClient } from "@prisma/client";
import { predict } from "@/services/inference/client";
import { getCommodityPriceValues } from "@/services/inference/data-fetcher";
import { getAllModels } from "@/services/modelRegistry";

const prisma = new PrismaClient();
const SLUG = "beef_carcass_us";
const DEFAULT_ORIGINS = 36;
const HORIZONS = [1, 3] as const;
const CONFIDENCE_LEVEL = 0.9;

// ---- CLI ----
const args = new Map(
	process.argv
		.slice(2)
		.filter((a) => a.startsWith("--"))
		.map((a) => {
			const [k, ...v] = a.replace(/^--/, "").split("=");
			return [k, v.join("=")] as const;
		}),
);
const N_ORIGINS = Number(args.get("origins") ?? DEFAULT_ORIGINS);
// Resolve from backend/ (the documented cwd): backend sits ONE level below
// the repo root, so the docs dir is ../docs. A bare relative path would
// depend on process.cwd() and "../../docs" once escaped to /docs.
const OUT_MD =
	args.get("out") ??
	new URL("../docs/backtests/beef-monthly-2026-08.md", `file://${process.cwd()}/`).pathname;
const OUT_JSON = args.get("json"); // optional raw dump (determinism diffing)

type Horizon = (typeof HORIZONS)[number];

interface OriginResult {
	model: string;
	horizon: Horizon;
	originDate: string; // ISO month of the FIRST PREDICTED step
	trainPoints: number;
	mape: number | null; // null = no valid steps (actual 0 / model error)
	directionHit: boolean | null; // null = flat prediction or flat actual (undecidable)
	coveredSteps: number;
	steps: number;
	// End-of-horizon values for consensus-residual calibration (round-164
	// batch 0b): the predicted last step, the actual last step, and the
	// anchor (last training point). Undefined only when the call errored.
	predLast?: number;
	actualLast?: number;
	anchor?: number;
	error?: string;
}

function median(xs: number[]): number | null {
	if (xs.length === 0) return null;
	const s = [...xs].sort((a, b) => a - b);
	const mid = Math.floor(s.length / 2);
	return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function quantile(xs: number[], q: number): number | null {
	if (xs.length === 0) return null;
	const s = [...xs].sort((a, b) => a - b);
	// Linear interpolation (R-7, the NumPy/pandas default) — stable and
	// convention-compatible for the small n of a rolling backtest.
	const pos = (s.length - 1) * q;
	const lo = Math.floor(pos);
	const hi = Math.ceil(pos);
	return lo === hi ? s[lo] : s[lo] + (pos - lo) * (s[hi] - s[lo]);
}

function round(v: number | null, d = 2): string {
	return v == null ? "—" : (Math.round(v * 10 ** d) / 10 ** d).toString();
}

function monthIso(ts: number): string {
	return new Date(ts).toISOString().slice(0, 7);
}

async function main(): Promise<number> {
	const commodity = await prisma.commodity.findUnique({ where: { slug: SLUG } });
	if (!commodity) throw new Error(`${SLUG} not found`);
	const series = await getCommodityPriceValues(commodity.id, 1000, "monthly");
	if (series.interval !== "monthly") throw new Error("expected monthly series");
	const { values, timestamps } = series;
	const n = values.length;
	console.log(
		`series ${SLUG}: ${n} monthly points ${monthIso(timestamps[0])}..${monthIso(timestamps[n - 1])} | latest close ${values[n - 1]}`,
	);
	if (n < N_ORIGINS + Math.max(...HORIZONS) + 20)
		throw new Error(`series too short for ${N_ORIGINS} origins`);

	const models = getAllModels();
	const results: OriginResult[] = [];

	// Sequential (origin → horizon → model) so chronos payload-seeding gives
	// bit-identical replays — see the determinism note in the header.
	for (let o = n - N_ORIGINS; o <= n - 1; o++) {
		const train = values.slice(0, o);
		const trainTs = timestamps.slice(0, o);
		const anchor = values[o - 1];
		const originDate = monthIso(timestamps[o]);
		for (const H of HORIZONS) {
			if (o + H > n) continue;
			const actual = values.slice(o, o + H);
			for (const model of models) {
				const base = {
					model,
					horizon: H,
					originDate,
					trainPoints: train.length,
					coveredSteps: 0,
					steps: H,
				} as OriginResult;
				try {
					const pred = await predict({
						values: train,
						timestamps: trainTs,
						model_id: model,
						horizon: H,
						confidence_level: CONFIDENCE_LEVEL,
					});
					// MAPE — same per-step definition as verifyPrediction.
					let sumAbs = 0;
					let valid = 0;
					for (let i = 0; i < H; i++) {
						const a = actual[i];
						const p = pred.values[i];
						if (a !== 0 && Number.isFinite(a) && Number.isFinite(p)) {
							sumAbs += Math.abs((a - p) / a);
							valid++;
						}
						if (
							pred.lower_bound &&
							pred.upper_bound &&
							actual[i] >= pred.lower_bound[i] &&
							actual[i] <= pred.upper_bound[i]
						)
							base.coveredSteps++;
					}
					base.mape = valid > 0 ? (sumAbs / valid) * 100 : null;
					// Direction — relative to the anchor (last training point),
					// decided on the horizon's LAST step (batch-4 definition).
					const predSign = Math.sign(pred.values[H - 1] - anchor);
					const actualSign = Math.sign(actual[H - 1] - anchor);
					base.directionHit = predSign === 0 || actualSign === 0 ? null : predSign === actualSign;
					base.predLast = pred.values[H - 1];
					base.actualLast = actual[H - 1];
					base.anchor = anchor;
					results.push(base);
				} catch (error) {
					base.error = error instanceof Error ? error.message : String(error);
					results.push(base);
				}
			}
		}
		process.stdout.write(`\rorigin ${originDate}: done (${results.length} results)`);
	}
	console.log("");

	if (OUT_JSON) {
		mkdirSync(dirname(OUT_JSON), { recursive: true });
		writeFileSync(OUT_JSON, JSON.stringify(results, null, 1));
		console.log(`raw results → ${OUT_JSON}`);
	}

	// ---- Aggregate per (model, horizon) ----
	interface Agg {
		model: string;
		horizon: Horizon;
		mapes: number[];
		dirHits: number;
		dirDecided: number;
		covered: number;
		steps: number;
		errors: number;
	}
	const aggs = new Map<string, Agg>();
	for (const r of results) {
		const key = `${r.model}:${r.horizon}`;
		const a = aggs.get(key) ?? {
			model: r.model,
			horizon: r.horizon,
			mapes: [],
			dirHits: 0,
			dirDecided: 0,
			covered: 0,
			steps: 0,
			errors: 0,
		};
		if (r.error) a.errors++;
		if (r.mape != null) a.mapes.push(r.mape);
		if (r.directionHit === true) a.dirHits++;
		if (r.directionHit != null) a.dirDecided++;
		a.covered += r.coveredSteps;
		a.steps += r.steps;
		aggs.set(key, a);
	}

	const lines: string[] = [];
	lines.push(`# 牛肉月度滚动回测 — ${SLUG}（批1，rolling-origin）`);
	lines.push("");
	lines.push(
		`- **运行**：${new Date().toISOString().slice(0, 10)}，\`${process.argv[1]}\`（origins=${N_ORIGINS}，H=${HORIZONS.join("/")}，confidence=${CONFIDENCE_LEVEL}）`,
	);
	lines.push(
		`- **数据**：${n} 个月度点（${monthIso(timestamps[0])} → ${monthIso(timestamps[n - 1])}，PBEEFUSDM via FRED，USC/lb）；expanding window（origin 训练全史，与生产路径同源取数）`,
	);
	lines.push(
		`- **确定性**：chronos 每请求 payload 派生种子 + 串行调用（commit 760f825）——重跑逐位一致；统计模型天然确定`,
	);
	lines.push(
		`- **指标口径**：MAPE=重叠步均值（同验证环）；方向=末步涨跌符号 vs 训练末点（anchor）；覆盖率=步数份额落在引擎原生 [lower, upper] 内（未过 conformal 校准，是校准前基线）`,
	);
	lines.push("");
	for (const H of HORIZONS) {
		const rows = [...aggs.values()]
			.filter((a) => a.horizon === H)
			.sort((a, b) => median(a.mapes)! - median(b.mapes)!);
		lines.push(`## H = ${H} ${H === 1 ? "个月" : "个月（下季度）"}`);
		lines.push("");
		lines.push("| 模型 | MAPE 均值 | MAPE 中位 | 方向命中 | 覆盖率(90%) | 样本 | 错误 |");
		lines.push("|------|---------:|---------:|---------:|------------:|-----:|-----:|");
		for (const a of rows) {
			lines.push(
				`| ${a.model} | ${round(a.mapes.reduce((s, x) => s + x, 0) / (a.mapes.length || 1))}% | ${round(median(a.mapes))}% | ${round(a.dirDecided ? (a.dirHits / a.dirDecided) * 100 : null, 1)}% (${a.dirHits}/${a.dirDecided}) | ${round(a.steps ? (a.covered / a.steps) * 100 : null, 1)}% | ${a.mapes.length} | ${a.errors} |`,
			);
		}
		lines.push("");
	}
	const errCount = results.filter((r) => r.error).length;
	if (errCount > 0) {
		lines.push(`> ⚠️ ${errCount} 个 (origin, model) 调用失败——见原始 JSON 的 error 字段。`);
		lines.push("");
	}

	// ---- Consensus-residual calibration section (round-164 batch 0b) ----
	// Per (horizon, origin): consensus = MEDIAN of the pool's end-of-horizon
	// predictions (the equal-weight shape of the production weighted median),
	// residual = (actual - consensus) / consensus. The empirical p5/p95 of
	// these signed residuals is the calibrated 90% band attached to the
	// consensus card (docs/backtests calibration evidence).
	lines.push("## 共识残差（7 模型末步中位，校准带依据）");
	lines.push("");
	lines.push(
		"- 口径：每起点取全部池内模型末步预测的中位为共识；残差 =（实际 − 共识）/ 共识 × 100。p5/p95 为经验分位（R-7 线性插值），即回放中覆盖 90% 起点的双侧带。",
	);
	lines.push("");
	lines.push("| H | 样本 | 残差 p5 | 残差 p50 | 残差 p95 | |残差| 均值 | |残差| 中位 |");
	lines.push("|---|-----:|-------:|---------:|---------:|----------:|----------:|");
	for (const H of HORIZONS) {
		const byOrigin = new Map<string, { pred: number[]; actual: number | null }>();
		for (const r of results) {
			if (r.horizon !== H || r.predLast == null || r.actualLast == null) continue;
			const slot = byOrigin.get(r.originDate) ?? { pred: [], actual: null };
			slot.pred.push(r.predLast);
			slot.actual = r.actualLast;
			byOrigin.set(r.originDate, slot);
		}
		const residuals: number[] = [];
		for (const slot of byOrigin.values()) {
			const cons = median(slot.pred);
			if (cons != null && cons !== 0 && slot.actual != null) {
				residuals.push(((slot.actual - cons) / cons) * 100);
			}
		}
		const abs = residuals.map(Math.abs);
		lines.push(
			`| ${H} | ${residuals.length} | ${round(quantile(residuals, 0.05), 2)}% | ${round(quantile(residuals, 0.5), 2)}% | ${round(quantile(residuals, 0.95), 2)}% | ${round(abs.length ? abs.reduce((s, x) => s + x, 0) / abs.length : null, 2)}% | ${round(median(abs), 2)}% |`,
		);
	}
	lines.push("");

	mkdirSync(dirname(OUT_MD), { recursive: true });
	writeFileSync(OUT_MD, lines.join("\n") + "\n");
	console.log(`report → ${OUT_MD}`);

	// Console summary (same table, compact).
	for (const line of lines) if (line.startsWith("| ")) console.log(line);
	return 0;
}

main()
	.then((code) => process.exit(code ?? 0))
	.catch((e) => {
		console.error("FAIL", e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
