/**
 * Tests for PredictionChart component
 *
 * Tests rendering with data, empty state, and export buttons.
 * Recharts components are mocked as simple divs since they don't render in JSDOM.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// recharts + html2canvas are auto-resolved from <rootDir>/__mocks__/ (manual
// mocks shared with AnomalyChart.test.tsx) — no per-file factory needed.
jest.mock("recharts");
jest.mock("html2canvas");

// Toast mock stays local — only PredictionChart uses it.
jest.mock("@/components/ui/Toast", () => ({
	useToast: () => ({
		showError: jest.fn(),
		showSuccess: jest.fn(),
		showInfo: jest.fn(),
		showWarning: jest.fn(),
	}),
}));

import { PredictionChart } from "../PredictionChart";

const defaultPredictionData = {
	timestamps: [1700000000000, 1700000060000, 1700000120000],
	values: [25.5, 26.0, 24.8],
	confidence: [1.2, 1.5, 1.3],
};

const defaultHistoricalData = [
	{ timestamp: 1699999000000, value: 24.0 },
	{ timestamp: 1699999600000, value: 24.5 },
	{ timestamp: 1699999800000, value: 25.0 },
];

describe("PredictionChart", () => {
	it("should render loading spinner when no data", () => {
		render(
			<PredictionChart
				timeseries="root.test.temp"
				historicalData={[]}
				predictionData={{ timestamps: [], values: [] }}
				algorithm="arima"
			/>,
		);

		// Loading spinner uses animate-spin
		expect(document.querySelector(".animate-spin")).toBeInTheDocument();
	});

	it("should render chart header with timeseries name and algorithm", () => {
		render(
			<PredictionChart
				timeseries="root.test.temp"
				historicalData={defaultHistoricalData}
				predictionData={defaultPredictionData}
				algorithm="arima"
			/>,
		);

		expect(screen.getByText(/Prediction Chart: root\.test\.temp/)).toBeInTheDocument();
		expect(screen.getByText(/ARIMA/)).toBeInTheDocument();
	});

	it("should display data point count", () => {
		render(
			<PredictionChart
				timeseries="root.test.temp"
				historicalData={defaultHistoricalData}
				predictionData={defaultPredictionData}
				algorithm="arima"
			/>,
		);

		// 3 historical + 3 prediction = 6 data points
		expect(screen.getByText(/6 data points/)).toBeInTheDocument();
	});

	it("should render export buttons", () => {
		render(
			<PredictionChart
				timeseries="root.test.temp"
				historicalData={defaultHistoricalData}
				predictionData={defaultPredictionData}
				algorithm="arima"
			/>,
		);

		expect(screen.getByLabelText("Export chart as PNG image")).toBeInTheDocument();
		expect(screen.getByLabelText("Export chart data as CSV spreadsheet")).toBeInTheDocument();
	});

	it("should render expand/collapse button", () => {
		render(
			<PredictionChart
				timeseries="root.test.temp"
				historicalData={defaultHistoricalData}
				predictionData={defaultPredictionData}
				algorithm="arima"
			/>,
		);

		const expandBtn = screen.getByLabelText("Expand chart to full size");
		expect(expandBtn).toBeInTheDocument();

		fireEvent.click(expandBtn);
		expect(screen.getByLabelText("Collapse chart to normal size")).toBeInTheDocument();
	});

	it("should render chart container for Recharts", () => {
		render(
			<PredictionChart
				timeseries="root.test.temp"
				historicalData={defaultHistoricalData}
				predictionData={defaultPredictionData}
				algorithm="arima"
			/>,
		);

		expect(screen.getByTestId("recharts-ResponsiveContainer")).toBeInTheDocument();
	});

	it("should call onExport callback when CSV export clicked", () => {
		const onExport = jest.fn();
		// Mock Blob and URL APIs for JSDOM
		const mockUrl = "blob:test";
		const originalCreateObjectURL = URL.createObjectURL;
		const originalRevokeObjectURL = URL.revokeObjectURL;
		URL.createObjectURL = jest.fn(() => mockUrl);
		URL.revokeObjectURL = jest.fn();

		render(
			<PredictionChart
				timeseries="root.test.temp"
				historicalData={defaultHistoricalData}
				predictionData={defaultPredictionData}
				algorithm="arima"
				onExport={onExport}
			/>,
		);

		fireEvent.click(screen.getByLabelText("Export chart data as CSV spreadsheet"));
		expect(onExport).toHaveBeenCalledWith("csv");

		URL.createObjectURL = originalCreateObjectURL;
		URL.revokeObjectURL = originalRevokeObjectURL;
	});

	it("should render with prediction-only data (no historical)", () => {
		render(
			<PredictionChart
				timeseries="root.test.sensor"
				historicalData={[]}
				predictionData={defaultPredictionData}
				algorithm="lstm"
			/>,
		);

		expect(screen.getByText(/Prediction Chart: root\.test\.sensor/)).toBeInTheDocument();
		expect(screen.getByText(/LSTM/)).toBeInTheDocument();
		expect(screen.getByTestId("recharts-ResponsiveContainer")).toBeInTheDocument();
	});

	it("should render with historical-only data (no predictions)", () => {
		render(
			<PredictionChart
				timeseries="root.test.temp"
				historicalData={defaultHistoricalData}
				predictionData={{ timestamps: [], values: [] }}
				algorithm="prophet"
			/>,
		);

		expect(screen.getByText(/PROPHET/)).toBeInTheDocument();
		expect(screen.getByTestId("recharts-ResponsiveContainer")).toBeInTheDocument();
	});

	it("should render chart with aria-label for accessibility", () => {
		render(
			<PredictionChart
				timeseries="root.test.temp"
				historicalData={defaultHistoricalData}
				predictionData={defaultPredictionData}
				algorithm="arima"
			/>,
		);

		// Antd icons also have role="img", so use getAllByRole and find the chart one
		const imgs = screen.getAllByRole("img");
		const chart = imgs.find((el) => el.getAttribute("aria-label")?.includes("root.test.temp"));
		expect(chart).toBeTruthy();
		expect(chart?.getAttribute("aria-label")).toContain("arima");
	});
});
