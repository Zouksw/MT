"use client";

import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { Tag, type TagColor } from "@/components/ui/Tag";

type Direction = "up" | "down" | "flat";

interface DirectionBadgeProps {
	direction: Direction;
	confidence?: number;
	size?: "small" | "default" | "large";
}

const directionConfig: Record<Direction, { color: TagColor; Icon: typeof ArrowUp; label: string }> =
	{
		up: { color: "success", Icon: ArrowUp, label: "Up" },
		down: { color: "error", Icon: ArrowDown, label: "Down" },
		flat: { color: "warning", Icon: Minus, label: "Flat" },
	};

/**
 * Direction pill for price-forecast consensus (up / down / flat).
 * Uses the design-system Tag primitive (token colors, dark-mode aware) instead
 * of the previous inline style={{}} hex values that bypassed Tailwind. Labels
 * are English (was hardcoded Chinese 上涨/下跌/横盘 — FE-M1 pattern).
 */
export default function DirectionBadge({
	direction,
	confidence,
	size = "default",
}: DirectionBadgeProps) {
	const { color, Icon, label } = directionConfig[direction];
	const iconSize = size === "small" ? "size-3" : size === "large" ? "size-4" : "size-3.5";
	const text = size === "large" ? "text-sm" : "text-xs";

	return (
		<Tag color={color} className={`inline-flex items-center gap-1 font-medium ${text}`}>
			<Icon className={iconSize} />
			{label}
			{confidence !== undefined && (
				<span className="opacity-70 font-normal">{Math.round(confidence * 100)}%</span>
			)}
		</Tag>
	);
}
