"use client";

import { PageContainer } from "@/components/layout/PageContainer";
import WatchlistPanel from "@/components/trading/WatchlistPanel";
import { PageHeader } from "@/components/ui/PageHeader";

export default function WatchlistPage() {
	return (
		<PageContainer>
			<PageHeader
				title="Watchlists"
				description="Track your favorite commodities and monitor price changes"
			/>
			<WatchlistPanel />
		</PageContainer>
	);
}
