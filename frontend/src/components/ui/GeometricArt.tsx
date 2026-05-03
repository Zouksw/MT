"use client";

import React from "react";

/**
 * Geometric art SVG components for subtle background decorations.
 * Designed for Vercel/Tailwind aesthetic: white backgrounds, black text,
 * gold (#B8860B) accent. All rendered at very low opacity.
 */

// ---------------------------------------------------------------------------
// 1. HexGrid — Hero section background (tiled hexagons)
// ---------------------------------------------------------------------------

const HEX_RADIUS = 30;
const HEX_STROKE = 0.5;

/** Points for a flat-top hexagon centred at (cx, cy). */
function hexPoints(cx: number, cy: number, r: number): string {
	const pts: string[] = [];
	for (let i = 0; i < 6; i++) {
		const angle = (Math.PI / 3) * i - Math.PI / 6;
		pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
	}
	return pts.join(" ");
}

const _HexGrid: React.FC<{ className?: string }> = ({ className }) => {
	// Pattern tile size must tessellate flat-top hexagons:
	//   width = sqrt(3) * R,  height = 1.5 * R  (with offset every other row)
	const w = Math.sqrt(3) * HEX_RADIUS;
	const h = 1.5 * HEX_RADIUS;

	return (
		<div className={`pointer-events-none absolute inset-0 ${className ?? ""}`}>
			<svg
				aria-hidden="true"
				xmlns="http://www.w3.org/2000/svg"
				width="100%"
				height="100%"
				style={{ position: "absolute", inset: 0 }}
			>
				<defs>
					<pattern
						id="hex-grid-pattern"
						x="0"
						y="0"
						width={w}
						height={h * 2}
						patternUnits="userSpaceOnUse"
						fill="none"
					>
						{/* Row A — centred at (w/2, h/2) */}
						<polygon
							points={hexPoints(w / 2, h / 2, HEX_RADIUS)}
							stroke="#B8860B"
							strokeWidth={HEX_STROKE}
							fill="none"
							opacity={0.04}
						/>
						{/* Subtle fill on ~every 4th hex (static — just fainten one) */}
						<polygon
							points={hexPoints(w / 2, h / 2, HEX_RADIUS - 1)}
							stroke="none"
							fill="#B8860B"
							opacity={0.02}
						/>
						{/* Row B — offset by w/2, shifted down by h */}
						<polygon
							points={hexPoints(w, h + h / 2, HEX_RADIUS)}
							stroke="#B8860B"
							strokeWidth={HEX_STROKE}
							fill="none"
							opacity={0.04}
						/>
					</pattern>
				</defs>
				<rect width="100%" height="100%" fill="url(#hex-grid-pattern)" />
			</svg>
		</div>
	);
};

export const HexGrid = React.memo(_HexGrid);

// ---------------------------------------------------------------------------
// 2. TopoLines — Auth page left panel (concentric organic curves)
// ---------------------------------------------------------------------------

/**
 * Build a closed cubic-bezier path that forms an organic, roughly circular
 * ring centred at (cx, cy) with a given radius. A small random-looking
 * perturbation is baked in via fixed offsets so the result looks hand-drawn.
 */
function topoRing(cx: number, cy: number, r: number, jitter: number): string {
	const n = 8; // control points around the ring
	const pts: { x: number; y: number }[] = [];
	for (let i = 0; i < n; i++) {
		const a = (2 * Math.PI * i) / n;
		// Deterministic "wobble" per ring so curves feel organic
		const wobble = jitter * Math.sin(i * 3.7 + r * 0.3) * Math.cos(i * 2.3 + r * 0.17);
		pts.push({
			x: cx + (r + wobble) * Math.cos(a),
			y: cy + (r + wobble) * Math.sin(a),
		});
	}

	// Build closed cubic-bezier path through the points using Catmull-Rom →
	// cubic Bezier conversion (simplified).
	let d = `M ${pts[0].x} ${pts[0].y}`;
	for (let i = 0; i < n; i++) {
		const p0 = pts[(i - 1 + n) % n];
		const p1 = pts[i];
		const p2 = pts[(i + 1) % n];
		const p3 = pts[(i + 2) % n];

		const cp1x = p1.x + (p2.x - p0.x) / 6;
		const cp1y = p1.y + (p2.y - p0.y) / 6;
		const cp2x = p2.x - (p3.x - p1.x) / 6;
		const cp2y = p2.y - (p3.y - p1.y) / 6;

		d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
	}
	d += " Z";
	return d;
}

const _TopoLines: React.FC<{ className?: string }> = ({ className }) => {
	const cx = 200;
	const cy = 200;
	const rings = 9;
	const startR = 30;
	const step = 18;

	const paths: string[] = [];
	for (let i = 0; i < rings; i++) {
		const r = startR + i * step;
		paths.push(topoRing(cx, cy, r, 6 + i * 0.8));
	}

	return (
		<svg
			aria-hidden="true"
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 400 400"
			width={400}
			height={400}
			className={className}
			fill="none"
		>
			{paths.map((d, i) => (
				<path key={i} d={d} stroke="rgba(255, 255, 255, 0.08)" strokeWidth={1} fill="none" />
			))}
		</svg>
	);
};

export const TopoLines = React.memo(_TopoLines);

// ---------------------------------------------------------------------------
// 3. DotGrid — Section background (simple dot grid)
// ---------------------------------------------------------------------------

const _DotGrid: React.FC<{ className?: string }> = ({ className }) => {
	const spacing = 24;

	return (
		<div className={`pointer-events-none absolute inset-0 ${className ?? ""}`}>
			<svg
				aria-hidden="true"
				xmlns="http://www.w3.org/2000/svg"
				width="100%"
				height="100%"
				style={{ position: "absolute", inset: 0 }}
			>
				<defs>
					<pattern
						id="dot-grid-pattern"
						x="0"
						y="0"
						width={spacing}
						height={spacing}
						patternUnits="userSpaceOnUse"
						fill="none"
					>
						<circle cx={spacing / 2} cy={spacing / 2} r={1} fill="#B8860B" opacity={0.06} />
					</pattern>
				</defs>
				<rect width="100%" height="100%" fill="url(#dot-grid-pattern)" />
			</svg>
		</div>
	);
};

export const DotGrid = React.memo(_DotGrid);

// ---------------------------------------------------------------------------
// 4. BrokenHex — 404 page (hex grid with one displaced piece)
// ---------------------------------------------------------------------------

const _BrokenHex: React.FC<{ className?: string }> = ({ className }) => {
	const R = 30;
	const w = Math.sqrt(3) * R;
	const h = 1.5 * R;

	// Build a small grid of hexagon centres (3 rows x 4 cols)
	const centres: { x: number; y: number }[] = [];
	const cols = 5;
	const rows = 4;
	const offsetX = 50;
	const offsetY = 35;
	for (let row = 0; row < rows; row++) {
		for (let col = 0; col < cols; col++) {
			const cx = offsetX + col * w + (row % 2 === 1 ? w / 2 : 0);
			const cy = offsetY + row * h * 2;
			centres.push({ x: cx, y: cy });
		}
	}

	// The "broken" hex is at index 7 (roughly centre of grid)
	const brokenIndex = 7;

	return (
		<svg
			aria-hidden="true"
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 300 300"
			width={300}
			height={300}
			className={className}
			fill="none"
		>
			{centres.map((c, i) => {
				if (i === brokenIndex) return null; // rendered separately below
				return (
					<polygon
						key={i}
						points={hexPoints(c.x, c.y, R)}
						stroke="#B8860B"
						strokeWidth={0.5}
						fill="none"
						opacity={0.04}
					/>
				);
			})}
			{/* The displaced / "broken" hexagon */}
			<g
				transform={`translate(${centres[brokenIndex].x + 20}, ${centres[brokenIndex].y - 20}) rotate(15)`}
			>
				<polygon
					points={hexPoints(0, 0, R)}
					stroke="#B8860B"
					strokeWidth={0.5}
					fill="none"
					opacity={0.08}
				/>
			</g>
			{/* Ghost of original position (faint outline) */}
			<polygon
				points={hexPoints(centres[brokenIndex].x, centres[brokenIndex].y, R)}
				stroke="#B8860B"
				strokeWidth={0.3}
				fill="none"
				opacity={0.02}
				strokeDasharray="4 4"
			/>
		</svg>
	);
};

export const BrokenHex = React.memo(_BrokenHex);
