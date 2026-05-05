/**
 * Tests for AnomalyChart component
 *
 * Tests rendering with anomaly data, empty state, severity display, and export buttons.
 * Recharts components are mocked as simple divs since they don't render in JSDOM.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import "@testing-library/jest-dom";

// Mock recharts dynamic imports
jest.mock("recharts", () => {
	const createComponent = (name: string) => {
		// biome-ignore lint/suspicious/noExplicitAny: third-party library type
		const Comp = React.forwardRef((props: any, ref: any) => (
			<div ref={ref} data-testid={`recharts-${name}`} {...props} />
		));
		Comp.displayName = name;
		return Comp;
	};
	return {
		Line: createComponent("Line"),
		XAxis: createComponent("XAxis"),
		YAxis: createComponent("YAxis"),
		CartesianGrid: createComponent("CartesianGrid"),
		Tooltip: createComponent("Tooltip"),
		Legend: createComponent("Legend"),
		// biome-ignore lint/suspicious/noExplicitAny: third-party library type
		ResponsiveContainer: ({ children }: any) => (
			<div data-testid="recharts-ResponsiveContainer">{children}</div>
		),
		// biome-ignore lint/suspicious/noExplicitAny: third-party library type
		ComposedChart: ({ children, ...props }: any) => (
			<div data-testid="recharts-ComposedChart" {...props}>
				{children}
			</div>
		),
		Scatter: createComponent("Scatter"),
		Cell: createComponent("Cell"),
	};
});

// Mock html2canvas
jest.mock("html2canvas", () => ({
	__esModule: true,
	default: jest.fn().mockResolvedValue({
		toDataURL: () => "data:image/png;base64,test",
	}),
}));

import { AnomalyChart } from "../AnomalyChart";

const sampleAnomalies = [
	{ timestamp: 1699999000000, value: 30.5, score: 0.95, severity: "HIGH" as const },
	{ timestamp: 1699999600000, value: 10.2, score: 0.7, severity: "MEDIUM" as const },
	{ timestamp: 1699999800000, value: 5.1, score: 0.3, severity: "LOW" as const },
];

const sampleHistoricalData = [
	{ timestamp: 1699999000000, value: 24.0 },
	{ timestamp: 1699999300000, value: 24.5 },
	{ timestamp: 1699999600000, value: 25.0 },
	{ timestamp: 1699999800000, value: 24.8 },
];

describe("AnomalyChart", () => {
	it("should render loading spinner when no data", () => {
		render(<AnomalyChart timeseries="root.test.temp" anomalies={[]} historicalData={[]} />);

		// Loading spinner uses animate-spin
		expect(document.querySelector(".animate-spin")).toBeInTheDocument();
	});

	it("should render chart header with timeseries name", () => {
		render(
			<AnomalyChart
				timeseries="root.test.temp"
				anomalies={sampleAnomalies}
				historicalData={sampleHistoricalData}
			/>,
		);

		expect(screen.getByText(/Anomaly Detection: root\.test\.temp/)).toBeInTheDocument();
	});

	it("should display the detection method", () => {
		render(
			<AnomalyChart
				timeseries="root.test.temp"
				anomalies={sampleAnomalies}
				historicalData={sampleHistoricalData}
				method="isolation_forest"
			/>,
		);

		expect(screen.getByText(/ISOLATION_FOREST/)).toBeInTheDocument();
	});

	it("should show anomaly count in header", () => {
		render(
			<AnomalyChart
				timeseries="root.test.temp"
				anomalies={sampleAnomalies}
				historicalData={sampleHistoricalData}
			/>,
		);

		expect(screen.getByText(/3 anomalies/)).toBeInTheDocument();
	});

	it("should display anomaly summary alert", () => {
		render(
			<AnomalyChart
				timeseries="root.test.temp"
				anomalies={sampleAnomalies}
				historicalData={sampleHistoricalData}
			/>,
		);

		expect(screen.getByText("3 Anomalies Detected")).toBeInTheDocument();
	});

	it("should display severity tags in summary", () => {
		render(
			<AnomalyChart
				timeseries="root.test.temp"
				anomalies={sampleAnomalies}
				historicalData={sampleHistoricalData}
			/>,
		);

		expect(screen.getByText("High: 1")).toBeInTheDocument();
		expect(screen.getByText("Medium: 1")).toBeInTheDocument();
		expect(screen.getByText("Low: 1")).toBeInTheDocument();
	});

	it("should render export buttons", () => {
		render(
			<AnomalyChart
				timeseries="root.test.temp"
				anomalies={sampleAnomalies}
				historicalData={sampleHistoricalData}
			/>,
		);

		expect(screen.getByLabelText("Export anomaly chart as PNG image")).toBeInTheDocument();
		expect(screen.getByLabelText("Export anomaly data as CSV spreadsheet")).toBeInTheDocument();
	});

	it("should render chart container for Recharts", () => {
		render(
			<AnomalyChart
				timeseries="root.test.temp"
				anomalies={sampleAnomalies}
				historicalData={sampleHistoricalData}
			/>,
		);

		expect(screen.getByTestId("recharts-ResponsiveContainer")).toBeInTheDocument();
	});

	it("should call onExport when CSV export clicked", () => {
		const onExport = jest.fn();
		// Mock Blob and URL APIs for JSDOM
		const mockUrl = "blob:test";
		const originalCreateObjectURL = URL.createObjectURL;
		const originalRevokeObjectURL = URL.revokeObjectURL;
		URL.createObjectURL = jest.fn(() => mockUrl);
		URL.revokeObjectURL = jest.fn();

		render(
			<AnomalyChart
				timeseries="root.test.temp"
				anomalies={sampleAnomalies}
				historicalData={sampleHistoricalData}
				onExport={onExport}
			/>,
		);

		fireEvent.click(screen.getByLabelText("Export anomaly data as CSV spreadsheet"));
		expect(onExport).toHaveBeenCalledWith("csv");

		URL.createObjectURL = originalCreateObjectURL;
		URL.revokeObjectURL = originalRevokeObjectURL;
	});

	it("should render with anomalies only (no historical data)", () => {
		render(
			<AnomalyChart
				timeseries="root.test.sensor"
				anomalies={sampleAnomalies}
				historicalData={[]}
			/>,
		);

		expect(screen.getByText(/Anomaly Detection: root\.test\.sensor/)).toBeInTheDocument();
		expect(screen.getByTestId("recharts-ResponsiveContainer")).toBeInTheDocument();
	});

	it("should render chart with aria-label for accessibility", () => {
		render(
			<AnomalyChart
				timeseries="root.test.temp"
				anomalies={sampleAnomalies}
				historicalData={sampleHistoricalData}
				method="statistical"
			/>,
		);

		// Antd icons also have role="img", find the chart one
		const imgs = screen.getAllByRole("img");
		const chart = imgs.find((el) => el.getAttribute("aria-label")?.includes("root.test.temp"));
		expect(chart).toBeTruthy();
		expect(chart?.getAttribute("aria-label")).toContain("3 anomalies");
	});

	it("should toggle expand/collapse", () => {
		render(
			<AnomalyChart
				timeseries="root.test.temp"
				anomalies={sampleAnomalies}
				historicalData={sampleHistoricalData}
			/>,
		);

		const expandBtn = screen.getByLabelText("Expand anomaly chart to full size");
		fireEvent.click(expandBtn);
		expect(screen.getByLabelText("Collapse anomaly chart to normal size")).toBeInTheDocument();
	});

	it("should show CRITICAL severity tag when present", () => {
		const anomaliesWithCritical = [
			...sampleAnomalies,
			{ timestamp: 1699999900000, value: 99.9, score: 0.99, severity: "CRITICAL" as const },
		];

		render(
			<AnomalyChart
				timeseries="root.test.temp"
				anomalies={anomaliesWithCritical}
				historicalData={sampleHistoricalData}
			/>,
		);

		expect(screen.getByText("Critical: 1")).toBeInTheDocument();
		expect(screen.getByText("4 Anomalies Detected")).toBeInTheDocument();
	});
});
