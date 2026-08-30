"use client";

/**
 * Topbar global search (PRODUCT-SPEC §四 顶栏搜索, wired round-146/D15).
 *
 * Minimal three-source cross-search backed by GET /api/search (authed,
 * whitelisted: beef cut taxonomy / commodities / published news). Debounced
 * contains-match; Enter jumps to the first hit, Escape closes. Commodity hits
 * land on /trading (its selector is the page's primary interaction — deep
 * link ?slug= is a registered polish item, not silently faked here).
 */

import { Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";

interface CutHit {
	cutCode: string;
	nameEn: string;
	nameZh: string | null;
	primal: string | null;
}
interface CommodityHit {
	slug: string;
	name: string;
	nameCn: string | null;
	category: string;
}
interface NewsHit {
	id: string;
	title: string;
	source: string;
	publishedAt: string;
}
interface SearchPayload {
	query: string;
	cuts: CutHit[];
	commodities: CommodityHit[];
	news: NewsHit[];
}

const DEBOUNCE_MS = 300;

export function GlobalSearch() {
	const [q, setQ] = useState("");
	const [payload, setPayload] = useState<SearchPayload | null>(null);
	const [failed, setFailed] = useState(false);
	const [open, setOpen] = useState(false);
	const boxRef = useRef<HTMLDivElement>(null);

	// Debounced fetch — q too short means "closed" state, not a request.
	useEffect(() => {
		const trimmed = q.trim();
		if (trimmed.length === 0) {
			setPayload(null);
			setFailed(false);
			return;
		}
		const t = setTimeout(() => {
			apiFetch<{ data: SearchPayload }>(`/api/search?q=${encodeURIComponent(trimmed)}`)
				.then((res) => {
					setPayload(res.data);
					setFailed(false);
				})
				.catch(() => {
					// Distinguish "no matches" (honest absence) from "search unavailable"
					// (network/auth) — the latter must not masquerade as the former.
					setPayload(null);
					setFailed(true);
				});
		}, DEBOUNCE_MS);
		return () => clearTimeout(t);
	}, [q]);

	// Click-outside closes the dropdown.
	useEffect(() => {
		function onDown(e: MouseEvent) {
			if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
		}
		document.addEventListener("mousedown", onDown);
		return () => document.removeEventListener("mousedown", onDown);
	}, []);

	const total = payload
		? payload.cuts.length + payload.commodities.length + payload.news.length
		: 0;
	const firstHref = payload
		? payload.cuts[0]
			? `/beef/cuts/${payload.cuts[0].cutCode}`
			: payload.commodities[0]
				? "/trading"
				: payload.news[0]
					? `/market-news/show/${payload.news[0].id}`
					: null
		: null;

	return (
		<div ref={boxRef} className="relative hidden sm:block w-56 lg:w-72">
			<div className="flex items-center gap-2 px-2.5 py-1.5 rounded-md border border-border bg-muted/40 text-sm focus-within:ring-1 focus-within:ring-primary">
				<Search className="size-3.5 shrink-0 text-muted-foreground" />
				<input
					type="text"
					placeholder="搜索部位 / 商品 / 资讯…"
					aria-label="全局搜索"
					value={q}
					onChange={(e) => {
						setQ(e.target.value);
						setOpen(true);
					}}
					onFocus={() => setOpen(true)}
					onKeyDown={(e) => {
						if (e.key === "Escape") setOpen(false);
						if (e.key === "Enter" && firstHref) window.location.href = firstHref;
					}}
					className="w-full bg-transparent outline-none placeholder:text-muted-foreground/70"
				/>
			</div>

			{open && failed && (
				<div className="absolute left-0 top-full mt-1 w-[min(24rem,80vw)] rounded-lg border border-border bg-background shadow-lg z-50">
					<p className="px-3 py-4 text-sm text-muted-foreground">搜索暂不可用，稍后重试</p>
				</div>
			)}

			{open && payload && (
				<div className="absolute left-0 top-full mt-1 w-[min(24rem,80vw)] rounded-lg border border-border bg-background shadow-lg z-50 max-h-96 overflow-y-auto">
					{total === 0 ? (
						<p className="px-3 py-4 text-sm text-muted-foreground">
							无匹配结果（部位 / 商品 / 资讯）
						</p>
					) : (
						<>
							{payload.cuts.length > 0 && (
								<Section label="牛肉部位">
									{payload.cuts.map((c) => (
										<Item
											key={c.cutCode}
											href={`/beef/cuts/${c.cutCode}`}
											onNavigate={() => setOpen(false)}
										>
											{c.nameZh || c.nameEn}
											<span className="text-muted-foreground">{c.cutCode}</span>
										</Item>
									))}
								</Section>
							)}
							{payload.commodities.length > 0 && (
								<Section label="商品">
									{payload.commodities.map((c) => (
										<Item key={c.slug} href="/trading" onNavigate={() => setOpen(false)}>
											{c.nameCn || c.name}
											<span className="text-muted-foreground">{c.slug}</span>
										</Item>
									))}
								</Section>
							)}
							{payload.news.length > 0 && (
								<Section label="资讯">
									{payload.news.map((n) => (
										<Item
											key={n.id}
											href={`/market-news/show/${n.id}`}
											onNavigate={() => setOpen(false)}
										>
											{n.title}
											<span className="text-muted-foreground">{n.source}</span>
										</Item>
									))}
								</Section>
							)}
						</>
					)}
				</div>
			)}
		</div>
	);
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<div className="py-1">
			<p className="px-3 pt-1.5 pb-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
				{label}
			</p>
			{children}
		</div>
	);
}

function Item({
	href,
	onNavigate,
	children,
}: {
	href: string;
	onNavigate: () => void;
	children: React.ReactNode;
}) {
	return (
		<Link
			href={href}
			onClick={onNavigate}
			className="flex items-center justify-between gap-3 px-3 py-1.5 text-sm hover:bg-muted"
		>
			{children}
		</Link>
	);
}
