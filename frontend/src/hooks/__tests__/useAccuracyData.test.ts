import { renderHook, waitFor } from "@testing-library/react";
import { useAccuracyData } from "../useAccuracyData";

// Mock auth utility. apiFetch (round-115) rides authFetch — which forwards
// to the global fetch stub mockFetchWith installs — so it must be a
// pass-through, not a fixed response. getAuthToken stays for any direct use.
jest.mock("@/utils/auth", () => ({
	getAuthToken: jest.fn(() => "mock-token"),
	authFetch: jest.fn((url: string, init?: RequestInit) => fetch(url, init)),
}));

import { getAuthToken } from "@/utils/auth";

const mockedGetAuthToken = getAuthToken as jest.MockedFunction<typeof getAuthToken>;

/**
 * Stub global fetch to return controlled accuracy payloads. The hook makes two
 * kinds of call: /api/signals/models/accuracy (returns the comparison rows)
 * and /api/signals/models/:id/backtest per model (Promise.allSettled — a
 * rejection is tolerated). We route by URL substring.
 */
function mockFetchWith(accuracyRows: unknown[]) {
	const fetchMock = jest.fn((url: string | URL) => {
		const u = String(url);
		const res = u.includes("/models/accuracy")
			? { success: true, data: { accuracy: accuracyRows, days: 30 } }
			: // backtest calls resolve with empty-ish data; the hook tolerates
				// undefined .data via the allSettled handler.
				{
					success: true,
					data: { modelId: "x", windows: [], trend: "insufficient_data", trendDescription: "" },
				};
		return Promise.resolve({
			ok: true,
			json: () => Promise.resolve(res),
		} as Response);
	});
	(globalThis as { fetch: typeof fetch }).fetch = fetchMock as unknown as typeof fetch;
	return fetchMock;
}

describe("useAccuracyData — sample-size honesty gates", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockedGetAuthToken.mockReturnValue("mock-token");
		process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000";
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it("excludes under-sampled models (< MIN_VERIFIED_SAMPLE) from overallAccuracy and bestModel", async () => {
		// chronos_tiny has a MAPE but only 1 verified row — it must NOT
		// contribute to the headline figures. naive_forecaster has enough
		// samples and should win bestModel uncontested.
		mockFetchWith([
			{
				modelId: "chronos_tiny",
				avgMape: 4.63,
				predictionCount: 4003,
				verifiedCount: 1,
				lastVerifiedAt: "2026-07-31T14:22:47.011Z",
				isPrimary: true,
			},
			{
				modelId: "chronos_mini",
				avgMape: null,
				predictionCount: 4003,
				verifiedCount: 0,
				lastVerifiedAt: null,
				isPrimary: true,
			},
			{
				modelId: "naive_forecaster",
				avgMape: 2.22,
				predictionCount: 20940,
				verifiedCount: 133,
				lastVerifiedAt: "2026-07-27T11:54:04.016Z",
				isPrimary: false,
			},
		]);

		const { result } = renderHook(() => useAccuracyData());

		await waitFor(() => expect(result.current.loading).toBe(false));

		// Only naive_forecaster passes the sample-size gate → overallAccuracy is
		// its MAPE alone, and it is the best model. chronos_tiny (MAPE 4.63 but
		// verifiedCount=1) is excluded from both.
		expect(result.current.overallAccuracy).toBeCloseTo(2.22, 2);
		expect(result.current.bestModel?.modelId).toBe("naive_forecaster");
	});

	it("returns null overallAccuracy / bestModel when every model is under-sampled", async () => {
		// Transition window: all chronos primaries have 0-1 verified rows and
		// there are no baselines. The headline figures must withhold rather
		// than crown a single-sample MAPE as "best".
		mockFetchWith([
			{
				modelId: "chronos_tiny",
				avgMape: 4.63,
				predictionCount: 4003,
				verifiedCount: 1,
				lastVerifiedAt: "2026-07-31T14:22:47.011Z",
				isPrimary: true,
			},
			{
				modelId: "chronos_mini",
				avgMape: null,
				predictionCount: 4003,
				verifiedCount: 0,
				lastVerifiedAt: null,
				isPrimary: true,
			},
		]);

		const { result } = renderHook(() => useAccuracyData());

		await waitFor(() => expect(result.current.loading).toBe(false));

		// No model clears MIN_VERIFIED_SAMPLE → headline figures withhold.
		expect(result.current.overallAccuracy).toBeNull();
		expect(result.current.bestModel).toBeNull();
		// totalVerified still aggregates raw counts (it is a count, not a
		// quality-gated statistic) so the "Verified" stat card stays truthful.
		expect(result.current.totalVerified).toBe(1);
	});
});
