import { renderHook, waitFor } from "@testing-library/react";
import { useDashboardStats } from "../useDashboardStats";

// Mock auth utility
jest.mock("@/utils/auth", () => ({
	getAuthToken: jest.fn(() => "mock-token"),
}));

// Mock useSWR for beef public endpoints
jest.mock("swr", () => ({
	__esModule: true,
	default: jest.fn(() => ({ data: undefined })),
}));

// Mock useRetryableFetch to control data flow
jest.mock("@/hooks/useRetryableFetch", () => ({
	useRetryableFetch: jest.fn(),
}));

// Mock useBeefCutForecasts so we can control the per-cut forecast data that
// feeds both the aiSummary hero card and the hotCuts forecast column.
jest.mock("@/hooks/useBeefCutForecasts", () => ({
	useBeefCutForecasts: jest.fn(() => ({ forecasts: undefined, isLoading: false })),
}));

import { useBeefCutForecasts } from "@/hooks/useBeefCutForecasts";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";

const mockUseRetryableFetch = useRetryableFetch as jest.MockedFunction<typeof useRetryableFetch>;
const mockUseBeefCutForecasts = useBeefCutForecasts as jest.MockedFunction<
	typeof useBeefCutForecasts
>;

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
		// Index the mock by URL key (not call order) so the test is robust to
		// hook reordering — the 3 public beef calls and the authed calls can
		// appear in any sequence without breaking this test.
		// biome-ignore lint/suspicious/noExplicitAny: third-party library type
		const byKey: Record<string, any> = {
			"/beef/cuts": { data: { cuts: [{ cutCode: "X" }] } },
			"/beef/factories": { data: { factories: [{ id: "f1" }] } },
			"/beef/prices/latest": { data: { prices: [{ price: 5, cutCode: "X", date: "2026-07-19" }] } },
			"/datasets?page=1&limit=1": { total: 10, data: [] },
			"/timeseries?page=1&limit=1": { total: 25, data: [] },
			"/models?page=1&limit=1": { total: 5, data: [] },
			"/alerts?page=1&limit=100": {
				total: 15,
				data: [
					{ severity: "critical" },
					{ severity: "high" },
					{ severity: "medium" },
					{ severity: "low" },
				],
			},
		};
		// biome-ignore lint/suspicious/noExplicitAny: third-party library type
		mockUseRetryableFetch.mockImplementation((key: any) => {
			const url = String(key ?? "");
			const matched = Object.entries(byKey).find(([k]) => url.includes(k));
			return {
				data: matched ? matched[1] : { total: 0, data: [] },
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

		expect(result.current.stats).not.toBeNull();
		expect(result.current.stats?.beef).toBeDefined();
		expect(result.current.stats?.beef.cuts).toBe(0);
	});

	it("should count alerts by severity correctly", async () => {
		// Key-indexed mock so the alerts payload is returned regardless of
		// call ordering (was: callCount === 4, fragile to hook reordering).
		// biome-ignore lint/suspicious/noExplicitAny: third-party library type
		mockUseRetryableFetch.mockImplementation((key: any) => {
			const url = String(key ?? "");
			if (url.includes("/alerts?page=1&limit=100")) {
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
		// Key-indexed mock so the recentAlerts/recentForecasts payloads land
		// regardless of call order (was: callCount 5/6, fragile to reordering).
		// biome-ignore lint/suspicious/noExplicitAny: third-party library type
		mockUseRetryableFetch.mockImplementation((key: any) => {
			const url = String(key ?? "");
			if (url.includes("/alerts?limit=5")) {
				// recentAlerts — uses items[] shape
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
			if (url.includes("/models?limit=5")) {
				// recentForecasts — uses items[] shape
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

	it("should report AI models count from the registry (no longer hardcoded)", async () => {
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

		// Previously this was a hardcoded fake (8/8). Now derived from the models
		// registry — with an empty registry the count is honestly 0.
		expect(result.current.stats?.aiModels.active).toBe(0);
		expect(result.current.stats?.aiModels.total).toBe(0);
	});

	it("reports active != total when only some models are isActive=true (TRUST-1 honesty guard)", async () => {
		// Mutation guard: the previous code set `active: aiTotal`, forcing
		// active==total (always 100%). With a real isActive count, a registry
		// of 4 models where only 1 is active must surface active=1, total=4.
		// Flipping the hook back to `active: aiTotal` fails this test.
		// Key-indexed (not call-order) so hook reordering doesn't break it.
		// biome-ignore lint/suspicious/noExplicitAny: third-party library type
		mockUseRetryableFetch.mockImplementation((key: any) => {
			const url = String(key ?? "");
			if (url.includes("isActive=true")) {
				return {
					data: { total: 1, pagination: { total: 1 } },
					error: undefined,
					isLoading: false,
					isValidating: false,
					isRetrying: false,
					retryCount: 0,
					manualRetry: jest.fn(),
					mutate: jest.fn(),
				};
			}
			if (url.includes("/models?page=1&limit=1")) {
				return {
					data: { total: 4, data: [] },
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

		expect(result.current.stats?.aiModels.total).toBe(4);
		expect(result.current.stats?.aiModels.active).toBe(1);
		// The honesty invariant: active must NEVER be force-set to total.
		expect(result.current.stats?.aiModels.active).not.toBe(result.current.stats?.aiModels.total);
	});

	it("surfaces trend as null when no trend source is wired (no fake 0 badge — TRUST-1)", async () => {
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

		// Previously trends were hardcoded 0 and rendered as a fake "0%" badge.
		// Now they are null so the StatCard hides its trend badge entirely —
		// an honest "no trend data" instead of a fabricated 0%.
		expect(result.current.stats?.datasets.trend).toBeNull();
		expect(result.current.stats?.timeseries.trend).toBeNull();
		expect(result.current.stats?.forecasts.trend).toBeNull();
		expect(result.current.stats?.alerts.trend).toBeNull();
	});

	it("merges per-cut forecasts into hotCuts rows (M2 §5.1 AI column)", async () => {
		// The hot-cuts table must carry the 7-day forecast per row so the
		// dashboard's 行情总览 shows the AI prediction alongside the price
		// (PRODUCT-SPEC §5.1). A cut with a forecast gets it merged in;
		// a cut without keeps forecast:null (honest "—").
		// biome-ignore lint/suspicious/noExplicitAny: third-party library type
		const byKey: Record<string, any> = {
			"/beef/cuts": { data: { cuts: [{ cutCode: "STRIPLOIN" }, { cutCode: "BRISKET" }] } },
			"/beef/factories": { data: { factories: [] } },
			"/beef/prices/latest": {
				data: {
					prices: [
						{ price: 12, cutCode: "STRIPLOIN", date: "2026-07-27", factory: { country: "BR" } },
						{ price: 8, cutCode: "BRISKET", date: "2026-07-27", factory: { country: "US" } },
					],
				},
			},
		};
		// biome-ignore lint/suspicious/noExplicitAny: third-party library type
		mockUseRetryableFetch.mockImplementation((key: any) => {
			const url = String(key ?? "");
			const matched = Object.entries(byKey).find(([k]) => url.includes(k));
			return {
				data: matched ? matched[1] : { total: 0, data: [] },
				error: undefined,
				isLoading: false,
				isValidating: false,
				isRetrying: false,
				retryCount: 0,
				manualRetry: jest.fn(),
				mutate: jest.fn(),
			};
		});

		// STRIPLOIN has a forecast; BRISKET does not.
		mockUseBeefCutForecasts.mockReturnValue({
			forecasts: {
				STRIPLOIN: {
					direction: "up",
					predictedChange: 2.5,
					confidence: 0.85,
					modelsAgree: 3,
					availableModels: 3,
					predictedPrice: 12.3,
					dataPoints: 30,
					horizon: 7,
				},
			},
			isLoading: false,
		});

		const { result } = renderHook(() => useDashboardStats());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		const hotCuts = result.current.stats?.beef.hotCuts ?? [];
		const striploin = hotCuts.find((c) => c.cutCode === "STRIPLOIN");
		const brisket = hotCuts.find((c) => c.cutCode === "BRISKET");

		// STRIPLOIN row carries the merged forecast.
		expect(striploin?.forecast).not.toBeNull();
		expect(striploin?.forecast?.direction).toBe("up");
		expect(striploin?.forecast?.predictedChange).toBe(2.5);

		// BRISKET row has no forecast → honest null (renders as "—").
		expect(brisket?.forecast).toBeNull();
	});
});
