"use client";

import { Bell, CircleCheck, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { StatCard } from "@/components/ui/StatCard";
import { Table } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { useIsMobile } from "@/lib/responsive-utils";
import { authFetch } from "@/utils/auth";

interface AlertRule {
	id: string;
	name: string;
	type: "ANOMALY" | "FORECAST_READY" | "SYSTEM";
	condition: AlertCondition;
	severity: "INFO" | "WARNING" | "ERROR";
	enabled: boolean;
	notificationChannels: NotificationChannel[];
	cooldownMinutes?: number;
	createdAt: string;
	updatedAt: string;
}

interface AlertCondition {
	type: "threshold" | "anomaly" | "pattern" | "forecast";
	operator?: ">" | "<" | "=" | "!=" | ">=" | "<=";
	value?: number;
	anomalySeverity?: string[];
	windowMinutes?: number;
}

interface NotificationChannel {
	type: "email" | "webhook" | "slack";
	config: {
		email?: string;
		webhookUrl?: string;
		slackWebhookUrl?: string;
	};
}

interface Timeseries {
	id: string;
	name: string;
	dataset: {
		name: string;
	};
}

const API_BASE = ""; // Use relative paths for Next.js rewrites

export default function AlertRules() {
	const [rules, setRules] = useState<AlertRule[]>([]);
	const [timeseries, setTimeseries] = useState<Timeseries[]>([]);
	const [loading, setLoading] = useState(true);
	const [modalVisible, setModalVisible] = useState(false);
	const [editingRule, setEditingRule] = useState<AlertRule | null>(null);
	const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
	const isMobile = useIsMobile();
	const toast = useToast();

	const fetchRules = useCallback(async () => {
		setLoading(true);
		try {
			const response = await authFetch(`${API_BASE}/api/auth/me`);

			if (!response.ok) throw new Error("Failed to fetch alert rules");

			const userData = await response.json();
			const preferences = userData.user?.preferences || {};
			const alertRules = preferences.alertRules || [];

			setRules(alertRules);
		} catch {
			toast.showError("Failed to load alert rules");
		} finally {
			setLoading(false);
		}
	}, [toast]);

	const fetchTimeseries = useCallback(async () => {
		try {
			const response = await authFetch(`${API_BASE}/api/timeseries`);

			if (!response.ok) throw new Error("Failed to fetch timeseries");

			const data = await response.json();
			setTimeseries(data.timeseries || data.data || []);
		} catch {
			toast.showError("Failed to fetch timeseries");
		}
	}, [toast]);

	useEffect(() => {
		fetchRules();
		fetchTimeseries();
	}, [fetchRules, fetchTimeseries]);

	const handleCreate = () => {
		setEditingRule(null);
		setModalVisible(true);
	};

	const handleEdit = (rule: AlertRule) => {
		setEditingRule(rule);
		setModalVisible(true);
	};

	const handleDelete = async (ruleId: string) => {
		try {
			const response = await authFetch(`${API_BASE}/api/alerts/rules/${ruleId}`, {
				method: "DELETE",
			});

			if (!response.ok) throw new Error("Failed to delete alert rule");

			toast.showSuccess("Alert rule deleted");
			setConfirmDelete(null);
			fetchRules();
		} catch {
			toast.showError("Failed to delete alert rule");
		}
	};

	const handleToggleEnabled = async (rule: AlertRule) => {
		try {
			await authFetch(`${API_BASE}/api/alerts/rules/${rule.id}`, {
				method: "PATCH",
				body: JSON.stringify({ enabled: !rule.enabled }),
			});

			fetchRules();
			toast.showSuccess(`Alert rule ${!rule.enabled ? "enabled" : "disabled"}`);
		} catch {
			toast.showError("Failed to update alert rule");
		}
	};

	const columns = [
		{
			key: "name",
			title: "Name",
			width: 180,
			render: (_value: unknown, record: AlertRule) => (
				<div>
					<span className="font-semibold" style={{ fontSize: 13 }}>
						{record.name}
					</span>
					<br />
					<span className="text-gray-400" style={{ fontSize: 11 }}>
						{record.id.slice(0, 8)}...
					</span>
				</div>
			),
		},
		{
			key: "type",
			title: "Type",
			width: 140,
			render: (_value: unknown, record: AlertRule) => {
				const colors: Record<string, "error" | "info" | "success"> = {
					ANOMALY: "error",
					FORECAST_READY: "info",
					SYSTEM: "success",
				};
				return <Tag color={colors[record.type] || "default"}>{record.type.replace(/_/g, " ")}</Tag>;
			},
		},
		{
			key: "condition",
			title: "Condition",
			width: 140,
			render: (_value: unknown, record: AlertRule) => {
				if (record.condition.type === "threshold") {
					return (
						<Tag color="default">
							Value {record.condition.operator} {record.condition.value}
						</Tag>
					);
				}
				if (record.condition.type === "anomaly") {
					return <Tag color="warning">Anomaly</Tag>;
				}
				return <Tag color="default">{record.condition.type}</Tag>;
			},
		},
		{
			key: "severity",
			title: "Severity",
			width: 100,
			render: (_value: unknown, record: AlertRule) => {
				const colors: Record<string, "info" | "warning" | "error"> = {
					INFO: "info",
					WARNING: "warning",
					ERROR: "error",
				};
				return <Tag color={colors[record.severity] || "default"}>{record.severity}</Tag>;
			},
		},
		{
			key: "notificationChannels",
			title: "Notifications",
			width: 140,
			render: (_value: unknown, record: AlertRule) => (
				<div className="flex flex-wrap gap-1">
					{record.notificationChannels.map((ch, idx) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
						<Tag key={idx} color="default">
							{ch.type}
						</Tag>
					))}
				</div>
			),
		},
		{
			key: "cooldownMinutes",
			title: "Cooldown",
			width: 100,
			render: (_value: unknown, record: AlertRule) =>
				record.cooldownMinutes ? `${record.cooldownMinutes} min` : "-",
		},
		{
			key: "enabled",
			title: "Status",
			width: 100,
			render: (_value: unknown, record: AlertRule) => (
				<Tag color={record.enabled ? "success" : "default"}>
					{record.enabled ? "Active" : "Inactive"}
				</Tag>
			),
		},
		{
			key: "actions",
			title: "Actions",
			width: isMobile ? 80 : 160,
			render: (_value: unknown, record: AlertRule) => (
				<div className="flex items-center gap-2">
					<Button
						size="sm"
						variant="ghost"
						onClick={() => handleEdit(record)}
						icon={<Pencil className="size-3.5" />}
					>
						{!isMobile && "Edit"}
					</Button>
					<button type="button"
						className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${record.enabled ? "bg-green-500" : "bg-gray-300"}`}
						onClick={() => handleToggleEnabled(record)}
					>
						<span
							className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${record.enabled ? "translate-x-4" : "translate-x-1"}`}
						/>
					</button>
					{!isMobile && (
						<Button
							size="sm"
							variant="danger"
							onClick={() => setConfirmDelete(record.id)}
							icon={<Trash2 className="size-3.5" />}
							aria-label="Delete"
						>
							{""}
						</Button>
					)}
				</div>
			),
		},
	];

	const breadcrumbItems = [
		{ label: "Home", href: "/" },
		{ label: "Alerts & Notifications", href: "/alerts" },
		{ label: "Alert Rules" },
	];

	// Statistics
	const totalRules = rules.length;
	const activeRules = rules.filter((r) => r.enabled).length;
	const errorSeverityRules = rules.filter((r) => r.severity === "ERROR").length;

	return (
		<PageContainer>
			<PageHeader
				title="Alert Rules"
				description="Configure automated alert rules for monitoring your time series data"
				breadcrumbs={breadcrumbItems}
				actions={
					<Button onClick={handleCreate} icon={<Plus className="size-4" />}>
						{!isMobile && "Create Rule"}
					</Button>
				}
			/>

			{/* Statistics Cards */}
			<div className={`grid grid-cols-3 gap-${isMobile ? 2 : 4} mb-${isMobile ? 4 : 6}`}>
				<StatCard
					title="Total Rules"
					value={totalRules}
					icon={<Bell className="size-4" />}
					variant="primary"
				/>
				<StatCard
					title="Active Rules"
					value={activeRules}
					icon={<CircleCheck className="size-4" />}
					variant="success"
				/>
				<StatCard
					title="Error Severity"
					value={errorSeverityRules}
					icon={<TriangleAlert className="size-4" />}
					variant="error"
				/>
			</div>

			{/* Info Alert */}
			<Alert variant="info" title="About Alert Rules" className={`mb-${isMobile ? 4 : 6}`}>
				Alert rules automatically monitor your timeseries data and send notifications when specific
				conditions are met. You can set up rules based on thresholds, anomalies, or forecast
				availability.
			</Alert>

			{/* Rules Table */}
			<Table
				columns={columns}
				dataSource={rules}
				loading={loading}
				rowKey="id"
				emptyText="No alert rules configured"
			/>

			{/* Create/Edit Modal */}
			<AlertRuleModal
				visible={modalVisible}
				editingRule={editingRule}
				timeseries={timeseries}
				onClose={() => setModalVisible(false)}
				onSave={() => {
					setModalVisible(false);
					fetchRules();
				}}
			/>

			{/* Delete Confirmation Modal */}
			<Modal
				open={confirmDelete !== null}
				onClose={() => setConfirmDelete(null)}
				title="Delete Alert Rule"
				footer={
					<div className="flex gap-3">
						<Button variant="secondary" onClick={() => setConfirmDelete(null)}>
							Cancel
						</Button>
						<Button variant="danger" onClick={() => confirmDelete && handleDelete(confirmDelete)}>
							Delete
						</Button>
					</div>
				}
			>
				<p className="text-sm text-muted-foreground">
					Are you sure you want to delete this alert rule?
				</p>
			</Modal>
		</PageContainer>
	);
}

// Alert Rule Modal Component
interface AlertRuleModalProps {
	visible: boolean;
	editingRule: AlertRule | null;
	timeseries: Timeseries[];
	onClose: () => void;
	onSave: () => void;
}

function AlertRuleModal({
	visible,
	editingRule,
	timeseries,
	onClose,
	onSave,
}: AlertRuleModalProps) {
	const [loading, setLoading] = useState(false);
	const toast = useToast();

	// Form state
	const [name, setName] = useState("");
	const [timeseriesId, setTimeseriesId] = useState("");
	const [type, setType] = useState("");
	const [conditionType, setConditionType] = useState("threshold");
	const [conditionOperator, setConditionOperator] = useState(">");
	const [conditionValue, setConditionValue] = useState("");
	const [severity, setSeverity] = useState("");
	const [cooldownMinutes, setCooldownMinutes] = useState("");
	const [notificationChannels, setNotificationChannels] = useState<NotificationChannel[]>([
		{ type: "email", config: {} },
	]);

	useEffect(() => {
		if (visible && editingRule) {
			setName(editingRule.name);
			setType(editingRule.type);
			setConditionType(editingRule.condition.type || "threshold");
			setConditionOperator(editingRule.condition.operator || ">");
			setConditionValue(editingRule.condition.value?.toString() || "");
			setSeverity(editingRule.severity);
			setCooldownMinutes(editingRule.cooldownMinutes?.toString() || "");
			setNotificationChannels(editingRule.notificationChannels || [{ type: "email", config: {} }]);
		} else if (visible) {
			setName("");
			setTimeseriesId("");
			setType("");
			setConditionType("threshold");
			setConditionOperator(">");
			setConditionValue("");
			setSeverity("");
			setCooldownMinutes("");
			setNotificationChannels([{ type: "email", config: {} }]);
		}
	}, [visible, editingRule]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		try {
			const payload = {
				name,
				timeseriesId,
				type,
				condition: {
					type: conditionType,
					...(conditionType === "threshold"
						? { operator: conditionOperator, value: parseFloat(conditionValue) }
						: {}),
				},
				severity,
				cooldownMinutes: cooldownMinutes ? parseInt(cooldownMinutes, 10) : undefined,
				notificationChannels,
			};

			const url = editingRule
				? `${API_BASE}/api/alerts/rules/${editingRule.id}`
				: `${API_BASE}/api/alerts/rules`;

			const response = await authFetch(url, {
				method: editingRule ? "PATCH" : "POST",
				body: JSON.stringify(payload),
			});

			if (!response.ok) throw new Error("Failed to save alert rule");

			toast.showSuccess(editingRule ? "Alert rule updated" : "Alert rule created");
			onSave();
		} catch {
			toast.showError("Failed to save alert rule");
		} finally {
			setLoading(false);
		}
	};

	return (
		<Modal
			open={visible}
			onClose={onClose}
			title={editingRule ? "Edit Alert Rule" : "Create Alert Rule"}
			width="max-w-2xl"
		>
			<form onSubmit={handleSubmit} className="space-y-4">
				<Input
					label="Rule Name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="e.g., High Temperature Alert"
					fullWidth
					required
				/>

				<Select
					label="Timeseries"
					value={timeseriesId}
					onChange={setTimeseriesId}
					options={timeseries.map((ts) => ({
						value: ts.id,
						label: `${ts.name} (${ts.dataset.name})`,
					}))}
					placeholder="Select a timeseries"
					fullWidth
				/>

				<Select
					label="Alert Type"
					value={type}
					onChange={setType}
					options={[
						{ value: "ANOMALY", label: "Anomaly Detection" },
						{ value: "FORECAST_READY", label: "Forecast Ready" },
						{ value: "SYSTEM", label: "System Event" },
					]}
					fullWidth
				/>

				<div>
					{/* biome-ignore lint/a11y/noLabelWithoutControl: section heading */}
					<label className="block text-sm font-medium text-foreground mb-1">Condition</label>
					<div className="flex gap-2">
						<div className="w-2/5">
							<Select
								value={conditionType}
								onChange={(val) => {
									setConditionType(val);
								}}
								options={[
									{ value: "threshold", label: "Threshold" },
									{ value: "anomaly", label: "Anomaly" },
									{ value: "forecast", label: "Forecast Ready" },
								]}
								fullWidth
							/>
						</div>
						{conditionType === "threshold" && (
							<>
								<div className="w-3/10">
									<Select
										value={conditionOperator}
										onChange={setConditionOperator}
										options={[
											{ value: ">", label: "Greater than" },
											{ value: "<", label: "Less than" },
											{ value: "=", label: "Equals" },
											{ value: ">=", label: "Greater or equal" },
											{ value: "<=", label: "Less or equal" },
										]}
										fullWidth
									/>
								</div>
								<div className="flex-1">
									<Input
										type="number"
										value={conditionValue}
										onChange={(e) => setConditionValue(e.target.value)}
										placeholder="Value"
										fullWidth
									/>
								</div>
							</>
						)}
					</div>
				</div>

				<Select
					label="Severity"
					value={severity}
					onChange={setSeverity}
					options={[
						{ value: "INFO", label: "Info" },
						{ value: "WARNING", label: "Warning" },
						{ value: "ERROR", label: "Error" },
					]}
					fullWidth
				/>

				<Input
					label="Cooldown (minutes)"
					type="number"
					value={cooldownMinutes}
					onChange={(e) => setCooldownMinutes(e.target.value)}
					placeholder="e.g., 5"
					helperText="Minimum time between alerts for this rule"
					fullWidth
				/>

				<div>
					{/* biome-ignore lint/a11y/noLabelWithoutControl: section heading */}
					<label className="block text-sm font-medium text-foreground mb-2">
						Notification Channels
					</label>
					<div className="space-y-3">
						{notificationChannels.map((channel, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
							<Card key={index}>
								<CardBody>
									<div className="space-y-3">
										<Select
											label="Channel Type"
											value={channel.type}
											onChange={(value) => {
												const newChannels = [...notificationChannels];
												newChannels[index] = {
													type: value as "email" | "webhook" | "slack",
													config: {},
												};
												setNotificationChannels(newChannels);
											}}
											options={[
												{ value: "email", label: "Email" },
												{ value: "webhook", label: "Webhook" },
												{ value: "slack", label: "Slack" },
											]}
											fullWidth
										/>

										{channel.type === "email" && (
											<Input
												label="Email Address"
												placeholder="your-email@example.com"
												value={channel.config.email || ""}
												onChange={(e) => {
													const newChannels = [...notificationChannels];
													newChannels[index] = {
														...channel,
														config: { ...channel.config, email: e.target.value },
													};
													setNotificationChannels(newChannels);
												}}
												fullWidth
											/>
										)}

										{channel.type === "webhook" && (
											<Input
												label="Webhook URL"
												placeholder="https://your-webhook-url.com"
												value={channel.config.webhookUrl || ""}
												onChange={(e) => {
													const newChannels = [...notificationChannels];
													newChannels[index] = {
														...channel,
														config: { ...channel.config, webhookUrl: e.target.value },
													};
													setNotificationChannels(newChannels);
												}}
												fullWidth
											/>
										)}

										{channel.type === "slack" && (
											<Input
												label="Slack Webhook URL"
												placeholder="https://hooks.slack.com/services/..."
												value={channel.config.slackWebhookUrl || ""}
												onChange={(e) => {
													const newChannels = [...notificationChannels];
													newChannels[index] = {
														...channel,
														config: { ...channel.config, slackWebhookUrl: e.target.value },
													};
													setNotificationChannels(newChannels);
												}}
												fullWidth
											/>
										)}
									</div>
								</CardBody>
							</Card>
						))}
					</div>
				</div>

				<div className="flex justify-end gap-3 pt-4">
					<Button variant="secondary" type="button" onClick={onClose}>
						Cancel
					</Button>
					<Button type="submit" isLoading={loading}>
						{editingRule ? "Update Rule" : "Create Rule"}
					</Button>
				</div>
			</form>
		</Modal>
	);
}
