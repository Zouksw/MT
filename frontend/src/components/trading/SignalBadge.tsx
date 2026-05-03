"use client";

type SignalType = "BUY" | "SELL" | "HOLD";

interface SignalBadgeProps {
	type: SignalType;
	confidence?: number;
	size?: "small" | "default" | "large";
}

const signalConfig: Record<SignalType, { color: string; arrow: string; bg: string }> = {
	BUY: { color: "#16a34a", arrow: "↑", bg: "#f0fdf4" },
	SELL: { color: "#dc2626", arrow: "↓", bg: "#fef2f2" },
	HOLD: { color: "#d97706", arrow: "−", bg: "#fffbeb" },
};

export default function SignalBadge({ type, confidence, size = "default" }: SignalBadgeProps) {
	const config = signalConfig[type];
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
			{config.arrow} {type}
			{confidence !== undefined && (
				<span style={{ opacity: 0.8, marginLeft: 4, fontWeight: 400 }}>
					{Math.round(confidence * 100)}%
				</span>
			)}
		</span>
	);
}
