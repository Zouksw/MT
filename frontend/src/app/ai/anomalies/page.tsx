"use client";

import { useState } from "react";
import { TriangleAlert, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Tag } from "@/components/ui/Tag";
import { Table } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";

import { PageContainer } from "@/components/layout/PageContainer";
import { StatCard } from "@/components/ui/StatCard";
import dynamic from "next/dynamic";

// Dynamic import for heavy chart component
const AnomalyChart = dynamic(
  () => import("@/components/charts/AnomalyChart").then(mod => ({ default: mod.AnomalyChart })),
  {
    loading: () => (
      <div className="py-10 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    ),
    ssr: false,
  }
);

interface Anomaly {
  timestamp: number;
  value: number;
  score: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

interface VisualizationResult {
  timeseries: string;
  historical: Array<{ timestamp: number; value: number }>;
  anomalies: Anomaly[];
  statistics: {
    total: number;
    bySeverity: Record<string, number>;
  };
  method: string;
}

const SEVERITY_TAG_COLORS: Record<string, "success" | "warning" | "error" | "info"> = {
  LOW: "success",
  MEDIUM: "warning",
  HIGH: "error",
  CRITICAL: "info",
};

export default function AIAnomaliesPage() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VisualizationResult | null>(null);
  const [_apiError, setApiError] = useState<string | null>(null);
  const toast = useToast();

  // Form state
  const [formTimeseries, setFormTimeseries] = useState("root.test2");
  const [formThreshold, setFormThreshold] = useState("2.5");
  const [formMethod, setFormMethod] = useState("statistical");
  const [formHistoryPoints, setFormHistoryPoints] = useState("100");

  // Validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  const methodOptions = [
    { value: "statistical", label: "Statistical (Z-score)" },
    { value: "ml", label: "Machine Learning" },
    { value: "stray", label: "STRAY Algorithm" },
  ];

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formTimeseries.trim()) newErrors.timeseries = "Please enter time series path";
    const threshold = parseFloat(formThreshold);
    if (!formThreshold || Number.isNaN(threshold) || threshold < 0) newErrors.threshold = "Please enter a valid threshold";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleDetect = async () => {
    if (!validate()) return;

    setLoading(true);
    setResult(null);
    setApiError(null);

    try {
      const token = (await import('@/lib/tokenManager')).tokenManager.getToken();
      const response = await fetch("/api/iotdb/ai/anomalies/visualize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          timeseries: formTimeseries,
          threshold: parseFloat(formThreshold),
          method: formMethod || "statistical",
          historyPoints: parseInt(formHistoryPoints, 10) || 100,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Detection failed");
      }

      const data = await response.json();
      setResult(data);
      toast.showSuccess(`Detection completed! Found ${data.statistics.total} anomalies.`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Detection failed";
      setApiError(msg);
      toast.showError(`Detection failed: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleString();
  };

  const columns = [
    {
      key: "severity",
      title: "Severity",
      dataIndex: "severity" as keyof Anomaly,
      render: (severity: string) => (
        <Tag color={SEVERITY_TAG_COLORS[severity] || "default"}>
          {severity}
        </Tag>
      ),
    },
    {
      key: "timestamp",
      title: "Timestamp",
      dataIndex: "timestamp" as keyof Anomaly,
      render: (ts: number) => formatTimestamp(ts),
    },
    {
      key: "value",
      title: "Value",
      dataIndex: "value" as keyof Anomaly,
      align: "right" as const,
      render: (val: number) => (
        <span className="data-text text-[13px] text-foreground">
          {val.toFixed(2)}
        </span>
      ),
    },
    {
      key: "score",
      title: "Anomaly Score",
      dataIndex: "score" as keyof Anomaly,
      align: "right" as const,
      render: (score: number) => (
        <span
          className="font-semibold data-text"
          style={{
            color:
              score > 4
                ? "#EF4444"
                : score > 3
                ? "#F59E0B"
                : score > 2
                ? "#B8860B"
                : "#10B981",
          }}
        >
          {score.toFixed(4)}
        </span>
      ),
    },
  ];

  return (
    <PageContainer>
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">AI Anomaly Detection</h2>
          <p className="text-sm text-muted-foreground mt-1">Detect anomalies in your time series data using AI</p>
        </div>
      </div>

      {/* Detection Configuration Form */}
      <div className="bg-card rounded-lg shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px] mb-6">
        <div className="p-6">
          <div className="text-lg font-semibold text-foreground flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-[#171717] dark:bg-gray-400 shrink-0" />
            Detection Configuration
          </div>
          <div className="text-sm text-muted-foreground mb-4">Powered by AI Node</div>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Time Series Path"
                placeholder="e.g., root.test2"
                value={formTimeseries}
                onChange={(e) => setFormTimeseries(e.target.value)}
                error={errors.timeseries}
                fullWidth
              />
              <Input
                label="Threshold (Z-score)"
                type="number"
                placeholder="e.g., 2.5"
                value={formThreshold}
                onChange={(e) => setFormThreshold(e.target.value)}
                error={errors.threshold}
                helperText="Values with Z-score above this threshold will be flagged as anomalies"
                fullWidth
              />
            </div>

            <Select
              label="Detection Method"
              options={methodOptions}
              value={formMethod}
              onChange={(val) => setFormMethod(val)}
              fullWidth
            />

            <Input
              label="Historical Data Points"
              type="number"
              placeholder="e.g., 100"
              value={formHistoryPoints}
              onChange={(e) => setFormHistoryPoints(e.target.value)}
              helperText="Number of historical data points to display on chart"
              fullWidth
            />

            <Button
              variant="primary"
              size="lg"
              isLoading={loading}
              onClick={handleDetect}
            >
              Detect Anomalies
            </Button>
          </div>
        </div>
      </div>

      {loading && (
        <div className="bg-card rounded-lg shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px] p-6 mb-6 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground mt-3">Detecting anomalies...</p>
        </div>
      )}

      {result && (
        <>
          {/* Anomaly Chart */}
          <AnomalyChart
            timeseries={result.timeseries}
            historicalData={result.historical}
            anomalies={result.anomalies}
            method={result.method}
            onExport={(_format) => {
              // Export handled by AnomalyChart component
            }}
          />

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-6 mb-6">
            <StatCard
              title="Total Anomalies"
              value={result.statistics.total}
              icon={
                <TriangleAlert className="size-5" />
              }
              variant={result.statistics.total > 0 ? "warning" : "success"}
            />
            {result.statistics.bySeverity.CRITICAL !== undefined && (
              <StatCard
                title="Critical"
                value={result.statistics.bySeverity.CRITICAL || 0}
                icon={
                  <AlertCircle className="size-5" />
                }
                variant="error"
              />
            )}
            {result.statistics.bySeverity.HIGH !== undefined && (
              <StatCard
                title="High Severity"
                value={result.statistics.bySeverity.HIGH || 0}
                icon={
                  <TriangleAlert className="size-5" />
                }
                variant="error"
              />
            )}
          </div>

          {/* Anomaly Details Table */}
          <div className="bg-card rounded-lg shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px] mb-6">
            <div className="p-6">
              <div className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                <span className="w-2 h-2 rounded-full bg-[#171717] dark:bg-gray-400 shrink-0" />
                Anomaly Details
              </div>
              <Table
                columns={columns}
                dataSource={result.anomalies}
                rowKey={(record) => `${record.timestamp}-${record.severity}`}
                emptyText="No anomalies detected"
              />
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}
