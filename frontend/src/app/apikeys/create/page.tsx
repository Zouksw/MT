"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { createRecord } from "@/lib/api";

const SCOPE_OPTIONS = [
	{ value: "read:datasets", label: "Read Datasets" },
	{ value: "write:datasets", label: "Write Datasets" },
	{ value: "read:timeseries", label: "Read Time Series" },
	{ value: "write:timeseries", label: "Write Time Series" },
	{ value: "admin", label: "Admin" },
];

export default function ApiKeyCreate() {
	const router = useRouter();
	const toast = useToast();
	const [saving, setSaving] = useState(false);

	const [name, setName] = useState("");
	const [scopes, setScopes] = useState<string[]>(["read:datasets", "read:timeseries"]);
	const [customScope, setCustomScope] = useState("");
	const [expiresAt, setExpiresAt] = useState("");

	const toggleScope = (value: string) => {
		setScopes((prev) =>
			prev.includes(value) ? prev.filter((s) => s !== value) : [...prev, value],
		);
	};

	const addCustomScope = () => {
		const trimmed = customScope.trim();
		if (trimmed && !scopes.includes(trimmed)) {
			setScopes((prev) => [...prev, trimmed]);
			setCustomScope("");
		}
	};

	const removeScope = (value: string) => {
		setScopes((prev) => prev.filter((s) => s !== value));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!name.trim()) {
			toast.showError("Please enter a name");
			return;
		}

		setSaving(true);
		try {
			const payload: Record<string, unknown> = { name: name.trim(), scopes };
			if (expiresAt) {
				payload.expiresAt = new Date(expiresAt).toISOString();
			}
			await createRecord("api-keys", payload);
			toast.showSuccess("API key created successfully");
			router.push("/apikeys");
		} catch (err: unknown) {
			toast.showError("Failed to create API key", err instanceof Error ? err.message : String(err));
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="min-h-screen bg-muted p-4 md:p-6">
			<div className="mx-auto max-w-2xl">
				{/* Page header */}
				<div className="mb-6">
					<h1 className="text-2xl font-semibold text-foreground">Create API Key</h1>
				</div>

				<form onSubmit={handleSubmit} className="flex flex-col gap-6">
					{/* API Key Information */}
					<Card>
						<CardHeader>
							<div>
								<CardTitle>API Key Information</CardTitle>
								<p className="text-sm text-muted-foreground mt-1">Configure your new API key</p>
							</div>
						</CardHeader>
						<CardBody>
							<div className="flex flex-col gap-4">
								<Input
									label="Key Name"
									placeholder="Production API Key"
									value={name}
									onChange={(e) => setName(e.target.value)}
									error={!name.trim() && saving ? "Please enter a name" : undefined}
									fullWidth
								/>

								{/* Scopes */}
								<div>
									{/* biome-ignore lint/a11y/noLabelWithoutControl: section heading */}
									<label className="block text-sm font-medium text-foreground mb-2">Scopes</label>
									<div className="flex flex-wrap gap-2 mb-2">
										{SCOPE_OPTIONS.map((opt) => (
											<button type="button"
												key={opt.value}
												onClick={() => toggleScope(opt.value)}
												className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
													scopes.includes(opt.value)
														? "bg-primary-light dark:bg-primary/20 text-primary dark:text-primary border-primary/30"
														: "bg-gray-50 dark:bg-gray-800 text-muted-foreground border hover:border-primary/50"
												}`}
											>
												{opt.label}
											</button>
										))}
										{/* Custom scopes added by user */}
										{scopes
											.filter((s) => !SCOPE_OPTIONS.some((o) => o.value === s))
											.map((s) => (
												<span
													key={s}
													className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-primary/10 dark:bg-primary/15 text-primary border border-primary/20 dark:border-primary/20"
												>
													{s}
													<button type="button"
														onClick={() => removeScope(s)}
														className="ml-1 hover:opacity-70"
													>
														x
													</button>
												</span>
											))}
									</div>
									{/* Add custom scope */}
									<div className="flex gap-2">
										<Input
											placeholder="Add custom scope"
											value={customScope}
											onChange={(e) => setCustomScope(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													addCustomScope();
												}
											}}
										/>
										<Button
											variant="secondary"
											size="sm"
											onClick={addCustomScope}
											disabled={!customScope.trim()}
										>
											Add
										</Button>
									</div>
									<p className="text-xs text-muted-foreground mt-2">
										Select the permissions this API key should have. You can add custom scopes by
										typing.
									</p>
								</div>
							</div>
						</CardBody>
					</Card>

					{/* Security Settings */}
					<Card>
						<CardHeader>
							<div>
								<CardTitle>Security Settings</CardTitle>
								<p className="text-sm text-muted-foreground mt-1">
									Configure expiration and access limits
								</p>
							</div>
						</CardHeader>
						<CardBody>
							<div className="flex flex-col gap-3">
								<Input
									label="Expiration Date"
									type="datetime-local"
									value={expiresAt}
									onChange={(e) => setExpiresAt(e.target.value)}
									fullWidth
								/>
								<p className="text-xs text-muted-foreground">
									API keys that expire provide better security. Consider setting an expiration date
									for production keys.
								</p>
							</div>
						</CardBody>
					</Card>

					{/* Form actions */}
					<div className="flex gap-3">
						<Button variant="primary" isLoading={saving} type="submit">
							Create API Key
						</Button>
						<Button variant="ghost" onClick={() => router.push("/apikeys")}>
							Cancel
						</Button>
					</div>
				</form>
			</div>
		</div>
	);
}
