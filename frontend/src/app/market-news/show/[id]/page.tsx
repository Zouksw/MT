"use client";

import { ArrowLeft, ExternalLink, Eye, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { LoadingState } from "@/components/ui/LoadingState";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { useOne } from "@/lib/api";

interface NewsArticle {
	id: string;
	title: string;
	slug: string;
	summary: string;
	body: string;
	category: string;
	source: string;
	sourceUrl: string | null;
	commoditySlug: string | null;
	relatedSlugs: string[] | null;
	coverImageUrl: string | null;
	tags: string[];
	status: string;
	viewCount: number;
	publishedAt: string;
	author: { id: string; name: string };
}

const CATEGORY_LABELS: Record<string, string> = {
	PRICE_MOVE: "Price Move",
	SUPPLY: "Supply",
	TRADE_POLICY: "Trade Policy",
	MARKET_INSIGHT: "Insight",
	COMPANY: "Company",
};

export default function NewsDetailPage() {
	const router = useRouter();
	const params = useParams();
	const id = (params?.id as string) ?? null;
	const toast = useToast();
	const [confirmDelete, setConfirmDelete] = useState(false);

	const { data: article, loading, error, mutate } = useOne<NewsArticle>("news", id);

	const handleDelete = async () => {
		if (!article) return;
		try {
			const { deleteRecord } = await import("@/lib/api");
			await deleteRecord("news", article.id);
			toast.showSuccess("Article deleted");
			router.push("/market-news");
		} catch {
			toast.showError("Failed to delete article");
		}
	};

	if (loading) {
		return (
			<PageContainer>
				<LoadingState loading timeout={15000}>
					<div className="py-20 text-center text-muted-foreground">Loading article…</div>
				</LoadingState>
			</PageContainer>
		);
	}

	if (error || !article) {
		return (
			<PageContainer>
				<ErrorDisplay
					error={error ?? new Error("Article not found")}
					retry={() => mutate()}
					context="News Article"
				/>
				<div className="mt-4">
					<Button variant="ghost" size="sm" onClick={() => router.push("/market-news")}>
						<ArrowLeft className="size-4 mr-1.5" />
						Back to Market News
					</Button>
				</div>
			</PageContainer>
		);
	}

	return (
		<PageContainer>
			<PageHeader
				title={article.title}
				description={article.summary}
				breadcrumbs={[
					{ label: "Home", href: "/" },
					{ label: "资讯", href: "/market-news" },
					{ label: "Market News", href: "/market-news" },
					{ label: article.category },
				]}
				actions={
					<Button variant="danger" size="sm" onClick={() => setConfirmDelete(true)}>
						<Trash2 className="size-4 mr-1.5" />
						Delete
					</Button>
				}
			/>

			<article className="max-w-3xl">
				{/* Meta bar */}
				<div className="flex flex-wrap items-center gap-3 mb-6 text-sm">
					<Tag color="info">{CATEGORY_LABELS[article.category] ?? article.category}</Tag>
					<span className="text-muted-foreground">{article.source}</span>
					<span className="text-muted-foreground">·</span>
					<span className="text-muted-foreground">
						{new Date(article.publishedAt).toLocaleDateString("en-US", {
							year: "numeric",
							month: "long",
							day: "numeric",
						})}
					</span>
					<span className="text-muted-foreground">·</span>
					<span className="inline-flex items-center gap-1 text-muted-foreground">
						<Eye className="size-3.5" />
						<span className="tabular-nums">{article.viewCount}</span>
					</span>
					{article.author && (
						<span className="text-muted-foreground">· by {article.author.name}</span>
					)}
				</div>

				{/* Body */}
				<div className="prose prose-sm dark:prose-invert max-w-none">
					{article.body
						.split("\n")
						.filter((p) => p.trim())
						.map((para) => (
							<p
								key={para.slice(0, 40)}
								className="text-foreground leading-relaxed mb-4 whitespace-pre-wrap"
							>
								{para}
							</p>
						))}
				</div>

				{/* Related commodity + tags */}
				{(article.commoditySlug || article.tags?.length > 0) && (
					<div className="mt-8 pt-6 border-t border">
						{article.commoditySlug && (
							<div className="mb-3">
								<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-2">
									Related cut
								</span>
								<a
									href={`/beef/cuts/${article.commoditySlug}`}
									className="text-sm text-primary hover:underline"
								>
									{article.commoditySlug.replace(/_/g, " ")}
								</a>
							</div>
						)}
						{article.tags?.length > 0 && (
							<div className="flex flex-wrap items-center gap-2">
								<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider mr-2">
									Tags
								</span>
								{article.tags.map((tag) => (
									<Tag key={tag} color="default">
										{tag}
									</Tag>
								))}
							</div>
						)}
					</div>
				)}

				{/* Source link */}
				{article.sourceUrl && (
					<div className="mt-6">
						<a
							href={article.sourceUrl}
							target="_blank"
							rel="noopener noreferrer"
							className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
						>
							View original source
							<ExternalLink className="size-3.5" />
						</a>
					</div>
				)}
			</article>

			<Modal
				open={confirmDelete}
				onClose={() => setConfirmDelete(false)}
				title="Delete article?"
				description="This action cannot be undone."
				footer={
					<>
						<Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
							Cancel
						</Button>
						<Button variant="danger" size="sm" onClick={handleDelete}>
							Delete
						</Button>
					</>
				}
			>
				<p className="text-sm text-muted-foreground">{article.title}</p>
			</Modal>
		</PageContainer>
	);
}
