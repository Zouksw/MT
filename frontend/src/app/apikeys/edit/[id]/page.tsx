"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import React, { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

interface ApiKeyEditPageProps {
	params: Promise<{ id: string }>;
}

export default function ApiKeyEditPage({ params }: ApiKeyEditPageProps) {
	const { id } = React.use(params);
	const router = useRouter();
	const toast = useToast();

	const [_loading, _setLoading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [apiKey, setApiKey] = useState<Record<string, unknown> | null>(null);
	const [isLoadingKey, setIsLoadingKey] = useState(true);

	// Form state
	const [name, setName] = useState("");
	const [isActive, setIsActive] = useState(true);
	const [initialized, setInitialized] = useState(false);

	// Fetch API key data
	useEffect(() => {
		async function fetchKey() {
			try {
				const { tokenManager } = await import("@/lib/tokenManager");
				const token = tokenManager.getToken();
				const response = await fetch(
					`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/api-keys/${id}`,
					{
						headers: {
							"Content-Type": "application/json",
							...(token ? { Authorization: `Bearer ${token}` } : {}),
						},
						credentials: "include",
					},
				);
				if (!response.ok) throw new Error("Failed to fetch API key");
				const result = await response.json();
				const data = result.data || result;
				setApiKey(data);
				if (!initialized) {
					setName(data.name || "");
					setIsActive(data.isActive ?? true);
					setInitialized(true);
				}
			} catch {
				toast.showError("Failed to load API key data");
			} finally {
				setIsLoadingKey(false);
			}
		}
		fetchKey();
	}, [id, initialized, toast]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) {
			toast.showError("Please enter a name");
			return;
		}

		setSaving(true);
		try {
			const { tokenManager } = await import("@/lib/tokenManager");
			const token = tokenManager.getToken();
			const response = await fetch(
				`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/api-keys/${id}`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
						...(token ? { Authorization: `Bearer ${token}` } : {}),
					},
					credentials: "include",
					body: JSON.stringify({ name: name.trim(), isActive }),
				},
			);

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to update API key");
			}

			toast.showSuccess("API Key Updated Successfully", "The API key has been updated.");

			setTimeout(() => {
				router.push("/apikeys");
			}, 1000);
		} catch (error: unknown) {
			toast.showError("Failed to Update API Key", error instanceof Error ? error.message : String(error));
		} finally {
			setSaving(false);
		}
	};

	if (isLoadingKey) {
		return (
			<div className="min-h-screen bg-muted p-4 md:p-6">
				<div className="mx-auto max-w-2xl">
					<Card>
						<CardBody>
							<Alert variant="info">Loading API key data...</Alert>
						</CardBody>
					</Card>
				</div>
			</div>
		);
	}

	if (!apiKey) {
		return (
			<div className="min-h-screen bg-muted p-4 md:p-6">
				<div className="mx-auto max-w-2xl">
					<Card>
						<CardBody>
							<Alert variant="error">API key not found</Alert>
						</CardBody>
					</Card>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-muted p-4 md:p-6">
			<div className="mx-auto max-w-[700px]">
				{/* Page Header */}
				<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
					<div>
						<h1 className="text-2xl font-semibold text-foreground">Edit API Key</h1>
						<p className="text-sm text-muted-foreground mt-1">Update API key: {apiKey.name as string}</p>
					</div>
					<Button
						variant="ghost"
						icon={<ArrowLeft className="size-[14px]" />}
						onClick={() => router.push("/apikeys")}
					>
						Back to API Keys
					</Button>
				</div>

				{/* Info alert */}
				<div className="mb-6">
					<Alert variant="info" title="API Key Settings">
						You can update the name or active status of your API key. The key value itself cannot be
						changed for security reasons.
					</Alert>
				</div>

				<form onSubmit={handleSubmit}>
					<Card>
						<CardHeader>
							<div>
								<CardTitle>API Key Details</CardTitle>
								<p className="text-sm text-muted-foreground mt-1">Update API key information</p>
							</div>
						</CardHeader>
						<CardBody>
							<div className="flex flex-col gap-6">
								{/* API Key Name */}
								<Input
									label="API Key Name"
									placeholder="e.g., Production App Key"
									value={name}
									onChange={(e) => setName(e.target.value)}
									fullWidth
								/>

								{/* Key Information - Read Only */}
								<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
									<div>
										<span className="block text-xs text-muted-foreground mb-1">Key ID</span>
										<div className="font-mono text-sm text-gray-900 dark:text-gray-100">
											{String(apiKey.id).slice(0, 8)}...
										</div>
									</div>
									<div>
										<span className="block text-xs text-muted-foreground mb-1">
											Last Characters
										</span>
										<div className="font-mono text-sm text-gray-900 dark:text-gray-100">
											...
											{(apiKey.lastCharacters as number)?.toString(16).toUpperCase().padStart(8, "0") || "N/A"}
										</div>
									</div>
								</div>

								{/* Active Status */}
								<div>
									{/* biome-ignore lint/a11y/noLabelWithoutControl: section heading */}
									<label className="block text-sm font-medium text-foreground mb-2">Status</label>
									<button type="button"
										onClick={() => setIsActive(!isActive)}
										className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
											isActive ? "bg-green-500" : "bg-gray-300 dark:bg-gray-600"
										}`}
									>
										<span
											className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
												isActive ? "translate-x-6" : "translate-x-1"
											}`}
										/>
									</button>
									<span className="ml-3 text-sm text-foreground">
										{isActive ? "Active" : "Inactive"}
									</span>
								</div>

								{/* Usage Statistics - Read Only */}
								{apiKey.usageCount !== undefined && (
									<div>
										<span className="block text-xs text-muted-foreground mb-2">
											Usage Statistics
										</span>
										<div className="text-sm text-gray-900 dark:text-gray-100">
											Total requests: <span className="font-semibold">{String(apiKey.usageCount)}</span>
										</div>
										{!!apiKey.lastUsedAt && (
											<div className="text-sm text-muted-foreground mt-1">
												Last used: {new Date(String(apiKey.lastUsedAt)).toLocaleString()}
											</div>
										)}
									</div>
								)}

								{/* Form actions */}
								<div className="flex gap-3 pt-4">
									<Button variant="primary" isLoading={saving} type="submit">
										Update API Key
									</Button>
									<Button variant="ghost" onClick={() => router.push("/apikeys")}>
										Cancel
									</Button>
								</div>
							</div>
						</CardBody>
					</Card>
				</form>
			</div>
		</div>
	);
}
