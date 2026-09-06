"use client";

/**
 * 对华贸易流卡 (V8 批4, round-151; deepened round-155 批C) — per-country
 * monthly beef trade flows to China from GET /api/market/trade-flows
 * (comtrade_mirror lanes, V8 批0). Auth-gated per D25 (鉴权内先行):
 * anonymous/failed fetches omit the card silently — the same degrade pattern
 * as the cut-forecast column, never a login wall inside the market page.
 *
 * 批C additions: an HS-code switcher (the mirror's 8 pinned lanes — zod enum
 * on the backend is the single source of truth), a per-country monthly
 * volume-bar + unit-price-line chart over the new `history` payload, the
 * previously-fetched-but-unrendered qtyMoM / valueM fields, and the AR
 * all-destinations FOB context line.
 *
 * round-161: fields genericized (unitPricePerT/valueM + per-row currency) —
 * the Comext EU lane (EUR) renders side by side with the USD mirror lanes.
 *
 * 口径注记 is mandatory UI, not decoration: the FOB mirror table (exporter
 * side, monthly where reported) and the China-reported annual CIF calibration
 * table are rendered side by side and never merged (research §七.4 — the two
 * calibers differ systematically by freight/insurance and timing).
 */

import { TrendingDown, TrendingUp } from "lucide-react";
import { useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { beefFetcher } from "@/lib/beef";
import { formatDecimal } from "@/lib/format";
import { dynamicRecharts } from "@/lib/recharts-lazy";

const {
	ComposedChart,
	Bar,
	Line,
	XAxis,
	YAxis,
	CartesianGrid,
	Tooltip,
	Legend,
	ResponsiveContainer,
} = dynamicRecharts();

interface TradeFlowPoint {
	period: string;
	date: string;
	/** "USD" (Comtrade FOB mirror) or "EUR" (Comext EU lane) — denominates
	 * unitPricePerT and valueM; lanes never merge (round-161). */
	currency: "USD" | "EUR";
	unitPricePerT: number;
	qtyTons: number;
	valueM: number;
}

interface TradeFlowEntry {
	region: string;
	country: string;
	freq: "M" | "A";
	basis: string;
	currency: "USD" | "EUR";
	latest: TradeFlowPoint;
	momPct: number | null;
	qtyMomPct: number | null;
	stale: boolean;
	history: TradeFlowPoint[];
}

interface CalibrationEntry {
	region: string;
	country: string;
	basis: string;
	latest: TradeFlowPoint;
	stale: boolean;
}

interface ArFobTotal {
	period: string;
	valueUsdM: number;
}

interface UyInacTotal {
	period: string;
	valueUsdM: number;
}

interface UyCutPoint {
	period: string;
	usdPerKg: number;
}

interface UyCutPrice {
	key: string;
	process: "frozen" | "chilled";
	period: string;
	usdPerKg: number;
	tonnes: number;
	history: UyCutPoint[];
}

interface TradeFlowsPayload {
	hs: string;
	flows: TradeFlowEntry[];
	calibration: CalibrationEntry[];
	arFobTotal: ArFobTotal | null;
	uyInacTotal: UyInacTotal | null;
	uyCuts: UyCutPrice[];
	notes: string[];
}

/** The mirror's pinned HS set (backend zod enum is the contract). */
const HS_OPTIONS = [
	{ code: "0202", label: "冻牛肉" },
	{ code: "020230", label: "冻去骨牛肉" },
	{ code: "020220", label: "冻带骨牛肉" },
	{ code: "0201", label: "鲜/冷藏牛肉" },
	{ code: "020610", label: "鲜/冷牛杂碎" },
	{ code: "020621", label: "冻牛肝" },
	{ code: "020622", label: "冻牛胃" },
	{ code: "020629", label: "其他冻牛杂碎" },
] as const;

const COUNTRY_LABELS: Record<string, string> = {
	BR: "巴西",
	AU: "澳大利亚",
	NZ: "新西兰",
	US: "美国",
	AR: "阿根廷",
	UY: "乌拉圭",
	IE: "爱尔兰",
	NL: "荷兰",
	FR: "法国",
	PL: "波兰",
	WORLD: "全球",
};

/** Uruguay cut-family slugs (INAC eDIAE n4 vocabulary) → zh labels. */
const CUT_LABELS: Record<string, string> = {
	carcass_bone_in: "胴体/四分体（带骨）",
	carcass_boneless: "胴体/四分体（去骨）",
	thin_cuts: "小件（胸/腱类）",
	forequarter_bone_in: "前四分体带骨",
	forequarter_boneless: "前四分体去骨",
	hindquarter_bone_in: "后四分体带骨",
	hindquarter_boneless: "后四分体去骨",
	other_bone_in: "其他带骨",
	other_boneless: "其他去骨",
	generic: "通用（未分）",
};

function fmtPeriod(period: string) {
	// "202606" → "2026-06"; "2024" stays as-is (annual).
	return period.length === 6 ? `${period.slice(0, 4)}-${period.slice(4)}` : period;
}

function MoM({ pct }: { pct: number | null }) {
	if (pct === null || !Number.isFinite(pct))
		return <span className="text-muted-foreground">—</span>;
	const up = pct >= 0;
	return (
		<span
			className={`inline-flex items-center gap-0.5 font-mono ${up ? "text-green-600" : "text-red-600"}`}
		>
			{up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
			{pct.toFixed(1)}%
		</span>
	);
}

export function TradeFlowsCard() {
	const [hs, setHs] = useState<string>("0202");
	// Chart country pill — null means "first monthly lane" (newest data).
	const [chartCountry, setChartCountry] = useState<string | null>(null);
	const { data } = useRetryableFetch(`/api/market/trade-flows?hs=${hs}`, beefFetcher);
	const payload = (data as { data?: TradeFlowsPayload } | undefined)?.data;

	// Not logged in (401 per D25), fetch error, or no rows yet — omit the
	// card entirely; honest absence, no fabricated placeholder. Array guards
	// keep the beef-page tests' shapeless mocks safely degrading.
	if (
		!payload ||
		!Array.isArray(payload.flows) ||
		payload.flows.length === 0 ||
		!Array.isArray(payload.calibration)
	)
		return null;

	const hsLabel = HS_OPTIONS.find((o) => o.code === hs)?.label ?? hs;
	const monthlyFlows = payload.flows.filter(
		(f) => f.freq === "M" && Array.isArray(f.history) && f.history.length >= 2,
	);
	const chartFlow = monthlyFlows.find((f) => f.country === chartCountry) ?? monthlyFlows[0];
	const chartData =
		chartFlow?.history.map((h) => ({
			label: fmtPeriod(h.period).slice(2), // "26-06" — compact x-axis
			qtyTons: h.qtyTons,
			unitPricePerT: h.unitPricePerT,
		})) ?? [];
	// Chart price axis honors the selected lane's denomination.
	const chartSymbol = chartFlow?.currency === "EUR" ? "€" : "$";

	return (
		<Card className="mt-6">
			<CardHeader>
				<CardTitle>
					对华贸易流 · {hsLabel}（HS {hs}，FOB 月度镜像）
				</CardTitle>
				<div className="mt-2 flex flex-wrap gap-1.5">
					{HS_OPTIONS.map((opt) => (
						<button
							key={opt.code}
							type="button"
							onClick={() => setHs(opt.code)}
							aria-pressed={hs === opt.code}
							className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
								hs === opt.code
									? "bg-primary text-primary-foreground"
									: "border border-border text-muted-foreground hover:bg-muted"
							}`}
						>
							{opt.label}
							<span className="ml-1 font-mono opacity-70">{opt.code}</span>
						</button>
					))}
				</div>
			</CardHeader>
			<CardBody>
				{chartFlow && chartData.length >= 2 && (
					<div className="mb-4">
						<div className="mb-1.5 flex flex-wrap items-center gap-1.5">
							<span className="text-xs text-muted-foreground">月度量价走势：</span>
							{monthlyFlows.map((f) => (
								<button
									key={f.region}
									type="button"
									onClick={() => setChartCountry(f.country)}
									aria-pressed={chartFlow.country === f.country}
									className={`rounded px-2 py-0.5 text-xs ${
										chartFlow.country === f.country
											? "bg-muted font-medium text-foreground"
											: "text-muted-foreground hover:text-foreground"
									}`}
								>
									{COUNTRY_LABELS[f.country] ?? f.country}
								</button>
							))}
						</div>
						<div className="h-[220px] w-full">
							<ResponsiveContainer width="100%" height="100%">
								<ComposedChart data={chartData}>
									<CartesianGrid strokeDasharray="3 3" className="opacity-40" />
									<XAxis dataKey="label" tick={{ fontSize: 11 }} />
									<YAxis yAxisId="qty" tick={{ fontSize: 11 }} width={52} />
									<YAxis yAxisId="price" orientation="right" tick={{ fontSize: 11 }} width={48} />
									<Tooltip
										formatter={(value, name) => {
											const label = String(name);
											return label.includes("数量")
												? [formatDecimal(Number(value), 0), label]
												: [`${chartSymbol}${formatDecimal(Number(value), 0)}/t`, label];
										}}
									/>
									<Legend wrapperStyle={{ fontSize: 12 }} />
									<Bar
										yAxisId="qty"
										dataKey="qtyTons"
										name="数量（吨）"
										fill="#8B6914"
										opacity={0.55}
										radius={[3, 3, 0, 0]}
									/>
									<Line
										yAxisId="price"
										dataKey="unitPricePerT"
										name={`FOB 均价（${chartSymbol}/吨）`}
										stroke="#2563EB"
										strokeWidth={2}
										dot={false}
									/>
								</ComposedChart>
							</ResponsiveContainer>
						</div>
					</div>
				)}

				<div className="overflow-x-auto">
					<table className="data-table">
						<thead>
							<tr>
								<th className="text-left">国别</th>
								<th className="text-left">期间</th>
								<th className="text-right">数量（吨）</th>
								<th className="text-right">数量环比</th>
								<th className="text-right">金额（百万）</th>
								<th className="text-right">FOB 均价</th>
								<th className="text-right">均价环比</th>
								<th className="text-left">口径</th>
							</tr>
						</thead>
						<tbody>
							{payload.flows.map((f) => (
								<tr key={f.region}>
									<td>
										{COUNTRY_LABELS[f.country] ?? f.country}
										{f.stale && (
											<span className="ml-1 rounded bg-amber-100 px-1 text-xs text-amber-700">
												滞后
											</span>
										)}
									</td>
									<td className="text-xs text-gray-500">
										{fmtPeriod(f.latest.period)}
										{f.freq === "A" && "（年度）"}
									</td>
									<td className="text-right font-mono">{formatDecimal(f.latest.qtyTons, 0)}</td>
									<td className="text-right">
										<MoM pct={f.qtyMomPct} />
									</td>
									<td className="text-right font-mono">
										{formatDecimal(f.latest.valueM, f.latest.valueM < 10 ? 1 : 0)} M
										{f.currency === "EUR" ? "€" : "$"}
									</td>
									<td className="text-right font-mono">
										{f.currency === "EUR" ? "€" : "$"}
										{formatDecimal(f.latest.unitPricePerT, 0)}/t
									</td>
									<td className="text-right">
										<MoM pct={f.momPct} />
									</td>
									<td className="text-xs text-gray-500">
										{f.freq === "M" ? "月度 FOB" : "年度 FOB"}
										{f.currency === "EUR" ? "·EUR" : ""}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				{payload.arFobTotal && (
					<p className="mt-2 text-xs text-gray-500">
						背景：阿根廷肉类月度出口总额（全部目的地，SSPM）——{fmtPeriod(payload.arFobTotal.period)}{" "}
						约 {formatDecimal(payload.arFobTotal.valueUsdM, 0)}{" "}
						百万美元。阿根廷无对华月度镜像（上表仅年度线），此为出口总量上下文，非对华流量。
					</p>
				)}

				{payload.uyInacTotal && (
					<p className="mt-1 text-xs text-gray-500">
						背景：乌拉圭 INAC 官方对华牛肉月度出口额——{fmtPeriod(payload.uyInacTotal.period)} 约{" "}
						{formatDecimal(payload.uyInacTotal.valueUsdM, 0)} 百万美元（FOB，肉类族口径；eDIAE
						无分国吨位，故不折均价）。
					</p>
				)}

				{payload.calibration.length > 0 && (
					<div className="mt-4">
						<p className="mb-2 text-sm font-medium text-gray-700">
							中国官方年度 CIF（校准线，{payload.calibration[0]?.latest.period?.slice(0, 4)} 年）
						</p>
						<div className="overflow-x-auto">
							<table className="data-table">
								<thead>
									<tr>
										<th className="text-left">伙伴</th>
										<th className="text-right">数量（吨）</th>
										<th className="text-right">CIF 均价（USD/吨）</th>
									</tr>
								</thead>
								<tbody>
									{payload.calibration.map((c) => (
										<tr key={c.region}>
											<td>{COUNTRY_LABELS[c.country] ?? c.country}</td>
											<td className="text-right font-mono">{formatDecimal(c.latest.qtyTons, 0)}</td>
											<td className="text-right font-mono">
												{formatDecimal(c.latest.unitPricePerT, 0)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}

				{payload.uyCuts && payload.uyCuts.length > 0 && (
					<div className="mt-4">
						<p className="mb-2 text-sm font-medium text-gray-700">
							乌拉圭部位族 FOB（INAC eDIAE，全球口径·月度）
						</p>
						<div className="overflow-x-auto">
							<table className="data-table">
								<thead>
									<tr>
										<th className="text-left">部位族</th>
										<th className="text-left">工艺</th>
										<th className="text-left">期间</th>
										<th className="text-right">FOB 均价（USD/kg）</th>
										<th className="text-right">当月吨位</th>
									</tr>
								</thead>
								<tbody>
									{payload.uyCuts.map((c) => {
										const [process, ...slugParts] = c.key.split("_");
										const slug = slugParts.join("_");
										return (
											<tr key={c.key}>
												<td>{CUT_LABELS[slug] ?? slug}</td>
												<td className="text-xs text-gray-500">
													{process === "chilled" ? "冷鲜" : "冷冻"}
												</td>
												<td className="text-xs text-gray-500">{c.period}</td>
												<td className="text-right font-mono">{formatDecimal(c.usdPerKg, 2)}</td>
												<td className="text-right font-mono">{formatDecimal(c.tonnes, 0)}</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						</div>
					</div>
				)}

				<ul className="mt-4 space-y-1 border-t pt-3 text-xs text-gray-500">
					{payload.notes.map((note) => (
						<li key={note}>· {note}</li>
					))}
				</ul>
			</CardBody>
		</Card>
	);
}
