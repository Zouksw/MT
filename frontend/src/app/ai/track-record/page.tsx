"use client";

import { BadgeCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import BeefBacktestSection from "@/components/ai/BeefBacktestSection";
import { apiFetch } from "@/lib/apiFetch";

/**
 * Public prediction track record (IMPROVEMENT-PLAN batch 2).
 *
 * A prediction product earns trust through dated, checkable forecasts — not
 * claims. This page is reachable WITHOUT login (middleware PUBLIC_PATHS) and
 * renders the privacy-whitelisted public aggregate: the 30-day model
 * leaderboard plus the most recent auto-verified predictions with their
 * actuals. Data source: GET /api/signals/models/accuracy/public.
 */

interface LeaderRow {
	modelId: string;
	medianMape: number | null;
	avgMape: number | null;
	verifiedCount: number;
	predictionCount: number;
	lastVerifiedAt: string | null;
	/** Rolling direction-hit rate [0,1] (round-137 批4); null = no judged rows. */
	directionHitRate: number | null;
	directionCount: number;
}

interface SampleRow {
	seriesKey: string;
	seriesLabel: string;
	modelId: string;
	horizon: number;
	predictedAt: string;
	predicted: number | null;
	actual: number | null;
	mape: number | null;
	verifiedAt: string;
}

interface TrackRecord {
	windowDays: number;
	generatedAt: string;
	leaderboard: LeaderRow[];
	samples: SampleRow[];
	methodology: {
		verification: string;
		window: string;
		metric: string;
		direction: string;
		consensus: string;
	};
}

function fmtMape(v: number | null): string {
	return v == null ? "—" : `${v.toFixed(2)}%`;
}

/** Direction-hit cell text (批4): naive is structurally flat, thin samples
 * are withheld rather than shown as a noisy percentage. */
function fmtDirection(rate: number | null, count: number, modelId: string): string {
	if (modelId === "naive_forecaster") return "— (flat)";
	if (rate == null || count < 5) return "—";
	return `${(rate * 100).toFixed(1)}%`;
}

function fmtNum(v: number | null): string {
	return v == null ? "—" : v.toFixed(2);
}

function fmtDate(iso: string | null): string {
	if (!iso) return "—";
	return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TrackRecordPage() {
	const [record, setRecord] = useState<TrackRecord | null>(null);
	const [error, setError] = useState<Error | null>(null);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const res = await apiFetch<{ data: TrackRecord }>("/api/signals/models/accuracy/public");
			setRecord(res.data);
		} catch (e) {
			setError(e instanceof Error ? e : new Error("Failed to load track record"));
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		load();
	}, [load]);

	return (
		<div className="min-h-screen bg-background">
			<div className="mx-auto max-w-5xl px-6 py-12">
				{/* Header */}
				<div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
					<ShieldCheck className="size-4 text-primary" />
					<span>Public record — no account required</span>
				</div>
				<h1 className="text-3xl font-semibold tracking-tight text-foreground">
					Prediction Track Record
				</h1>
				<p className="mt-2 max-w-2xl text-sm text-muted-foreground">
					Every forecast is logged when made and automatically re-scored against actual prices. This
					page shows the rolling {record?.windowDays ?? 30}-day model leaderboard and the most
					recent verified predictions — checkable, not just claimed.
				</p>

				{loading && <div className="mt-10 h-40 animate-pulse rounded-lg bg-muted" />}

				{error && (
					<div
						className="mt-8 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
						role="alert"
					>
						Track record unavailable: {error.message}
						<button type="button" onClick={load} className="ml-2 underline">
							Retry
						</button>
					</div>
				)}

				{/* Beef monthly backtest evidence (批1) — static dated snapshot,
				 * rendered independent of the live API (the evidence exists even
				 * while the live beef rolling verification is still maturing,
				 * first due 2026-09). */}
				<BeefBacktestSection />

				{record && !loading && (
					<>
						{/* Leaderboard */}
						<section className="mt-10">
							<h2 className="mb-3 text-lg font-semibold text-foreground">
								Model leaderboard — last {record.windowDays} days
							</h2>
							<div className="overflow-x-auto rounded-lg ring-1 ring-black/5 dark:ring-white/10">
								<table className="w-full text-sm">
									<thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
										<tr>
											<th className="px-4 py-3">Model</th>
											<th className="px-4 py-3">Median MAPE</th>
											<th className="px-4 py-3">Mean MAPE</th>
											<th className="px-4 py-3">Direction</th>
											<th className="px-4 py-3">Verified</th>
											<th className="px-4 py-3">Last verified</th>
										</tr>
									</thead>
									<tbody>
										{[...record.leaderboard]
											.sort((a, b) => (a.medianMape ?? 999) - (b.medianMape ?? 999))
											.map((row) => (
												<tr
													key={row.modelId}
													className="border-t border-black/5 dark:border-white/5"
												>
													<td className="px-4 py-2.5 font-mono text-xs">{row.modelId}</td>
													<td className="px-4 py-2.5 tabular-nums">{fmtMape(row.medianMape)}</td>
													<td className="px-4 py-2.5 tabular-nums text-muted-foreground">
														{fmtMape(row.avgMape)}
													</td>
													<td className="px-4 py-2.5 tabular-nums">
														{fmtDirection(row.directionHitRate, row.directionCount, row.modelId)}
													</td>
													<td className="px-4 py-2.5 tabular-nums">{row.verifiedCount}</td>
													<td className="px-4 py-2.5 text-muted-foreground">
														{fmtDate(row.lastVerifiedAt)}
													</td>
												</tr>
											))}
									</tbody>
								</table>
							</div>
						</section>

						{/* Recent verified predictions */}
						<section className="mt-10">
							<h2 className="mb-1 text-lg font-semibold text-foreground">
								Recent verified predictions
							</h2>
							<p className="mb-3 text-xs text-muted-foreground">
								Predicted value = end-of-horizon forecast at log time; actual = the value that later
								arrived. Only public series are shown. Beef samples enter this table once the
								monthly actual lands — beef actuals publish on a monthly cadence, so macro rows lead
								until then.
							</p>
							<div className="overflow-x-auto rounded-lg ring-1 ring-black/5 dark:ring-white/10">
								<table className="w-full text-sm">
									<thead className="bg-muted/50 text-left text-xs uppercase tracking-wider text-muted-foreground">
										<tr>
											<th className="px-4 py-3">Series</th>
											<th className="px-4 py-3">Model</th>
											<th className="px-4 py-3">Made</th>
											<th className="px-4 py-3">Horizon</th>
											<th className="px-4 py-3">Predicted</th>
											<th className="px-4 py-3">Actual</th>
											<th className="px-4 py-3">MAPE</th>
										</tr>
									</thead>
									<tbody>
										{/* Beef series first: this is a beef platform's credibility
										    page — macro rows were burying every beef sample
										    (design-review round-160). Stable within-group order. */}
										{[...record.samples]
											.sort(
												(a, b) =>
													Number(/beef/i.test(b.seriesLabel)) - Number(/beef/i.test(a.seriesLabel)),
											)
											.slice(0, 25)
											.map((s) => (
												<tr
													key={`${s.seriesLabel}-${s.modelId}`}
													className="border-t border-black/5 dark:border-white/5"
												>
													<td className="max-w-52 truncate px-4 py-2.5">{s.seriesLabel}</td>
													<td className="px-4 py-2.5 font-mono text-xs">{s.modelId}</td>
													<td className="px-4 py-2.5 text-muted-foreground">
														{fmtDate(s.predictedAt)}
													</td>
													<td className="px-4 py-2.5 tabular-nums">{s.horizon}d</td>
													<td className="px-4 py-2.5 tabular-nums">{fmtNum(s.predicted)}</td>
													<td className="px-4 py-2.5 tabular-nums">{fmtNum(s.actual)}</td>
													<td className="px-4 py-2.5 tabular-nums">
														<span className={s.mape != null && s.mape <= 5 ? "text-success" : ""}>
															{fmtMape(s.mape)}
														</span>
														{/* Scale-mismatch marker: a 3-digit+ MAPE against
													    same-series peers at ~1-5% means the prediction
													    landed in a different unit (cotton #2 case,
													    KNOWN-ISSUES round-160). */}
														{s.mape != null && s.mape > 200 && (
															<span
																className="ml-1 text-[10px] text-amber-600 dark:text-amber-400"
																title="疑似预测尺度错位——与同序列其他模型量级不符，已登记核查"
															>
																尺度?
															</span>
														)}
													</td>
												</tr>
											))}
									</tbody>
								</table>
							</div>
						</section>

						{/* Methodology */}
						<section className="mt-10 rounded-lg bg-muted/40 p-5">
							<h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
								<BadgeCheck className="size-4 text-primary" />
								How verification works
							</h2>
							<ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
								<li>{record.methodology.verification}</li>
								<li>{record.methodology.metric}</li>
								<li>{record.methodology.direction}</li>
								<li>{record.methodology.consensus}</li>
								<li>{record.methodology.window}</li>
							</ul>
						</section>

						<p className="mt-8 text-xs text-muted-foreground">
							Generated {new Date(record.generatedAt).toLocaleString()} ·{" "}
							{/* prefetch={false}: protected route on a public page — an
							    anonymous prefetch bounces off the middleware login redirect. */}
							<Link href="/ai/accuracy" prefetch={false} className="underline hover:text-primary">
								logged-in users see the full accuracy workbench
							</Link>
						</p>
					</>
				)}
			</div>
		</div>
	);
}
