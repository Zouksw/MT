"use client";

import { useState } from "react";

interface CorrelationMatrixProps {
	commodities: string[];
	matrix: number[][];
	loading?: boolean;
}

function getCellColor(value: number): string {
	if (value >= 0.7) return "rgba(22, 163, 74, 0.3)";
	if (value >= 0.3) return "rgba(22, 163, 74, 0.15)";
	if (value > -0.3) return "rgba(0, 0, 0, 0.03)";
	if (value > -0.7) return "rgba(220, 38, 38, 0.15)";
	return "rgba(220, 38, 38, 0.3)";
}

function getTextColor(value: number): string {
	if (value >= 0.7) return "#16a34a";
	if (value >= 0.3) return "#15803d";
	if (value > -0.3) return "#374151";
	if (value > -0.7) return "#b91c1c";
	return "#dc2626";
}

export default function CorrelationMatrixChart({
	commodities,
	matrix,
	loading = false,
}: CorrelationMatrixProps) {
	const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);

	if (loading || !commodities.length || !matrix.length) {
		return (
			<div className="text-center p-10 text-gray-400">
				{loading ? "Loading correlation data..." : "No correlation data available"}
			</div>
		);
	}

	const cellSize = Math.max(50, Math.min(80, 500 / commodities.length));
	const labelWidth = 100;

	return (
		<div className="overflow-x-auto relative">
			{tooltip && (
				<div
					className="fixed bg-gray-900 text-white text-xs px-2 py-1 rounded z-50 pointer-events-none"
					style={{ left: tooltip.x, top: tooltip.y }}
				>
					{tooltip.text}
				</div>
			)}
			<div
				style={{
					display: "inline-block",
					minWidth: labelWidth + commodities.length * cellSize + 20,
				}}
			>
				<div style={{ display: "flex", marginLeft: labelWidth }}>
					{commodities.map((name, j) => (
						<div
							// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
							key={j}
							style={{
								width: cellSize,
								textAlign: "center",
								fontSize: 10,
								transform: "rotate(-45deg)",
								transformOrigin: "bottom left",
								padding: "2px 0",
								whiteSpace: "nowrap",
							}}
						>
							{name.length > 10 ? `${name.slice(0, 10)}…` : name}
						</div>
					))}
				</div>
				{matrix.map((row, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: no stable key available
					<div key={i} style={{ display: "flex", alignItems: "center" }}>
						<div
							style={{
								width: labelWidth,
								textAlign: "right",
								paddingRight: 8,
								fontSize: 11,
								whiteSpace: "nowrap",
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}
						>
							{commodities[i]}
						</div>
						{row.map((value, j) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: matrix cell position is the key
							<div
															key={`${i}-${j}`}
								style={{
									width: cellSize,
									height: cellSize,
									backgroundColor: getCellColor(value),
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									border: "1px solid #f0f0f0",
									cursor: "pointer",
									fontSize: cellSize > 60 ? 12 : 10,
									fontFamily: "monospace",
									color: getTextColor(value),
									fontWeight: Math.abs(value) > 0.5 ? 600 : 400,
								}}
								onMouseEnter={(e) =>
									setTooltip({
										text: `${commodities[i]} × ${commodities[j]}: r = ${value.toFixed(3)}`,
										x: e.clientX + 10,
										y: e.clientY - 30,
									})
								}
								onMouseLeave={() => setTooltip(null)}
							>
								{value.toFixed(2)}
							</div>
						))}
					</div>
				))}
				<div className="flex justify-center gap-4 mt-3 text-xs">
					<span>
						<span
							className="inline-block w-3 h-3 mr-1 align-middle"
							style={{ backgroundColor: "rgba(22, 163, 74, 0.3)" }}
						/>
						Positive (r &gt; 0.7)
					</span>
					<span>
						<span
							className="inline-block w-3 h-3 mr-1 align-middle"
							style={{ backgroundColor: "rgba(0, 0, 0, 0.03)" }}
						/>
						Weak (&minus;0.3 to 0.3)
					</span>
					<span>
						<span
							className="inline-block w-3 h-3 mr-1 align-middle"
							style={{ backgroundColor: "rgba(220, 38, 38, 0.3)" }}
						/>
						Negative (r &lt; &minus;0.7)
					</span>
				</div>
			</div>
		</div>
	);
}
