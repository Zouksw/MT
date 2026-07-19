"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageContainer } from "@/components/layout/PageContainer";
import { EMPTY_NEWS_FORM, NewsForm } from "@/components/market-news/NewsForm";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { useToast } from "@/components/ui/Toast";
import { createRecord } from "@/lib/api";
import { useIsMobile } from "@/lib/responsive-utils";

export default function CreateNewsPage() {
	const router = useRouter();
	const toast = useToast();
	const isMobile = useIsMobile();

	return (
		<PageContainer>
			<PageHeader
				title="New Article"
				description="Publish a market dynamics article for the 资讯 feed"
				breadcrumbs={[
					{ label: "Home", href: "/" },
					{ label: "资讯", href: "/market-news" },
					{ label: "Market News", href: "/market-news" },
					{ label: "New" },
				]}
				actions={
					<Button variant="ghost" size="sm" onClick={() => router.push("/market-news")}>
						<ArrowLeft className="size-4 mr-1.5" />
						{!isMobile && "Back"}
					</Button>
				}
			/>

			<NewsForm
				initial={EMPTY_NEWS_FORM}
				submitLabel="Publish Article"
				loadingLabel="Publishing…"
				onSubmit={async (payload) => {
					await createRecord("news", payload);
					toast.showSuccess("Article published");
					setTimeout(() => router.push("/market-news"), 800);
				}}
			/>
		</PageContainer>
	);
}
