"use client";

import { UploadCloud } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * CSVDropzone — a reusable drag-and-drop / file-picker for CSV uploads.
 *
 * This is the first file-input component in the app; it establishes the
 * pattern subsequent upload surfaces (if any) should follow. Validates
 * extension + size client-side so we never send an obviously-wrong file
 * over the wire.
 *
 * Controlled: the parent owns the selected file via `onFileSelected`. The
 * dropzone itself only manages drag highlight + invalid-reason display.
 */
export interface CSVDropzoneProps {
	/** Called when a valid file is selected (passes null when cleared). */
	onFileSelected: (file: File | null) => void;
	/** Max file size in bytes (default 10MB, matching the backend multer limit). */
	maxSizeBytes?: number;
	/** Whether the parent is currently uploading (disables interaction). */
	disabled?: boolean;
	className?: string;
}

const DEFAULT_MAX = 10 * 1024 * 1024; // 10MB — mirrors backend multer limit.

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function CSVDropzone({
	onFileSelected,
	maxSizeBytes = DEFAULT_MAX,
	disabled = false,
	className,
}: CSVDropzoneProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const inputId = useId();
	const [isDragging, setIsDragging] = useState(false);
	const [selectedFile, setSelectedFile] = useState<File | null>(null);
	const [error, setError] = useState<string | null>(null);

	function validateAndAccept(file: File) {
		const lowerName = file.name.toLowerCase();
		if (!lowerName.endsWith(".csv") && file.type !== "text/csv") {
			setError("File must be a .csv");
			setSelectedFile(null);
			onFileSelected(null);
			return;
		}
		if (file.size > maxSizeBytes) {
			setError(`File is ${formatBytes(file.size)} — max is ${formatBytes(maxSizeBytes)}`);
			setSelectedFile(null);
			onFileSelected(null);
			return;
		}
		setError(null);
		setSelectedFile(file);
		onFileSelected(file);
	}

	function handleDrop(e: React.DragEvent<HTMLDivElement>) {
		e.preventDefault();
		setIsDragging(false);
		if (disabled) return;
		const file = e.dataTransfer.files?.[0];
		if (file) validateAndAccept(file);
	}

	function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (file) validateAndAccept(file);
		// Reset the input value so selecting the same file again re-fires.
		e.target.value = "";
	}

	function handleClear() {
		setSelectedFile(null);
		setError(null);
		onFileSelected(null);
	}

	return (
		<div className={className}>
			<div
				role="button"
				tabIndex={0}
				aria-disabled={disabled}
				onClick={() => !disabled && inputRef.current?.click()}
				onKeyDown={(e) => {
					if ((e.key === "Enter" || e.key === " ") && !disabled) {
						e.preventDefault();
						inputRef.current?.click();
					}
				}}
				onDragOver={(e) => {
					e.preventDefault();
					if (!disabled) setIsDragging(true);
				}}
				onDragLeave={() => setIsDragging(false)}
				onDrop={handleDrop}
				className={cn(
					"flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors cursor-pointer",
					isDragging
						? "border-primary bg-primary/5"
						: "border-gray-300 dark:border-gray-700 hover:border-primary/50",
					disabled && "opacity-50 cursor-not-allowed",
				)}
			>
				<input
					ref={inputRef}
					id={inputId}
					type="file"
					accept=".csv,text/csv"
					className="hidden"
					onChange={handleInputChange}
					disabled={disabled}
				/>
				{selectedFile ? (
					<>
						<UploadCloud className="size-8 text-primary" />
						<div className="text-sm font-medium text-foreground">{selectedFile.name}</div>
						<div className="text-xs text-muted-foreground">{formatBytes(selectedFile.size)}</div>
						<button
							type="button"
							onClick={(e) => {
								e.stopPropagation();
								handleClear();
							}}
							className="text-xs text-muted-foreground hover:text-destructive underline mt-1"
						>
							Choose a different file
						</button>
					</>
				) : (
					<>
						<UploadCloud className="size-8 text-muted-foreground" />
						<div className="text-sm font-medium text-foreground">
							Drop CSV here, or click to browse
						</div>
						<div className="text-xs text-muted-foreground">
							.csv up to {formatBytes(maxSizeBytes)}
						</div>
					</>
				)}
			</div>
			{error && <p className="mt-2 text-sm text-destructive">{error}</p>}
		</div>
	);
}

export default CSVDropzone;
