import { renderHook, waitFor } from "@testing-library/react";
import { useBeefCutForecasts } from "../useBeefCutForecasts";

// Mock tokenManager so the bearer header is deterministic.
jest.mock("@/lib/tokenManager", () => ({
	tokenManager: { getToken: jest.fn(() => "test-token") },
}));

type Route = { ok?: boolean; status?: number; body?: unknown };

function mockFetchRoute(routes: Record<string, Route>) {
	global.fetch = jest.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		const entry = Object.entries(routes).find(([k]) => url.includes(k))?.[1];
		if (!entry) return { ok: false, status: 404, json: async () => ({}) };
		return {
			ok: entry.ok ?? true,
			status: entry.status ?? 200,
			json: async () => entry.body,
		};
	}) as unknown as typeof fetch;
}

const FORECASTS = {
	brisket: {
		direction: "up",
		predictedChange: 0.031,
		confidence: 0.72,
		predictedPrice: 5.31,
		modelsAgree: 3,
		availableModels: 3,
		dataPoints: 120,
		horizon: 7,
	},
};

describe("useBeefCutForecasts", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("returns the cutCode → summary map on success, with auth attached", async () => {
		mockFetchRoute({
			"/api/beef/forecasts": { body: { data: { forecasts: FORECASTS, count: 1, horizon: 7 } } },
		});

		const { result } = renderHook(() => useBeefCutForecasts(7));

		await waitFor(() => expect(result.current.forecasts).toEqual(FORECASTS));
		expect(global.fetch).toHaveBeenCalledWith(
			expect.stringContaining("/api/beef/forecasts?horizon=7"),
			expect.objectContaining({
				credentials: "include",
				headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
			}),
		);
	});

	it("returns a null map when the endpoint fails (honest absence)", async () => {
		// horizon 14 → distinct SWR key, so the cached success from the first
		// test can't leak into this failure case (SWR's cache is module-global
		// and jest.clearAllMocks doesn't touch it).
		mockFetchRoute({ "/api/beef/forecasts": { ok: false, status: 401, body: {} } });

		const { result } = renderHook(() => useBeefCutForecasts(14));

		await waitFor(() => {
			expect(result.current.forecasts).toBeNull();
			expect(result.current.isLoading).toBe(false);
		});
	});
});
