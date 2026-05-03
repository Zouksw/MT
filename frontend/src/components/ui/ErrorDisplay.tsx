"use client";

import type React from "react";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { errorHandler, type SafeError } from "@/lib/errorHandler";
import { useToast } from "./Toast";

export interface ErrorDisplayProps {
	error: SafeError | Error | unknown;
	retry?: () => void;
	context?: string;
	showInline?: boolean;
	className?: string;
}

export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
	error,
	retry,
	context,
	showInline = true,
	className,
}) => {
	const { showError } = useToast();

	const safeError: SafeError =
		error instanceof Error && "message" in error && "shouldNotify" in error
			? (error as SafeError)
			: errorHandler.createSafeError(error);

	useEffect(() => {
		if (safeError.shouldNotify) {
			const msg = context ? `${context}: ${safeError.message}` : safeError.message;
			showError(msg, safeError.code);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [safeError.code, showError, safeError.shouldNotify, safeError.message, context]);

	if (!showInline || !safeError.shouldNotify) return null;

	const isRecoverable = errorHandler.isRecoverable(safeError);

	return (
		<div
			className={`flex items-start gap-3 px-4 py-3 rounded-lg border bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 ${className || ""}`}
			role="alert"
		>
			<span className="text-sm font-bold mt-0.5">✗</span>
			<div className="flex-1 min-w-0">
				<p className="font-semibold text-sm">{safeError.message}</p>
				<div className="mt-2">
					{safeError.code && (
						<small className="text-red-600/70 dark:text-red-400/70">
							Error code: {safeError.code}
						</small>
					)}
					{isRecoverable && retry && (
						<div className="mt-2">
							<Button variant="danger" size="sm" onClick={retry}>
								Retry
							</Button>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export const ErrorInline: React.FC<Omit<ErrorDisplayProps, "showInline">> = (props) => (
	<ErrorDisplay {...props} showInline={true} />
);

export const ErrorToastOnly: React.FC<ErrorDisplayProps> = (props) => (
	<ErrorDisplay {...props} showInline={false} />
);

export default ErrorDisplay;
