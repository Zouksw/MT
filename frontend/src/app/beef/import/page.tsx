"use client";

import { ChevronRight, Download, Upload } from "lucide-react";
import { useState } from "react";
import { CSVDropzone } from "@/components/beef/CSVDropzone";
import { ImportResultTable } from "@/components/beef/ImportResultTable";
import { PageContainer } from "@/components/layout/PageContainer";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { useBeefImport } from "@/hooks/useBeefImport";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";
import { beefFetcher } from "@/lib/beef";
import { API_BASE } from "@/lib/config";

/**
 * Beef price CSV import page — the no-API-key real-data injection point.
 *
 * This is the answer to "where do I inject real beef data?": an admin uploads
 * a CSV of actual cut-level prices here. The backend parses, validates, and
 * upserts each row with source='manual:<uploader>', which the freshness
 * framework classifies as 'live' — turning the SnapshotBanner off and
 * unlocking per-cut AI forecasts without any scraper API key.
 *
 * ADMIN-only on the backend (authorize("ADMIN")). Non-admins who land here
 * will see the 403 surfaced by useBeefImport.
 */
export default function BeefImportPage() {
	const [file, setFile] = useState<File | null>(null);
	const { status, result, error, upload, reset } = useBeefImport();

	// Factory + cut lookup tables help the operator write valid CSVs without
	// guessing codes. Both endpoints are public GETs.
	const { data: factoriesData } = useRetryableFetch("/api/beef/factories", beefFetcher);
	const { data: cutsData } = useRetryableFetch("/api/beef/cuts", beefFetcher);
	const factories = factoriesData?.data?.factories ?? [];
	const cuts = cutsData?.data?.cuts ?? [];

	const isUploading = status === "uploading";

	function handleUpload() {
		if (file) upload(file);
	}

	function handleReset() {
		setFile(null);
		reset();
	}

	function downloadTemplate() {
		// Direct download from the backend template endpoint.
		const base = API_BASE;
		window.open(`${base}/api/beef/import/template`, "_blank");
	}

	return (
		<PageContainer>
			{/* Breadcrumb */}
			<div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
				<a href="/" className="hover:text-primary">
					Home
				</a>
				<ChevronRight className="size-3" />
				<a href="/beef" className="hover:text-primary">
					Beef Market
				</a>
				<ChevronRight className="size-3" />
				<span>Import Prices</span>
			</div>

			<PageHeader
				title="Import Beef Prices"
				description="Upload a CSV of real cut-level prices. Manual imports are marked 'live' and unlock AI forecasts — no API key required."
			/>

			<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
				{/* Left: upload + result */}
				<div className="lg:col-span-2 space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Upload CSV</CardTitle>
						</CardHeader>
						<CardBody className="space-y-4">
							{status !== "success" && status !== "error" && (
								<>
									<CSVDropzone onFileSelected={setFile} disabled={isUploading} />
									<div className="flex items-center justify-between">
										<button
											type="button"
											onClick={downloadTemplate}
											className="flex items-center gap-1.5 text-sm text-primary hover:underline"
										>
											<Download className="size-4" />
											Download CSV template
										</button>
										<Button
											onClick={handleUpload}
											disabled={!file || isUploading}
											isLoading={isUploading}
											icon={<Upload className="size-4" />}
										>
											{isUploading ? "Uploading..." : "Import"}
										</Button>
									</div>
								</>
							)}

							{status === "success" && result && (
								<div className="space-y-4">
									<ImportResultTable result={result} />
									<Button variant="outline" onClick={handleReset}>
										Upload another file
									</Button>
								</div>
							)}

							{status === "error" && (
								<div className="space-y-4">
									<Alert variant="error" title="Import failed">
										{error}
									</Alert>
									<Button variant="outline" onClick={handleReset}>
										Try again
									</Button>
								</div>
							)}
						</CardBody>
					</Card>
				</div>

				{/* Right: reference tables + CSV contract */}
				<div className="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>CSV Format</CardTitle>
						</CardHeader>
						<CardBody>
							<div className="text-sm text-muted-foreground space-y-2">
								<p>Required columns (header row, case-insensitive):</p>
								<ul className="font-mono text-xs space-y-1 pl-2">
									<li>
										<span className="text-foreground">factoryCode</span> — see table below
									</li>
									<li>
										<span className="text-foreground">cutCode</span> — see table below
									</li>
									<li>
										<span className="text-foreground">price</span> — numeric (e.g. 8.45)
									</li>
									<li>
										<span className="text-foreground">date</span> — YYYY-MM-DD
									</li>
								</ul>
								<p className="pt-1">Optional: currency (USD), unit (USD/kg), grade.</p>
							</div>
						</CardBody>
					</Card>

					{factories.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle>Factory Codes ({factories.length})</CardTitle>
							</CardHeader>
							<CardBody>
								<div className="max-h-48 overflow-y-auto space-y-1">
									{factories.map((f: { code: string; name: string; country: string }) => (
										<div key={f.code} className="flex items-center justify-between text-xs">
											<code className="text-primary">{f.code}</code>
											<span className="text-muted-foreground truncate ml-2">
												{f.name} ({f.country})
											</span>
										</div>
									))}
								</div>
							</CardBody>
						</Card>
					)}

					{cuts.length > 0 && (
						<Card>
							<CardHeader>
								<CardTitle>Cut Codes ({cuts.length})</CardTitle>
							</CardHeader>
							<CardBody>
								<div className="max-h-48 overflow-y-auto flex flex-wrap gap-1">
									{cuts.map((c: { cutCode: string; nameEn: string }) => (
										<span
											key={c.cutCode}
											title={c.nameEn}
											className="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-mono text-gray-600 dark:text-gray-400"
										>
											{c.cutCode}
										</span>
									))}
								</div>
							</CardBody>
						</Card>
					)}
				</div>
			</div>
		</PageContainer>
	);
}
