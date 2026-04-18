"use client";

import React from "react";
import {
  ConfigProvider,
  Card,
  Button,
  Row,
  Col,
  Tag,
  Spin,
  message,
} from "antd";
import { CheckOutlined, CrownOutlined } from "@ant-design/icons";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import useSWR from "swr";
import { fetcher } from "@/lib/market-data";

interface Plan {
  id: string;
  name: string;
  price: number;
  features: string[];
}

export default function BillingPage() {
  const { data: plansData } = useSWR<{ success: boolean; data: { plans: Plan[] } }>(
    "/billing/plans",
    fetcher,
  );

  const { data: subData, mutate } = useSWR<{
    success: boolean;
    data: { plan: string; limits: Record<string, number>; planDetails: Plan | undefined };
  }>("/billing/subscription", fetcher);

  const plans = plansData?.data?.plans ?? [];
  const currentPlan = subData?.data?.plan ?? "free";

  const handleUpgrade = async (planId: string) => {
    const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const res = await fetch(`${base}/api/billing/checkout`, {
      method: "POST",
      headers,
      body: JSON.stringify({ planId }),
    });

    if (res.ok) {
      message.success("Plan upgraded!");
      mutate();
    } else {
      message.error("Upgrade failed");
    }
  };

  return (
    <ConfigProvider
      theme={{
        token: { colorPrimary: "#F59E0B" },
      }}
    >
      <PageContainer>
        <PageHeader
          title="Billing"
          description="Manage your subscription plan"
        />

        <Row gutter={[24, 24]} justify="center">
          {plans.map((plan) => {
            const isActive = currentPlan === plan.id;
            return (
              <Col xs={24} sm={12} md={8} key={plan.id}>
                <Card
                  className={isActive ? "ring-2 ring-amber-400" : ""}
                  title={
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{plan.name}</span>
                      {isActive && <Tag color="gold">Current</Tag>}
                      {plan.id === "pro" && (
                        <Tag icon={<CrownOutlined />} color="gold">Popular</Tag>
                      )}
                    </div>
                  }
                >
                  <div className="text-center mb-4">
                    <span className="text-3xl font-bold">${plan.price}</span>
                    <span className="text-gray-400">/month</span>
                  </div>

                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm">
                        <CheckOutlined className="text-green-500" />
                        {f}
                      </li>
                    ))}
                  </ul>

                  {plan.id === "free" ? (
                    <Button block disabled={isActive}>
                      {isActive ? "Current Plan" : "Downgrade"}
                    </Button>
                  ) : (
                    <Button
                      type="primary"
                      block
                      disabled={isActive}
                      onClick={() => handleUpgrade(plan.id)}
                    >
                      {isActive ? "Current Plan" : `Upgrade to ${plan.name}`}
                    </Button>
                  )}
                </Card>
              </Col>
            );
          })}
        </Row>
      </PageContainer>
    </ConfigProvider>
  );
}
