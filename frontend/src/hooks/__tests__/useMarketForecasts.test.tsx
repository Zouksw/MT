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
let batchResponse: unknown = { success: true, data: [] };
let batchStatus = 200;

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
		if (full.endsWith("/inference/predict/batch")) {
			return Promise.resolve(jsonResponse(batchResponse, batchStatus));
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
		batchResponse = { success: true, data: [] };
		batchStatus = 200;
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

	it("computes changePct from latest price to forecast end when authenticated", async () => {
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
		// Forecast rises from 100 → 102.3 over the horizon → +2.3%.
		batchResponse = {
			success: true,
			data: [
				{
					values: [100.5, 101, 101.5, 102, 102.3],
					lowerBound: [99, 99, 99, 99, 98],
					upperBound: [102, 103, 104, 105, 106],
				},
			],
		};

		const { result } = renderHook(() => useMarketForecasts(5), { wrapper });

		await waitFor(() => {
			const cube = result.current.rows.find((r) => r.slug === "aus_cube_roll_m9");
			expect(cube?.forecastEnd).toBe(102.3);
			expect(cube?.changePct).toBeCloseTo(2.3, 1);
			expect(cube?.lowerBound).toBe(98);
			expect(cube?.upperBound).toBe(106);
		});
		expect(result.current.permission).toBe("allowed");
	});

	it("reports denied permission on a 403 batch response", async () => {
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
		batchResponse = { success: false, error: { message: "Pro required" } };
		batchStatus = 403;

		const { result } = renderHook(() => useMarketForecasts(7), { wrapper });

		await waitFor(() => expect(result.current.permission).toBe("denied"));
	});
});
