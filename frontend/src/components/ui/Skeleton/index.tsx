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

export const TableSkeleton: React.FC<{
	rows?: number;
	columns?: number;
}> = ({ rows = 5, columns = 6 }) => (
	<div className="bg-card rounded-lg shadow-card dark:shadow-card-dark p-4">
		<ShimmerBlock width={200} height={20} className="mb-4" />
		{Array.from({ length: rows }).map((_, row) => (
			<div
				// biome-ignore lint/suspicious/noArrayIndexKey: decorative placeholder
				key={row}
				className={`flex gap-4 py-3 ${row < rows - 1 ? "border-b border-border" : ""}`}
			>
				{Array.from({ length: columns }).map((_, col) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: decorative placeholder
					<ShimmerBlock key={col} width={col === 0 ? 150 : 100} height={20} className="flex-1" />
				))}
			</div>
		))}
	</div>
);

export const FormSkeleton: React.FC<{ fieldCount?: number }> = ({ fieldCount = 4 }) => (
	<div className="bg-card rounded-lg shadow-card dark:shadow-card-dark p-6 max-w-lg">
		<ShimmerBlock width={200} height={28} className="mb-6" />
		{Array.from({ length: fieldCount }).map((_, i) => (
			// biome-ignore lint/suspicious/noArrayIndexKey: decorative placeholder
			<div key={i} className="mb-5">
				<ShimmerBlock width={120} height={16} className="mb-2" />
				<ShimmerBlock height={40} />
			</div>
		))}
		<ShimmerBlock width={120} height={40} className="mt-2" />
	</div>
);

export const CardListSkeleton: React.FC<{ count?: number }> = ({ count = 3 }) => (
	<div className="flex flex-col gap-4">
		{Array.from({ length: count }).map((_, i) => (
			// biome-ignore lint/suspicious/noArrayIndexKey: decorative placeholder
			<div key={i} className="bg-card rounded-lg shadow-card dark:shadow-card-dark p-5">
				<div className="flex gap-4 mb-4">
					<div className="w-12 h-12 bg-muted rounded animate-pulse" />
					<div className="flex-1">
						<ShimmerBlock width={150} height={20} className="mb-2" />
						<ShimmerBlock width="80%" height={14} />
					</div>
				</div>
				<ShimmerBlock height={60} />
			</div>
		))}
	</div>
);

export const DetailPageSkeleton: React.FC = () => (
	<div>
		<div className="mb-6">
			<ShimmerBlock width={200} height={28} className="mb-3" />
			<ShimmerBlock width={400} height={16} />
		</div>
		<div className="bg-card rounded-lg shadow-card dark:shadow-card-dark p-6 mb-6">
			<ShimmerBlock width={150} height={20} className="mb-4" />
			<ShimmerBlock width={150} height={36} />
		</div>
		<div className="bg-card rounded-lg shadow-card dark:shadow-card-dark p-6">
			<ShimmerBlock width={180} height={20} className="mb-4" />
			{Array.from({ length: 4 }).map((_, i) => (
				// biome-ignore lint/suspicious/noArrayIndexKey: decorative placeholder
				<ShimmerBlock key={i} height={16} className="mb-3" />
			))}
		</div>
	</div>
);

export const InlineSkeleton: React.FC<{
	width?: string | number;
	lines?: number;
}> = ({ width = "100%", lines = 2 }) => (
	<div>
		{Array.from({ length: lines }).map((_, i) => (
			<ShimmerBlock
				// biome-ignore lint/suspicious/noArrayIndexKey: decorative placeholder
				key={i}
				width={i === lines - 1 ? "70%" : width}
				height={16}
				className={i < lines - 1 ? "mb-2" : ""}
			/>
		))}
	</div>
);

export default StatsCardSkeleton;
