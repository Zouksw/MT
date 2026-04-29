"use client";

import { useParams } from "next/navigation";
import { ArrowLeft, Target, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { useModelDetail } from "@/hooks/useModelDetail";
import { BacktestDetailChart } from "@/components/charts/BacktestDetailChart";
import { MODEL_NAME_MAP, MODEL_COLORS } from "@/types/accuracy";

function TrendBadge({ trend }: { trend: string }) {
  switch (trend) {
    case "improving":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
          <TrendingUp className="size-3.5" /> Improving
        </span>
      );
    case "degrading":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
          <TrendingDown className="size-3.5" /> Degrading
        </span>
      );
    case "stable":
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
          <Minus className="size-3.5" /> Stable
        </span>
      );
    default:
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-800 text-gray-500">
          Insufficient data
        </span>
      );
  }
}

export default function ModelDetailPage() {
  const params = useParams();
  const modelId = params.modelId as string;
  const displayName = MODEL_NAME_MAP[modelId] || modelId;
  const modelColor = MODEL_COLORS[modelId] || "#6B7280";

  const { backtest, predictions, totalPredictions, loading, error, retry } =
    useModelDetail(modelId);

  if (error) {
    return (
      <PageContainer>
        <PageHeader
          title={displayName}
          description="Model prediction accuracy details"
          breadcrumbs={[
            { label: "Home", href: "/dashboard" },
            { label: "AI", href: "/ai/models" },
            { label: "Accuracy", href: "/ai/accuracy" },
            { label: displayName },
          ]}
        />
        <ErrorDisplay error={error} retry={retry} context="model detail" />
      </PageContainer>
    );
  }

  const _bestWindow = backtest?.windows?.find((w) => w.mape !== null);
  const window7 = backtest?.windows?.find((w) => w.days === 7);
  const window30 = backtest?.windows?.find((w) => w.days === 30);
  const window90 = backtest?.windows?.find((w) => w.days === 90);

  return (
    <PageContainer>
      <PageHeader
        title={displayName}
        description="Model prediction accuracy details"
        breadcrumbs={[
          { label: "Home", href: "/dashboard" },
          { label: "AI", href: "/ai/models" },
          { label: "Accuracy", href: "/ai/accuracy" },
          { label: displayName },
        ]}
        actions={
          <Link
            href="/ai/accuracy"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Accuracy
          </Link>
        }
      />

      <LoadingState loading={loading} skeletonType="stats">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            title="7-Day MAPE"
            value={window7?.mape !== null && window7?.mape !== undefined ? Number(window7.mape.toFixed(1)) : "--"}
            icon={<Target className="size-5" />}
            variant={window7?.mape != null && window7.mape < 5 ? "success" : "primary"}
          />
          <StatCard
            title="30-Day MAPE"
            value={window30?.mape !== null && window30?.mape !== undefined ? Number(window30.mape.toFixed(1)) : "--"}
            icon={<BarChart3 className="size-5" />}
            variant="default"
          />
          <StatCard
            title="90-Day MAPE"
            value={window90?.mape !== null && window90?.mape !== undefined ? Number(window90.mape.toFixed(1)) : "--"}
            icon={<BarChart3 className="size-5" />}
            variant="default"
          />
          <StatCard
            title="Trend"
            value={backtest?.trend ? displayName : "--"}
            icon={<TrendingUp className="size-5" />}
            variant={backtest?.trend === "improving" ? "success" : backtest?.trend === "degrading" ? "error" : "default"}
          />
        </div>
      </LoadingState>

      {backtest && (
        <LoadingState loading={loading} skeletonType="card">
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Backtest Windows</CardTitle>
                <TrendBadge trend={backtest.trend} />
              </div>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {backtest.windows.map((w) => (
                  <div
                    key={w.days}
                    className="bg-muted/50 rounded-lg p-4 text-center"
                  >
                    <p className="text-xs text-muted-foreground mb-1">{w.days}-Day Window</p>
                    <p
                      className="text-2xl font-semibold"
                      style={{ color: modelColor }}
                    >
                      {w.mape !== null ? `${w.mape.toFixed(1)}%` : "N/A"}
                    </p>
                    <div className="mt-2 flex justify-center gap-3 text-xs text-muted-foreground">
                      <span>{w.predictionCount} predictions</span>
                      <span>{w.verifiedCount} verified</span>
                    </div>
                  </div>
                ))}
              </div>
              {backtest.trendDescription && (
                <p className="mt-3 text-xs text-muted-foreground text-center">
                  {backtest.trendDescription}
                </p>
              )}
            </CardBody>
          </Card>
        </LoadingState>
      )}

      <LoadingState loading={loading} skeletonType="card">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Prediction History
              {totalPredictions > 0 && (
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  ({totalPredictions} total)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardBody>
            {predictions.length === 0 ? (
              <EmptyState
                type="data"
                title="No verified predictions yet"
                description="Prediction records will appear here once this model has verified predictions with actual values."
              />
            ) : (
              <div className="flex flex-col gap-6">
                {predictions.map((pred) => (
                  <div key={pred.id} className="border border-border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-foreground">
                          {pred.commodityId}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Horizon: {pred.horizon} steps
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        {pred.mape !== null && (
                          <span className={`text-sm font-medium ${
                            pred.mape < 5 ? "text-green-600 dark:text-green-400" :
                            pred.mape < 10 ? "text-amber-600 dark:text-amber-400" :
                            "text-red-600 dark:text-red-400"
                          }`}>
                            MAPE: {pred.mape.toFixed(1)}%
                          </span>
                        )}
                        {pred.confidence !== null && (
                          <Badge variant="info">
                            {(pred.confidence * 100).toFixed(0)}% conf.
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(pred.predictedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <BacktestDetailChart prediction={pred} />
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </LoadingState>
    </PageContainer>
  );
}
