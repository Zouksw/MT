/**
 * Tests for RealTimeChart component
 *
 * Tests initial state, start/stop/pause interactions, empty state display.
 * Recharts components are mocked. RealTimeChart uses fetch for polling,
 * which is intercepted by MSW.
 */

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
		// biome-ignore lint/suspicious/noExplicitAny: third-party library type
		LineChart: ({ children }: any) => <div data-testid="recharts-LineChart">{children}</div>,
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
		ReferenceLine: createComponent("ReferenceLine"),
	};
});

// Mock fetch for polling
const mockFetch = jest.fn();
// biome-ignore lint/suspicious/noExplicitAny: third-party library type
global.fetch = mockFetch as any;

import { RealTimeChart } from "../RealTimeChart";

describe("RealTimeChart", () => {
	beforeEach(() => {
		jest.useFakeTimers();
		mockFetch.mockReset();
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it("should render initial empty state with Start button", () => {
		render(<RealTimeChart timeseries="root.test.temp" />);

		expect(screen.getByText("Real-Time Data")).toBeInTheDocument();
		expect(screen.getByText("root.test.temp")).toBeInTheDocument();
		expect(screen.getByLabelText("Start real-time data monitoring")).toBeInTheDocument();
	});

	it('should show "Click Start" message when not connected', () => {
		render(<RealTimeChart timeseries="root.test.temp" />);

		expect(screen.getByText("Click Start to begin real-time monitoring")).toBeInTheDocument();
	});

	it("should start polling when Start button clicked", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				data: [{ timestamp: Date.now(), value: "25.5" }],
			}),
		});

		render(<RealTimeChart timeseries="root.test.temp" />);

		const startBtn = screen.getByLabelText("Start real-time data monitoring");
		await act(async () => {
			fireEvent.click(startBtn);
		});

		expect(mockFetch).toHaveBeenCalledTimes(1);
		expect(screen.getByText("LIVE")).toBeInTheDocument();
	});

	it("should show Pause/Stop buttons when connected", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ data: [] }),
		});

		render(<RealTimeChart timeseries="root.test.temp" />);

		await act(async () => {
			fireEvent.click(screen.getByLabelText("Start real-time data monitoring"));
		});

		expect(screen.getByLabelText("Pause real-time updates")).toBeInTheDocument();
		expect(screen.getByLabelText("Stop real-time monitoring")).toBeInTheDocument();
		expect(screen.getByLabelText("Clear all chart data")).toBeInTheDocument();
	});

	it("should toggle pause state", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ data: [] }),
		});

		render(<RealTimeChart timeseries="root.test.temp" />);

		await act(async () => {
			fireEvent.click(screen.getByLabelText("Start real-time data monitoring"));
		});

		const pauseBtn = screen.getByLabelText("Pause real-time updates");
		await act(async () => {
			fireEvent.click(pauseBtn);
		});

		expect(screen.getByText("PAUSED")).toBeInTheDocument();
		expect(screen.getByLabelText("Resume real-time updates")).toBeInTheDocument();
	});

	it("should stop polling and return to initial state", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ data: [] }),
		});

		render(<RealTimeChart timeseries="root.test.temp" />);

		await act(async () => {
			fireEvent.click(screen.getByLabelText("Start real-time data monitoring"));
		});

		await act(async () => {
			fireEvent.click(screen.getByLabelText("Stop real-time monitoring"));
		});

		expect(screen.getByLabelText("Start real-time data monitoring")).toBeInTheDocument();
	});

	it("should show error when fetch fails", async () => {
		mockFetch.mockResolvedValue({
			ok: false,
		});

		render(<RealTimeChart timeseries="root.test.temp" />);

		await act(async () => {
			fireEvent.click(screen.getByLabelText("Start real-time data monitoring"));
		});

		await waitFor(() => {
			expect(screen.getByText("Connection Error")).toBeInTheDocument();
		});
	});

	it("should call onDisconnect when Stop clicked", async () => {
		const onDisconnect = jest.fn();
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({ data: [] }),
		});

		render(<RealTimeChart timeseries="root.test.temp" onDisconnect={onDisconnect} />);

		await act(async () => {
			fireEvent.click(screen.getByLabelText("Start real-time data monitoring"));
		});

		await act(async () => {
			fireEvent.click(screen.getByLabelText("Stop real-time monitoring"));
		});

		expect(onDisconnect).toHaveBeenCalledTimes(1);
	});

	it("should use default timeseries when not provided", () => {
		render(<RealTimeChart />);

		expect(screen.getByText("root.test2")).toBeInTheDocument();
	});

	it("should render with data points when fetch returns data", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				data: [{ timestamp: 1699999000000, value: "25.5" }],
			}),
		});

		render(<RealTimeChart timeseries="root.test.temp" />);

		await act(async () => {
			fireEvent.click(screen.getByLabelText("Start real-time data monitoring"));
		});

		// Chart container should appear with data
		await waitFor(() => {
			expect(screen.getByTestId("recharts-ResponsiveContainer")).toBeInTheDocument();
		});

		// Statistics should appear
		expect(screen.getByText("Current")).toBeInTheDocument();
	});

	it("should clear data when Clear button clicked", async () => {
		mockFetch.mockResolvedValue({
			ok: true,
			json: async () => ({
				data: [{ timestamp: 1699999000000, value: "25.5" }],
			}),
		});

		render(<RealTimeChart timeseries="root.test.temp" />);

		await act(async () => {
			fireEvent.click(screen.getByLabelText("Start real-time data monitoring"));
		});

		await waitFor(() => {
			expect(screen.getByTestId("recharts-ResponsiveContainer")).toBeInTheDocument();
		});

		await act(async () => {
			fireEvent.click(screen.getByLabelText("Clear all chart data"));
		});

		// After clearing, should show empty state
		expect(screen.getByText("Waiting for data...")).toBeInTheDocument();
	});
});
