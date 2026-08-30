"use client";

/**
 * Import landing-cost calculator (IMPROVEMENT-PLAN v3.2.0 批 3, promoted from
 * v3.0.0 批 A) — a structural differentiator 牧集-style marketplaces can't
 * offer: a fully traceable RMB/kg landed-cost reference whose ONLY live
 * inputs are whitelisted price series (IMF beef benchmark / CME cattle
 * futures) and the USD/CNY rate, each stamped with its date and staleness.
 * Duty/VAT/freight/loss are the visitor's own assumptions — the platform
 * deliberately ships NO per-country tariff presets (fabricating tariff
 * numbers would violate the honesty-first rule). Computation lives
 * server-side (services/landingCost.ts); this page is form + honest display.
 *
 * Public (middleware PUBLIC_PATHS): an acquisition tool, same whitelist
 * discipline as /api/market/public/highlights.
 */

import { ArrowLeft, Calculator } from "lucide-react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { PageHeader } from "@/components/ui/PageHeader";
import {
	type LandingBaseSeries,
	type LandingCostParamsState,
	type LandingOriginFx,
	useLandingCost,
} from "@/hooks/useLandingCost";

const BASE_SERIES_OPTIONS: { value: LandingBaseSeries; label: string }[] = [
	{ value: "beef_carcass_us", label: "全球牛肉基准（IMF 月度）" },
	{ value: "live_cattle_cme", label: "活牛期货（CME 日更）" },
	{ value: "feeder_cattle_cme", label: "架子牛期货（CME 日更）" },
];

const ORIGIN_FX_OPTIONS: { value: LandingOriginFx; label: string }[] = [
	{ value: "none", label: "不显示" },
	{ value: "aud_usd", label: "澳元 AUD/USD（参考）" },
	{ value: "brl_usd", label: "雷亚尔 BRL/USD（参考）" },
];

const PARAM_FIELDS: {
	key: keyof LandingCostParamsState;
	label: string;
	suffix: string;
	max: number;
}[] = [
	{ key: "tariffPct", label: "关税税率", suffix: "%", max: 100 },
	{ key: "vatPct", label: "增值税税率", suffix: "%", max: 100 },
	{ key: "freightUsdPerKg", label: "海运费", suffix: "USD/kg", max: 1000 },
	{ key: "feesUsdPerKg", label: "港杂/保险等", suffix: "USD/kg", max: 1000 },
	{ key: "lossPct", label: "损耗率", suffix: "%", max: 100 },
];

const inputClass =
	"h-10 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40";

const fmt = (v: number | null | undefined, digits = 2) =>
	v == null || !Number.isFinite(v) ? "—" : v.toFixed(digits);

function fmtDate(iso: string | null | undefined) {
	if (!iso) return "—";
	const d = new Date(iso);
	return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("zh-CN");
}

export default function LandingCostPage() {
	const { params, setParams, quote, loading, error, recalculate } = useLandingCost();

	const setParam = <K extends keyof LandingCostParamsState>(
		key: K,
		value: LandingCostParamsState[K],
	) => setParams((prev) => ({ ...prev, [key]: value }));

	return (
		<PageContainer>
			<PageHeader
				title="进口成本计算器"
				description="活序列基准价 × 你输入的关税/运费参数 → RMB/kg 到岸参考（输入可溯源、断流诚实降级）"
				breadcrumbs={[
					{ label: "Home", href: "/dashboard" },
					{ label: "牛肉行情", href: "/beef" },
					{ label: "进口成本计算器" },
				]}
			/>

			<div className="grid gap-4 lg:grid-cols-[380px_1fr]">
				{/* 参数表单：唯一假设输入面 */}
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<Calculator className="h-4 w-4 text-primary" />
							参数
						</CardTitle>
					</CardHeader>
					<CardBody className="space-y-4">
						<label className="block space-y-1.5">
							<span className="text-xs font-medium text-muted-foreground">基准价序列</span>
							<select
								aria-label="基准价序列"
								className={inputClass}
								value={params.baseSeries}
								onChange={(e) => setParam("baseSeries", e.target.value as LandingBaseSeries)}
							>
								{BASE_SERIES_OPTIONS.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</select>
						</label>

						<label className="block space-y-1.5">
							<span className="text-xs font-medium text-muted-foreground">
								出口国汇率（仅供参考）
							</span>
							<select
								aria-label="出口国汇率"
								className={inputClass}
								value={params.originFx}
								onChange={(e) => setParam("originFx", e.target.value as LandingOriginFx)}
							>
								{ORIGIN_FX_OPTIONS.map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</select>
						</label>

						<div className="grid grid-cols-2 gap-3">
							{PARAM_FIELDS.map((f) => (
								<label key={f.key} className="block space-y-1.5">
									<span className="text-xs font-medium text-muted-foreground">
										{f.label}（{f.suffix}）
									</span>
									<input
										aria-label={f.label}
										type="number"
										min={0}
										max={f.max}
										step="0.01"
										className={inputClass}
										value={params[f.key] as number}
										onChange={(e) =>
											setParam(f.key, (e.target.value === "" ? 0 : Number(e.target.value)) as never)
										}
									/>
								</label>
							))}
						</div>

						<button
							type="button"
							className="h-10 w-full rounded-lg bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
							disabled={loading}
							onClick={() => void recalculate(params)}
						>
							{loading ? "计算中…" : "计算到岸成本"}
						</button>

						<p className="text-xs leading-relaxed text-muted-foreground">
							税率与费用为你的假设值——平台不内置各国税率（不造虚构数据）。公式：到岸 = (基准 + 运费
							+ 杂费) × (1 + 关税) ，再按 (基数 + 关税) × (1 + 增值税)， 最后乘 (1 + 损耗) 与
							USD/CNY 汇率。
						</p>
					</CardBody>
				</Card>

				{/* 结果区 */}
				<div className="space-y-4">
					{error && <ErrorDisplay error={error} />}

					{!error && quote?.status === "insufficient_data" && (
						<Card>
							<CardBody>
								<p className="text-sm font-medium text-foreground">暂无法计算</p>
								<p className="mt-1 text-xs text-muted-foreground">{quote.reason}</p>
							</CardBody>
						</Card>
					)}

					{!error && quote?.status === "ok" && quote.base && quote.landed && (
						<>
							<Card>
								<CardHeader>
									<CardTitle>到岸参考（RMB/kg）</CardTitle>
								</CardHeader>
								<CardBody>
									<div className="grid gap-3 sm:grid-cols-3">
										{(
											[
												["低（近窗最低基准）", quote.landed.low],
												["中（最新基准）", quote.landed.mid],
												["高（近窗最高基准）", quote.landed.high],
											] as const
										).map(([label, b]) => (
											<div
												key={label}
												className="rounded-lg border bg-card p-3"
												data-testid={`landed-${label.startsWith("低") ? "low" : label.startsWith("中") ? "mid" : "high"}`}
											>
												<div className="text-xs text-muted-foreground">{label}</div>
												<div className="mt-1 font-display text-2xl font-semibold tabular-nums text-foreground">
													{b.cnyPerKg != null ? `¥${fmt(b.cnyPerKg)}` : "—"}
												</div>
												<div className="text-xs tabular-nums text-muted-foreground">
													{fmt(b.landedUsdPerKg, 3)} USD/kg
												</div>
											</div>
										))}
									</div>

									{/* 明细（中档口径） */}
									<table className="mt-4 w-full text-sm">
										<tbody className="divide-y divide-border">
											{(
												[
													["基准价", quote.landed.mid.baseUsdPerKg],
													["海运费", quote.landed.mid.freightUsdPerKg],
													["港杂/保险等", quote.landed.mid.feesUsdPerKg],
													["完税基数（CIF 类）", quote.landed.mid.costBaseUsdPerKg],
													["关税", quote.landed.mid.dutyUsdPerKg],
													["增值税", quote.landed.mid.vatUsdPerKg],
													["损耗后到岸（USD/kg）", quote.landed.mid.landedUsdPerKg],
												] as const
											).map(([label, v]) => (
												<tr key={label}>
													<td className="py-1.5 text-muted-foreground">{label}</td>
													<td className="py-1.5 text-right tabular-nums text-foreground">
														{fmt(v, 3)}
													</td>
												</tr>
											))}
										</tbody>
									</table>
									{quote.landed.mid.cnyPerKg == null && (
										<p className="mt-2 text-xs text-warning">
											USD/CNY 汇率不可用——仅显示美元口径。
										</p>
									)}
								</CardBody>
							</Card>

							<div className="grid gap-4 sm:grid-cols-2">
								{/* 基准价溯源 */}
								<Card>
									<CardHeader>
										<CardTitle>基准价（可溯源）</CardTitle>
									</CardHeader>
									<CardBody className="space-y-1.5 text-sm">
										<div className="font-medium text-foreground">{quote.base.label}</div>
										<div className="tabular-nums text-muted-foreground">
											{fmt(quote.base.latestClose)} {quote.base.unit} · ≈{" "}
											{fmt(quote.base.usdPerKg, 3)} USD/kg
										</div>
										<div className="text-xs text-muted-foreground">
											数据日期 {fmtDate(quote.base.latestDate)} · 来源 {quote.base.source}
											{quote.base.stale && (
												<span className="ml-1 text-warning">
													（已 {quote.base.daysOld} 天未更新，注意时效）
												</span>
											)}
										</div>
										<div className="text-xs text-muted-foreground">
											{quote.base.window.description}区间 {fmt(quote.base.window.lowClose)} –{" "}
											{fmt(quote.base.window.highClose)} {quote.base.unit}
										</div>
									</CardBody>
								</Card>

								{/* 汇率溯源 */}
								<Card>
									<CardHeader>
										<CardTitle>汇率（可溯源）</CardTitle>
									</CardHeader>
									<CardBody className="space-y-1.5 text-sm">
										{quote.fx?.usdCny ? (
											<>
												<div className="tabular-nums text-foreground">
													USD/CNY {fmt(quote.fx.usdCny.rate, 4)}
												</div>
												<div className="text-xs text-muted-foreground">
													数据日期 {fmtDate(quote.fx.usdCny.date)}
													{quote.fx.usdCny.stale && (
														<span className="ml-1 text-warning">（超出新鲜度窗口）</span>
													)}
												</div>
											</>
										) : (
											<div className="text-xs text-muted-foreground">USD/CNY 暂不可用</div>
										)}
										{quote.fx?.originRef && (
											<div className="tabular-nums text-muted-foreground">
												{quote.fx.originRef.label} {fmt(quote.fx.originRef.rate, 4)} ·{" "}
												{fmtDate(quote.fx.originRef.date)}（参考，不参与计算）
											</div>
										)}
									</CardBody>
								</Card>
							</div>
						</>
					)}

					{!error && loading && !quote && (
						<div className="text-xs text-muted-foreground animate-pulse">加载基准价与汇率…</div>
					)}

					{/* 诚实声明 */}
					{quote && (
						<Card>
							<CardBody>
								<ul className="list-disc space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
									{quote.notes.map((n) => (
										<li key={n}>{n}</li>
									))}
								</ul>
							</CardBody>
						</Card>
					)}

					<Link
						href="/beef/forecast"
						className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
					>
						<ArrowLeft className="h-3 w-3" />
						返回牛肉预测中心
					</Link>
				</div>
			</div>
		</PageContainer>
	);
}
