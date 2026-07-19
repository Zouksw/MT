"use client";

import { Check, Crown, Sparkles, Zap } from "lucide-react";
import type React from "react";
import useSWR from "swr";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardBody } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Tag } from "@/components/ui/Tag";
import { fetcher } from "@/lib/market-data";

interface Plan {
	id: string;
	name: string;
	price: number;
	features: string[];
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
	free: <Sparkles className="size-5" />,
	pro: <Zap className="size-5" />,
	enterprise: <Crown className="size-5" />,
};

export default function BillingPage() {
	// Plans + the current subscription are real (GET /billing/plans,
	// /billing/subscription). Checkout is NOT implemented — there is no
	// /api/billing/checkout endpoint — so this page is informational only:
	// it shows the plan tiers and which one the user is on. The previous
	// "Upgrade" button POSTed to a non-existent route and always surfaced a
	// "Payment not yet available" toast. Upgrade/checkout will return when
	// payment integration (Stripe, etc.) is added.
	const { data: plansData } = useSWR<{ success: boolean; data: { plans: Plan[] } }>(
		"/billing/plans",
		fetcher,
	);
	const { data: subData } = useSWR<{ success: boolean; data: { plan: string } }>(
		"/billing/subscription",
		fetcher,
	);

	const plans = plansData?.data?.plans ?? [];
	const currentPlan = subData?.data?.plan ?? "free";

	return (
		<PageContainer>
			<PageHeader
				title="AI Plan"
				description="Choose the right AI features for your analysis needs"
			/>
			<div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 gap-6">
				{plans.map((plan) => {
					const isActive = currentPlan === plan.id;
					const icon = PLAN_ICONS[plan.id] || <Sparkles className="size-5" />;
					return (
						<Card key={plan.id} className={isActive ? "ring-2 ring-primary" : ""}>
							<CardBody>
								<div className="flex items-center justify-between mb-4">
									<div className="flex items-center gap-2">
										<span className="text-primary">{icon}</span>
										<span className="font-semibold">{plan.name}</span>
									</div>
									{isActive && <Tag color="primary">Current</Tag>}
									{plan.id === "pro" && !isActive && <Tag color="warning">Popular</Tag>}
								</div>
								<div className="text-center mb-4">
									<span className="text-3xl font-semibold">${plan.price}</span>
									<span className="text-muted-foreground">/month</span>
								</div>
								<ul className="space-y-2 mb-6">
									{plan.features.map((f) => (
										<li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
											<Check className="size-4 text-primary shrink-0" />
											{f}
										</li>
									))}
								</ul>
								{isActive ? (
									<div className="text-center text-sm font-medium text-primary py-2">
										Your current plan
									</div>
								) : (
									<div className="text-center text-sm text-muted-foreground py-2">
										Contact us to switch
									</div>
								)}
							</CardBody>
						</Card>
					);
				})}
			</div>
		</PageContainer>
	);
}
