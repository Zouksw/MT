/**
 * API Key Detail Page
 *
 * Displays detailed information about a specific API key including:
 * - API key metadata (name, permissions, scopes)
 * - Usage statistics and rate limits
 * - Activity log
 * - Security settings (IP whitelist, expiration)
 */

"use client";

import { Copy, Eye, Home, Key, Pencil, RefreshCw, Shield, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Table } from "@/components/ui/Table";
import { Tag } from "@/components/ui/Tag";
import { useToast } from "@/components/ui/Toast";
import { useIsMobile } from "@/lib/responsive-utils";
import { authFetch } from "@/utils/auth";

// --- Types ---

interface ApiKeyDetailParams {
	id: string;
}

interface ApiKeyWithDetails {
	id: string;
	name: string;
	key?: string;
	createdAt: string;
	lastUsed?: string;
	usageCount?: number;
	rateLimit?: {
		limit: number;
		remaining: number;
		window: string;
	};
	permissions?: string[];
	ipWhitelist?: string[];
	expiresAt?: string;
	keyPreview?: string;
}

interface ApiUsageLog {
	id: string;
	timestamp: string;
	endpoint: string;
	method: string;
	statusCode: number;
	responseTime: number;
	ip: string;
}

// --- Progress bar sub-component ---

function ProgressBar({ percent, status }: { percent: number; status: "exception" | "active" }) {
	const barColor = status === "exception" ? "bg-red-500" : "bg-green-500";
	return (
		<div className="w-full h-2 bg-muted rounded-full overflow-hidden">
			<div
				className={`h-full rounded-full transition-all duration-300 ${barColor}`}
				style={{ width: `${Math.min(percent, 100)}%` }}
			/>
		</div>
	);
}

// --- Usage log table columns ---

const usageLogColumns = [
	{
		key: "timestamp",
		title: "Timestamp",
		dataIndex: "timestamp" as const,
		render: (timestamp: unknown) => new Date(timestamp as string).toLocaleString(),
	},
	{
		key: "endpoint",
		title: "Endpoint",
		dataIndex: "endpoint" as const,
	},
	{
		key: "method",
		title: "Method",
		dataIndex: "method" as const,
		width: 80,
		render: (method: unknown) => {
			const m = method as string;
			return <Tag color={m === "GET" ? "success" : m === "POST" ? "info" : "warning"}>{m}</Tag>;
		},
	},
	{
		key: "statusCode",
		title: "Status",
		dataIndex: "statusCode" as const,
		width: 100,
		render: (status: unknown) => {
			const s = status as number;
			const color = s >= 200 && s < 300 ? "success" : s >= 300 && s < 400 ? "warning" : "error";
			return <Tag color={color}>{s}</Tag>;
		},
	},
	{
		key: "responseTime",
		title: "Response Time",
		dataIndex: "responseTime" as const,
		width: 120,
		render: (time: number) => `${time}ms`,
	},
	{
		key: "ip",
		title: "IP Address",
		dataIndex: "ip" as const,
	},
];

// --- Main component ---

export default function ApiKeyDetailPage({ params }: { params: Promise<ApiKeyDetailParams> }) {
	const { id } = use(params);
	const router = useRouter();
	const toast = useToast();
	const isMobile = useIsMobile();

	const [apiKey, setApiKey] = useState<ApiKeyWithDetails | null>(null);
	const [usageLogs, setUsageLogs] = useState<ApiUsageLog[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [confirmModal, setConfirmModal] = useState<{
		open: boolean;
		title: string;
		message: string;
		confirmLabel: string;
		onConfirm: () => void;
	}>({ open: false, title: "", message: "", confirmLabel: "", onConfirm: () => {} });

	const fetchApiKey = useCallback(async () => {
		if (!id) {
			setError("API Key ID is required");
			setLoading(false);
			return;
		}

		try {
			setLoading(true);
			const response = await authFetch(`/api/apikeys/${id}`);
			if (!response.ok) throw new Error("Failed to fetch API key");
			const data = await response.json();
			setApiKey({
				...(data.data || data),
				keyPreview: `${(data.data || data).key?.substring(0, 8)}${(data.data || data).key?.slice(-4)}`,
			});
		} catch {
			setError("Unknown error");
		} finally {
			setLoading(false);
		}
	}, [id]);

	const fetchUsageLogs = useCallback(async () => {
		if (!id) return;

		try {
			const response = await authFetch(`/api/apikeys/${id}/usage`);
			if (response.ok) {
				const data = await response.json();
				setUsageLogs(data.data || data.items || []);
			}
		} catch {
			// eslint-disable-next-line no-console
			console.error("Failed to fetch usage logs:");
		}
	}, [id]);

	useEffect(() => {
		fetchApiKey();
		fetchUsageLogs();
	}, [fetchApiKey, fetchUsageLogs]);

	const handleCopyKey = () => {
		if (apiKey?.key) {
			navigator.clipboard.writeText(apiKey.key);
			toast.showSuccess("API key copied to clipboard");
		}
	};

	const handleRegenerate = () => {
		setConfirmModal({
			open: true,
			title: "Regenerate API Key",
			message:
				"Regenerating this API key will invalidate the current key immediately. Any existing integrations using this key will stop working until they are updated with the new key.",
			confirmLabel: "Regenerate",
			onConfirm: async () => {
				try {
					const response = await authFetch(`/api/apikeys/${id}/regenerate`, { method: "POST" });
					if (!response.ok) throw new Error("Failed to regenerate API key");
					const data = await response.json();
					const newKey = data.data || data;
					setApiKey({
						// biome-ignore lint/style/noNonNullAssertion: value guaranteed by middleware
						...apiKey!,
						...(typeof newKey === "object" ? newKey : {}),
						keyPreview: newKey.key
							? `${newKey.key.substring(0, 8)}${newKey.key.slice(-4)}`
							: apiKey?.keyPreview,
					});
					toast.showSuccess("API key regenerated successfully. Make sure to copy the new key.");
				} catch {
					toast.showError("Failed to regenerate API key");
				}
				setConfirmModal((prev) => ({ ...prev, open: false }));
			},
		});
	};

	const handleRevoke = () => {
		setConfirmModal({
			open: true,
			title: "Revoke API Key",
			message:
				"Revoking this API key will permanently disable it. Any applications using this key will lose access immediately.",
			confirmLabel: "Revoke",
			onConfirm: async () => {
				try {
					const response = await authFetch(`/api/apikeys/${id}`, { method: "DELETE" });
					if (!response.ok) throw new Error("Failed to revoke API key");
					toast.showSuccess("API key revoked");
					router.push("/apikeys");
				} catch {
					toast.showError("Failed to revoke API key");
				}
				setConfirmModal((prev) => ({ ...prev, open: false }));
			},
		});
	};

	// Loading state
	if (loading) {
		return (
			<div className="min-h-[400px] flex items-center justify-center">
				<div className="text-center">
					<div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-r-transparent" />
					<p className="mt-3 text-sm text-muted-foreground">Loading...</p>
				</div>
			</div>
		);
	}

	// Error state
	if (error || !apiKey) {
		return (
			<div className="min-h-[400px] flex items-center justify-center p-6">
				<Card className="max-w-[500px] w-full">
					<CardBody className="text-center">
						<h3 className="text-red-600 dark:text-red-400 text-lg font-semibold mb-4">Error</h3>
						<p className="text-muted-foreground mb-6">{error || "API key not found"}</p>
						<Button variant="primary" onClick={() => window.history.back()}>
							Go Back
						</Button>
					</CardBody>
				</Card>
			</div>
		);
	}

	const breadcrumb = [{ label: "API Keys", href: "/apikeys" }, { label: apiKey.name || "API Key" }];

	const isExpired = apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();

	return (
		<div className="min-h-screen bg-muted p-4 md:p-6">
			{/* Confirm modal */}
			<Modal
				open={confirmModal.open}
				onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
				title={confirmModal.title}
				footer={
					<>
						<Button
							variant="secondary"
							onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
						>
							Cancel
						</Button>
						<Button variant="danger" onClick={confirmModal.onConfirm}>
							{confirmModal.confirmLabel}
						</Button>
					</>
				}
			>
				<p className="text-sm text-foreground">{confirmModal.message}</p>
			</Modal>

			{/* Breadcrumb */}
			<nav className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
				<a href="/" className="hover:text-primary inline-flex items-center gap-1">
					<Home className="size-3" />
					<span>Home</span>
				</a>
				{breadcrumb.map((item, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
					<span key={i} className="flex items-center gap-2">
						<span className="text-muted-foreground">/</span>
						{item.href ? (
							<a href={item.href} className="hover:text-primary">
								{item.label}
							</a>
						) : (
							<span className="text-gray-900 dark:text-gray-100">{item.label}</span>
						)}
					</span>
				))}
			</nav>

			{/* Page Header */}
			<div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
				<div>
					<h1 className="text-2xl font-semibold text-foreground">{apiKey.name}</h1>
					<p className="text-sm text-muted-foreground mt-1">
						Created {new Date(apiKey.createdAt).toLocaleString()}
					</p>
				</div>
				<div className="flex flex-wrap gap-2">
					<Button
						variant="ghost"
						size="sm"
						icon={<Copy className="size-3.5" />}
						onClick={handleCopyKey}
					>
						{!isMobile && "Copy Key"}
					</Button>
					<Button
						variant="ghost"
						size="sm"
						icon={<RefreshCw className="size-3.5" />}
						onClick={handleRegenerate}
					>
						{!isMobile && "Regenerate"}
					</Button>
					<a href={`/apikeys/edit/${apiKey.id}`}>
						<Button variant="ghost" size="sm" icon={<Pencil className="size-3.5" />}>
							{!isMobile && "Edit"}
						</Button>
					</a>
					<Button
						variant="danger"
						size="sm"
						icon={<Trash2 className="size-3.5" />}
						onClick={handleRevoke}
					>
						{!isMobile && "Revoke"}
					</Button>
				</div>
			</div>

			{/* Expired warning */}
			{isExpired && (
				<div className="mb-6">
					<Alert variant="error" title="This API key has expired" closable>
						Please regenerate or create a new API key to continue using the API
					</Alert>
				</div>
			)}

			{/* Main content grid */}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
				{/* Key Information Card */}
				<Card>
					<CardHeader>
						<CardTitle>API Key Information</CardTitle>
					</CardHeader>
					<CardBody>
						<div className="flex flex-col gap-4">
							{/* Key-Value pairs */}
							<div>
								<span className="text-xs text-muted-foreground">Key Name</span>
								<div className="font-semibold text-foreground mt-1">{apiKey.name}</div>
							</div>

							<div>
								<span className="text-xs text-muted-foreground">Key Preview</span>
								<div className="flex items-center gap-2 mt-1">
									<code className="text-xs px-1.5 py-0.5 bg-muted rounded font-mono text-foreground">
										{apiKey.keyPreview}
									</code>
									<Button
										variant="ghost"
										size="sm"
										icon={<Copy className="size-3.5" />}
										onClick={handleCopyKey}
									>
										Copy
									</Button>
								</div>
							</div>

							<div>
								<span className="text-xs text-muted-foreground">Status</span>
								<div className="mt-1">
									<Tag color={isExpired ? "error" : "success"}>
										{isExpired ? "Expired" : "Active"}
									</Tag>
								</div>
							</div>

							{/* Total Usage statistic */}
							<div className="pt-2 border-t border">
								<span className="text-xs text-muted-foreground">Total Usage</span>
								<div className="flex items-center gap-2 mt-1">
									<Key className="size-3.5" />
									<span className="text-2xl font-semibold data-text text-foreground">
										{apiKey.usageCount || 0}
									</span>
									<span className="text-sm text-muted-foreground">requests</span>
								</div>
							</div>

							{apiKey.lastUsed && (
								<div>
									<span className="text-xs text-muted-foreground">Last used</span>
									<div className="text-sm text-foreground mt-1">
										{new Date(apiKey.lastUsed).toLocaleString()}
									</div>
								</div>
							)}
						</div>
					</CardBody>
				</Card>

				{/* Rate Limit Card */}
				{apiKey.rateLimit && (
					<Card>
						<CardHeader>
							<CardTitle>Rate Limit</CardTitle>
						</CardHeader>
						<CardBody>
							<div className="flex flex-col gap-3">
								<ProgressBar
									percent={(apiKey.rateLimit.remaining / apiKey.rateLimit.limit) * 100}
									status={
										apiKey.rateLimit.remaining < apiKey.rateLimit.limit * 0.2
											? "exception"
											: "active"
									}
								/>
								<span className="text-sm text-muted-foreground">
									{apiKey.rateLimit.remaining} / {apiKey.rateLimit.limit} requests remaining (
									{apiKey.rateLimit.window})
								</span>
							</div>
						</CardBody>
					</Card>
				)}

				{/* Permissions Card */}
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between w-full">
							<CardTitle>Permissions</CardTitle>
							<a
								href={`/apikeys/edit/${apiKey.id}`}
								className="text-sm text-primary hover:underline"
							>
								Edit
							</a>
						</div>
					</CardHeader>
					<CardBody>
						{apiKey.permissions && apiKey.permissions.length > 0 ? (
							<div className="flex flex-wrap gap-2">
								{apiKey.permissions.map((permission) => (
									<Tag key={permission} color="info">
										{permission}
									</Tag>
								))}
							</div>
						) : (
							<span className="text-sm text-muted-foreground">Full permissions</span>
						)}
					</CardBody>
				</Card>

				{/* Security Settings Card */}
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between w-full">
							<CardTitle>Security Settings</CardTitle>
							<span className="text-gray-400">
								<Shield className="size-3.5" />
							</span>
						</div>
					</CardHeader>
					<CardBody>
						<div className="flex flex-col gap-3">
							{apiKey.ipWhitelist && apiKey.ipWhitelist.length > 0 && (
								<div>
									<span className="text-xs text-muted-foreground">IP Whitelist</span>
									<div className="flex flex-col gap-1 mt-1">
										{apiKey.ipWhitelist.map((ip, index) => (
											// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
											<Tag key={index} color="success">
												{ip}
											</Tag>
										))}
									</div>
								</div>
							)}
							{apiKey.expiresAt && (
								<div>
									<span className="text-xs text-muted-foreground">Expires</span>
									<div
										className={`text-sm mt-1 ${isExpired ? "text-red-600 dark:text-red-400" : "text-muted-foreground"}`}
									>
										{new Date(apiKey.expiresAt).toLocaleString()}
									</div>
								</div>
							)}
							{(!apiKey.ipWhitelist || apiKey.ipWhitelist.length === 0) && !apiKey.expiresAt && (
								<span className="text-sm text-muted-foreground">No restrictions configured</span>
							)}
						</div>
					</CardBody>
				</Card>
			</div>

			{/* Usage Log Table */}
			<div className="mt-6">
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between w-full">
							<CardTitle>Recent Usage</CardTitle>
							<Button variant="ghost" size="sm" onClick={fetchUsageLogs}>
								Refresh
							</Button>
						</div>
					</CardHeader>
					<CardBody>
						{usageLogs.length === 0 ? (
							<p className="text-sm text-muted-foreground p-6">
								No usage logs available for this API key.
							</p>
						) : (
							<Table<ApiUsageLog>
								columns={usageLogColumns}
								dataSource={usageLogs}
								rowKey="id"
								emptyText="No usage logs"
							/>
						)}
					</CardBody>
				</Card>
			</div>

			{/* Quick Actions */}
			<div className="mt-6">
				<Card>
					<CardHeader>
						<CardTitle>Quick Actions</CardTitle>
					</CardHeader>
					<CardBody>
						<div className="flex flex-wrap gap-3">
							<Button variant="ghost" icon={<Copy className="size-3.5" />} onClick={handleCopyKey}>
								Copy API Key
							</Button>
							<Button
								variant="ghost"
								icon={<RefreshCw className="size-3.5" />}
								onClick={handleRegenerate}
							>
								Regenerate Key
							</Button>
							<Button
								variant="ghost"
								icon={<Eye className="size-3.5" />}
								onClick={() => router.push("/docs/api")}
							>
								View API Docs
							</Button>
						</div>
					</CardBody>
				</Card>
			</div>
		</div>
	);
}
