/**
 * Tests for AnomalyChart component
 *
 * Tests rendering with anomaly data, empty state, severity display, and export buttons.
 * Recharts components are mocked as simple divs since they don't render in JSDOM.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// recharts + html2canvas are auto-resolved from <rootDir>/__mocks__/ (manual
// mocks shared with PredictionChart.test.tsx) — no per-file factory needed.
jest.mock("recharts");
jest.mock("html2canvas");

import type { ComponentProps } from "react";
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

type AnomalyChartProps = ComponentProps<typeof AnomalyChart>;

// Shared render helper — every behaviour test renders the chart with the same
// sample data; only a few override a single prop (method / onExport /
// anomalies / historicalData). Absorbs ~10 repeated JSX blocks.
function renderChart(overrides: Partial<AnomalyChartProps> = {}) {
	return render(
		<AnomalyChart
			timeseries="root.test.temp"
			anomalies={sampleAnomalies}
			historicalData={sampleHistoricalData}
			{...overrides}
		/>,
	);
}

describe("AnomalyChart", () => {
	it("should render loading spinner when no data", () => {
		render(<AnomalyChart timeseries="root.test.temp" anomalies={[]} historicalData={[]} />);

		// Loading spinner uses animate-spin
		expect(document.querySelector(".animate-spin")).toBeInTheDocument();
	});

	it("should render chart header with timeseries name", () => {
		renderChart();
		expect(screen.getByText(/Anomaly Detection: root\.test\.temp/)).toBeInTheDocument();
	});

	it("should display the detection method", () => {
		renderChart({ method: "isolation_forest" });
		expect(screen.getByText(/ISOLATION_FOREST/)).toBeInTheDocument();
	});

	it("should show anomaly count in header", () => {
		renderChart();
		expect(screen.getByText(/3 anomalies/)).toBeInTheDocument();
	});

	it("should display anomaly summary alert", () => {
		renderChart();
		expect(screen.getByText("3 Anomalies Detected")).toBeInTheDocument();
	});

	it("should display severity tags in summary", () => {
		renderChart();
		expect(screen.getByText("High: 1")).toBeInTheDocument();
		expect(screen.getByText("Medium: 1")).toBeInTheDocument();
		expect(screen.getByText("Low: 1")).toBeInTheDocument();
	});

	it("should render export buttons", () => {
		renderChart();
		expect(screen.getByLabelText("Export anomaly chart as PNG image")).toBeInTheDocument();
		expect(screen.getByLabelText("Export anomaly data as CSV spreadsheet")).toBeInTheDocument();
	});

	it("should call onExport when CSV export clicked", () => {
		const onExport = jest.fn();
		// Mock Blob and URL APIs for JSDOM
		const originalCreateObjectURL = URL.createObjectURL;
		const originalRevokeObjectURL = URL.revokeObjectURL;
		URL.createObjectURL = jest.fn(() => "blob:test");
		URL.revokeObjectURL = jest.fn();

		renderChart({ onExport });
		fireEvent.click(screen.getByLabelText("Export anomaly data as CSV spreadsheet"));
		expect(onExport).toHaveBeenCalledWith("csv");

		URL.createObjectURL = originalCreateObjectURL;
		URL.revokeObjectURL = originalRevokeObjectURL;
	});

	it("should render with anomalies only (no historical data)", () => {
		renderChart({ timeseries: "root.test.sensor", historicalData: [] });
		expect(screen.getByText(/Anomaly Detection: root\.test\.sensor/)).toBeInTheDocument();
		expect(screen.getByTestId("recharts-ResponsiveContainer")).toBeInTheDocument();
	});

	it("should render chart with aria-label for accessibility", () => {
		renderChart({ method: "statistical" });
		// Antd icons also have role="img", find the chart one
		const imgs = screen.getAllByRole("img");
		const chart = imgs.find((el) => el.getAttribute("aria-label")?.includes("root.test.temp"));
		expect(chart).toBeTruthy();
		expect(chart?.getAttribute("aria-label")).toContain("3 anomalies");
	});

	it("should toggle expand/collapse", () => {
		renderChart();
		const expandBtn = screen.getByLabelText("Expand anomaly chart to full size");
		fireEvent.click(expandBtn);
		expect(screen.getByLabelText("Collapse anomaly chart to normal size")).toBeInTheDocument();
	});

	it("should show CRITICAL severity tag when present", () => {
		const anomaliesWithCritical = [
			...sampleAnomalies,
			{ timestamp: 1699999900000, value: 99.9, score: 0.99, severity: "CRITICAL" as const },
		];
		renderChart({ anomalies: anomaliesWithCritical });
		expect(screen.getByText("Critical: 1")).toBeInTheDocument();
		expect(screen.getByText("4 Anomalies Detected")).toBeInTheDocument();
	});
});
