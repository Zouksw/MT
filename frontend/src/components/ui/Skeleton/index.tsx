"use client";

import type React from "react";

function ShimmerBlock({
	width = "100%",
	height = 20,
	className = "",
}: {
	width?: string | number;
	height?: number;
	className?: string;
}) {
	return (
		<div className={`bg-muted rounded animate-pulse ${className}`} style={{ width, height }} />
	);
}

export const StatsCardSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => (
	<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
		{Array.from({ length: count }).map((_, i) => (
			// biome-ignore lint/suspicious/noArrayIndexKey: decorative placeholder
			<div key={i} className="bg-card rounded-lg shadow-card dark:shadow-card-dark p-5">
				<ShimmerBlock width={120} height={24} className="mb-3" />
				<ShimmerBlock width={80} height={32} className="mb-2" />
				<ShimmerBlock width={100} height={14} />
			</div>
		))}
	</div>
);

export default StatsCardSkeleton;
