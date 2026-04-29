"use client";

import type React from "react";
import { Check, Sparkles, Zap, Crown } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Card, CardBody } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import useSWR from "swr";
import { fetcher } from "@/lib/market-data";

interface Plan { id: string; name: string; price: number; features: string[] }

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free: <Sparkles className="size-5" />,
  pro: <Zap className="size-5" />,
  enterprise: <Crown className="size-5" />,
};

export default function BillingPage() {
  const toast = useToast();
  const { data: plansData } = useSWR<{ success: boolean; data: { plans: Plan[] } }>("/billing/plans", fetcher);
  const { data: subData, mutate } = useSWR<{ success: boolean; data: { plan: string } }>("/billing/subscription", fetcher);

  const plans = plansData?.data?.plans ?? [];
  const currentPlan = subData?.data?.plan ?? "free";

  const handleUpgrade = async (planId: string) => {
    const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const res = await fetch(`${base}/api/billing/checkout`, { method: "POST", headers, body: JSON.stringify({ planId }) });

    if (res.ok) {
      toast.showSuccess("Plan upgraded!");
      mutate();
    } else {
      toast.showError("Payment not yet available — coming soon");
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="AI Plan"
        description="Choose the right AI features for your analysis needs"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
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
                  <span className="text-3xl font-bold">${plan.price}</span>
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
                {plan.id === "free" ? (
                  <Button fullWidth disabled={isActive}>
                    {isActive ? "Current Plan" : "Downgrade"}
                  </Button>
                ) : (
                  <Button fullWidth variant="primary" disabled={isActive} onClick={() => handleUpgrade(plan.id)}>
                    {isActive ? "Current Plan" : `Upgrade to ${plan.name}`}
                  </Button>
                )}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
}
