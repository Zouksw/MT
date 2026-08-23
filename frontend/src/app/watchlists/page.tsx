"use client";

import { Plus, Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { LoadingState } from "@/components/ui/LoadingState";
import { PageHeader } from "@/components/ui/PageHeader";
import {
	addWatchlistItem,
	type CommodityOption,
	createWatchlist,
	removeWatchlistItem,
	useCommodityOptions,
	useWatchlistQuotes,
	useWatchlists,
} from "@/hooks/useWatchlists";

/**
 * /watchlists — minimal watchlist UI (IMPROVEMENT-PLAN D1): pick a commodity,
 * see its latest authoritative quote, remove it. Prices/dates come from the
 * same authoritative-source resolution as the market pages; a stale series
 * shows its real date rather than being hidden or fabricated.
 */

function fmtDate(d: string | null): string {
	return d ? d.slice(0, 10) : "—";
}

function fmtPrice(p: number | null): string {
	return p == null ? "—" : p.toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

const CATEGORY_LABELS: Record<string, string> = {
	beef_cuts: "牛肉部位",
	futures: "期货",
	forex: "汇率",
	grain: "谷物",
	meat_dairy: "肉禽奶",
	other_meat: "其他肉类",
	metals: "金属",
	energy: "能源",
	soft_commodities: "软商品",
	feed: "饲料",
	live_cattle: "活牛",
	shipping: "运价",
	index: "指数",
	indices: "指数",
};

export default function WatchlistsPage() {
	const { watchlists, loading, error, mutate } = useWatchlists();
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [pickerId, setPickerId] = useState("");
	const [busy, setBusy] = useState(false);
	const [actionError, setActionError] = useState<string | null>(null);

	const selected = useMemo(
		() => watchlists.find((w) => w.id === selectedId) ?? watchlists[0] ?? null,
		[watchlists, selectedId],
	);
	const { quotes } = useWatchlistQuotes(selected?.id ?? null);
	const { commodities } = useCommodityOptions();

	const quoteById = useMemo(() => {
		const m = new Map<string, (typeof quotes)[number]>();
		for (const q of quotes) m.set(q.commodityId, q);
		return m;
	}, [quotes]);

	// Picker options grouped by category; already-added excluded. Within a
	// group, commodities that actually have a price sort first — the picker
	// shouldn't bury the three priced beef cuts under 29 empty seed rows.
	const groups = useMemo(() => {
		const added = new Set(selected?.items.map((i) => i.commodityId) ?? []);
		const g = new Map<string, CommodityOption[]>();
		for (const c of commodities) {
			if (added.has(c.id)) continue;
			const list = g.get(c.category) ?? [];
			list.push(c);
			g.set(c.category, list);
		}
		for (const list of g.values()) {
			list.sort(
				(a, b) =>
					Number(b.latestPrice != null) - Number(a.latestPrice != null) ||
					(a.nameCn ?? a.name).localeCompare(b.nameCn ?? b.name),
			);
		}
		return g;
	}, [commodities, selected?.items]);

	const run = async (fn: () => Promise<void>) => {
		setBusy(true);
		setActionError(null);
		try {
			await fn();
			await mutate();
		} catch (e) {
			setActionError(e instanceof Error ? e.message : "操作失败，请重试");
		} finally {
			setBusy(false);
		}
	};

	return (
		<PageContainer>
			<PageHeader
				title="自选清单"
				description="关注部位与商品的最新报价——数据与行情页同源，日期即真实数据日期。"
			/>

			<LoadingState loading={loading} timeout={15000}>
				{error ? (
					<ErrorDisplay error={error} retry={() => void mutate()} context="Watchlists" />
				) : watchlists.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-20 text-center">
						<div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-6">
							<Star className="size-7 text-primary" />
						</div>
						<h2 className="text-h4 font-display font-semibold text-foreground mb-2">
							还没有自选清单
						</h2>
						<p className="text-body text-muted-foreground mb-6 max-w-md">
							创建一个清单，把关心的牛肉部位和商品加进来，一眼跟踪最新报价。
						</p>
						<Button
							variant="primary"
							disabled={busy}
							onClick={() => void run(() => createWatchlist("我的自选"))}
						>
							<Plus className="size-4" />
							创建自选清单
						</Button>
						{actionError && <p className="text-sm text-destructive mt-3">{actionError}</p>}
					</div>
				) : (
					selected && (
						<div className="flex flex-col gap-4">
							{watchlists.length > 1 && (
								<div className="flex gap-2 flex-wrap" role="tablist" aria-label="清单切换">
									{watchlists.map((w) => (
										<button
											key={w.id}
											type="button"
											role="tab"
											aria-selected={w.id === selected.id}
											onClick={() => setSelectedId(w.id)}
											className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
												w.id === selected.id
													? "border-primary/50 bg-primary/10 text-primary"
													: "border-border text-muted-foreground hover:text-foreground"
											}`}
										>
											{w.name}（{w.itemCount}）
										</button>
									))}
								</div>
							)}

							<div className="rounded-xl border bg-card">
								<div className="flex flex-col sm:flex-row gap-2 p-4 border-b">
									<select
										value={pickerId}
										onChange={(e) => setPickerId(e.target.value)}
										aria-label="选择要添加的部位或商品"
										className="flex-1 h-9 rounded-lg border border-border bg-background px-3 text-sm"
									>
										<option value="">选择部位 / 商品…</option>
										{[...groups.entries()].map(([category, list]) => (
											// Native <optgroup> keeps the picker accessible without
											// extra JS; empty groups (all added) render nothing.
											<optgroup key={category} label={CATEGORY_LABELS[category] ?? category}>
												{list.map((c) => (
													<option key={c.id} value={c.id}>
														{c.nameCn ?? c.name}
														{c.latestPrice == null ? "（暂无价格）" : ""}
													</option>
												))}
											</optgroup>
										))}
									</select>
									<Button
										variant="primary"
										disabled={!pickerId || busy}
										onClick={() =>
											void run(async () => {
												await addWatchlistItem(selected.id, pickerId);
												setPickerId("");
											})
										}
									>
										<Plus className="size-4" />
										添加
									</Button>
								</div>
								{actionError && <p className="text-sm text-destructive px-4 pt-3">{actionError}</p>}

								{selected.items.length === 0 ? (
									<p className="text-sm text-muted-foreground p-6 text-center">
										清单为空——从上方添加部位或商品。
									</p>
								) : (
									<div className="overflow-x-auto">
										<table className="w-full text-sm">
											<thead>
												<tr className="text-left text-xs text-muted-foreground border-b">
													<th className="px-4 py-2 font-medium">部位 / 商品</th>
													<th className="px-3 py-2 font-medium text-right">最新价</th>
													<th className="px-3 py-2 font-medium text-right">涨跌</th>
													<th className="px-3 py-2 font-medium text-left">数据日期</th>
													<th className="px-4 py-2 font-medium text-right">操作</th>
												</tr>
											</thead>
											<tbody>
												{selected.items.map((item) => {
													const q = quoteById.get(item.commodityId);
													const price = q?.price ?? item.latestPrice;
													const date = q?.date ?? item.latestDate;
													const pct = q?.changePercent ?? null;
													const unit = q?.unit ?? item.commodity.unit;
													return (
														<tr key={item.id} className="border-b last:border-b-0">
															<td className="px-4 py-2.5">
																<div className="font-medium text-foreground">
																	{item.commodity.nameCn ?? item.commodity.name}
																</div>
																<div className="text-xs text-muted-foreground">
																	{item.commodity.slug}
																</div>
															</td>
															<td className="px-3 py-2.5 text-right tabular-nums">
																{fmtPrice(price)}
																{price != null && (
																	<span className="text-xs text-muted-foreground ml-1">{unit}</span>
																)}
															</td>
															<td className="px-3 py-2.5 text-right tabular-nums">
																{pct == null ? (
																	<span className="text-muted-foreground">—</span>
																) : (
																	<span className={pct >= 0 ? "text-green-600" : "text-red-600"}>
																		{pct >= 0 ? "+" : ""}
																		{pct.toFixed(2)}%
																	</span>
																)}
															</td>
															<td className="px-3 py-2.5 text-muted-foreground">{fmtDate(date)}</td>
															<td className="px-4 py-2.5 text-right">
																<button
																	type="button"
																	disabled={busy}
																	onClick={() =>
																		void run(() =>
																			removeWatchlistItem(selected.id, item.commodityId),
																		)
																	}
																	aria-label={`移除 ${item.commodity.nameCn ?? item.commodity.name}`}
																	className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
																>
																	<Trash2 className="size-3.5" />
																	移除
																</button>
															</td>
														</tr>
													);
												})}
											</tbody>
										</table>
									</div>
								)}
							</div>
						</div>
					)
				)}
			</LoadingState>
		</PageContainer>
	);
}
