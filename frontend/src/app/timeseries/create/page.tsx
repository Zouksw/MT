"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { createRecord, useList } from "@/lib/api";

export default function TimeseriesCreate() {
	const router = useRouter();
	const toast = useToast();
	const [saving, setSaving] = useState(false);

	// Form state
	const [form, setForm] = useState({
		datasetId: "",
		name: "",
		slug: "",
		unit: "",
		description: "",
		colorHex: "#F59E0B",
		timezone: "UTC",
		isAnomalyDetectionEnabled: false,
	});

	const [errors, setErrors] = useState<Record<string, string>>({});

	// Fetch datasets for select
	const { data: datasets } = useList<{ id: string; name: string }>("datasets", { pageSize: 1000 });
	const datasetOptions = datasets.map((ds) => ({
		value: ds.id,
		label: ds.name,
	}));

	const handleChange = (field: string, value: string | boolean) => {
		setForm((prev) => ({ ...prev, [field]: value }));
		// Clear error on change
		if (errors[field]) {
			setErrors((prev) => {
				const next = { ...prev };
				delete next[field];
				return next;
			});
		}
	};

	const validate = (): boolean => {
		const newErrors: Record<string, string> = {};
		if (!form.datasetId) newErrors.datasetId = "Please select a dataset";
		if (!form.name) newErrors.name = "Please enter a name";
		if (!form.slug) newErrors.slug = "Please enter a slug";
		if (form.slug && !/^[a-z0-9-]+$/.test(form.slug)) {
			newErrors.slug = "Only lowercase letters, numbers, and hyphens";
		}
		setErrors(newErrors);
		return Object.keys(newErrors).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;

		setSaving(true);
		try {
			const result = await createRecord<typeof form & { id: string }>("timeseries", form);
			toast.showSuccess("Time series created");
			router.push(`/timeseries/show/${result.id}`);
		} catch (err) {
			toast.showError(err instanceof Error ? err.message : "Failed to create time series");
		} finally {
			setSaving(false);
		}
	};

	return (
		<PageContainer>
			<PageHeader
				title="Create Time Series"
				breadcrumbs={[
					{ label: "Home", href: "/" },
					{ label: "Time Series", href: "/timeseries" },
					{ label: "Create" },
				]}
			/>

			<form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
				{/* Basic Information */}
				<Card>
					<CardHeader>
						<CardTitle>Basic Information</CardTitle>
						<p className="text-sm text-muted-foreground mt-1">
							Configure the basic properties of your time series
						</p>
					</CardHeader>
					<CardBody>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<Select
								label="Dataset"
								options={datasetOptions}
								value={form.datasetId}
								onChange={(v) => handleChange("datasetId", v)}
								placeholder="Select dataset"
								error={errors.datasetId}
								fullWidth
							/>
							<Input
								label="Name"
								value={form.name}
								onChange={(e) => handleChange("name", e.target.value)}
								placeholder="Temperature"
								error={errors.name}
								fullWidth
							/>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
							<Input
								label="Slug"
								value={form.slug}
								onChange={(e) => handleChange("slug", e.target.value)}
								placeholder="temperature"
								error={errors.slug}
								helperText="Only lowercase letters, numbers, and hyphens"
								fullWidth
							/>
							<Input
								label="Unit"
								value={form.unit}
								onChange={(e) => handleChange("unit", e.target.value)}
								placeholder="°C, MB, %"
								helperText="The unit of measurement for this time series"
								fullWidth
							/>
						</div>

						<div className="mt-4">
							<Textarea
								label="Description"
								value={form.description}
								onChange={(e) => handleChange("description", e.target.value)}
								placeholder="Describe what this time series measures..."
								rows={3}
								fullWidth
							/>
						</div>
					</CardBody>
				</Card>

				{/* Display Settings */}
				<Card>
					<CardHeader>
						<CardTitle>Display Settings</CardTitle>
						<p className="text-sm text-muted-foreground mt-1">
							Configure how this time series appears in visualizations
						</p>
					</CardHeader>
					<CardBody>
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<div className="w-full">
															<label htmlFor="ts-color" className="block text-sm font-medium text-foreground mb-1">Color</label>
																<input id="ts-color"
									type="color"
									value={form.colorHex}
									onChange={(e) => handleChange("colorHex", e.target.value)}
									className="w-full h-10 rounded-md border border-input cursor-pointer"
									title="Color used in charts and visualizations"
								/>
							</div>
							<Input
								label="Timezone"
								value={form.timezone}
								onChange={(e) => handleChange("timezone", e.target.value)}
								placeholder="UTC"
								helperText="Timezone for timestamp display"
								fullWidth
							/>
						</div>
					</CardBody>
				</Card>

				{/* Advanced Options */}
				<Card>
					<CardHeader>
						<CardTitle>Advanced Options</CardTitle>
						<p className="text-sm text-muted-foreground mt-1">
							Configure additional features for this time series
						</p>
					</CardHeader>
					<CardBody>
						<label className="flex items-center gap-3 cursor-pointer">
							<button type="button"
								role="switch"
								aria-checked={form.isAnomalyDetectionEnabled}
								onClick={() =>
									handleChange("isAnomalyDetectionEnabled", !form.isAnomalyDetectionEnabled)
								}
								className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
									form.isAnomalyDetectionEnabled ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"
								}`}
							>
								<span
									className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
										form.isAnomalyDetectionEnabled ? "translate-x-6" : "translate-x-1"
									}`}
								/>
							</button>
							<span className="font-semibold text-foreground">Anomaly Detection</span>
						</label>
						<p className="mt-2 text-sm text-muted-foreground">
							When enabled, the system will automatically analyze this time series for anomalies
							using machine learning algorithms.
						</p>
					</CardBody>
				</Card>

				{/* Actions */}
				<div className="flex items-center gap-3">
					<Button type="submit" isLoading={saving}>
						Create Time Series
					</Button>
					<Button variant="ghost" onClick={() => router.push("/timeseries")}>
						Cancel
					</Button>
				</div>
			</form>
		</PageContainer>
	);
}
