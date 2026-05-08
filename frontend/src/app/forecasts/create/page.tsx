"use client";

import { ArrowLeft, ChevronDown, Monitor, TrendingUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { createRecord, useList } from "@/lib/api";

// AI Node supported algorithms
const AI_NODE_ALGORITHMS = [
	{
		value: "arima",
		label: "ARIMA",
		description: "AutoRegressive Integrated Moving Average",
		icon: "arima",
		category: "statistical",
		features: [
			"Suitable for stationary time series",
			"Fast training",
			"Accurate short-term predictions",
		],
		hyperparameters: [
			{ name: "p", label: "AR order", default: 1, min: 0, max: 10 },
			{ name: "d", label: "Differencing order", default: 1, min: 0, max: 2 },
			{ name: "q", label: "MA order", default: 1, min: 0, max: 10 },
		],
	},
	{
		value: "holtwinters",
		label: "Holt-Winters",
		description: "Triple exponential smoothing - seasonal data",
		icon: "holtwinters",
		category: "statistical",
		features: ["Handles seasonality", "Captures trends", "No training required"],
		hyperparameters: [
			{ name: "seasonal_periods", label: "Seasonal period", default: 7, min: 2, max: 365 },
		],
	},
	{
		value: "exponential_smoothing",
		label: "Exponential Smoothing",
		description: "Simple and effective forecasting",
		icon: "exp",
		category: "statistical",
		features: ["Fast computation", "Easy to understand", "Short-term predictions"],
		hyperparameters: [
			{ name: "alpha", label: "Smoothing coefficient", default: 0.3, min: 0, max: 1, step: 0.1 },
		],
	},
	{
		value: "naive_forecaster",
		label: "Naive Forecaster",
		description: "Uses last observation as prediction",
		icon: "naive",
		category: "baseline",
		features: ["Simplest baseline", "Zero training time", "Good for comparison"],
		hyperparameters: [],
	},
	{
		value: "stl_forecaster",
		label: "STL Forecaster",
		description: "STL decomposition - trend, seasonality, residuals",
		icon: "stl",
		category: "statistical",
		features: ["Robust decomposition", "Complex seasonality", "High interpretability"],
		hyperparameters: [
			{ name: "seasonal_periods", label: "Seasonal period", default: 7, min: 2, max: 365 },
		],
	},
	{
		value: "timer_xl",
		label: "Timer-XL (LSTM)",
		description: "Long Short-Term Memory network - requires pretrained weights",
		icon: "lstm",
		category: "deeplearning",
		features: [
			"Long-term dependency capture",
			"Complex pattern recognition",
			"Requires pretraining",
		],
		requiresWeights: true,
		hyperparameters: [
			{
				name: "model_path",
				label: "Model weights path",
				type: "string",
				placeholder: "/path/to/timer_xl_weights.pth",
			},
		],
	},
	{
		value: "sundial",
		label: "Sundial (Transformer)",
		description: "Transformer time series model - requires pretrained weights",
		icon: "transformer",
		category: "deeplearning",
		features: ["Attention mechanism", "Parallel computation", "Requires pretraining"],
		requiresWeights: true,
		hyperparameters: [
			{
				name: "model_path",
				label: "Model weights path",
				type: "string",
				placeholder: "/path/to/sundial_weights.pth",
			},
		],
	},
];

export default function ForecastCreate() {
	const router = useRouter();
	const toast = useToast();
	const [loading, setLoading] = useState(false);
	const [selectedAlgorithm, setSelectedAlgorithm] = useState<string>("arima");
	const [showHyperparams, setShowHyperparams] = useState(false);

	// Form state
	const [timeseriesId, setTimeseriesId] = useState("");
	const [algorithm, setAlgorithm] = useState("arima");
	const [horizon, setHorizon] = useState("100");
	const [confidenceLevel, setConfidenceLevel] = useState("0.95");
	const [hyperparameters, setHyperparameters] = useState<Record<string, string>>({});

	// Get timeseries list
	const { data: timeseriesList } = useList<{
		id: string;
		name: string;
		unit?: string;
		slug?: string;
	}>("timeseries", {
		pageSize: 1000,
		sort: "name",
		order: "asc",
	});

	const timeseriesOptions = (timeseriesList || []).map((ts) => ({
		value: ts.id,
		label: `${ts.name}${ts.unit ? ` (${ts.unit})` : ""}${ts.slug ? ` - ${ts.slug}` : ""}`,
	}));

	const algorithmOptions = AI_NODE_ALGORITHMS.map((algo) => ({
		value: algo.value,
		label: `${algo.label} (${algo.category === "deeplearning" ? "Deep Learning" : algo.category === "statistical" ? "Statistical" : "Baseline"})`,
	}));

	// Get selected algorithm info
	const algorithmInfo = AI_NODE_ALGORITHMS.find((a) => a.value === selectedAlgorithm);

	const handleHyperparamChange = (name: string, value: string) => {
		setHyperparameters((prev) => ({ ...prev, [name]: value }));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		try {
			const timeseries = (timeseriesList || []).find((ts) => ts.id === timeseriesId);
			if (!timeseries) {
				throw new Error("Time series not found");
			}

			const timeseriesPath = timeseries.slug || timeseries.name;

			// Call AI Node prediction API
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/inference/predict`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					credentials: "include",
					body: JSON.stringify({
						commodityId: timeseriesPath,
						horizon: Number(horizon),
						algorithm,
						confidenceLevel: Number(confidenceLevel),
						hyperparameters,
					}),
				},
			);

			if (!response.ok) {
				const errData = await response.json();
				throw new Error(errData.error || "Failed to generate forecast");
			}

			const result = await response.json();

			// Save the prediction result to database
			await createRecord("forecasts", {
				timeseriesId,
				timeseriesPath,
				algorithm,
				horizon: Number(horizon),
				confidenceLevel: Number(confidenceLevel),
				hyperparameters: hyperparameters || {},
				predictionValues: result.values || [],
				predictionMetadata: {
					timestamp: new Date().toISOString(),
					model: algorithm,
					dataPoints: result.values?.length || Number(horizon),
				},
				status: "completed",
			});

			toast.showSuccess(
				"Forecast Generated Successfully",
				`Generated ${result.values?.length || horizon} forecast points using ${algorithm.toUpperCase()}.`,
			);

			setTimeout(() => {
				router.push("/forecasts");
			}, 1500);
		} catch (error: unknown) {
			toast.showError(
				"Failed to Generate Forecast",
				error instanceof Error ? error.message : "Unknown error",
			);
		} finally {
			setLoading(false);
		}
	};

	// Algorithm icon
	const _algoIcon = (_icon: string) => {
		return <TrendingUp className="size-4 text-gray-500" />;
	};

	const categoryTagColor = (category: string): "primary" | "info" | "default" => {
		if (category === "deeplearning") return "primary";
		if (category === "statistical") return "info";
		return "default";
	};

	return (
		<PageContainer>
			<PageHeader
				title="Generate New Forecast"
				description="Use AI Node models to predict future time series values"
				breadcrumbs={[
					{ label: "Home", href: "/" },
					{ label: "Forecasts", href: "/forecasts" },
					{ label: "Generate New Forecast" },
				]}
				actions={
					<Button variant="ghost" onClick={() => router.push("/forecasts")}>
						<ArrowLeft className="size-4 mr-1.5" />
						Back to Forecasts
					</Button>
				}
			/>

			{/* Info card */}
			<div className="bg-card rounded-lg shadow-sm border border p-6 mb-6">
				<div className="flex items-center gap-2 mb-3">
					<span className="w-2 h-2 rounded-full bg-gray-900 inline-block" />
					<h2 className="text-lg font-semibold text-foreground">AI Node Forecasting</h2>
				</div>
				<p className="text-sm text-muted-foreground mb-3">
					Direct prediction using AI Node built-in models
				</p>
				<Alert variant="info">
					<div>
						<p className="mb-2">
							<strong>Directly call AI Node native models</strong> -- no pre-training required.
							Select time series data, algorithm, and parameters to generate predictions.
						</p>
						<ul className="list-disc pl-5 space-y-1 text-sm">
							<li>
								<strong>Horizon:</strong> Number of time points to predict
							</li>
							<li>
								<strong>Confidence Level:</strong> Confidence interval (0-1)
							</li>
							<li>
								<strong>Algorithm:</strong> Choose an AI Node built-in algorithm
							</li>
							<li>
								<strong>Hyperparameters:</strong> Optional model tuning parameters
							</li>
						</ul>
					</div>
				</Alert>
			</div>

			{/* Form Card */}
			<div className="bg-card rounded-lg shadow-sm border border mb-6">
				<div className="px-6 py-4 border-b border">
					<div className="flex items-center gap-2">
						<span className="w-2 h-2 rounded-full bg-gray-900 inline-block" />
						<h2 className="text-lg font-semibold text-foreground">Generate Forecast</h2>
					</div>
					<p className="text-sm text-muted-foreground mt-1">Configure prediction parameters</p>
				</div>

				<form onSubmit={handleSubmit} className="p-6 space-y-6">
					{/* Time Series Selection */}
					<Select
						label="Time Series"
						options={timeseriesOptions}
						value={timeseriesId}
						onChange={setTimeseriesId}
						placeholder="Select a time series"
						fullWidth
					/>

					{/* Algorithm Selection */}
					<Select
						label="AI Node Algorithm"
						options={algorithmOptions}
						value={algorithm}
						onChange={(val) => {
							setAlgorithm(val);
							setSelectedAlgorithm(val);
							setHyperparameters({});
						}}
						placeholder="Select AI Node algorithm"
						fullWidth
					/>

					{/* Algorithm Info */}
					{algorithmInfo && (
						<Alert
							variant={algorithmInfo.category === "deeplearning" ? "warning" : "info"}
							className="mb-4"
						>
							<div>
								<p className="font-semibold mb-1">{algorithmInfo.label} features:</p>
								<ul className="list-disc pl-5 space-y-0.5 text-sm">
									{algorithmInfo.features.map((feature, idx) => (
										// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
										<li key={idx}>{feature}</li>
									))}
								</ul>
								{algorithmInfo.requiresWeights && (
									<p className="text-sm mt-2 text-primary">
										This algorithm requires pretrained model weight files
									</p>
								)}
							</div>
						</Alert>
					)}

					{/* Prediction Parameters */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Input
							label="Forecast Horizon"
							type="number"
							min={1}
							max={10000}
							placeholder="e.g., 100"
							value={horizon}
							onChange={(e) => setHorizon(e.target.value)}
							fullWidth
							required
							helperText="Number of future time points to predict"
						/>
						<Input
							label="Confidence Level"
							type="number"
							min={0}
							max={1}
							step={0.01}
							placeholder="e.g., 0.95"
							value={confidenceLevel}
							onChange={(e) => setConfidenceLevel(e.target.value)}
							fullWidth
							required
							helperText="Confidence interval (e.g., 0.95 = 95%)"
						/>
					</div>

					{/* Hyperparameters (collapsible) */}
					{algorithmInfo && algorithmInfo.hyperparameters.length > 0 && (
						<div className="border border rounded-lg">
							<button
								type="button"
								className="w-full flex items-center gap-2 px-4 py-3 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
								onClick={() => setShowHyperparams(!showHyperparams)}
							>
								<ChevronDown
									className={`size-4 transition-transform ${showHyperparams ? "rotate-180" : ""}`}
								/>
								Advanced Parameters - Model Tuning (Optional)
							</button>
							{showHyperparams && (
								<div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
									{algorithmInfo.hyperparameters.map((param) => {
										const isString = "type" in param && param.type === "string";
										return isString ? (
											<Input
												key={param.name}
												label={param.label}
												placeholder={"placeholder" in param ? param.placeholder : ""}
												value={hyperparameters[param.name] || ""}
												onChange={(e) => handleHyperparamChange(param.name, e.target.value)}
												fullWidth
												helperText={"default" in param ? `Default: ${param.default}` : undefined}
											/>
										) : (
											<Input
												key={param.name}
												label={param.label}
												type="number"
												min={"min" in param ? String(param.min) : undefined}
												max={"max" in param ? String(param.max) : undefined}
												step={"step" in param ? String(param.step) : "1"}
												value={
													hyperparameters[param.name] ??
													("default" in param ? String(param.default) : "")
												}
												onChange={(e) => handleHyperparamChange(param.name, e.target.value)}
												fullWidth
												helperText={"default" in param ? `Default: ${param.default}` : undefined}
											/>
										);
									})}
								</div>
							)}
						</div>
					)}

					<hr className="border" />

					{/* Recommended Settings */}
					<div>
						<p className="text-sm font-medium text-muted-foreground mb-2">
							<strong>Recommended settings:</strong>
						</p>
						<div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
							<span>Short-term: horizon=50-100, confidence=0.95</span>
							<span>Medium-term: horizon=100-500, confidence=0.90</span>
							<span>Long-term: horizon=500-1000, confidence=0.85</span>
						</div>
					</div>

					<hr className="border" />

					{/* Submit */}
					<Button type="submit" variant="primary" size="lg" fullWidth isLoading={loading}>
						{loading ? "Generating Forecast..." : "Generate Forecast"}
					</Button>
				</form>
			</div>

			{/* Algorithm Comparison Table */}
			<div className="bg-card rounded-lg shadow-sm border border">
				<div className="px-6 py-4 border-b border">
					<div className="flex items-center gap-2">
						<Monitor className="size-4 text-gray-500" />
						<h2 className="text-lg font-semibold text-foreground">Algorithm Comparison</h2>
					</div>
				</div>
				<div className="overflow-x-auto">
					<table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
						<thead className="bg-muted">
							<tr>
								<th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
									Algorithm
								</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
									Type
								</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
									Training Time
								</th>
								<th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
									Use Case
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-gray-200 dark:divide-gray-700">
							{AI_NODE_ALGORITHMS.map((algo) => (
								<tr key={algo.value} className="hover:bg-accent/50">
									<td className="px-4 py-3 whitespace-nowrap">
										<span className="font-semibold text-sm text-foreground">{algo.label}</span>
									</td>
									<td className="px-4 py-3 whitespace-nowrap">
										<Tag color={categoryTagColor(algo.category)}>
											{algo.category === "deeplearning"
												? "Deep Learning"
												: algo.category === "statistical"
													? "Statistical"
													: "Baseline"}
										</Tag>
									</td>
									<td className="px-4 py-3 whitespace-nowrap">
										{algo.category === "deeplearning" ? (
											<Tag color="warning">Requires pretraining</Tag>
										) : (
											<Tag color="success">No training needed</Tag>
										)}
									</td>
									<td className="px-4 py-3 text-sm text-muted-foreground">{algo.features[0]}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</PageContainer>
	);
}
