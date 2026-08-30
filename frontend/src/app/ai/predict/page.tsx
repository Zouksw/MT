"use client";

import { ChevronRight, Zap } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { ErrorDisplay } from "@/components/ui/ErrorDisplay";
import { Input } from "@/components/ui/Input";
import { LoadingState } from "@/components/ui/LoadingState";
import { Select } from "@/components/ui/Select";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { ApiFetchError, apiFetch } from "@/lib/apiFetch";
import { useIsMobile } from "@/lib/responsive-utils";

// Dynamic import for heavy chart component
const PredictionChart = dynamic(
	() =>
		import("@/components/charts/PredictionChart").then((mod) => ({ default: mod.PredictionChart })),
	{
		loading: () => (
			<div className="py-10 text-center">
				<div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
			</div>
		),
		ssr: false,
	},
);

// Check if AI features are disabled
const AI_DISABLED = process.env.NEXT_PUBLIC_AI_DISABLED === "true";

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

/** Engine model row from GET /api/inference/models (single source of truth). */
interface EngineModel {
	id: string;
	name?: string;
	type?: string;
	role?: string;
	description?: string;
	available?: boolean;
}

export default function AIPredictPage() {
	const [loading, setLoading] = useState(false);
	const [result, setResult] = useState<VisualizationResult | null>(null);
	const [permissionError, setPermissionError] = useState<string | null>(null);
	const [apiError, setApiError] = useState<Error | null>(null);
	const isMobile = useIsMobile();
	const toast = useToast();

	// Model list is fetched from the engine (via /api/inference/models) instead
	// of a hardcoded copy — the old static list had already drifted from the
	// engine's callable ids (TECH-DEBT §十四). On fetch failure the select is
	// disabled with an honest notice; a static fallback would re-introduce the
	// drift this batch removes (and a prediction would fail anyway if the
	// engine is unreachable).
	const [engineModels, setEngineModels] = useState<EngineModel[]>([]);
	const [modelsUnavailable, setModelsUnavailable] = useState(false);

	useEffect(() => {
		let cancelled = false;
		apiFetch<{ models?: EngineModel[] }>("/api/inference/models")
			.then((d) => {
				if (!cancelled) setEngineModels(d.models ?? []);
			})
			.catch(() => {
				if (!cancelled) setModelsUnavailable(true);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	// Form state
	// Default series = the platform's only live beef series (IMF global beef
	// benchmark, monthly; slug is accepted, UUID works too). The old default
	// "root.test2" matched no commodity, so the prefilled form always failed
	// with a 400.
	const [formTimeseries, setFormTimeseries] = useState("beef_carcass_us");
	// Default model: chronos_tiny when the engine lists it, else first entry.
	const [formModel, setFormModel] = useState("chronos_tiny");
	const [formHorizon, setFormHorizon] = useState("10");
	const [formStartTime, setFormStartTime] = useState("");
	const [formHistoryPoints, setFormHistoryPoints] = useState("50");

	// Validation state
	const [errors, setErrors] = useState<Record<string, string>>({});

	const selectableModels = useMemo(
		() => engineModels.filter((m) => m.available !== false),
		[engineModels],
	);

	const modelOptions = selectableModels.map((model) => ({
		value: model.id,
		label: `${model.name ?? model.id} — ${model.type ?? "model"}${model.description ? ` - ${model.description}` : ""}`,
	}));

	// Keep the selected model valid against the fetched list.
	useEffect(() => {
		if (selectableModels.length === 0) return;
		if (!selectableModels.some((m) => m.id === formModel)) {
			setFormModel(selectableModels[0].id);
		}
	}, [selectableModels, formModel]);

	const validate = (): boolean => {
		const newErrors: Record<string, string> = {};
		if (!formTimeseries.trim()) newErrors.timeseries = "Please enter time series path";
		if (!formModel) newErrors.model = "Please select a model";
		const horizon = parseInt(formHorizon, 10);
		if (!formHorizon || Number.isNaN(horizon) || horizon < 1)
			newErrors.horizon = "Please enter a valid horizon (min 1)";
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
			const data = await apiFetch<{ data?: VisualizationResult }>(
				"/api/inference/predict/visualize",
				{
					method: "POST",
					body: JSON.stringify({
						commodityId: formTimeseries,
						algorithm: formModel,
						horizon: parseInt(formHorizon, 10) || 10,
						...(formStartTime ? { startTime: parseInt(formStartTime, 10) } : {}),
						historyPoints: parseInt(formHistoryPoints, 10) || 50,
					}),
				},
			);

			setResult(data.data ?? null);
			setApiError(null);
			toast.showSuccess(
				`Prediction completed! Generated ${data.data?.prediction?.values?.length || 0} data points.`,
			);
		} catch (error: unknown) {
			const msg = error instanceof Error && error.message ? error.message : "Prediction failed";
			// 403/503 are access-gate rejections (tier gate / inference down) —
			// show them in the dedicated permission banner, not just the toast.
			if (error instanceof ApiFetchError && (error.status === 403 || error.status === 503)) {
				setPermissionError(msg);
			}
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
					AI prediction features have been temporarily disabled for security reasons. Contact your
					administrator for more information.
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
						<a href="/" className="hover:text-primary">
							Home
						</a>
						<ChevronRight className="size-3" />
						<a href="/ai/accuracy" className="hover:text-primary">
							AI
						</a>
						<ChevronRight className="size-3" />
						<span>AI Prediction</span>
					</div>
					<h1 className="text-2xl font-semibold text-foreground">AI Prediction</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Generate single-time predictions using AI models
					</p>
				</div>
				<Button
					variant="ghost"
					onClick={() => {
						window.location.href = "/ai/accuracy";
					}}
					disabled={AI_DISABLED}
				>
					{!isMobile && "Model Accuracy"}
				</Button>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
				{/* Left Column - Prediction Form */}
				<div className="lg:col-span-5">
					<div className="bg-card rounded-lg shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px] mb-6">
						<div className="p-6">
							<div className="text-lg font-semibold text-foreground flex items-center gap-2 mb-1">
								<span className="w-2 h-2 rounded-full bg-gray-900 dark:bg-gray-400 flex-shrink-0" />
								Configuration
							</div>
							<div className="text-sm text-muted-foreground mb-4">Set prediction parameters</div>

							<div className="space-y-4">
								<Input
									label="Time Series Path"
									placeholder="e.g., beef_carcass_us"
									value={formTimeseries}
									onChange={(e) => setFormTimeseries(e.target.value)}
									error={errors.timeseries}
									helperText="Commodity slug or UUID"
									fullWidth
								/>

								{modelsUnavailable ? (
									<Alert variant="warning" title="Model list unavailable">
										Could not reach the inference engine to list callable models. Prediction would
										fail too — retry once the service is reachable.
									</Alert>
								) : (
									<Select
										label="AI Model"
										options={modelOptions}
										value={formModel}
										onChange={(val) => setFormModel(val)}
										error={errors.model}
										fullWidth
									/>
								)}

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
								historical time series data from PostgreSQL.
							</p>
							<p className="mb-2">
								<strong className="text-foreground">Model engine:</strong>
							</p>
							<ul className="list-disc pl-4 space-y-1">
								<li>
									<strong className="text-foreground">Chronos-T5:</strong> pretrained foundation
									model for zero-shot time series forecasting (3 sizes)
								</li>
								<li>
									<strong className="text-foreground">Statistical baselines:</strong> Naive, ARIMA,
									Holt-Winters, Exponential Smoothing (and more via the list above)
								</li>
								<li>
									<strong className="text-foreground">Quality-weighted consensus:</strong> the
									signal vote weighs each model by its verified MAPE; models verified worse than the
									naive baseline are eliminated from the vote
								</li>
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
							setApiError(
								new Error("Prediction request timed out. The model may be processing heavy data."),
							);
						}}
					>
						{apiError && (
							<ErrorDisplay error={apiError} retry={handlePredict} context="AI Prediction" />
						)}

						{result && (
							<>
								{/* Success Alert */}
								<Alert variant="success" title="Prediction Completed Successfully" className="mb-6">
									Generated {result.prediction?.values?.length ?? 0} predictions using{" "}
									{result.algorithm} model
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
											<span className="w-2 h-2 rounded-full bg-gray-900 dark:bg-gray-400 flex-shrink-0" />
											Model Information
										</div>
										<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
											<div className="sm:col-span-2">
												<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
													Algorithm
												</span>
												<div className="mt-1 flex items-center gap-2">
													<Tag color="info">{result.algorithm.toUpperCase()}</Tag>
													<Tag color="info">AI Node</Tag>
												</div>
											</div>
											<div className="sm:col-span-2">
												<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
													Time Series
												</span>
												<div className="mt-1 text-sm text-foreground">{result.timeseries}</div>
											</div>
											<div>
												<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
													Historical Points
												</span>
												<div className="mt-1 text-sm text-foreground">
													{result.historical.length}
												</div>
											</div>
											<div>
												<span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
													Prediction Points
												</span>
												<div className="mt-1 text-sm text-foreground">
													{result.prediction.values.length}
												</div>
											</div>
										</div>
									</div>
								</div>
							</>
						)}

						{!loading && !result && !apiError && (
							<div className="bg-card rounded-lg shadow-[rgba(0,0,0,0.08)_0px_0px_0px_1px,rgba(0,0,0,0.04)_0px_2px_2px] text-center py-16 px-5">
								<div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mx-auto mb-5">
									{/* Rocket icon */}
									<Zap className="size-8 text-muted-foreground" />
								</div>
								<div className="text-base font-semibold text-gray-700 dark:text-gray-200 mb-2">
									Ready to Predict
								</div>
								<div className="text-[13px] text-muted-foreground">
									Configure your prediction parameters and click &quot;Generate Prediction&quot; to
									start.
								</div>
							</div>
						)}
					</LoadingState>
				</div>
			</div>
		</PageContainer>
	);
}
