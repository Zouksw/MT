/**
 * Manual mock for `recharts` — shared by the chart component test suites
 * (AnomalyChart, PredictionChart).
 *
 * Recharts renders to SVG/Canvas which JSDOM cannot meaningfully execute, so
 * every chart subcomponent is stubbed as a `<div data-testid="recharts-Name">`
 * that tests can locate via `getByTestId("recharts-ResponsiveContainer")` etc.
 * The union of components here covers both suites: AnomalyChart uses
 * Scatter/Cell; PredictionChart uses Area/ReferenceLine; both use the rest.
 *
 * Placement: `<rootDir>/__mocks__/recharts.ts` is Jest's node-module manual
 * mock location — a test calls `jest.mock("recharts")` (no factory) and Jest
 * resolves it here automatically, eliminating the per-file factory duplication
 * that previously existed (AnomalyChart lines 13-42 ≈ PredictionChart 13-44).
 */

import React from "react";

// biome-ignore lint/suspicious/noExplicitAny: third-party library, props are opaque
const createComponent = (name: string) => {
	const Comp = React.forwardRef((props: any, ref: any) => (
		<div ref={ref} data-testid={`recharts-${name}`} {...props} />
	));
	Comp.displayName = name;
	return Comp;
};

// biome-ignore lint/suspicious/noExplicitAny: third-party library, props are opaque
const ResponsiveContainer = ({ children, ...props }: any) => (
	<div data-testid="recharts-ResponsiveContainer" {...props}>
		{children}
	</div>
);

// biome-ignore lint/suspicious/noExplicitAny: third-party library, props are opaque
const ComposedChart = ({ children, ...props }: any) => (
	<div data-testid="recharts-ComposedChart" {...props}>
		{children}
	</div>
);

module.exports = {
	Line: createComponent("Line"),
	XAxis: createComponent("XAxis"),
	YAxis: createComponent("YAxis"),
	CartesianGrid: createComponent("CartesianGrid"),
	Tooltip: createComponent("Tooltip"),
	Legend: createComponent("Legend"),
	ResponsiveContainer,
	ComposedChart,
	Scatter: createComponent("Scatter"),
	Cell: createComponent("Cell"),
	Area: createComponent("Area"),
	ReferenceLine: createComponent("ReferenceLine"),
};
