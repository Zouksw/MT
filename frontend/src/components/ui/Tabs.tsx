"use client";

import type React from "react";
import { useState } from "react";

export interface TabItem {
	key: string;
	label: string;
	content: React.ReactNode;
	disabled?: boolean;
}

export interface TabsProps {
	items: TabItem[];
	activeKey?: string;
	onChange?: (key: string) => void;
	className?: string;
}

export const Tabs: React.FC<TabsProps> = ({ items, activeKey, onChange, className = "" }) => {
	const [internalKey, setInternalKey] = useState(items[0]?.key || "");
	const currentKey = activeKey ?? internalKey;

	const handleChange = (key: string) => {
		setInternalKey(key);
		onChange?.(key);
	};

	return (
		<div className={className}>
			<div className="flex border-b border" role="tablist">
				{items.map((item) => (
					<button
						key={item.key}
						role="tab"
						aria-selected={item.key === currentKey}
						disabled={item.disabled}
						className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px
              ${item.key === currentKey ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-gray-700 dark:hover:text-gray-300"}
              ${item.disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
						onClick={() => !item.disabled && handleChange(item.key)}
					>
						{item.label}
					</button>
				))}
			</div>
			<div className="pt-4" role="tabpanel">
				{items.find((i) => i.key === currentKey)?.content}
			</div>
		</div>
	);
};
