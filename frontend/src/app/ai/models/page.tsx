"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronRight, FlaskConical, TrendingUp, Zap } from "lucide-react";
import { Tag } from "@/components/ui/Tag";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Table } from "@/components/ui/Table";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";

import { PageContainer } from "@/components/layout/PageContainer";
import { useIsMobile } from "@/lib/responsive-utils";

// Check if AI features are disabled
const AI_DISABLED = process.env.NEXT_PUBLIC_AI_DISABLED === 'true';

interface AIModel {
  id: string;
  name: string;
  type: string;
  description: string;
  ainode: boolean;
  useCase?: string;
}

export default function AIModelsPage() {
  const [loading, setLoading] = useState(true);
  const [models, setModels] = useState<AIModel[]>([]);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const toast = useToast();

  const fetchModels = useCallback(async () => {
    setLoading(true);
    setPermissionError(null);
    try {
      const token = (await import('@/lib/tokenManager')).tokenManager.getToken();
      const response = await fetch("/api/iotdb/ai/models", {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!response.ok) {
        const error = await response.json();
        if (response.status === 403 || response.status === 503) {
          setPermissionError(error.error || "AI features are restricted to administrators");
        }
        throw new Error(error.error || "Failed to fetch models");
      }
      const data = await response.json();
      setModels(data.models || []);
    } catch (error: unknown) {
      if (!permissionError) {
        const msg = error instanceof Error ? error.message : "Unknown error";
        toast.showError(`Failed to load models: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.showError, permissionError]);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const totalModels = models.length;

  const columns = [
    {
      key: "id",
      title: "Model ID",
      dataIndex: "id" as keyof AIModel,
      render: (id: string) => (
        <code className="text-xs px-1.5 py-0.5 bg-muted rounded text-foreground">
          {id}
        </code>
      ),
    },
    {
      key: "name",
      title: "Name",
      dataIndex: "name" as keyof AIModel,
      render: (name: string, record: AIModel) => (
        <span className="font-semibold text-foreground">
          {name}
          {record.ainode && (
            <Tag color="info" className="ml-2">
              Built-in
            </Tag>
          )}
        </span>
      ),
    },
    {
      key: "type",
      title: "Type",
      dataIndex: "type" as keyof AIModel,
      render: (type: string) => {
        const color = type === "prediction" ? "success" : "info";
        return <Tag color={color}>{type}</Tag>;
      },
    },
    {
      key: "description",
      title: "Description",
      dataIndex: "description" as keyof AIModel,
    },
    {
      key: "action",
      title: "Action",
      render: (_: string, _record: AIModel) => (
        <Button
          variant="primary"
          size="sm"
          onClick={() => window.location.href = "/forecasts/create"}
        >
          {!isMobile && "Use Model"}
        </Button>
      ),
    },
  ];

  return (
    <PageContainer>
      {/* AI Feature Disabled Warning */}
      {AI_DISABLED && (
        <Alert variant="warning" title="AI Features Temporarily Disabled" className="mb-6">
          AI features including model training and prediction have been temporarily disabled for security reasons. Contact your administrator for more information.
        </Alert>
      )}

      {/* Permission Error Alert */}
      {permissionError && (
        <Alert
          variant="error"
          title="AI Feature Access Restricted"
          closable
          onClose={() => setPermissionError(null)}
          className="mb-6"
        >
          {permissionError.includes("disabled")
            ? "AI features are currently disabled. Please contact your administrator to enable them."
            : "AI model management is only available to administrators. If you are an administrator, please ensure you are logged in with your admin account."}
        </Alert>
      )}

      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
            <a href="/" className="hover:text-primary">Home</a>
            <ChevronRight className="size-3" />
            <a href="/ai" className="hover:text-primary">AI & Anomaly Detection</a>
            <ChevronRight className="size-3" />
            <span>AI Models</span>
          </div>
          <h2 className="text-2xl font-semibold text-foreground">AI Models</h2>
          <p className="text-sm text-muted-foreground mt-1">Built-in AI models for forecasting and prediction</p>
        </div>
        <Button
          variant="primary"
          onClick={fetchModels}
          isLoading={loading}
          disabled={AI_DISABLED}
        >
          {!isMobile && "Refresh"}
        </Button>
      </div>

      {/* Statistics Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className="bg-card rounded-lg border border-gray-200/60 dark:border-gray-700/60 shadow-card-hover-dark p-5">
          <div className="flex items-center mb-3">
            <div className="w-10 h-10 rounded-md bg-primary flex items-center justify-center mr-3">
              <FlaskConical className="size-5 text-white" />
            </div>
            <span className="text-sm font-medium text-muted-foreground">
              Available Models
            </span>
          </div>
          <div className="text-[28px] font-semibold text-foreground data-text">
            {totalModels}
          </div>
          <span className="text-sm text-muted-foreground">
            Built-in AI models
          </span>
        </div>
      </div>

      {/* Models Table */}
      <Card className="mb-6">
        <CardBody className="p-0">
          <Table
            columns={columns}
            dataSource={models}
            rowKey="id"
            loading={loading}
            emptyText="No AI models found"
          />
        </CardBody>
      </Card>

      {/* Info Card */}
      <Card>
        <div className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">About AI Models</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <TrendingUp className="size-6 text-blue-500 mb-2" />
              <h5 className="text-base font-semibold text-foreground mb-2">
                Time Series Forecasting
              </h5>
              <p className="text-sm text-muted-foreground">
                Use built-in ARIMA, FFT, or Neural Network models to generate predictions for your time series data.
              </p>
            </div>
            <div>
              <FlaskConical className="size-6 text-purple-600 mb-2" />
              <h5 className="text-base font-semibold text-foreground mb-2">
                Anomaly Detection
              </h5>
              <p className="text-sm text-muted-foreground">
                Detect anomalies in your data using statistical and machine learning methods.
              </p>
            </div>
            <div>
              <Zap className="size-6 text-primary mb-2" />
              <h5 className="text-base font-semibold text-foreground mb-2">
                IoTDB AI Node
              </h5>
              <p className="text-sm text-muted-foreground">
                Models run directly on IoTDB server for optimal performance.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </PageContainer>
  );
}
