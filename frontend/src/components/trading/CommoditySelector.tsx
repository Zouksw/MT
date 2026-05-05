"use client";

import React from "react";
import { Select } from "@/components/ui/Select";

interface Commodity {
	id: string;
	name: string;
	symbol?: string;
}

interface CommoditySelectorProps {
	commodities: Commodity[];
	selected: string;
	onSelect: (id: string) => void;
	loading?: boolean;
	renderLabel?: (commodity: Commodity) => React.ReactNode;
}

export default function CommoditySelector({
	commodities,
	selected,
	onSelect,
	loading = false,
	renderLabel,
}: CommoditySelectorProps) {
	const [isMobile, setIsMobile] = React.useState(false);

	React.useEffect(() => {
		const check = () => setIsMobile(window.innerWidth < 768);
		check();
		window.addEventListener("resize", check);
		return () => window.removeEventListener("resize", check);
	}, []);

	if (loading) {
		return (
			<div className="flex gap-2">
				{[1, 2, 3, 4].map((i) => (
					<div key={i} className="h-8 w-30 bg-muted rounded animate-pulse" />
				))}
			</div>
		);
	}

	if (commodities.length === 0) return null;

	if (isMobile) {
		return (
			<div className="mb-3">
				<Select
					value={selected}
					onChange={onSelect}
					options={commodities.map((c) => ({
						value: c.id,
						label: c.symbol ? `${c.name} (${c.symbol})` : c.name,
					}))}
					fullWidth
				/>
			</div>
		);
	}

	const defaultLabel = (c: Commodity) => (c.symbol ? `${c.name} (${c.symbol})` : c.name);

	return (
		<div className="flex gap-1 mb-4 border-b overflow-x-auto">
			{commodities.map((c) => (
				<button type="button"
					key={c.id}
					onClick={() => onSelect(c.id)}
					className={`px-3 py-1.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${selected === c.id ? "border-amber-500 text-amber-600" : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"}`}
				>
					{renderLabel ? renderLabel(c) : defaultLabel(c)}
				</button>
			))}
		</div>
	);
}
