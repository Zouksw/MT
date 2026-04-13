"use client";

import { useState } from "react";
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Button,
  message,
  Row,
  Col,
  Descriptions,
  Alert,
  Spin,
  Tag,
  Divider,
} from "antd";

import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import {
  ThunderboltOutlined,
  RocketOutlined,
  CheckCircleOutlined,
  LineChartOutlined,
  ExperimentOutlined,
  WarningOutlined,
} from "@ant-design/icons";

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/ui/PageHeader";
import { ContentCard } from "@/components/layout/ContentCard";
import GlassCard from "@/components/ui/GlassCard";
import { useIsMobile } from "@/lib/responsive-utils";
import dynamic from "next/dynamic";

// Dynamic import for heavy chart component
const PredictionChart = dynamic(
  () => import("@/components/charts/PredictionChart").then(mod => ({ default: mod.PredictionChart })),
  {
    loading: () => (
      <div style={{ padding: "40px", textAlign: "center" }}>
        <Spin size="large" />
      </div>
    ),
    ssr: false,
  }
);

// Check if AI features are disabled
const AI_DISABLED = process.env.NEXT_PUBLIC_AI_DISABLED === 'true';

interface PredictionRequest {
  timeseries: string;
  model: string;
  horizon?: number;
  startTime?: number;
  historyPoints?: number;
}

interface VisualizationResult {
  timeseries: string;
  historical: Array<{ timestamp: number; value: number }>;
  prediction: {
    timestamps: number[];
    values: number[];
    confidence?: number[];
  };
  algorithm: string;
}

export default function AIPredictPage() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VisualizationResult | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<Error | null>(null);
  const isMobile = useIsMobile();

  // AI Node built-in algorithms
  const models = [
    { id: "arima", name: "ARIMA", type: "Classic", description: "Auto-Regressive Integrated Moving Average" },
    { id: "timer_xl", name: "Timer_XL (LSTM)", type: "Deep Learning", description: "Long Short-Term Memory Network" },
    { id: "sundial", name: "Sundial (Transformer)", type: "Deep Learning", description: "Transformer-based Model" },
    { id: "holtwinters", name: "Holt-Winters", type: "Classic", description: "Triple Exponential Smoothing" },
    { id: "exponential_smoothing", name: "Exponential Smoothing", type: "Classic", description: "Simple Exponential Smoothing" },
    { id: "naive_forecaster", name: "Naive Forecaster", type: "Baseline", description: "Naive Prediction Method" },
    { id: "stl_forecaster", name: "STL Forecaster", type: "Decomposition", description: "STL Decomposition Forecast" },
  ];

  const handlePredict = async (values: PredictionRequest) => {
    setLoading(true);
    setResult(null);
    setPermissionError(null);
    setApiError(null);

    try {
      const response = await fetch("/api/iotdb/ai/predict/visualize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timeseries: values.timeseries,
          algorithm: values.model,
          horizon: values.horizon || 10,
          historyPoints: values.historyPoints || 50,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 403 || response.status === 503) {
          setPermissionError(error.error || "AI features are restricted to administrators");
          throw new Error(error.error || "Prediction failed");
        }
        throw new Error(error.error || "Prediction failed");
      }

      const data = await response.json();
      setResult(data);
      setApiError(null);
      message.success(`Prediction completed! Generated ${data.prediction?.values?.length || 0} data points.`);
    } catch (error: any) {
      setApiError(error instanceof Error ? error : new Error(error.message || "Prediction failed"));
      if (!permissionError) {
        message.error(`Prediction failed: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const breadcrumbItems = [
    { title: "Home", href: "/" },
    { title: "AI & Anomaly Detection", href: "/ai" },
    { title: "AI Prediction" },
  ];

  return (
    <PageContainer>
      {/* AI Feature Disabled Warning */}
      {AI_DISABLED && (
        <Alert
          message="AI Features Temporarily Disabled"
          description="AI prediction features have been temporarily disabled for security reasons. Contact your administrator for more information."
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: isMobile ? 16 : 24 }}
          closable
        />
      )}

      {/* Permission Error Alert */}
      {permissionError && (
        <Alert
          message="AI Feature Access Restricted"
          description={
            permissionError.includes("disabled")
              ? "AI features are currently disabled. Please contact your administrator to enable them."
              : "AI prediction features are only available to administrators. If you are an administrator, please ensure you are logged in with your admin account."
          }
          type="error"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: isMobile ? 16 : 24 }}
          closable
          onClose={() => setPermissionError(null)}
        />
      )}

      <PageHeader
        title="AI Prediction"
        description="Generate single-time predictions using AI models"
        breadcrumbs={breadcrumbItems}
        actions={
          <Button
            icon={<ExperimentOutlined />}
            onClick={() => {
              window.location.href = "/ai/models";
            }}
            disabled={AI_DISABLED}
          >
            {!isMobile && "View Models"}
          </Button>
        }
      />

      <Row gutter={[isMobile ? 16 : 24, isMobile ? 16 : 24]}>
        {/* Left Column - Prediction Form */}
        <Col xs={24} lg={10}>
          <ContentCard
            title="Configuration"
            subtitle={<span style={{ fontSize: 13 }}>Set prediction parameters</span>}
            style={{ padding: isMobile ? 16 : 24 }}
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handlePredict}
              initialValues={{
                timeseries: "root.test2",
                model: "arima",
                horizon: 10,
              }}
            >
              <Form.Item
                label="Time Series Path"
                name="timeseries"
                rules={[{ required: true, message: "Please enter time series path" }]}
                tooltip="The path of the time series to predict"
              >
                <Input
                  placeholder="e.g., root.test2"
                  prefix={<LineChartOutlined style={{ color: "#bfbfbf" }} />}
                />
              </Form.Item>

              <Form.Item
                label="AI Model"
                name="model"
                rules={[{ required: true, message: "Please select a model" }]}
                tooltip="Choose the AI model for prediction"
              >
                <Select>
                  {models.map((model) => (
                    <Select.Option key={model.id} value={model.id}>
                      <div>
                        <div style={{ fontWeight: 500 }}>{model.name}</div>
                        <div style={{ fontSize: 12, color: "#999" }}>
                          {model.type} - {model.description}
                        </div>
                      </div>
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label="Prediction Horizon"
                name="horizon"
                rules={[{ required: true, message: "Please enter horizon" }]}
                tooltip="Number of data points to predict ahead"
              >
                <InputNumber
                  min={1}
                  max={1000}
                  step={1}
                  style={{ width: "100%" }}
                  placeholder="e.g., 10"
                />
              </Form.Item>

              <Form.Item
                label="Start Time (Optional)"
                name="startTime"
                tooltip="Timestamp to start prediction from (defaults to last data point)"
              >
                <InputNumber
                  min={0}
                  style={{ width: "100%" }}
                  placeholder="Unix timestamp in milliseconds"
                />
              </Form.Item>

              <Form.Item
                label="Historical Data Points"
                name="historyPoints"
                tooltip="Number of historical data points to display on chart"
              >
                <InputNumber
                  min={10}
                  max={500}
                  step={10}
                  style={{ width: "100%" }}
                  placeholder="e.g., 50"
                />
              </Form.Item>

              <Divider style={{ margin: "16px 0" }} />

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  loading={loading}
                  size="large"
                  block
                  icon={<RocketOutlined />}
                  style={{
                    background: "#171717",
                    border: "none",
                    borderRadius: 3,
                    fontWeight: 600,
                    height: "48px",
                  }}
                >
                  Generate Prediction
                </Button>
              </Form.Item>
            </Form>
          </ContentCard>

          {/* Model Info Card */}
          <GlassCard
            intensity="light"
            style={{ marginTop: isMobile ? 16 : 24, padding: isMobile ? "16px" : "20px" }}
          >
            <div style={{ marginBottom: 16 }}>
              <ThunderboltOutlined style={{ marginRight: 8, color: "#0a72ef" }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>About AI Prediction</span>
            </div>
            <div style={{ fontSize: 13, color: "#64748b", lineHeight: "1.6" }}>
              <p style={{ margin: "0 0 8px 0" }}>
                AI prediction uses machine learning models to forecast future values based on
                historical time series data from IoTDB.
              </p>
              <p style={{ margin: "0 0 8px 0" }}>
                <strong>AI Node Built-in Algorithms:</strong>
              </p>
              <ul style={{ margin: 0, paddingLeft: 16 }}>
                <li>
                  <strong>ARIMA:</strong> Classic statistical method for time series forecasting
                </li>
                <li>
                  <strong>Timer_XL (LSTM):</strong> Long Short-Term Memory for complex patterns
                </li>
                <li>
                  <strong>Sundial (Transformer):</strong> Transformer-based for complex time patterns
                </li>
                <li>
                  <strong>Holt-Winters:</strong> Triple exponential smoothing for trend and seasonality
                </li>
              </ul>
            </div>
          </GlassCard>
        </Col>

        {/* Right Column - Results */}
        <Col xs={24} lg={14}>
          <LoadingState
            loading={loading}
            skeletonType="card"
            timeout={30000}
            onTimeout={() => {
              setLoading(false);
              setApiError(new Error("Prediction request timed out. The model may be processing heavy data."));
            }}
          >
            {apiError && (
              <ErrorDisplay
                error={apiError}
                retry={() => form.submit()}
                context="AI Prediction"
              />
            )}

            {result && (
              <>
                {/* Success Alert */}
                <Alert
                  message="Prediction Completed Successfully"
                  description={`Generated ${result.prediction.values.length} predictions using ${result.algorithm} model`}
                  type="success"
                  showIcon
                  icon={<CheckCircleOutlined />}
                  style={{ marginBottom: isMobile ? 16 : 24 }}
                />

                {/* Prediction Chart */}
                <PredictionChart
                  timeseries={result.timeseries}
                  historicalData={result.historical}
                  predictionData={result.prediction}
                  algorithm={result.algorithm}
                  onExport={(_format) => {
                    // Export handled by PredictionChart component
                  }}
                />

                {/* Model Information */}
                <ContentCard
                  title="Model Information"
                  style={{ marginTop: 24 }}
                >
                  <Descriptions bordered column={2} size="small">
                    <Descriptions.Item label="Algorithm" span={2}>
                      <Tag color="purple" icon={<ExperimentOutlined />}>
                        {result.algorithm.toUpperCase()}
                      </Tag>
                      <Tag color="blue" style={{ marginLeft: 8 }}>
                        AI Node
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="Time Series" span={2}>
                      {result.timeseries}
                    </Descriptions.Item>
                    <Descriptions.Item label="Historical Points" span={1}>
                      {result.historical.length}
                    </Descriptions.Item>
                    <Descriptions.Item label="Prediction Points" span={1}>
                      {result.prediction.values.length}
                    </Descriptions.Item>
                  </Descriptions>
                </ContentCard>

                {/* Action Buttons */}
                <Card style={{ marginTop: 24, borderRadius: 4 }}>
                  <Button
                    type="primary"
                    size="large"
                    block
                    icon={<LineChartOutlined />}
                    onClick={() => {
                      // Navigate to create forecast with these predictions
                      window.location.href = "/forecasts/create";
                    }}
                  >
                    Save as Forecast
                  </Button>
                </Card>
              </>
            )}

            {!loading && !result && !apiError && (
              <ContentCard style={{ textAlign: "center", padding: "60px 20px" }}>
                <div
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: "50%",
                    background: "#F3F4F6",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 20px",
                  }}
                >
                  <RocketOutlined style={{ fontSize: 32, color: "#9ca3af" }} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 8 }}>
                  Ready to Predict
                </div>
                <div style={{ color: "#6b7280", fontSize: 13 }}>
                  Configure your prediction parameters and click &quot;Generate Prediction&quot; to start.
                </div>
              </ContentCard>
            )}
          </LoadingState>
        </Col>
      </Row>
    </PageContainer>
  );
}
