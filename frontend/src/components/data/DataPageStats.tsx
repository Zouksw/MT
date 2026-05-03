"use client";

import type React from "react";
import { ResponsiveStats } from "@/components/ui/MobileStatsCard";
import { StatCard, type StatCardVariant } from "@/components/ui/StatCard";
import { useIsMobile } from "@/lib/responsive-utils";

export interface DataPageStatsItem {
	label: string;
	value: number | string;
	icon?: React.ReactNode;
	color?: string;
	trend?: number;
	variant?: StatCardVariant;
}

export interface DataPageStatsProps {
	items: DataPageStatsItem[];
	featuredIndex?: number;
	loading?: boolean;
}

export const DataPageStats: React.FC<DataPageStatsProps> = ({
	items,
	featuredIndex = 0,
	loading = false,
}) => {
	const isMobile = useIsMobile();

	if (isMobile) {
		return (
			<div className="mb-4">
				<ResponsiveStats
					isMobile={true}
					items={items.map((item) => ({
						label: item.label,
						value: item.value,
						color: item.color,
						trend: item.trend,
					}))}
					featuredIndex={featuredIndex}
				/>
			</div>
		);
	}

	return (
		<div
			className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6"
			aria-live="polite"
			aria-atomic="true"
		>
			{items.map((item, index) => {
				const variant =
					item.variant ||
					(index === featuredIndex
						? ("primary" as StatCardVariant)
						: ("default" as StatCardVariant));
				return (
					<div
						key={index}
						className="stagger-slide-up"
						style={{ animationDelay: `${index * 80}ms` }}
					>
						<StatCard
							title={item.label}
							value={item.value}
							icon={item.icon}
							variant={variant}
							loading={loading}
							trend={
								item.trend !== undefined
									? { value: Math.abs(item.trend), isPositive: item.trend >= 0 }
									: undefined
							}
						/>
					</div>
				);
			})}
		</div>
	);
};

export default DataPageStats;
