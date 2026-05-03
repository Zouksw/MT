import { renderHook, waitFor } from "@testing-library/react";
import { useDashboardStats } from "../useDashboardStats";

// Mock auth utility
jest.mock("@/utils/auth", () => ({
	getAuthToken: jest.fn(() => "mock-token"),
}));

// Mock useRetryableFetch to control data flow
jest.mock("@/hooks/useRetryableFetch", () => ({
	useRetryableFetch: jest.fn(),
}));

import { useRetryableFetch } from "@/hooks/useRetryableFetch";

const mockUseRetryableFetch = useRetryableFetch as jest.MockedFunction<typeof useRetryableFetch>;

describe("useDashboardStats", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("should start with loading state and null stats", () => {
		mockUseRetryableFetch.mockReturnValue({
			data: undefined,
			error: undefined,
			isLoading: true,
			isValidating: false,
			isRetrying: false,
			retryCount: 0,
			manualRetry: jest.fn(),
			mutate: jest.fn(),
		});

		const { result } = renderHook(() => useDashboardStats());

		expect(result.current.loading).toBe(true);
		expect(result.current.stats).toBeNull();
		expect(result.current.error).toBeNull();
	});

	it("should fetch and parse stats successfully", async () => {
		mockUseRetryableFetch.mockImplementation((_key: any, _fetcher: any) => {
			// Return different data based on call order
			const callIndex = mockUseRetryableFetch.mock.calls.length - 1;
			const _dataMap: any[] = [
				{ total: 10, data: [] }, // datasets
				{ total: 25, data: [] }, // timeseries
				{ total: 5, data: [] }, // forecasts
				{
					total: 15,
					data: [
						{ severity: "critical" },
						{ severity: "high" },
						{ severity: "medium" },
						{ severity: "low" },
					],
				}, // alerts
				{ data: [{ id: 1 }] }, // recentAlerts
				{ data: [{ id: 1 }] }, // recentForecasts
			];

			// Use a simple counter approach - return data based on how many calls so far
			const dataByCallOrder: Record<number, any> = {
				0: { total: 10, data: [] },
				1: { total: 25, data: [] },
				2: { total: 5, data: [] },
				3: {
					total: 15,
					data: [
						{ severity: "critical" },
						{ severity: "high" },
						{ severity: "medium" },
						{ severity: "low" },
					],
				},
				4: { data: [{ id: 1 }] },
				5: { data: [{ id: 1 }] },
			};

			return {
				data: dataByCallOrder[callIndex] || { total: 0, data: [] },
				error: undefined,
				isLoading: false,
				isValidating: false,
				isRetrying: false,
				retryCount: 0,
				manualRetry: jest.fn(),
				mutate: jest.fn(),
			};
		});

		const { result } = renderHook(() => useDashboardStats());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.stats).toBeDefined();
		expect(result.current.stats?.datasets.total).toBe(10);
		expect(result.current.stats?.timeseries.total).toBe(25);
		expect(result.current.stats?.forecasts.total).toBe(5);
		expect(result.current.stats?.alerts.total).toBe(15);
		expect(result.current.error).toBeNull();
	});

	it("should handle API errors gracefully", async () => {
		mockUseRetryableFetch.mockImplementation(() => ({
			data: undefined,
			error: new Error("Network error"),
			isLoading: false,
			isValidating: false,
			isRetrying: false,
			retryCount: 0,
			manualRetry: jest.fn(),
			mutate: jest.fn(),
		}));

		const { result } = renderHook(() => useDashboardStats());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.stats).toBeNull();
		expect(result.current.error).toBeInstanceOf(Error);
		expect(result.current.error?.message).toBe("Network error");
	});

	it("should handle missing auth token", async () => {
		const { getAuthToken } = require("@/utils/auth");
		getAuthToken.mockReturnValueOnce(null);

		// When auth token is null, useRetryableFetch gets null key and returns default
		mockUseRetryableFetch.mockImplementation(() => ({
			data: undefined,
			error: undefined,
			isLoading: false,
			isValidating: false,
			isRetrying: false,
			retryCount: 0,
			manualRetry: jest.fn(),
			mutate: jest.fn(),
		}));

		const { result } = renderHook(() => useDashboardStats());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.stats).toBeNull();
	});

	it("should count alerts by severity correctly", async () => {
		let callCount = 0;
		mockUseRetryableFetch.mockImplementation(() => {
			callCount++;
			if (callCount === 4) {
				// alerts call (4th useRetryableFetch call)
				return {
					data: {
						total: 8,
						data: [
							{ severity: "critical" },
							{ severity: "critical" },
							{ severity: "high" },
							{ severity: "high" },
							{ severity: "high" },
							{ severity: "medium" },
							{ severity: "low" },
							{ severity: "LOW" },
						],
					},
					error: undefined,
					isLoading: false,
					isValidating: false,
					isRetrying: false,
					retryCount: 0,
					manualRetry: jest.fn(),
					mutate: jest.fn(),
				};
			}
			return {
				data: { total: 0, data: [] },
				error: undefined,
				isLoading: false,
				isValidating: false,
				isRetrying: false,
				retryCount: 0,
				manualRetry: jest.fn(),
				mutate: jest.fn(),
			};
		});

		const { result } = renderHook(() => useDashboardStats());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.stats?.alerts.bySeverity.critical).toBe(2);
		expect(result.current.stats?.alerts.bySeverity.high).toBe(3);
		expect(result.current.stats?.alerts.bySeverity.medium).toBe(1);
		expect(result.current.stats?.alerts.bySeverity.low).toBe(2);
	});

	it("should handle responses with items instead of data", async () => {
		let callCount = 0;
		mockUseRetryableFetch.mockImplementation(() => {
			callCount++;
			if (callCount === 5) {
				// recentAlerts
				return {
					data: { items: [{ id: 1, name: "Alert 1" }] },
					error: undefined,
					isLoading: false,
					isValidating: false,
					isRetrying: false,
					retryCount: 0,
					manualRetry: jest.fn(),
					mutate: jest.fn(),
				};
			}
			if (callCount === 6) {
				// recentForecasts
				return {
					data: { items: [{ id: 1, name: "Forecast 1" }] },
					error: undefined,
					isLoading: false,
					isValidating: false,
					isRetrying: false,
					retryCount: 0,
					manualRetry: jest.fn(),
					mutate: jest.fn(),
				};
			}
			return {
				data: { total: 0, data: [] },
				error: undefined,
				isLoading: false,
				isValidating: false,
				isRetrying: false,
				retryCount: 0,
				manualRetry: jest.fn(),
				mutate: jest.fn(),
			};
		});

		const { result } = renderHook(() => useDashboardStats());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.stats?.recentAlerts).toEqual([{ id: 1, name: "Alert 1" }]);
		expect(result.current.stats?.recentForecasts).toEqual([{ id: 1, name: "Forecast 1" }]);
	});

	it("should use default values when totals are missing", async () => {
		mockUseRetryableFetch.mockImplementation(() => ({
			data: { data: [] },
			error: undefined,
			isLoading: false,
			isValidating: false,
			isRetrying: false,
			retryCount: 0,
			manualRetry: jest.fn(),
			mutate: jest.fn(),
		}));

		const { result } = renderHook(() => useDashboardStats());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.stats?.datasets.total).toBe(0);
		expect(result.current.stats?.timeseries.total).toBe(0);
	});

	it("should include mock AI models data", async () => {
		mockUseRetryableFetch.mockImplementation(() => ({
			data: { total: 0, data: [] },
			error: undefined,
			isLoading: false,
			isValidating: false,
			isRetrying: false,
			retryCount: 0,
			manualRetry: jest.fn(),
			mutate: jest.fn(),
		}));

		const { result } = renderHook(() => useDashboardStats());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.stats?.aiModels.active).toBe(5);
		expect(result.current.stats?.aiModels.total).toBe(7);
	});

	it("should include trend data", async () => {
		mockUseRetryableFetch.mockImplementation(() => ({
			data: { total: 0, data: [] },
			error: undefined,
			isLoading: false,
			isValidating: false,
			isRetrying: false,
			retryCount: 0,
			manualRetry: jest.fn(),
			mutate: jest.fn(),
		}));

		const { result } = renderHook(() => useDashboardStats());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(typeof result.current.stats?.datasets.trend).toBe("number");
		expect(typeof result.current.stats?.timeseries.trend).toBe("number");
		expect(typeof result.current.stats?.forecasts.trend).toBe("number");
		expect(typeof result.current.stats?.alerts.trend).toBe("number");
	});
});
