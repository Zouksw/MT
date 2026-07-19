"use client";

import { Globe } from "lucide-react";
import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Alert } from "@/components/ui/Alert";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";

/**
 * 产地对比 — Origin comparison (PRODUCT-SPEC §四 "分析 > 产地对比", M3).
 *
 * Compares imported-beef prices across origin countries (BR/AU/AR/UY/US/...)
 * on the latest available date. Each country card shows avg/min/max + cut
 * count + factory count + a top-cuts breakdown. Side-by-side layout lets the
 * user see which origins are cheapest/premium at a glance.
 *
 * Data is public (GET /api/beef/by-country). When only frozen seed data is
 * available (e.g. just BR+AU at 2026-04-30), the page still renders honestly
 * — it shows what exists rather than fabricating a richer comparison. As
 * live scrapers come online (DATA-1 / G6), more countries populate.
 */

interface TopCut {
	cutCode: string;
	price: number;
}

interface CountryAgg {
	country: string;
	avgPrice: number;
	minPrice: number;
	maxPrice: number;
	cutCount: number;
	factoryCount: number;
	topCuts: TopCut[];
}

interface ByCountryResponse {
	countries: CountryAgg[];
	date: string | null;
	count: number;
}

// ISO2 → 中文/英文 display label. Falls back to the raw code for unknown.
const COUNTRY_LABELS: Record<string, string> = {
	BR: "巴西 Brazil",
	AU: "澳大利亚 Australia",
	AR: "阿根廷 Argentina",
	UY: "乌拉圭 Uruguay",
	US: "美国 USA",
	CN: "中国 China",
};

function countryLabel(code: string): string {
	return COUNTRY_LABELS[code] ?? code;
}

export default function OriginComparisonPage() {
	const [data, setData] = useState<ByCountryResponse | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		async function load() {
			setLoading(true);
			setError(null);
			try {
				// Public endpoint, no token needed.
				const res = await fetch("/api/beef/by-country?cuts=5");
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const json = (await res.json()) as { success: boolean; data?: ByCountryResponse };
				if (!cancelled && json.success && json.data) {
					setData(json.data);
				} else if (!cancelled) {
					setError("Failed to load origin comparison");
				}
			} catch (err) {
				if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		load();
		return () => {
			cancelled = true;
		};
	}, []);

	const asOf = data?.date ? new Date(data.date).toLocaleDateString() : null;

	return (
		<PageContainer>
			<PageHeader
				title="产地对比"
				description="Compare imported beef prices across origin countries — latest available date."
				breadcrumbs={[
					{ label: "Home", href: "/dashboard" },
					{ label: "分析", href: "/dashboard/analysis" },
					{ label: "产地对比" },
				]}
			/>

			{error && (
				<Alert variant="error" className="mb-4">
					{error}
				</Alert>
			)}

			{asOf && (
				<p className="text-xs text-muted-foreground mb-4">
					As of <span className="font-medium text-foreground">{asOf}</span> ·{" "}
					{data?.countries.length ?? 0} origin{(data?.countries.length ?? 0) === 1 ? "" : "s"} with
					data
				</p>
			)}

			{loading ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{[0, 1, 2].map((i) => (
						<div key={i} className="h-48 rounded-xl border bg-card animate-pulse" />
					))}
				</div>
			) : (data?.countries.length ?? 0) > 0 ? (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
					{data?.countries.map((c) => (
						<Card key={c.country}>
							<CardHeader>
								<div className="flex items-center justify-between">
									<CardTitle className="flex items-center gap-2">
										<Globe className="size-4 text-primary" />
										{countryLabel(c.country)}
									</CardTitle>
									<span className="text-xs text-muted-foreground">
										{c.factoryCount} plant{c.factoryCount === 1 ? "" : "s"}
									</span>
								</div>
							</CardHeader>
							<CardBody>
								<div className="flex items-baseline gap-1 mb-3">
									<span
										className="text-3xl font-display font-semibold tabular-nums text-foreground"
										style={{ fontVariantNumeric: "tabular-nums" }}
									>
										${c.avgPrice.toFixed(2)}
									</span>
									<span className="text-sm text-muted-foreground">/kg avg</span>
								</div>
								<p className="text-xs text-muted-foreground mb-4">
									Range ${c.minPrice.toFixed(2)} – ${c.maxPrice.toFixed(2)} · {c.cutCount} cut
									{c.cutCount === 1 ? "" : "s"}
								</p>
								{c.topCuts.length > 0 && (
									<div>
										<div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
											Top cuts
										</div>
										<ul className="space-y-1">
											{c.topCuts.map((cut) => (
												<li key={cut.cutCode} className="flex items-center justify-between text-sm">
													<a
														href={`/beef/cuts/${cut.cutCode}`}
														className="text-foreground hover:text-primary truncate mr-2"
													>
														{cut.cutCode.replace(/_/g, " ")}
													</a>
													<span
														className="font-mono tabular-nums text-muted-foreground"
														style={{ fontVariantNumeric: "tabular-nums" }}
													>
														${cut.price.toFixed(2)}
													</span>
												</li>
											))}
										</ul>
									</div>
								)}
							</CardBody>
						</Card>
					))}
				</div>
			) : (
				!error && (
					<Card>
						<CardBody>
							<div className="text-center py-12">
								<Globe className="size-10 text-muted-foreground/40 mx-auto mb-3" />
								<p className="text-sm text-muted-foreground">
									No beef price data available yet. The origin comparison will populate once
									scrapers ingest per-country prices.
								</p>
							</div>
						</CardBody>
					</Card>
				)
			)}
		</PageContainer>
	);
}
