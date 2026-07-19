import { renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { SWRConfig } from "swr";
import "@testing-library/jest-dom";

// Mock tokenManager — default to no token (unauthenticated).
const mockGetToken: jest.Mock<string | null, []> = jest.fn(() => null);
jest.mock("@/lib/tokenManager", () => ({
	tokenManager: { getToken: () => mockGetToken() },
}));

// SWR responses are controlled via these knobs.
let commoditiesResponse: unknown = { success: true, data: { commodities: [] } };
let latestResponses: Record<string, unknown> = {};
let signalsBatchResponse: unknown = { success: true, data: { forecasts: [] } };
let signalsBatchStatus = 200;

const fetchMock = jest.fn();
global.fetch = fetchMock as unknown as typeof global.fetch;

function jsonResponse(body: unknown, status = 200) {
	return {
		ok: status >= 200 && status < 300,
		status,
		json: async () => body,
	} as unknown as Response;
}

function configureFetch() {
	fetchMock.mockImplementation((url: string, _opts?: RequestInit) => {
		const full = String(url);
		if (full.endsWith("/market/commodities")) {
			return Promise.resolve(jsonResponse(commoditiesResponse));
		}
		if (full.includes("/market/commodities/") && full.includes("/latest")) {
			const slug = full.split("/market/commodities/")[1]?.split("/")[0] ?? "";
			return Promise.resolve(jsonResponse(latestResponses[slug] ?? { data: {} }));
		}
		if (full.endsWith("/signals/batch")) {
			return Promise.resolve(jsonResponse(signalsBatchResponse, signalsBatchStatus));
		}
		return Promise.resolve(jsonResponse({ success: false }));
	});
}

import { useMarketForecasts } from "@/hooks/useMarketForecasts";

describe("useMarketForecasts", () => {
	// Isolate SWR cache per test so prior responses don't leak across cases.
	const wrapper = ({ children }: { children: React.ReactNode }) => (
		<SWRConfig value={{ provider: () => new Map(), dedupingInterval: 0 }}>{children}</SWRConfig>
	);

	beforeEach(() => {
		jest.clearAllMocks();
		mockGetToken.mockReturnValue(null);
		commoditiesResponse = { success: true, data: { commodities: [] } };
		latestResponses = {};
		signalsBatchResponse = { success: true, data: { forecasts: [] } };
		signalsBatchStatus = 200;
		configureFetch();
	});

	it("returns empty rows and no-token permission when unauthenticated", async () => {
		const { result } = renderHook(() => useMarketForecasts(7), { wrapper });

		await waitFor(() => expect(result.current.permission).toBe("no-token"));
		expect(result.current.rows).toEqual([]);
	});

	it("lists beef_cut commodities and their latest prices", async () => {
		commoditiesResponse = {
			success: true,
			data: {
				commodities: [
					{ id: "1", slug: "aus_cube_roll_m9", name: "Cube Roll", category: "beef_cuts" },
					{ id: "2", slug: "coffee_cme", name: "Coffee", category: "futures" },
				],
			},
		};
		latestResponses = {
			aus_cube_roll_m9: { data: { value: 4.5, date: "2026-04-30" } },
		};

		const { result } = renderHook(() => useMarketForecasts(7), { wrapper });

		await waitFor(() => {
			const cube = result.current.rows.find((r) => r.slug === "aus_cube_roll_m9");
			expect(cube?.latestPrice).toBe(4.5);
		});
		// Non-beef commodity filtered out.
		expect(result.current.rows.find((r) => r.slug === "coffee_cme")).toBeUndefined();
	});

	it("surfaces the consensus fields (direction/confidence/modelsAgree) per row", async () => {
		// PRODUCT-SPEC §5.3 requires each market row to show direction +
		// magnitude + confidence + model count. The hook now reads these from
		// /signals/batch instead of the raw inference batch array (which only
		// carried values[]/bounds).
		mockGetToken.mockReturnValue("fake-token");
		commoditiesResponse = {
			success: true,
			data: {
				commodities: [
					{ id: "1", slug: "aus_cube_roll_m9", name: "Cube Roll", category: "beef_cuts" },
				],
			},
		};
		latestResponses = {
			aus_cube_roll_m9: { data: { value: 100, date: "2026-04-30" } },
		};
		signalsBatchResponse = {
			success: true,
			data: {
				forecasts: [
					{
						slug: "aus_cube_roll_m9",
						ok: true,
						forecast: {
							direction: "up",
							confidence: 0.78,
							modelsAgree: 4,
							totalModels: 5,
							availableModels: 5,
							predictedChange: 2.3,
							currentPrice: 100,
							predictedPrice: 102.3,
							horizon: 7,
							range: { lower: 101, upper: 104 },
						},
					},
				],
			},
		};

		const { result } = renderHook(() => useMarketForecasts(7), { wrapper });

		await waitFor(() => {
			const cube = result.current.rows.find((r) => r.slug === "aus_cube_roll_m9");
			expect(cube?.direction).toBe("up");
			expect(cube?.changePct).toBe(2.3);
			expect(cube?.confidence).toBe(0.78);
			expect(cube?.modelsAgree).toBe(4);
			expect(cube?.totalModels).toBe(5);
			expect(cube?.forecastEnd).toBe(102.3);
			expect(cube?.lowerBound).toBe(101);
			expect(cube?.upperBound).toBe(104);
		});
		expect(result.current.permission).toBe("allowed");
	});

	it("reports denied permission on a 403 signals/batch response", async () => {
		mockGetToken.mockReturnValue("fake-token");
		commoditiesResponse = {
			success: true,
			data: {
				commodities: [
					{ id: "1", slug: "aus_cube_roll_m9", name: "Cube Roll", category: "beef_cuts" },
				],
			},
		};
		latestResponses = {
			aus_cube_roll_m9: { data: { value: 4.5, date: "2026-04-30" } },
		};
		signalsBatchResponse = { success: false, error: { message: "Pro required" } };
		signalsBatchStatus = 403;

		const { result } = renderHook(() => useMarketForecasts(7), { wrapper });

		await waitFor(() => expect(result.current.permission).toBe("denied"));
	});

	it("marks a row with an error when its individual forecast fails (insufficient data)", async () => {
		// Fault tolerance: a batch entry with ok=false surfaces as row.error
		// rather than sinking the whole board.
		mockGetToken.mockReturnValue("fake-token");
		commoditiesResponse = {
			success: true,
			data: {
				commodities: [
					{ id: "1", slug: "aus_cube_roll_m9", name: "Cube Roll", category: "beef_cuts" },
					{ id: "2", slug: "bra_topside", name: "Topside", category: "beef_cuts" },
				],
			},
		};
		latestResponses = {
			aus_cube_roll_m9: { data: { value: 100, date: "2026-04-30" } },
			bra_topside: { data: { value: 50, date: "2026-04-30" } },
		};
		signalsBatchResponse = {
			success: true,
			data: {
				forecasts: [
					{
						slug: "aus_cube_roll_m9",
						ok: true,
						forecast: {
							direction: "flat",
							confidence: 0.5,
							modelsAgree: 3,
							totalModels: 5,
							availableModels: 5,
							predictedChange: 0.1,
							currentPrice: 100,
							predictedPrice: 100.1,
							horizon: 7,
							range: { lower: 98, upper: 102 },
						},
					},
					{ slug: "bra_topside", ok: false, error: "No current price — insufficient data" },
				],
			},
		};

		const { result } = renderHook(() => useMarketForecasts(7), { wrapper });

		await waitFor(() => {
			const cube = result.current.rows.find((r) => r.slug === "aus_cube_roll_m9");
			expect(cube?.direction).toBe("flat");
		});
		const topside = result.current.rows.find((r) => r.slug === "bra_topside");
		expect(topside?.error).toBe("No current price — insufficient data");
		expect(topside?.direction).toBeNull();
	});
});
