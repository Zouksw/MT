"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useMemo } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { NewsForm, type NewsFormState } from "@/components/market-news/NewsForm";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { updateRecord, useOne } from "@/lib/api";
import { useIsMobile } from "@/lib/responsive-utils";

/**
 * Edit an existing market-news article (EDITOR/ADMIN only — enforced by the
 * PATCH /api/news/:id backend route via requireEditorRole + ownership check).
 *
 * Reuses the shared <NewsForm/> from the create flow so field set,
 * validation, and XSS sanitization stay identical. Seeds the form from the
 * fetched article via useOne, then PATCHes on submit (was: only create
 * existed, so typos required delete+recreate).
 */

interface NewsArticle {
	id: string;
	title: string;
	summary: string;
	body: string;
	category: string;
	source: string;
	sourceUrl: string | null;
	commoditySlug: string | null;
	tags: string[];
	status: string;
}

export default function EditNewsPage() {
	const params = useParams();
	const id = String(params?.id ?? "");
	const router = useRouter();
	const toast = useToast();
	const isMobile = useIsMobile();

	const { data: article, loading, error } = useOne<NewsArticle>("news", id || null);

	const initial: NewsFormState | null = useMemo(() => {
		if (!article) return null;
		return {
			title: article.title ?? "",
			summary: article.summary ?? "",
			body: article.body ?? "",
			category: article.category ?? "MARKET_INSIGHT",
			source: article.source ?? "",
			sourceUrl: article.sourceUrl ?? "",
			commoditySlug: article.commoditySlug ?? "",
			tags: Array.isArray(article.tags) ? article.tags.join(", ") : "",
			status: article.status ?? "published",
		};
	}, [article]);

	return (
		<PageContainer>
			<PageHeader
				title="Edit Article"
				description="Update an existing market dynamics article"
				breadcrumbs={[
					{ label: "Home", href: "/" },
					{ label: "资讯", href: "/market-news" },
					{ label: "Market News", href: "/market-news" },
					{ label: "Edit" },
				]}
				actions={
					<Button variant="ghost" size="sm" onClick={() => router.push("/market-news")}>
						<ArrowLeft className="size-4 mr-1.5" />
						{!isMobile && "Back"}
					</Button>
				}
			/>

			{loading ? (
				<Card>
					<CardBody>
						<div className="flex items-center justify-center py-12 text-muted-foreground">
							<Loader2 className="size-5 animate-spin mr-2" />
							Loading article…
						</div>
					</CardBody>
				</Card>
			) : error ? (
				<Card>
					<CardBody>
						<p className="text-sm text-destructive py-8 text-center">
							Failed to load article: {error.message}
						</p>
					</CardBody>
				</Card>
			) : !article || !initial ? (
				<Card>
					<CardBody>
						<p className="text-sm text-muted-foreground py-8 text-center">Article not found.</p>
					</CardBody>
				</Card>
			) : (
				<NewsForm
					initial={initial}
					submitLabel="Save Changes"
					loadingLabel="Saving…"
					onSubmit={async (payload) => {
						await updateRecord("news", id, payload);
						toast.showSuccess("Article updated");
						setTimeout(() => router.push(`/market-news/show/${id}`), 800);
					}}
				/>
			)}
		</PageContainer>
	);
}
