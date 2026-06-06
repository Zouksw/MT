"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { StatsCardSkeleton } from "./Skeleton";

export interface LoadingStateProps {
	loading: boolean;
	timeout?: number;
	onTimeout?: () => void;
	onCancel?: () => void;
	skeletonType?: "stats" | "table" | "form" | "card" | "inline";
	children: React.ReactNode;
	className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
	loading,
	timeout = 10000,
	onTimeout,
	onCancel,
	skeletonType = "stats",
	children,
	className,
}) => {
	const [timedOut, setTimedOut] = useState(false);
	const [_loadingId, setLoadingId] = useState(0);

	const prevLoadingRef = useRef(loading);
	if (prevLoadingRef.current !== loading) {
		prevLoadingRef.current = loading;
		if (!loading) setLoadingId((prev) => prev + 1);
	}

	const effectiveTimedOut = loading ? timedOut : false;

	useEffect(() => {
		if (!loading) return;
		const timer = setTimeout(() => {
			setTimedOut(true);
			onTimeout?.();
		}, timeout);
		return () => clearTimeout(timer);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loading, timeout, onTimeout]);

	if (!loading) return <>{children}</>;

	if (!effectiveTimedOut) {
		return (
			<div className={className}>
				{skeletonType === "stats" && <StatsCardSkeleton />}
				{(skeletonType === "table" || skeletonType === "form" || skeletonType === "card") && (
					<div className="flex items-center justify-center py-12">
						<div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
					</div>
				)}
				{skeletonType === "inline" && (
					<div className="flex items-center gap-2">
						<div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
						<span className="text-sm text-gray-500">Loading...</span>
					</div>
				)}
			</div>
		);
	}

	return (
		<div className={className}>
			<div
				className="flex items-start gap-3 px-4 py-3 rounded-lg border bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
				role="alert"
			>
				<span className="text-sm font-semibold mt-0.5">⚠</span>
				<div className="flex-1">
					<p className="font-semibold text-sm">Request Taking Longer Than Expected</p>
					<div className="mt-2 text-sm">
						<p>The request is taking longer than usual ({timeout / 1000}s).</p>
						<div className="flex gap-2 mt-3">
							{onCancel && (
								<Button variant="ghost" size="sm" onClick={onCancel}>
									Cancel
								</Button>
							)}
							{onTimeout && (
								<Button variant="primary" size="sm" onClick={onTimeout}>
									Retry
								</Button>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default LoadingState;
