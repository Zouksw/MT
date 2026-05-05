"use client";

import type React from "react";

export interface MobileStatItem {
	label: string;
	value: string | number;
	trend?: number;
	suffix?: string;
	color?: string;
}

export interface MobileStatsCardProps {
	items: MobileStatItem[];
	featuredIndex?: number;
}

export const MobileStatsCard: React.FC<MobileStatsCardProps> = ({ items, featuredIndex = 0 }) => {
	return (
		<div className="flex gap-3 overflow-x-auto overflow-y-visible p-1 pb-4 -m-1 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
			{items.map((item, index) => {
				const isFeatured = index === featuredIndex;
				return (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: decorative placeholder
						key={index}
						className={`shrink-0 snap-start ${isFeatured ? "w-[280px] min-w-[280px]" : "w-[200px] min-w-[200px]"}`}
					>
						<div className={`rounded border bg-card h-full ${isFeatured ? "p-5" : "p-4"}`}>
							<div className="flex flex-col justify-between h-full">
								<div
									className={`text-[13px] font-medium text-gray-500 ${isFeatured ? "mb-3" : "mb-2"}`}
								>
									{item.label}
								</div>
								<div
									className={`font-semibold leading-none ${isFeatured ? "text-3xl mb-3" : "text-2xl mb-2"}`}
									style={{ color: item.color || "#111827" }}
								>
									{typeof item.value === "number" ? item.value.toLocaleString() : item.value}
									{item.suffix && (
										<span className={`font-medium ml-1 ${isFeatured ? "text-lg" : "text-sm"}`}>
											{item.suffix}
										</span>
									)}
								</div>
								{item.trend !== undefined && (
									<div
										className={`text-xs font-semibold ${item.trend >= 0 ? "text-emerald-500" : "text-red-500"}`}
									>
										{item.trend >= 0 ? "↑" : "↓"} {Math.abs(item.trend)}%
									</div>
								)}
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
};

export interface DesktopGridStatsProps {
	items: MobileStatItem[];
	featuredIndex?: number;
	columns?: { featured: number; standard: number };
}

export const DesktopGridStats: React.FC<DesktopGridStatsProps> = ({
	items,
	featuredIndex = 0,
	columns = { featured: 12, standard: 6 },
}) => {
	return (
		<div className="grid grid-cols-2 md:grid-cols-12 gap-4">
			{items.map((item, index) => {
				const isFeatured = index === featuredIndex;
				return (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: decorative placeholder
						key={index}
						className={`col-span-2 ${isFeatured ? `md:col-span-${columns.featured}` : `md:col-span-${columns.standard}`}`}
					>
						<div className={`rounded border bg-card h-full ${isFeatured ? "p-6" : "p-5"}`}>
							<div className="flex flex-col justify-between h-full">
								<div
									className={`text-[13px] font-medium text-gray-500 ${isFeatured ? "mb-3" : "mb-2"}`}
								>
									{item.label}
								</div>
								<div
									className={`font-semibold leading-none ${isFeatured ? "text-4xl mb-3" : "text-3xl mb-2"}`}
									style={{ color: item.color || "#111827" }}
								>
									{typeof item.value === "number" ? item.value.toLocaleString() : item.value}
									{item.suffix && (
										<span className={`font-medium ml-1 ${isFeatured ? "text-xl" : "text-base"}`}>
											{item.suffix}
										</span>
									)}
								</div>
								{item.trend !== undefined && (
									<div
										className={`text-sm font-semibold ${item.trend >= 0 ? "text-emerald-500" : "text-red-500"}`}
									>
										{item.trend >= 0 ? "↑" : "↓"} {Math.abs(item.trend)}%
									</div>
								)}
							</div>
						</div>
					</div>
				);
			})}
		</div>
	);
};

export interface ResponsiveStatsProps extends DesktopGridStatsProps {
	isMobile?: boolean;
}

export const ResponsiveStats: React.FC<ResponsiveStatsProps> = ({ isMobile = false, ...props }) => {
	return isMobile ? <MobileStatsCard {...props} /> : <DesktopGridStats {...props} />;
};
