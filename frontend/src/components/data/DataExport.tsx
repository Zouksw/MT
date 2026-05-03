"use client";

import { CircleCheck, Download, Info } from "lucide-react";
import type React from "react";
import { useState } from "react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Native download function (no external dependency needed)
const downloadFile = (blob: Blob, filename: string) => {
	const url = window.URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	window.URL.revokeObjectURL(url);
};

interface ExportFormat {
	id: string;
	name: string;
	extension: string;
	mimeType: string;
	description: string;
}

interface ExportConfig {
	timeseries: string;
	format: string;
	startTime?: number;
	endTime?: number;
	limit?: number;
	aggregation?: string;
}

interface DataPoint {
	timestamp: number;
	value: number;
}

interface DataExportProps {
	timeseries?: string;
	onExportComplete?: (filename: string, recordCount: number) => void;
}

const exportFormats: ExportFormat[] = [
	{
		id: "csv",
		name: "CSV",
		extension: "csv",
		mimeType: "text/csv",
		description: "Comma-separated values, compatible with Excel",
	},
	{
		id: "json",
		name: "JSON",
		extension: "json",
		mimeType: "application/json",
		description: "JavaScript Object Notation",
	},
	{
		id: "txt",
		name: "Plain Text",
		extension: "txt",
		mimeType: "text/plain",
		description: "Simple text format with timestamp and value",
	},
];

export const DataExport: React.FC<DataExportProps> = ({
	timeseries: defaultTimeseries = "root.test2",
	onExportComplete,
}) => {
	const [modalVisible, setModalVisible] = useState(false);
	const [exporting, setExporting] = useState(false);
	const [progress, setProgress] = useState(0);

	const [formState, setFormState] = useState({
		timeseries: defaultTimeseries,
		format: "csv",
		limit: 10000,
		startDate: "",
		endDate: "",
	});

	const showToast = (type: "success" | "warning" | "error", msg: string) => {
		// Simple toast via DOM for now — replace with useToast if available
		const el = document.createElement("div");
		el.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
			type === "success"
				? "bg-emerald-50 text-emerald-800 border border-emerald-200"
				: type === "warning"
					? "bg-amber-50 text-amber-800 border border-amber-200"
					: "bg-red-50 text-red-800 border border-red-200"
		}`;
		el.textContent = msg;
		document.body.appendChild(el);
		setTimeout(() => {
			el.style.opacity = "0";
			setTimeout(() => el.remove(), 300);
		}, 3000);
	};

	const exportData = async (config: ExportConfig) => {
		setExporting(true);
		setProgress(0);

		try {
			// Build query parameters
			const params = new URLSearchParams();
			params.append("timeseries", config.timeseries);
			if (config.limit) params.append("limit", config.limit.toString());
			if (config.startTime) params.append("start_time", config.startTime.toString());
			if (config.endTime) params.append("end_time", config.endTime.toString());

			// Simulate progress
			const progressInterval = setInterval(() => {
				setProgress((prev) => {
					if (prev >= 90) {
						clearInterval(progressInterval);
						return 90;
					}
					return prev + 10;
				});
			}, 200);

			// Fetch data
			const token = (await import("@/lib/tokenManager")).tokenManager.getToken();
			const response = await fetch(`/api/iotdb/query?${params.toString()}`, {
				headers: {
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
			});

			clearInterval(progressInterval);
			setProgress(95);

			if (!response.ok) {
				throw new Error("Failed to fetch data for export");
			}

			const result = await response.json();
			const data: DataPoint[] = result.data || [];

			if (data.length === 0) {
				showToast("warning", "No data available for the specified criteria");
				setExporting(false);
				setProgress(0);
				return;
			}

			// Generate filename
			const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
			const sanitizedTimeseries = config.timeseries.replace(/[^a-zA-Z0-9_-]/g, "_");
			const formatConfig = exportFormats.find((f) => f.id === config.format)!;
			const filename = `${sanitizedTimeseries}_export_${timestamp}.${formatConfig.extension}`;

			// Export based on format
			switch (config.format) {
				case "csv":
					await exportToCSV(data, filename);
					break;
				case "json":
					await exportToJSON(data, filename);
					break;
				case "txt":
					await exportToTxt(data, filename);
					break;
				default:
					throw new Error("Unsupported export format");
			}

			setProgress(100);
			showToast("success", `Exported ${data.length} records to ${filename}`);

			onExportComplete?.(filename, data.length);

			setTimeout(() => {
				setModalVisible(false);
				setExporting(false);
				setProgress(0);
				setFormState({
					timeseries: defaultTimeseries,
					format: "csv",
					limit: 10000,
					startDate: "",
					endDate: "",
				});
			}, 1000);
		} catch (error: any) {
			showToast("error", `Export failed: ${error.message}`);
			setExporting(false);
			setProgress(0);
		}
	};

	const exportToCSV = async (data: DataPoint[], filename: string) => {
		const header = "timestamp,value\n";
		const rows = data
			.map((point) => `${new Date(point.timestamp).toISOString()},${point.value.toFixed(6)}`)
			.join("\n");
		const csv = header + rows;
		const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
		downloadFile(blob, filename);
	};

	const exportToJSON = async (data: DataPoint[], filename: string) => {
		const json = JSON.stringify(
			{
				timeseries: formState.timeseries,
				exportTime: new Date().toISOString(),
				recordCount: data.length,
				data: data.map((point) => ({
					timestamp: new Date(point.timestamp).toISOString(),
					value: point.value,
				})),
			},
			null,
			2,
		);
		const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
		downloadFile(blob, filename);
	};

	const exportToTxt = async (data: DataPoint[], filename: string) => {
		const txt = data
			.map((point) => `${new Date(point.timestamp).toISOString()}\t${point.value.toFixed(6)}`)
			.join("\n");
		const blob = new Blob([txt], { type: "text/plain;charset=utf-8;" });
		downloadFile(blob, filename);
	};

	const handleExport = () => {
		if (!formState.timeseries) return;

		const config: ExportConfig = {
			timeseries: formState.timeseries,
			format: formState.format,
			limit: formState.limit,
		};

		if (formState.startDate) {
			config.startTime = new Date(formState.startDate).getTime();
		}
		if (formState.endDate) {
			config.endTime = new Date(formState.endDate).getTime();
		}

		exportData(config);
	};

	const selectedFormat = exportFormats.find((f) => f.id === formState.format);

	return (
		<>
			{/* Export Button with DropdownMenu */}
			<DropdownMenu>
				<DropdownMenuTrigger className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-sm font-semibold hover:opacity-90 transition-opacity outline-none">
					<Download className="size-4" />
					Export Data
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-48">
					{exportFormats.map((format) => (
						<DropdownMenuItem
							key={format.id}
							onClick={() => {
								setFormState((s) => ({ ...s, format: format.id }));
								setModalVisible(true);
							}}
						>
							<span>{format.name}</span>
							<span className="ml-auto text-xs text-muted-foreground">.{format.extension}</span>
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>

			{/* Modal */}
			{modalVisible && (
				<div className="fixed inset-0 z-50 flex items-center justify-center">
					<div
						className="absolute inset-0 bg-black/40"
						onClick={() => {
							if (!exporting) {
								setModalVisible(false);
							}
						}}
					/>
					<div className="relative bg-card rounded-xl shadow-xl w-full max-w-150 mx-4 max-h-[90vh] overflow-y-auto">
						{/* Modal Header */}
						<div className="flex items-center gap-2 px-6 py-4 border-b border">
							<Download className="size-5 text-gray-500" />
							<h3 className="text-lg font-semibold text-gray-900 dark:text-white">Export Data</h3>
						</div>

						{/* Modal Body */}
						<div className="p-6">
							{exporting && (
								<div className="flex items-center justify-center py-8">
									<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
									<span className="ml-3 text-sm text-gray-500">Preparing export...</span>
								</div>
							)}

							<div className={exporting ? "opacity-50 pointer-events-none" : ""}>
								{/* Time Series */}
								<div className="mb-4">
									<label className="block text-sm font-medium text-foreground mb-1">
										Time Series
									</label>
									<input
										type="text"
										value={formState.timeseries}
										onChange={(e) => setFormState((s) => ({ ...s, timeseries: e.target.value }))}
										placeholder="e.g., root.test2"
										className="w-full px-3 py-2 border border-input rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none"
									/>
								</div>

								{/* Format + Limit row */}
								<div className="grid grid-cols-2 gap-4 mb-4">
									<div>
										<label className="block text-sm font-medium text-foreground mb-1">
											Export Format
										</label>
										<select
											value={formState.format}
											onChange={(e) => setFormState((s) => ({ ...s, format: e.target.value }))}
											className="w-full px-3 py-2 border border-input rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none"
										>
											{exportFormats.map((f) => (
												<option key={f.id} value={f.id}>
													{f.name} (.{f.extension})
												</option>
											))}
										</select>
									</div>
									<div>
										<label className="block text-sm font-medium text-foreground mb-1">
											Max Records
										</label>
										<input
											type="number"
											min={1}
											max={1000000}
											value={formState.limit}
											onChange={(e) =>
												setFormState((s) => ({ ...s, limit: parseInt(e.target.value, 10) || 1 }))
											}
											className="w-full px-3 py-2 border border-input rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none"
										/>
									</div>
								</div>

								{/* Time Range */}
								<div className="grid grid-cols-2 gap-4 mb-4">
									<div>
										<label className="block text-sm font-medium text-foreground mb-1">
											Start Time
										</label>
										<input
											type="datetime-local"
											value={formState.startDate}
											onChange={(e) => setFormState((s) => ({ ...s, startDate: e.target.value }))}
											className="w-full px-3 py-2 border border-input rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none"
										/>
									</div>
									<div>
										<label className="block text-sm font-medium text-foreground mb-1">
											End Time
										</label>
										<input
											type="datetime-local"
											value={formState.endDate}
											onChange={(e) => setFormState((s) => ({ ...s, endDate: e.target.value }))}
											className="w-full px-3 py-2 border border-input rounded-md text-sm bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-primary outline-none"
										/>
									</div>
								</div>

								{/* Progress */}
								{exporting && (
									<div className="mb-4">
										<div className="h-1 text-xs font-medium text-foreground mb-2">
											Export Progress
										</div>
										<div className="w-full h-2 bg-muted rounded-full overflow-hidden">
											<div
												className="h-full bg-primary rounded-full transition-all duration-300"
												style={{ width: `${progress}%` }}
											/>
										</div>
										{progress === 100 && (
											<div className="mt-3 flex items-center gap-2 text-sm text-emerald-600">
												<CircleCheck className="size-4" />
												Export completed successfully!
											</div>
										)}
									</div>
								)}

								<hr className="border my-4" />

								{/* Format info */}
								{selectedFormat && (
									<div className="p-3 bg-muted rounded-lg mb-4">
										<div className="text-sm font-medium text-foreground mb-1">
											Export Format Info
										</div>
										<p className="text-sm text-muted-foreground mb-2">
											{selectedFormat.description}
										</p>
										<div className="flex gap-2">
											<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground">
												{selectedFormat.extension.toUpperCase()}
											</span>
											<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground">
												MIME: {selectedFormat.mimeType}
											</span>
										</div>
									</div>
								)}

								{/* Tips */}
								<div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
									<Info className="size-4 text-blue-500 shrink-0 mt-0.5" />
									<div className="text-xs text-blue-700 dark:text-blue-300">
										<ul className="list-disc pl-4 space-y-0.5">
											<li>Large datasets may take longer to process</li>
											<li>CSV format is recommended for Excel compatibility</li>
											<li>Use time range filter to reduce export size</li>
										</ul>
									</div>
								</div>
							</div>
						</div>

						{/* Modal Footer */}
						<div className="flex justify-end gap-3 px-6 py-4 border-t border">
							<button
								onClick={() => {
									if (!exporting) {
										setModalVisible(false);
									}
								}}
								disabled={exporting}
								className="px-4 py-2 rounded-md border border-input text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50 transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={handleExport}
								disabled={exporting || !formState.timeseries}
								className="px-4 py-2 rounded-md bg-primary text-white text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors"
							>
								{exporting ? "Exporting..." : "Export"}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	);
};

export default DataExport;
