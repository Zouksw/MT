"use client";

import { Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
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
			<div className="rounded-lg bg-card border border-gray-200/60 dark:border-gray-700/60 p-5 flex justify-center">
				<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{watchlists.map((wl) => (
				<div
					key={wl.id}
					className="rounded-lg bg-card border border-gray-200/60 dark:border-gray-700/60"
				>
					<div className="px-5 py-3 border-b border-gray-200/60 dark:border-gray-700/60 flex items-center justify-between">
						<span className="flex items-center gap-2 font-semibold">
							<Star className="size-4 text-amber-500" fill="currentColor" />
							{wl.name}
							<span className="text-xs text-gray-400 font-normal">({wl.itemCount})</span>
						</span>
						{!wl.isDefault && (
							<button type="button"
								className="p-1 text-gray-400 hover:text-red-500 transition-colors"
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
								<Link href="/trading" className="text-amber-600">
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
													{Number(item.latestPrice).toFixed(2)}
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
