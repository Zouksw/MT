"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { createRecord, useList } from "@/lib/api";

const SEVERITY_LEVELS = [
	{ value: "LOW", label: "Low - Minor deviation from expected values" },
	{ value: "MEDIUM", label: "Medium - Notable anomaly worth investigating" },
	{ value: "HIGH", label: "High - Significant deviation requiring attention" },
	{ value: "CRITICAL", label: "Critical - Extreme deviation, immediate action needed" },
];

const DETECTION_METHODS = [
	{ value: "statistical", label: "Statistical (Z-Score)" },
	{ value: "iqr", label: "Interquartile Range (IQR)" },
	{ value: "isolation_forest", label: "Isolation Forest" },
	{ value: "lstm", label: "LSTM Autoencoder" },
	{ value: "manual", label: "Manual Entry" },
];

export default function AnomalyCreate() {
	const router = useRouter();
	const toast = useToast();
	const [loading, setLoading] = useState(false);

	// Form state
	const [timeseriesId, setTimeseriesId] = useState("");
	const [severity, setSeverity] = useState("MEDIUM");
	const [detectionMethod, setDetectionMethod] = useState("manual");
	const [value, setValue] = useState("");
	const [expectedRangeMin, setExpectedRangeMin] = useState("");
	const [expectedRangeMax, setExpectedRangeMax] = useState("");
	const [notes, setNotes] = useState("");

	// Get timeseries list
	const { data: timeseriesList } = useList("timeseries", {
		pageSize: 1000,
		sort: "name",
		order: "asc",
	});

	const timeseriesOptions = (timeseriesList || []).map((ts: Record<string, unknown>) => ({
		value: String(ts.id),
		label: String(ts.name) + (ts.unit ? ` (${String(ts.unit)})` : ""),
	}));

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		try {
			// Get timeseries path
			const timeseries = (timeseriesList || []).find(
				(ts: Record<string, unknown>) => ts.id === timeseriesId,
			);
			if (!timeseries) {
				throw new Error("Time series not found");
			}

			const timeseriesPath = timeseries.slug || timeseries.name;

			await createRecord("anomalies", {
				timeseriesId,
				timeseriesPath,
				severity,
				value: Number(value),
				expectedRange: {
					min: Number(expectedRangeMin),
					max: Number(expectedRangeMax),
				},
				detectionMethod,
				notes,
				detectedAt: new Date().toISOString(),
			});

			toast.showSuccess("Anomaly Created Successfully", "The anomaly record has been created.");

			setTimeout(() => {
				router.push("/anomalies");
			}, 1000);
		} catch (error: unknown) {
			toast.showError(
				"Failed to Create Anomaly",
				error instanceof Error ? error.message : String(error),
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
			<div className="mx-auto max-w-[900px]">
				{/* Header */}
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
					<div>
						<h1 className="text-2xl font-semibold text-foreground">Create Anomaly Record</h1>
						<p className="text-sm text-muted-foreground mt-1">
							Manually record an anomaly detected in your time series data
						</p>
					</div>
					<Button variant="ghost" onClick={() => router.push("/anomalies")}>
						<ArrowLeft className="size-4 mr-1.5" />
						Back to Anomalies
					</Button>
				</div>

				<Alert variant="info" title="Manual Anomaly Entry" className="mb-6">
					This form allows you to manually record anomalies that were detected outside the automated
					system. Use this for documenting known issues or manually identified anomalies.
				</Alert>

				{/* Form Card */}
				<div className="bg-card rounded-lg shadow-sm border">
					{/* Card header */}
					<div className="px-6 py-4 border-b border">
						<div className="flex items-center gap-2">
							<span className="w-2 h-2 rounded-full bg-gray-900 inline-block" />
							<h2 className="text-lg font-semibold text-foreground">Anomaly Details</h2>
						</div>
						<p className="text-sm text-muted-foreground mt-1">Enter the anomaly information</p>
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

						{/* Severity & Detection Method */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<Select
								label="Severity Level"
								options={SEVERITY_LEVELS}
								value={severity}
								onChange={setSeverity}
								placeholder="Select severity"
								fullWidth
							/>
							<Select
								label="Detection Method"
								options={DETECTION_METHODS}
								value={detectionMethod}
								onChange={setDetectionMethod}
								placeholder="Select detection method"
								fullWidth
							/>
						</div>

						<hr className="border" />

						{/* Value Information */}
						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<Input
								label="Anomalous Value"
								type="number"
								step="any"
								placeholder="e.g., 45.7"
								value={value}
								onChange={(e) => setValue(e.target.value)}
								fullWidth
								required
							/>
							<div>
								{/* biome-ignore lint/a11y/noLabelWithoutControl: section heading */}
								<label className="block text-sm font-medium text-foreground mb-1">
									Expected Range
								</label>
								<div className="flex gap-3">
									<Input
										type="number"
										step="any"
										placeholder="Min"
										value={expectedRangeMin}
										onChange={(e) => setExpectedRangeMin(e.target.value)}
										fullWidth
										required
									/>
									<Input
										type="number"
										step="any"
										placeholder="Max"
										value={expectedRangeMax}
										onChange={(e) => setExpectedRangeMax(e.target.value)}
										fullWidth
										required
									/>
								</div>
							</div>
						</div>

						{/* Notes */}
						<Textarea
							label="Notes"
							rows={4}
							placeholder="Describe the anomaly, potential causes, or any relevant context..."
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							fullWidth
						/>

						<hr className="border" />

						{/* Submit */}
						<Button type="submit" variant="primary" size="lg" fullWidth isLoading={loading}>
							Create Anomaly Record
						</Button>
					</form>
				</div>
			</div>
		</div>
	);
}
