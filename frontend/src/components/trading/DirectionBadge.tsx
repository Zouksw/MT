"use client";

type Direction = "up" | "down" | "flat";

interface DirectionBadgeProps {
	direction: Direction;
	confidence?: number;
	size?: "small" | "default" | "large";
}

const directionConfig: Record<
	Direction,
	{ color: string; arrow: string; bg: string; label: string }
> = {
	up: { color: "#16a34a", arrow: "↑", bg: "#f0fdf4", label: "上涨" },
	down: { color: "#dc2626", arrow: "↓", bg: "#fef2f2", label: "下跌" },
	flat: { color: "#d97706", arrow: "−", bg: "#fffbeb", label: "横盘" },
};

export default function DirectionBadge({
	direction,
	confidence,
	size = "default",
}: DirectionBadgeProps) {
	const config = directionConfig[direction];
	const scale = size === "small" ? 0.85 : size === "large" ? 1.2 : 1;

	return (
		<span
			style={{
				display: "inline-flex",
				alignItems: "center",
				gap: 4,
				fontSize: `${14 * scale}px`,
				padding: `${2 * scale}px ${8 * scale}px`,
				borderRadius: 4,
				fontWeight: 600,
				fontFamily: "monospace",
				letterSpacing: 0.5,
				backgroundColor: config.bg,
				color: config.color,
				border: `1px solid ${config.color}30`,
			}}
		>
			{config.arrow} {config.label}
			{confidence !== undefined && (
				<span style={{ opacity: 0.8, marginLeft: 4, fontWeight: 400 }}>
					{Math.round(confidence * 100)}%
				</span>
			)}
		</span>
	);
}
