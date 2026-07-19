"use client";

import { Eye, FileText, Newspaper, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/StatCard";
import { type Column, Table } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { deleteRecord, useList } from "@/lib/api";
import { useIsMobile } from "@/lib/responsive-utils";

// Row shape returned by /api/news list endpoint.
interface NewsRow {
	id: string;
	title: string;
	slug: string;
	summary: string;
	category: string;
	source: string;
	commoditySlug: string | null;
	tags: string[];
	status: string;
	viewCount: number;
	publishedAt: string;
	author: { id: string; name: string };
}

function asRow(record: Record<string, unknown>): NewsRow {
	return record as unknown as NewsRow;
}

const CATEGORY_LABELS: Record<string, string> = {
	PRICE_MOVE: "Price Move",
	SUPPLY: "Supply",
	TRADE_POLICY: "Trade Policy",
	MARKET_INSIGHT: "Insight",
	COMPANY: "Company",
};

const CATEGORY_OPTIONS = [
	{ value: "", label: "All categories" },
	...Object.entries(CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
];

export default function MarketNewsList() {
	const router = useRouter();
	const isMobile = useIsMobile();
	const toast = useToast();

	const [page, setPage] = useState(1);
	const pageSize = isMobile ? 10 : 20;
	const [category, setCategory] = useState("");
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const [deleteTarget, setDeleteTarget] = useState<Record<string, unknown> | null>(null);

	// Debounce the search input so we don't refetch the list on every keystroke.
	useEffect(() => {
		const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
		return () => clearTimeout(t);
	}, [search]);

	// Main feed — server-side paginated + filtered.
	const { data, total, loading, mutate } = useList("news", {
		page,
		pageSize,
		sort: "publishedAt",
		order: "desc",
		filters: {
			...(category ? { category } : {}),
			...(debouncedSearch ? { search: debouncedSearch } : {}),
		},
	});

	// Stats — single lightweight fetch from the dedicated /news/stats endpoint.
	// Previously this pulled 1000 rows via useList and client-counted them —
	// wasteful and laggy as the article count grows. The endpoint returns the
	// 4 counts server-side in one small response.
	const statsFetcher = async (url: string) => {
		const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
		const res = await fetch(url, {
			headers: token ? { Authorization: `Bearer ${token}` } : {},
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const j = (await res.json()) as {
			data?: { total: number; published: number; drafts: number; thisWeek: number };
		};
		return j.data ?? { total: 0, published: 0, drafts: 0, thisWeek: 0 };
	};
	const { data: stats } = useSWR("/api/news/stats", statsFetcher, {
		revalidateOnFocus: false,
	});
	const totalArticles = stats?.total ?? 0;
	const publishedCount = stats?.published ?? 0;
	const draftCount = stats?.drafts ?? 0;
	const thisWeek = stats?.thisWeek ?? 0;

	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	const handleDelete = async () => {
		if (!deleteTarget) return;
		try {
			await deleteRecord("news", String(deleteTarget.id));
			toast.showSuccess("Article deleted");
			mutate();
			setDeleteTarget(null);
		} catch {
			toast.showError("Failed to delete article");
		}
	};

	const columns: Column<Record<string, unknown>>[] = useMemo(() => {
		return [
			{
				key: "title",
				title: "Title",
				dataIndex: "title",
				render: (_value, record) => {
					const r = asRow(record);
					return (
						<div className="max-w-md">
							<button
								type="button"
								className="text-left font-medium text-foreground hover:text-primary"
								onClick={() => router.push(`/market-news/show/${r.id}`)}
							>
								{r.title}
							</button>
							<p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{r.summary}</p>
						</div>
					);
				},
			},
			{
				key: "category",
				title: "Category",
				dataIndex: "category",
				width: 130,
				render: (_value, record) => {
					const r = asRow(record);
					return <Tag color="info">{CATEGORY_LABELS[r.category] ?? r.category}</Tag>;
				},
			},
			{
				key: "source",
				title: "Source",
				dataIndex: "source",
				width: 120,
				render: (_value, record) => (
					<span className="text-sm text-muted-foreground">{asRow(record).source}</span>
				),
			},
			{
				key: "publishedAt",
				title: "Published",
				dataIndex: "publishedAt",
				width: 140,
				render: (value) => {
					const v = value as string | undefined;
					return (
						<span className="text-xs text-muted-foreground">
							{v
								? new Date(v).toLocaleDateString("en-US", { month: "short", day: "numeric" })
								: "--"}
						</span>
					);
				},
			},
			{
				key: "viewCount",
				title: "Views",
				dataIndex: "viewCount",
				width: 80,
				align: "right" as const,
				render: (value) => (
					<span
						className="text-sm text-muted-foreground tabular-nums"
						style={{ fontVariantNumeric: "tabular-nums" }}
					>
						{(value as number) ?? 0}
					</span>
				),
			},
			{
				key: "actions",
				title: "",
				width: isMobile ? 70 : 100,
				render: (_value, record) => {
					const r = asRow(record);
					return (
						<div className="flex items-center justify-end gap-1">
							<Button
								variant="ghost"
								size="sm"
								aria-label="View"
								onClick={() => router.push(`/market-news/show/${r.id}`)}
							>
								<Eye className="size-3.5" />
							</Button>
							<Button
								variant="ghost"
								size="sm"
								aria-label="Delete"
								onClick={() => setDeleteTarget(record)}
							>
								<Trash2 className="size-3.5" />
							</Button>
						</div>
					);
				},
			},
		];
	}, [isMobile, router]);

	return (
		<PageContainer>
			<PageHeader
				title="Market News"
				description="Beef trade market dynamics, price moves, and policy updates"
				breadcrumbs={[{ label: "Home", href: "/" }, { label: "资讯" }, { label: "Market News" }]}
				actions={
					<Button variant="primary" size="md" onClick={() => router.push("/market-news/create")}>
						<Plus className="size-4 mr-1.5" />
						{!isMobile && "New Article"}
					</Button>
				}
			/>

			{/* Stat cards — info/primary variants only (no directional green/red). */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
				<StatCard
					title="Total Articles"
					value={totalArticles}
					variant="primary"
					icon={<Newspaper className="size-4" />}
					loading={loading}
				/>
				<StatCard
					title="Published"
					value={publishedCount}
					variant="info"
					icon={<FileText className="size-4" />}
					loading={loading}
				/>
				<StatCard
					title="Drafts"
					value={draftCount}
					icon={<FileText className="size-4" />}
					loading={loading}
				/>
				<StatCard
					title="This Week"
					value={thisWeek}
					variant="info"
					icon={<Newspaper className="size-4" />}
					loading={loading}
				/>
			</div>

			{/* Filters */}
			<div className="flex flex-col sm:flex-row gap-3 mb-4">
				<div className="w-full sm:w-56">
					<Select
						options={CATEGORY_OPTIONS}
						value={category}
						onChange={(v) => {
							setCategory(v);
							setPage(1);
						}}
						fullWidth
					/>
				</div>
				<Input
					placeholder="Search articles..."
					value={search}
					onChange={(e) => {
						setSearch(e.target.value);
						setPage(1);
					}}
					fullWidth
				/>
			</div>

			{/* Table */}
			<div className="bg-card rounded-lg shadow-sm border border">
				<Table
					columns={columns}
					dataSource={data}
					rowKey="id"
					loading={loading}
					emptyText="No articles yet"
				/>

				{/* Pagination */}
				{totalPages > 1 && (
					<div className="flex items-center justify-between px-6 py-4 border-t border">
						<span className="text-sm text-muted-foreground">
							{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
						</span>
						<div className="flex items-center gap-2">
							<Button
								variant="ghost"
								size="sm"
								disabled={page <= 1}
								onClick={() => setPage((p) => Math.max(1, p - 1))}
							>
								Previous
							</Button>
							<span className="px-3 py-1 text-sm text-foreground">
								Page {page} of {totalPages}
							</span>
							<Button
								variant="ghost"
								size="sm"
								disabled={page >= totalPages}
								onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
							>
								Next
							</Button>
						</div>
					</div>
				)}
			</div>

			{/* Delete confirmation */}
			<Modal
				open={!!deleteTarget}
				onClose={() => setDeleteTarget(null)}
				title="Delete article?"
				description="This action cannot be undone."
				footer={
					<>
						<Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
							Cancel
						</Button>
						<Button variant="danger" size="sm" onClick={handleDelete}>
							Delete
						</Button>
					</>
				}
			>
				<p className="text-sm text-muted-foreground">
					{deleteTarget ? String(deleteTarget.title) : ""}
				</p>
			</Modal>
		</PageContainer>
	);
}
