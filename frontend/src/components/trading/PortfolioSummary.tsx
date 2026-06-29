"use client";

import { Scale } from "lucide-react";
import { Tag } from "@/components/ui/Tag";
import { useAnalysisGroups } from "@/lib/watchlist";

export default function PortfolioSummary() {
	const { groups, loading } = useAnalysisGroups();

	if (loading) {
		return (
			<div className="rounded-lg bg-card shadow-card dark:shadow-card-dark p-5 animate-pulse">
				<div className="h-6 bg-muted rounded w-32 mb-4" />
				<div className="space-y-3">
					{[1, 2, 3].map((i) => (
						<div key={i} className="h-10 bg-muted rounded" />
					))}
				</div>
			</div>
		);
	}

	if (groups.length === 0) {
		return (
			<div className="rounded-lg bg-card shadow-card dark:shadow-card-dark p-8 text-center">
				<p className="text-muted-foreground">
					No analysis groups yet. Create a group to track related commodities.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			{groups.map((g) => (
				<GroupCard key={g.id} group={g} />
			))}
		</div>
	);
}

function GroupCard({ group }: { group: { id: string; name: string; description: string | null; isDefault: boolean; memberCount: number; members: Array<{ id: string; commodity: { slug: string; name: string; unit: string }; notes: string | null }> } }) {
	return (
		<div className="rounded-lg bg-card shadow-card dark:shadow-card-dark">
			<div className="px-5 py-3 border-b flex items-center gap-2">
				<Scale className="size-4 text-primary" />
				<span className="font-semibold">{group.name}</span>
				{group.isDefault && <Tag color="primary">Default</Tag>}
				{group.description && (
					<span className="text-xs text-muted-foreground ml-2">{group.description}</span>
				)}
				<span className="ml-auto text-xs text-muted-foreground">
					{group.memberCount} commodit{group.memberCount === 1 ? "y" : "ies"}
				</span>
			</div>
			<div className="p-5">
				{group.members.length > 0 ? (
					<div className="divide-y divide-border">
						{group.members.map((m) => (
							<div key={m.id} className="flex items-center justify-between py-2">
								<div className="flex items-center gap-2">
									<span className="text-sm font-medium">{m.commodity.name}</span>
									<span className="text-xs text-muted-foreground">{m.commodity.unit}</span>
								</div>
								{m.notes && (
									<span className="text-xs text-muted-foreground truncate max-w-[50%]">
										{m.notes}
									</span>
								)}
							</div>
						))}
					</div>
				) : (
					<p className="text-sm text-muted-foreground text-center py-4">No tracked commodities</p>
				)}
			</div>
		</div>
	);
}
