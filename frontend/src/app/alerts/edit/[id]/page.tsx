"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { useList, useOne } from "@/lib/api";
import { tokenManager } from "@/lib/tokenManager";

const ALERT_TYPES = [
	{ value: "ANOMALY", label: "Anomaly Detection" },
	{ value: "FORECAST_READY", label: "Forecast Ready" },
	{ value: "SYSTEM", label: "System Event" },
	{ value: "THRESHOLD", label: "Threshold Breach" },
];

const SEVERITY_LEVELS = [
	{ value: "INFO", label: "Info" },
	{ value: "WARNING", label: "Warning" },
	{ value: "ERROR", label: "Error" },
];

const OPERATOR_OPTIONS = [
	{ value: ">", label: "Greater than" },
	{ value: "<", label: "Less than" },
	{ value: ">=", label: "Greater or equal" },
	{ value: "<=", label: "Less or equal" },
];

interface AlertEditPageProps {
	params: Promise<{ id: string }>;
}

export default function AlertEditPage({ params }: AlertEditPageProps) {
	const { id } = React.use(params);
	const router = useRouter();
	const toast = useToast();
	const [loading, setLoading] = useState(false);
	const [formErrors, setFormErrors] = useState<Record<string, string>>({});
	const [initialized, setInitialized] = useState(false);

	// Form state
	const [name, setName] = useState("");
	const [type, setType] = useState("");
	const [severity, setSeverity] = useState("");
	const [timeseriesId, setTimeseriesId] = useState("");
	const [description, setDescription] = useState("");
	const [enabled, setEnabled] = useState(true);
	const [conditionOperator, setConditionOperator] = useState(">");
	const [conditionValue, setConditionValue] = useState("");
	const [cooldownMinutes, setCooldownMinutes] = useState("5");

	// Get alert data
	const { data: alert, loading: isLoadingAlert } = useOne<any>("alerts", id);

	// Get timeseries list
	const { data: timeseriesList } = useList<any>("timeseries", {
		pageSize: 1000,
		sort: "name",
		order: "asc",
	});

	const timeseriesOptions = timeseriesList.map((ts: any) => ({
		value: ts.id,
		label: ts.name,
	}));

	// Set form values when data is loaded
	useEffect(() => {
		if (alert && !initialized) {
			setName(alert.name || "");
			setType(alert.type || "");
			setSeverity(alert.severity || "");
			setTimeseriesId(alert.timeseriesId || "");
			setDescription(alert.description || "");
			setEnabled(alert.isRead !== false);
			setConditionOperator(alert.condition?.operator || ">");
			setConditionValue(alert.condition?.value != null ? String(alert.condition.value) : "");
			setCooldownMinutes(alert.cooldownMinutes != null ? String(alert.cooldownMinutes) : "5");
			setInitialized(true);
		}
	}, [alert, initialized]);

	const validate = (): boolean => {
		const errors: Record<string, string> = {};

		if (!name.trim()) {
			errors.name = "Please enter an alert name";
		}
		if (!type) {
			errors.type = "Please select alert type";
		}
		if (!severity) {
			errors.severity = "Please select severity";
		}
		if (!timeseriesId) {
			errors.timeseriesId = "Please select a time series";
		}

		setFormErrors(errors);
		return Object.keys(errors).length === 0;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!validate()) return;

		setLoading(true);
		try {
			const token = tokenManager.getToken();
			const values = {
				name,
				type,
				severity,
				timeseriesId,
				description,
				enabled,
				condition:
					type === "THRESHOLD"
						? {
								operator: conditionOperator,
								value: Number(conditionValue),
							}
						: undefined,
				cooldownMinutes: type === "THRESHOLD" ? Number(cooldownMinutes) : undefined,
			};

			const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/alerts/${id}`, {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				credentials: "include",
				body: JSON.stringify(values),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to update alert");
			}

			toast.showSuccess("Alert Updated Successfully", "The alert configuration has been updated.");

			setTimeout(() => {
				router.push("/alerts");
			}, 1000);
		} catch (error: any) {
			toast.showError("Failed to Update Alert", error.message);
		} finally {
			setLoading(false);
		}
	};

	if (isLoadingAlert) {
		return (
			<div className="min-h-screen bg-muted p-4 md:p-6">
				<div className="mx-auto max-w-3xl">
					<Alert variant="info">Loading alert data...</Alert>
				</div>
			</div>
		);
	}

	if (!alert && !isLoadingAlert) {
		return (
			<div className="min-h-screen bg-muted p-4 md:p-6">
				<div className="mx-auto max-w-3xl">
					<Alert variant="error">Alert not found</Alert>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-muted p-4 md:p-6">
			<div className="mx-auto max-w-3xl">
				{/* Breadcrumbs */}
				<nav className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
					<a href="/" className="hover:text-gray-700 dark:hover:text-gray-200">
						Home
					</a>
					<ChevronRight className="size-3" />
					<a href="/alerts" className="hover:text-gray-700 dark:hover:text-gray-200">
						Alerts & Notifications
					</a>
					<ChevronRight className="size-3" />
					<span className="text-foreground">Edit Alert</span>
				</nav>

				{/* Page Header */}
				<div className="flex items-start justify-between gap-4 mb-6">
					<div>
						<h1 className="text-2xl font-semibold text-foreground tracking-tight">Edit Alert</h1>
						<p className="text-sm text-muted-foreground mt-1">
							Editing alert: {alert?.name || id.slice(0, 8)}...
						</p>
					</div>
					<Button variant="ghost" onClick={() => router.push("/alerts")}>
						<ArrowLeft className="size-4 mr-1.5" />
						Back to Alerts
					</Button>
				</div>

				{/* Form */}
				<Card>
					<CardHeader>
						<h3 className="text-lg font-semibold text-foreground">Alert Configuration</h3>
						<p className="text-sm text-muted-foreground">Update alert settings</p>
					</CardHeader>
					<CardBody>
						<form onSubmit={handleSubmit} className="space-y-6">
							{/* Alert Name */}
							<Input
								label="Alert Name"
								placeholder="e.g., High Temperature Alert"
								value={name}
								onChange={(e) => setName(e.target.value)}
								error={formErrors.name}
								fullWidth
							/>

							{/* Alert Type and Severity */}
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								<Select
									label="Alert Type"
									placeholder="Select alert type"
									value={type}
									onChange={setType}
									options={ALERT_TYPES}
									error={formErrors.type}
								/>
								<Select
									label="Severity Level"
									placeholder="Select severity"
									value={severity}
									onChange={setSeverity}
									options={SEVERITY_LEVELS}
									error={formErrors.severity}
								/>
							</div>

							{/* Time Series Selection */}
							<Select
								label="Time Series"
								placeholder="Select a time series"
								value={timeseriesId}
								onChange={setTimeseriesId}
								options={timeseriesOptions}
								error={formErrors.timeseriesId}
							/>

							<hr className="border" />

							{/* Threshold Configuration */}
							{type === "THRESHOLD" && (
								<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
									<Select
										label="Operator"
										value={conditionOperator}
										onChange={setConditionOperator}
										options={OPERATOR_OPTIONS}
									/>
									<Input
										label="Threshold Value"
										type="number"
										value={conditionValue}
										onChange={(e) => setConditionValue(e.target.value)}
										fullWidth
									/>
									<Input
										label="Cooldown (minutes)"
										type="number"
										value={cooldownMinutes}
										onChange={(e) => setCooldownMinutes(e.target.value)}
										fullWidth
									/>
								</div>
							)}

							{/* Description */}
							<Textarea
								label="Description"
								placeholder="Alert description..."
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								rows={3}
								fullWidth
							/>

							{/* Enable/Disable */}
							<div className="flex items-center gap-3">
								<button
									type="button"
									role="switch"
									aria-checked={enabled}
									onClick={() => setEnabled(!enabled)}
									className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? "bg-primary" : "bg-gray-300 dark:bg-gray-600"}`}
								>
									<span
										className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
									/>
								</button>
								<span className="text-sm font-medium text-foreground">
									{enabled ? "Enabled" : "Disabled"}
								</span>
							</div>

							<hr className="border" />

							{/* Submit */}
							<Button type="submit" size="lg" fullWidth isLoading={loading}>
								Update Alert
							</Button>
						</form>
					</CardBody>
				</Card>
			</div>
		</div>
	);
}
