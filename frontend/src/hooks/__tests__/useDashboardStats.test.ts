import { renderHook, waitFor } from "@testing-library/react";
import { useDashboardStats } from "../useDashboardStats";

// Mock auth utility
jest.mock("@/utils/auth", () => ({
	getAuthToken: jest.fn(() => "mock-token"),
}));

// Mock the AuthContext the hook reads session truth from (round-104: the
// hook moved from the refresh-volatile memory token to useAuth()).
// authStatus is a mutable knob so individual tests can flip the session.
const authStatus = { current: "authenticated" as "authenticated" | "unauthenticated" };
jest.mock("@/contexts/auth", () => ({
	useAuth: jest.fn(() => ({
		status: authStatus.current,
		user:
			authStatus.current === "authenticated"
				? { id: "u1", email: "u@x.dev", name: "Test User" }
				: null,
		refresh: jest.fn(),
		logout: jest.fn(),
	})),
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
// feeds the hotCuts forecast column.
jest.mock("@/hooks/useBeefCutForecasts", () => ({
	useBeefCutForecasts: jest.fn(() => ({ forecasts: undefined, isLoading: false })),
}));

// Mock the beef monthly consensus (round-138 批5 hero source) — its fetch
// behavior belongs to its own concern; here null keeps the hero in its
// honest empty state and stops a real apiFetch from churning renders (which
// double-fired the /alerts dedup assertion below).
jest.mock("@/hooks/useBeefMonthlyConsensus", () => ({
	useBeefMonthlyConsensus: jest.fn(() => ({
		consensus: null,
		loading: false,
		error: null,
		retry: jest.fn(),
	})),
}));

import { useBeefCutForecasts } from "@/hooks/useBeefCutForecasts";
import { useRetryableFetch } from "@/hooks/useRetryableFetch";

const mockUseRetryableFetch = useRetryableFetch as jest.MockedFunction<typeof useRetryableFetch>;
const mockUseBeefCutForecasts = useBeefCutForecasts as jest.MockedFunction<
	typeof useBeefCutForecasts
>;

// ─── Mock factories (round-65) ────────────────────────────────────────
// Every test returned the same 9-field useRetryableFetch result object
// inline (~9 lines × 13 tests). These factories absorb that boilerplate.
// biome-ignore lint/suspicious/noExplicitAny: third-party library type
type FetchResult = any;

// Build the standard resolved-result object with optional overrides.
function makeFetchResult(overrides: Partial<FetchResult> = {}): FetchResult {
	return {
		data: undefined,
		error: undefined,
		isLoading: false,
		isValidating: false,
		isRetrying: false,
		retryCount: 0,
		manualRetry: jest.fn(),
		mutate: jest.fn(),
		...overrides,
	};
}

// Key-indexed mockImplementation: returns the byKey entry whose key is a
// substring of the called URL, falling back to {total:0,data:[]}. Robust to
// hook reordering (no call-order dependence).
// biome-ignore lint/suspicious/noExplicitAny: third-party library type
function mockByKey(byKey: Record<string, any>) {
	mockUseRetryableFetch.mockImplementation((key: any) => {
		const url = String(key ?? "");
		const matched = Object.entries(byKey).find(([k]) => url.includes(k));
		return makeFetchResult({ data: matched ? matched[1] : { total: 0, data: [] } });
	});
}

describe("useDashboardStats", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("should start with loading state and null stats", () => {
		mockUseRetryableFetch.mockReturnValue(makeFetchResult({ isLoading: true }));

		const { result } = renderHook(() => useDashboardStats());

		expect(result.current.loading).toBe(true);
		expect(result.current.stats).toBeNull();
		expect(result.current.error).toBeNull();
	});

	it("should fetch and parse stats successfully", async () => {
		// Key-indexed mock (robust to hook reordering) — see mockByKey factory.
		mockByKey({
			"/beef/cuts": { data: { cuts: [{ cutCode: "X" }] } },
			"/beef/factories": { data: { factories: [{ id: "f1" }] } },
			"/beef/prices/latest": { data: { prices: [{ price: 5, cutCode: "X", date: "2026-07-19" }] } },
			"/datasets?page=1&limit=1": { total: 10, data: [] },
			"/timeseries?page=1&limit=1": { total: 25, data: [] },
			"/inference/models": {
				models: [
					{ id: "arima", available: true },
					{ id: "chronos_tiny", available: true },
				],
			},
			"/alerts?page=1&limit=100": {
				total: 15,
				data: [
					{ severity: "critical" },
					{ severity: "high" },
					{ severity: "medium" },
					{ severity: "low" },
				],
			},
		});

		const { result } = renderHook(() => useDashboardStats());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.stats).toBeDefined();
		expect(result.current.stats?.datasets.total).toBe(10);
		expect(result.current.stats?.timeseries.total).toBe(25);
		expect(result.current.stats?.aiModels.total).toBe(2);
		expect(result.current.stats?.aiModels.active).toBe(2);
		expect(result.current.stats?.alerts.total).toBe(15);
		expect(result.current.error).toBeNull();
	});

	it("should handle API errors gracefully", async () => {
		mockUseRetryableFetch.mockImplementation(() =>
			makeFetchResult({ error: new Error("Network error") }),
		);

		const { result } = renderHook(() => useDashboardStats());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.stats).toBeNull();
		expect(result.current.error).toBeInstanceOf(Error);
		expect(result.current.error?.message).toBe("Network error");
	});

	it("falls back to public-only stats when the session is unauthenticated", async () => {
		// round-104: session truth is AuthContext status, not the memory
		// token — a cookie session survives refresh; "no session" is what
		// gates the authed fetches now.
		authStatus.current = "unauthenticated";

		// Unauthenticated → authed useRetryableFetch calls get a null key and
		// return the default empty result.
		mockUseRetryableFetch.mockImplementation(() => makeFetchResult());

		const { result } = renderHook(() => useDashboardStats());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.stats).not.toBeNull();
		expect(result.current.stats?.beef).toBeDefined();
		expect(result.current.stats?.beef.cuts).toBe(0);

		authStatus.current = "authenticated";
	});

	it("should count alerts by severity correctly", async () => {
		// Key-indexed mock so the alerts payload is returned regardless of
		// call ordering (was: callCount === 4, fragile to hook reordering).
		// biome-ignore lint/suspicious/noExplicitAny: third-party library type
		mockUseRetryableFetch.mockImplementation((key: any) => {
			const url = String(key ?? "");
			if (url.includes("/alerts?page=1&limit=100")) {
				return makeFetchResult({
					data: {
						total: 8,
						data: [
							// Backend enum casing (schema.prisma AlertSeverity) —
							// the counting code lowercases before keying.
							{ severity: "ERROR" },
							{ severity: "ERROR" },
							{ severity: "WARNING" },
							{ severity: "WARNING" },
							{ severity: "WARNING" },
							{ severity: "INFO" },
							{ severity: "info" },
							{ severity: "INFO" },
						],
					},
				});
			}
			return makeFetchResult({ data: { total: 0, data: [] } });
		});

		const { result } = renderHook(() => useDashboardStats());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.stats?.alerts.bySeverity.error).toBe(2);
		expect(result.current.stats?.alerts.bySeverity.warning).toBe(3);
		expect(result.current.stats?.alerts.bySeverity.info).toBe(3);
	});

	it("recentAlerts are sliced from the single /alerts response (round-119 dedup)", async () => {
		// The hook used to fire a SECOND /api/alerts?limit=5 request for data
		// the limit=100 call already returns. It must slice the first 5 from
		// the one response instead — one alerts request per dashboard load.
		// Key-indexed mock so payloads land regardless of call order.
		// biome-ignore lint/suspicious/noExplicitAny: third-party library type
		mockUseRetryableFetch.mockImplementation((key: any) => {
			const url = String(key ?? "");
			if (url.includes("/alerts?page=1&limit=100")) {
				return makeFetchResult({
					data: {
						total: 7,
						data: [
							{ id: "1" },
							{ id: "2" },
							{ id: "3" },
							{ id: "4" },
							{ id: "5" },
							{ id: "6" },
							{ id: "7" },
						],
					},
				});
			}
			return makeFetchResult({ data: { total: 0, data: [] } });
		});

		const { result } = renderHook(() => useDashboardStats());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		// The 5 newest from the one response, newest-first order preserved.
		expect(result.current.stats?.recentAlerts).toHaveLength(5);
		expect(result.current.stats?.recentAlerts.map((a: { id: string }) => a.id)).toEqual([
			"1",
			"2",
			"3",
			"4",
			"5",
		]);
		// The per-user forecast store died with the round-132 registry — the
		// strip is an honest [] (RecentActivity renders its empty state).
		expect(result.current.stats?.recentForecasts).toEqual([]);

		// Exactly ONE alerts request is issued (authed keys are thunks; their
		// source contains the URL, so match on the stringified key).
		const alertsCalls = mockUseRetryableFetch.mock.calls.filter((c) =>
			String(c[0]).includes("/alerts"),
		);
		expect(alertsCalls).toHaveLength(1);

		// And NO call to the deleted /api/models registry survives.
		const modelsCalls = mockUseRetryableFetch.mock.calls.filter((c) =>
			String(c[0]).includes("/models?"),
		);
		expect(modelsCalls).toHaveLength(0);
	});

	it("should use default values when totals are missing", async () => {
		mockUseRetryableFetch.mockImplementation(() => makeFetchResult({ data: { data: [] } }));

		const { result } = renderHook(() => useDashboardStats());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.stats?.datasets.total).toBe(0);
		expect(result.current.stats?.timeseries.total).toBe(0);
	});

	it("should report AI models count from the engine (no longer hardcoded)", async () => {
		mockByKey({
			"/inference/models": { models: [] },
		});

		const { result } = renderHook(() => useDashboardStats());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		// Previously this was a hardcoded fake (8/8). Now derived from the
		// engine's model list — with an empty list the count is honestly 0.
		expect(result.current.stats?.aiModels.active).toBe(0);
		expect(result.current.stats?.aiModels.total).toBe(0);
	});

	it("counts only engine-available models as active (TRUST-1 honesty guard)", async () => {
		// Mutation guard: the previous code set `active: aiTotal`, forcing
		// active==total (always 100%). The engine reports per-model
		// availability; 4 listed models with 1 available must surface
		// active=1, total=4. Flipping back to `active: aiTotal` fails this.
		// The static fallback payload has no `available` flag at all —
		// availability we could not verify is never claimed.
		// Key-indexed (not call-order) so hook reordering doesn't break it.
		mockByKey({
			"/inference/models": {
				models: [
					{ id: "arima", available: true },
					{ id: "sarimax" },
					{ id: "chronos_tiny", available: false },
					{ id: "chronos_base" },
				],
			},
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

	it("survives an engine-models fetch failure without crashing (regression: /api/models 404 crash)", async () => {
		// The deleted /api/models registry 404'd on every load and the
		// unguarded forecastsData.total read threw during the stats build,
		// crashing /dashboard into the error boundary. The models fetch is
		// auxiliary now: when it fails, stats must still build (0 models) and
		// the hook must NOT surface it as a dashboard error.
		// biome-ignore lint/suspicious/noExplicitAny: third-party library type
		mockUseRetryableFetch.mockImplementation((key: any) => {
			const url = String(key ?? "");
			if (url.includes("/inference/models")) {
				return makeFetchResult({ data: undefined, error: new Error("HTTP error! status: 404") });
			}
			return makeFetchResult({ data: { total: 3, data: [] } });
		});

		const { result } = renderHook(() => useDashboardStats());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.stats).not.toBeNull();
		expect(result.current.stats?.aiModels.total).toBe(0);
		expect(result.current.stats?.aiModels.active).toBe(0);
		expect(result.current.error).toBeNull();
	});

	it("surfaces trend as null when no trend source is wired (no fake 0 badge — TRUST-1)", async () => {
		mockUseRetryableFetch.mockImplementation(() =>
			makeFetchResult({ data: { total: 0, data: [] } }),
		);

		const { result } = renderHook(() => useDashboardStats());

		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		// Previously trends were hardcoded 0 and rendered as a fake "0%" badge.
		// Now they are null so the StatCard hides its trend badge entirely —
		// an honest "no trend data" instead of a fabricated 0%.
		expect(result.current.stats?.datasets.trend).toBeNull();
		expect(result.current.stats?.timeseries.trend).toBeNull();
		expect(result.current.stats?.alerts.trend).toBeNull();
	});

	it("merges per-cut forecasts into hotCuts rows (M2 §5.1 AI column)", async () => {
		// The hot-cuts table must carry the 7-day forecast per row so the
		// dashboard's 行情总览 shows the AI prediction alongside the price
		// (PRODUCT-SPEC §5.1). A cut with a forecast gets it merged in;
		// a cut without keeps forecast:null (honest "—").
		mockByKey({
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

	it("surfaces the backend beef-price trend on the hero card (round-57, §5.1)", async () => {
		// /beef/prices/latest now returns a `trend` object with the imported
		// average % change vs the previous day. The hook must pass it through so
		// the hero card can render the trend badge instead of hiding it.
		mockByKey({
			"/beef/cuts": { data: { cuts: [] } },
			"/beef/factories": { data: { factories: [] } },
			"/beef/prices/latest": {
				data: {
					prices: [{ price: 50, cutCode: "X", date: "2026-07-31", factory: { country: "BR" } }],
					trend: {
						importedTrendPct: -12.1,
						latestDate: "2026-07-31T00:00:00.000Z",
						previousDate: "2026-07-24T00:00:00.000Z",
					},
				},
			},
		});
		mockUseBeefCutForecasts.mockReturnValue({ forecasts: {}, isLoading: false });

		const { result } = renderHook(() => useDashboardStats());
		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.stats?.beef.importedTrendPct).toBe(-12.1);
	});

	it("renders null trend when the backend omits the trend field (honest absence)", async () => {
		// Older backend / transient error → no trend field. The hook must not
		// crash and must surface null (StatCard hides the badge) rather than a
		// fabricated 0%.
		mockByKey({
			"/beef/cuts": { data: { cuts: [] } },
			"/beef/factories": { data: { factories: [] } },
			"/beef/prices/latest": {
				data: { prices: [{ price: 50, cutCode: "X", date: "2026-07-31" }] },
			},
		});
		mockUseBeefCutForecasts.mockReturnValue({ forecasts: {}, isLoading: false });

		const { result } = renderHook(() => useDashboardStats());
		await waitFor(() => {
			expect(result.current.loading).toBe(false);
		});

		expect(result.current.stats?.beef.importedTrendPct).toBeNull();
	});
});
