"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardBody } from "@/components/ui/Card";
import { Tag } from "@/components/ui/Tag";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { ChevronRight, Zap } from "lucide-react";

import { PageContainer } from "@/components/layout/PageContainer";
import { LoadingState } from "@/components/ui/LoadingState";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { useIsMobile } from "@/lib/responsive-utils";
import dynamic from "next/dynamic";

// Dynamic import for heavy chart component
const PredictionChart = dynamic(
  () => import("@/components/charts/PredictionChart").then(mod => ({ default: mod.PredictionChart })),
  {
    loading: () => (
      <div className="py-10 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    ),
    ssr: false,
  }
);

// Check if AI features are disabled
const AI_DISABLED = process.env.NEXT_PUBLIC_AI_DISABLED === 'true';

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
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VisualizationResult | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [apiError, setApiError] = useState<Error | null>(null);
  const isMobile = useIsMobile();
  const toast = useToast();

  // Form state
  const [formTimeseries, setFormTimeseries] = useState("root.test2");
  const [formModel, setFormModel] = useState("arima");
  const [formHorizon, setFormHorizon] = useState("10");
  const [formStartTime, setFormStartTime] = useState("");
  const [formHistoryPoints, setFormHistoryPoints] = useState("50");

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  const modelOptions = models.map((model) => ({
    value: model.id,
    label: `${model.name} — ${model.type} - ${model.description}`,
  }));

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formTimeseries.trim()) newErrors.timeseries = "Please enter time series path";
    if (!formModel) newErrors.model = "Please select a model";
    const horizon = parseInt(formHorizon, 10);
    if (!formHorizon || Number.isNaN(horizon) || horizon < 1) newErrors.horizon = "Please enter a valid horizon (min 1)";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handlePredict = async () => {
    if (!validate()) return;

    setLoading(true);
    setResult(null);
    setPermissionError(null);
    setApiError(null);

    try {
      const token = (await import('@/lib/tokenManager')).tokenManager.getToken();
      const response = await fetch("/api/iotdb/ai/predict/visualize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          timeseries: formTimeseries,
          algorithm: formModel,
          horizon: parseInt(formHorizon, 10) || 10,
          ...(formStartTime ? { startTime: parseInt(formStartTime, 10) } : {}),
          historyPoints: parseInt(formHistoryPoints, 10) || 50,
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
      toast.showSuccess(`Prediction completed! Generated ${data.prediction?.values?.length || 0} data points.`);
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Prediction failed";
      setApiError(error instanceof Error ? error : new Error(msg));
      if (!permissionError) {
        toast.showError(`Prediction failed: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      {/* AI Feature Disabled Warning */}
      {AI_DISABLED && (
        <Alert variant="warning" title="AI Features Temporarily Disabled" closable className="mb-6">
          AI prediction features have been temporarily disabled for security reasons. Contact your administrator for more information.
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
            : "AI prediction features are only available to administrators. If you are an administrator, please ensure you are logged in with your admin account."}
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
            <span>AI Prediction</span>
          </div>
          <h2 className="text-2xl font-semibold text-foreground">AI Prediction</h2>
          <p className="text-sm text-muted-foreground mt-1">Generate single-time predictions using AI models</p>
        </div>
        <Button
          variant="ghost"
          onClick={() => { window.location.href = "/ai/models"; }}
          disabled={AI_DISABLED}
        >
          {!isMobile && "View Models"}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column - Prediction Form */}
        <div className="lg:col-span-5">
          <div className="bg-card rounded-lg shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px] mb-6">
            <div className="p-6">
              <div className="text-lg font-semibold text-foreground flex items-center gap-2 mb-1">
                <span className="w-2 h-2 rounded-full bg-[#171717] dark:bg-gray-400 flex-shrink-0" />
                Configuration
              </div>
              <div className="text-sm text-muted-foreground mb-4">Set prediction parameters</div>

              <div className="space-y-4">
                <Input
                  label="Time Series Path"
                  placeholder="e.g., root.test2"
                  value={formTimeseries}
                  onChange={(e) => setFormTimeseries(e.target.value)}
                  error={errors.timeseries}
                  fullWidth
                />

                <Select
                  label="AI Model"
                  options={modelOptions}
                  value={formModel}
                  onChange={(val) => setFormModel(val)}
                  error={errors.model}
                  fullWidth
                />

                <Input
                  label="Prediction Horizon"
                  type="number"
                  placeholder="e.g., 10"
                  value={formHorizon}
                  onChange={(e) => setFormHorizon(e.target.value)}
                  error={errors.horizon}
                  fullWidth
                />

                <Input
                  label="Start Time (Optional)"
                  type="number"
                  placeholder="Unix timestamp in milliseconds"
                  value={formStartTime}
                  onChange={(e) => setFormStartTime(e.target.value)}
                  helperText="Timestamp to start prediction from (defaults to last data point)"
                  fullWidth
                />

                <Input
                  label="Historical Data Points"
                  type="number"
                  placeholder="e.g., 50"
                  value={formHistoryPoints}
                  onChange={(e) => setFormHistoryPoints(e.target.value)}
                  helperText="Number of historical data points to display on chart"
                  fullWidth
                />

                <hr className="border my-4" />

                <Button
                  variant="primary"
                  size="lg"
                  fullWidth
                  isLoading={loading}
                  onClick={handlePredict}
                >
                  Generate Prediction
                </Button>
              </div>
            </div>
          </div>

          {/* About AI Prediction Card */}
          <div className="bg-card rounded-lg border border-white/10 dark:border-white/5 shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px] p-5">
            <div className="mb-4 flex items-center gap-2">
              {/* Thunderbolt icon */}
              <Zap className="size-4 text-primary" />
              <span className="font-semibold text-sm text-foreground">About AI Prediction</span>
            </div>
            <div className="text-[13px] text-muted-foreground leading-relaxed">
              <p className="mb-2">
                AI prediction uses machine learning models to forecast future values based on
                historical time series data from IoTDB.
              </p>
              <p className="mb-2">
                <strong className="text-foreground">AI Node Built-in Algorithms:</strong>
              </p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong className="text-foreground">ARIMA:</strong> Classic statistical method for time series forecasting</li>
                <li><strong className="text-foreground">Timer_XL (LSTM):</strong> Long Short-Term Memory for complex patterns</li>
                <li><strong className="text-foreground">Sundial (Transformer):</strong> Transformer-based for complex time patterns</li>
                <li><strong className="text-foreground">Holt-Winters:</strong> Triple exponential smoothing for trend and seasonality</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right Column - Results */}
        <div className="lg:col-span-7">
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
                retry={handlePredict}
                context="AI Prediction"
              />
            )}

            {result && (
              <>
                {/* Success Alert */}
                <Alert variant="success" title="Prediction Completed Successfully" className="mb-6">
                  Generated {result.prediction.values.length} predictions using {result.algorithm} model
                </Alert>

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
                <div className="bg-card rounded-lg shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px] mt-6 mb-6">
                  <div className="p-6">
                    <div className="text-lg font-semibold text-foreground flex items-center gap-2 mb-4">
                      <span className="w-2 h-2 rounded-full bg-[#171717] dark:bg-gray-400 flex-shrink-0" />
                      Model Information
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="sm:col-span-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Algorithm</span>
                        <div className="mt-1 flex items-center gap-2">
                          <Tag color="info">{result.algorithm.toUpperCase()}</Tag>
                          <Tag color="info">AI Node</Tag>
                        </div>
                      </div>
                      <div className="sm:col-span-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Time Series</span>
                        <div className="mt-1 text-sm text-foreground">{result.timeseries}</div>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Historical Points</span>
                        <div className="mt-1 text-sm text-foreground">{result.historical.length}</div>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Prediction Points</span>
                        <div className="mt-1 text-sm text-foreground">{result.prediction.values.length}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <Card className="mt-6">
                  <CardBody>
                    <Button
                      variant="primary"
                      size="lg"
                      fullWidth
                      onClick={() => {
                        window.location.href = "/forecasts/create";
                      }}
                    >
                      Save as Forecast
                    </Button>
                  </CardBody>
                </Card>
              </>
            )}

            {!loading && !result && !apiError && (
              <div className="bg-card rounded-lg shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px] text-center py-16 px-5">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-5">
                  {/* Rocket icon */}
                  <Zap className="size-8 text-gray-400" />
                </div>
                <div className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-2">Ready to Predict</div>
                <div className="text-[13px] text-muted-foreground">
                  Configure your prediction parameters and click &quot;Generate Prediction&quot; to start.
                </div>
              </div>
            )}
          </LoadingState>
        </div>
      </div>
    </PageContainer>
  );
}
