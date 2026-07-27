/**
 * Lazy-loaded recharts components.
 *
 * recharts is a large dependency; importing it statically bloats the initial
 * JS bundle. Each chart component dynamically imports only the pieces it
 * needs, so charts that are below the fold (or never rendered) don't cost
 * anything on first paint.
 *
 * This helper centralizes the dynamic-import boilerplate so each chart
 * component doesn't repeat 8 near-identical `dynamic(() => import(...))`
 * calls (the pattern ForecastTrendChart originated).
 */

import dynamic from "next/dynamic";

/** Returns the core recharts primitives, lazily loaded. Call once at module top. */
export function dynamicRecharts() {
	return {
		LineChart: dynamic(() => import("recharts").then((m) => ({ default: m.LineChart })), {
			ssr: false,
		}),
		Line: dynamic(() => import("recharts").then((m) => ({ default: m.Line })), {
			ssr: false,
		}),
		AreaChart: dynamic(() => import("recharts").then((m) => ({ default: m.AreaChart })), {
			ssr: false,
		}),
		Area: dynamic(() => import("recharts").then((m) => ({ default: m.Area })), {
			ssr: false,
		}),
		BarChart: dynamic(() => import("recharts").then((m) => ({ default: m.BarChart })), {
			ssr: false,
		}),
		Bar: dynamic(() => import("recharts").then((m) => ({ default: m.Bar })), {
			ssr: false,
		}),
		XAxis: dynamic(() => import("recharts").then((m) => ({ default: m.XAxis })), {
			ssr: false,
		}),
		YAxis: dynamic(() => import("recharts").then((m) => ({ default: m.YAxis })), {
			ssr: false,
		}),
		CartesianGrid: dynamic(() => import("recharts").then((m) => ({ default: m.CartesianGrid })), {
			ssr: false,
		}),
		Tooltip: dynamic(() => import("recharts").then((m) => ({ default: m.Tooltip })), {
			ssr: false,
		}),
		Legend: dynamic(() => import("recharts").then((m) => ({ default: m.Legend })), {
			ssr: false,
		}),
		ResponsiveContainer: dynamic(
			() => import("recharts").then((m) => ({ default: m.ResponsiveContainer })),
			{ ssr: false },
		),
	};
}
