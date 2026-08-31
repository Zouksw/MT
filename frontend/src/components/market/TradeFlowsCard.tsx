"use client";

/**
 * 对华贸易流卡 (V8 批4, round-151) — per-country monthly beef trade flows to
 * China from GET /api/market/trade-flows (comtrade_mirror lanes, V8 批0).
 * Auth-gated per D25 (鉴权内先行): anonymous/failed fetches omit the card
 * silently — the same degrade pattern as the cut-forecast column, never a
 * login wall inside the market page.
 *
 * 口径注记 is mandatory UI, not decoration: the FOB mirror table (exporter
 * side, monthly where reported) and the China-reported annual CIF calibration
 * table are rendered side by side and never merged (research §七.4 — the two
 * calibers differ systematically by freight/insurance and timing).
 */

import { TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { beefFetcher } from "@/lib/beef";
import { formatDecimal } from "@/lib/format";

interface TradeFlowPoint {
	period: string;
	date: string;
	unitPriceUsdPerT: number;
	qtyTons: number;
	valueUsdM: number;
}

interface TradeFlowEntry {
	region: string;
	country: string;
	freq: "M" | "A";
	basis: string;
	latest: TradeFlowPoint;
	momPct: number | null;
	qtyMomPct: number | null;
	stale: boolean;
}

interface CalibrationEntry {
	region: string;
	country: string;
	basis: string;
	latest: TradeFlowPoint;
	stale: boolean;
}

interface TradeFlowsPayload {
	hs: string;
	flows: TradeFlowEntry[];
	calibration: CalibrationEntry[];
	notes: string[];
}

const COUNTRY_LABELS: Record<string, string> = {
	BR: "巴西",
	AU: "澳大利亚",
	NZ: "新西兰",
	US: "美国",
	AR: "阿根廷",
	UY: "乌拉圭",
	WORLD: "全球",
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
	const { data } = useRetryableFetch("/api/market/trade-flows?hs=0202", beefFetcher);
	const payload = (data as { data?: TradeFlowsPayload } | undefined)?.data;

	// Not logged in (401 per D25), fetch error, or no rows yet — omit the
	// card entirely; honest absence, no fabricated placeholder.
	if (!payload || !Array.isArray(payload.flows) || payload.flows.length === 0) return null;

	return (
		<Card className="mt-6">
			<CardHeader>
				<CardTitle>对华贸易流 · 冻牛肉（HS 0202，FOB 月度镜像）</CardTitle>
			</CardHeader>
			<CardBody>
				<div className="overflow-x-auto">
					<table className="data-table">
						<thead>
							<tr>
								<th className="text-left">国别</th>
								<th className="text-left">期间</th>
								<th className="text-right">数量（吨）</th>
								<th className="text-right">FOB 均价（USD/吨）</th>
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
									<td className="text-right font-mono">
										{formatDecimal(f.latest.unitPriceUsdPerT, 0)}
									</td>
									<td className="text-right">
										<MoM pct={f.momPct} />
									</td>
									<td className="text-xs text-gray-500">
										{f.freq === "M" ? "月度 FOB" : "年度 FOB"}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

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
												{formatDecimal(c.latest.unitPriceUsdPerT, 0)}
											</td>
										</tr>
									))}
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
