import { act, renderHook, waitFor } from "@testing-library/react";
import { useTradingData } from "../useTradingData";

// market-data hooks are mocked wholesale: useTradingData's job is assembly
// (selection, chart mapping, AI state hygiene), not fetching from those five
// endpoints. The knob is read lazily inside the factories so beforeEach can
// retarget the fixtures per test.
const md = {
	commodities: [{ id: "c1", slug: "beef_carcass_us", name: "Beef Carcass (US)" }],
	prices: [
		{ date: "2026-08-01", open: 4.0, high: 4.2, low: 3.9, close: 4.1, volume: 100 },
		{ date: "2026-08-02", open: 4.1, high: 4.3, low: 4.0, close: 4.2, volume: 110 },
	],
};
jest.mock("@/lib/market-data", () => ({
	useCommodities: jest.fn(() => ({ commodities: md.commodities, loading: false })),
	usePriceHistory: jest.fn(() => ({ prices: md.prices, loading: false })),
	useCommoditySources: jest.fn(() => ({ priceSources: [], factorSources: [], loading: false })),
	useMultiSourcePrices: jest.fn(() => ({ sources: {}, sourceCount: 0 })),
	useCommodityFundamentals: jest.fn(() => ({ factors: [], loading: false })),
}));

jest.mock("@/lib/tokenManager", () => ({
	tokenManager: { getToken: jest.fn(() => "test-token") },
}));

type Route = {
	ok?: boolean;
	status?: number;
	/** Shorthand JSON body. */
	body?: unknown;
	/** Full override for failure-in-json paths. */
	json?: () => Promise<unknown>;
};

function mockFetchRoute(routes: Record<string, Route>) {
	global.fetch = jest.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		const entry = Object.entries(routes).find(([k]) => url.includes(k))?.[1];
		if (!entry) return { ok: false, status: 404, json: async () => ({}) };
		return {
			ok: entry.ok ?? true,
			status: entry.status ?? 200,
			json: entry.json ?? (async () => entry.body),
		};
	}) as unknown as typeof fetch;
}

/** The full happy-path route table for the AI side effects. */
function happyRoutes(): Record<string, Route> {
	return {
		// Order matters: more specific keys first (substring matching).
		"/api/signals/models/accuracy": {
			body: {
				success: true,
				data: {
					accuracy: [
						{ modelId: "naive_forecaster", avgMape: 3.2, medianMape: 3.0 },
						{ modelId: "chronos_tiny", avgMape: 2.5, medianMape: 1.5 },
					],
				},
			},
		},
		"/api/signals/models": {
			// Doubles as the models list AND the per-model predictions response
			// (the router substring-matches both). One prediction has
			// actualValues (kept), one doesn't (filtered out).
			body: {
				success: true,
				data: {
					models: ["m1"],
					predictions: [
						{
							id: "p1",
							modelId: "m1",
							commodityId: "beef_carcass_us",
							predictedValues: [4.0],
							actualValues: [4.1],
							mape: 2.5,
							confidence: 0.9,
							predictedAt: "2026-08-20T10:00:00Z",
						},
						{
							id: "p2",
							modelId: "m1",
							commodityId: "beef_carcass_us",
							predictedValues: [4.4],
							actualValues: null,
							mape: null,
							confidence: 0.8,
							predictedAt: "2026-08-21T10:00:00Z",
						},
					],
				},
			},
		},
		"/api/signals/beef_carcass_us/predictions": {
			body: {
				success: true,
				data: {
					predictions: {
						chronos_tiny: {
							timestamps: [1755062400000],
							values: [5.2],
							lowerBound: [5.0],
							upperBound: [5.4],
						},
					},
				},
			},
		},
		"/api/signals/beef_carcass_us?": {
			body: { success: true, data: { direction: "BUY", confidence: 0.8 } },
		},
		"/api/anomalies": {
			body: { data: { anomalies: [{ id: "a1", severity: "HIGH", message: "spike" }] } },
		},
	};
}

describe("useTradingData", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		md.commodities = [{ id: "c1", slug: "beef_carcass_us", name: "Beef Carcass (US)" }];
		md.prices = [
			{ date: "2026-08-01", open: 4.0, high: 4.2, low: 3.9, close: 4.1, volume: 100 },
			{ date: "2026-08-02", open: 4.1, high: 4.3, low: 4.0, close: 4.2, volume: 110 },
		];
	});

	it("assembles the trading view: auto-select, chart mapping, signal, best model, anomalies, overlays", async () => {
		mockFetchRoute(happyRoutes());

		const { result } = renderHook(() => useTradingData());

		await waitFor(() => {
			expect(result.current.selectedSlug).toBe("beef_carcass_us");
			expect(result.current.signal?.direction).toBe("BUY");
			expect(result.current.bestModelId).toBe("chronos_tiny");
			expect(result.current.anomalies).toHaveLength(1);
			expect(result.current.predictionOverlays).toHaveLength(1);
			expect(result.current.predictionHistory).toHaveLength(1);
		});

		// Chart mapping + currentPrice from the LAST close.
		expect(result.current.currentPrice).toBe(4.2);
		expect(result.current.chartData).toEqual([
			{ time: "2026-08-01", open: 4, high: 4.2, low: 3.9, close: 4.1, volume: 100 },
			{ time: "2026-08-02", open: 4.1, high: 4.3, low: 4, close: 4.2, volume: 110 },
		]);

		// Median-preferred best model: chronos_tiny (1.5) beats naive (3.0).
		expect(result.current.bestModelId).toBe("chronos_tiny");

		// Overlay aggregation from the predictions map.
		expect(result.current.predictionOverlays[0]).toEqual({
			time: "2025-08-13",
			predicted: 5.2,
			upperBound: 5.4,
			lowerBound: 5.0,
		});

		// Prediction history keeps only rows with actualValues (verifiable).
		expect(result.current.predictionHistory[0].id).toBe("p1");
	});

	it("beef mode: sorts DESC history ascending, derives latestPrice by max date (not array order)", async () => {
		mockFetchRoute({
			...happyRoutes(),
			"/api/beef/factories": {
				body: { data: { factories: [{ code: "208", country: "AU", name: "EST 208" }] } },
			},
			"/api/beef/prices/history/brisket": {
				// Backend order: newest first. Max date is 08-03 even though it
				// is first — the order-independent "latest" must find it.
				body: {
					data: {
						prices: [
							{ date: "2026-08-03", price: 5.2, source: "manual" },
							{
								date: "2026-08-01",
								price: 5.0,
								source: "bridge:commodity:beef_carcass_us",
								factory: { code: "208", country: "AU" },
							},
							{ date: "2026-08-02", price: 5.1, source: "bridge:commodity:beef_carcass_us" },
						],
					},
				},
			},
		});

		const { result } = renderHook(() => useTradingData());

		act(() => {
			result.current.setBeefMode(true);
			result.current.setSelectedCut("brisket");
		});

		await waitFor(() => {
			expect(result.current.beefFactories).toHaveLength(1);
			expect(result.current.beefPrices).toHaveLength(3);
		});

		// Chart data is ascending by date without mutating the cached order.
		expect(result.current.beefChartData.map((c: { time: string }) => c.time)).toEqual([
			"2026-08-01",
			"2026-08-02",
			"2026-08-03",
		]);

		const info = result.current.beefCutInfo;
		expect(info?.latestPrice).toBe(5.2);
		expect(info?.minPrice).toBe(5.0);
		expect(info?.maxPrice).toBe(5.2);
		expect(info?.sources).toEqual(["manual", "bridge:commodity:beef_carcass_us"]);
		expect(info?.factories).toEqual(["208"]);

		// Multi-source grouping keys carry the factory country when known —
		// bridge rows split by factory presence (AU vs unknown).
		expect(Object.keys(result.current.beefMultiSources)).toEqual([
			"manual (?)",
			"bridge:commodity:beef_carcass_us (AU)",
			"bridge:commodity:beef_carcass_us (?)",
		]);
	});

	it("deep link: initialSlug is honored (beats first-commodity auto-select); unknown slug degrades to the default", async () => {
		mockFetchRoute(happyRoutes());
		md.commodities = [
			{ id: "c1", slug: "beef_carcass_us", name: "Beef Carcass (US)" },
			{ id: "c2", slug: "corn_cme", name: "Corn" },
		];

		const { result } = renderHook(() => useTradingData("corn_cme"));
		// The deep-linked commodity, NOT the auto-selected first one.
		await waitFor(() => expect(result.current.selectedSlug).toBe("corn_cme"));
		expect(result.current.selected?.slug).toBe("corn_cme");

		// A stale/typo'd slug falls back to the first commodity instead of a
		// permanent "Loading..." chart title.
		const { result: stale } = renderHook(() => useTradingData("no_such_slug"));
		await waitFor(() => expect(stale.current.selectedSlug).toBe("beef_carcass_us"));
	});

	it("surfaces an AI-signal error when the signal payload can't be parsed", async () => {
		const routes = happyRoutes();
		routes["/api/signals/beef_carcass_us?"] = {
			ok: true,
			json: async () => {
				throw new Error("bad payload");
			},
		};
		mockFetchRoute(routes);

		const { result } = renderHook(() => useTradingData());

		await waitFor(() => {
			expect(result.current.error).toContain("AI signal unavailable");
			expect(result.current.error).toContain("bad payload");
		});
		expect(result.current.signal).toBeNull();
	});

	it("switching commodity clears the previous commodity's AI state (round-119)", async () => {
		// The round-106 cleanup effect had an empty deps array — it ran once on
		// mount and never on a switch, so switching to a commodity whose loaders
		// all early-return (no price data) left the OLD signal/anomalies on
		// screen, attributed to the new selection.
		mockFetchRoute(happyRoutes());

		const { result } = renderHook(() => useTradingData());

		await waitFor(() => {
			expect(result.current.signal).toEqual({ direction: "BUY", confidence: 0.8 });
		});
		expect(result.current.anomalies.length).toBeGreaterThan(0);

		// Switch to a second commodity with NO price data (loaders early-return).
		md.commodities = [
			{ id: "c1", slug: "beef_carcass_us", name: "Beef Carcass (US)" },
			{ id: "c2", slug: "corn_cme", name: "Corn" },
		];
		md.prices = [];
		act(() => {
			result.current.setSelectedSlug("corn_cme");
		});

		// The stale state must be gone — not still showing beef's signal.
		await waitFor(() => {
			expect(result.current.signal).toBeNull();
		});
		expect(result.current.anomalies).toEqual([]);
		expect(result.current.predictionHistory).toEqual([]);
	});
});
