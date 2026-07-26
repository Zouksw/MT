"use client";

/**
 * WatchlistPanel — the "follow list" UI (PRODUCT-SPEC §四: portfolio/watchlist
 * 降级为关注列表). This component and its backend (/api/watchlists +
 * watchlistService) are KEPT as the implementation basis for the degraded
 * "关注列表" entry point.
 *
 * The /trading/watchlist ROUTE was removed (§九: no trading semantics in the
 * main IA), so this panel currently has no renderer. It will be re-mounted at
 * a non-trading entry point (e.g. /settings/watchlists or a user-menu item)
 * when the degraded entry is wired. Do NOT delete without removing
 * lib/watchlist.ts and backend watchlistService too.
 */

import { Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { formatPrice } from "@/lib/format";
import { useWatchlists } from "@/lib/watchlist";

export default function WatchlistPanel() {
	const { watchlists, loading, mutate } = useWatchlists();

	const handleCreate = async () => {
		const name = prompt("Watchlist name:");
		if (!name) return;
		const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
		const headers: Record<string, string> = { "Content-Type": "application/json" };
		if (token) headers.Authorization = `Bearer ${token}`;
		const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
		await fetch(`${base}/api/watchlists`, {
			method: "POST",
			headers,
			body: JSON.stringify({ name }),
		});
		mutate();
	};

	if (loading) {
		return (
			<div className="rounded-lg bg-card ring-1 ring-black/[0.06] dark:ring-white/[0.08] p-5 flex justify-center">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{watchlists.map((wl) => (
				<div
					key={wl.id}
					className="rounded-lg bg-card ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
				>
					<div className="px-5 py-3 border-b border-gray-200/60 dark:border-gray-700/60 flex items-center justify-between">
						<span className="flex items-center gap-2 font-semibold">
							<Star className="size-4 text-primary" fill="currentColor" />
							{wl.name}
							<span className="text-xs text-gray-400 font-normal">({wl.itemCount})</span>
						</span>
						{!wl.isDefault && (
							<button
								type="button"
								className="p-1 text-gray-400 hover:text-destructive transition-colors"
								title="Delete watchlist"
								onClick={async () => {
									if (!confirm("Delete this watchlist?")) return;
									const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
									const headers: Record<string, string> = {};
									if (token) headers.Authorization = `Bearer ${token}`;
									const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
									await fetch(`${base}/api/watchlists/${wl.id}`, { method: "DELETE", headers });
									mutate();
								}}
							>
								<Trash2 className="size-4" />
							</button>
						)}
					</div>
					<div className="p-5">
						{wl.items.length === 0 ? (
							<p className="text-xs text-gray-400 text-center py-4">
								No items.{" "}
								<Link href="/trading" className="text-primary">
									Browse commodities
								</Link>
							</p>
						) : (
							<div className="divide-y divide-gray-100 dark:divide-gray-700">
								{wl.items.map((item) => (
									<Link
										key={item.id}
										href={`/trading?slug=${item.commodity.slug}`}
										className="flex items-center justify-between py-2 hover:bg-accent/50 px-1 rounded transition-colors"
									>
										<div>
											<div className="text-sm font-medium">
												{item.commodity.nameCn || item.commodity.name}
											</div>
											<div className="text-xs text-gray-400">{item.commodity.slug}</div>
										</div>
										<div className="text-right">
											{item.latestPrice != null ? (
												<div className="text-sm font-mono">
													{formatPrice(item.latestPrice, false)}
												</div>
											) : (
												<div className="text-xs text-gray-400">--</div>
											)}
										</div>
									</Link>
								))}
							</div>
						)}
					</div>
				</div>
			))}

			<Button variant="secondary" fullWidth onClick={handleCreate}>
				+ New Watchlist
			</Button>
		</div>
	);
}
