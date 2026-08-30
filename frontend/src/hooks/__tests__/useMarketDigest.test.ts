import { renderHook, waitFor } from "@testing-library/react";
import { useMarketDigest } from "../useMarketDigest";

// Mock tokenManager so the bearer header is deterministic (the public
// endpoint ignores it, apiFetch still attaches it when present).
jest.mock("@/lib/tokenManager", () => ({
	tokenManager: { getToken: jest.fn(() => "test-token") },
}));

function mockFetch(body: unknown, ok = true, status = 200) {
	global.fetch = jest.fn(async () => ({
		ok,
		status,
		json: async () => body,
	})) as unknown as typeof fetch;
}

const OK_ENTRY = {
	slug: "beef_carcass_us",
	name: "Global Beef Price (IMF via FRED)",
	nameCn: "全球牛肉价格（IMF 月度）",
	unit: "USC/lb",
	category: "beef_cuts",
	status: "ok",
	latest: { date: "2026-07-01T00:00:00.000Z", close: 331.78, source: "fred" },
	interval: "monthly" as const,
	seriesId: "PBEEFUSDM",
	prevPointChangePct: -2.87,
	wowChangePct: null,
	momChangePct: -2.87,
	stale: false,
	series: [
		{ date: "2026-06-01T00:00:00.000Z", close: 341.57 },
		{ date: "2026-07-01T00:00:00.000Z", close: 331.78 },
	],
};

describe("useMarketDigest", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("serves the digest payload with generatedAt + series", async () => {
		mockFetch({
			success: true,
			data: { digest: { generatedAt: "2026-08-31T00:00:00.000Z", series: [OK_ENTRY] } },
		});
		const { result } = renderHook(() => useMarketDigest());

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error).toBeNull();
		expect(result.current.digest?.generatedAt).toBe("2026-08-31T00:00:00.000Z");
		expect(result.current.digest?.series).toHaveLength(1);
		expect(result.current.digest?.series[0].latest?.close).toBe(331.78);
	});

	it("degrades honestly on fetch failure — null digest, never fabricated data", async () => {
		mockFetch({ error: { message: "boom" } }, false, 503);
		const { result } = renderHook(() => useMarketDigest());

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error).toBeInstanceOf(Error);
		expect(result.current.digest).toBeNull();
	});

	it("keeps degrade-marker entries (no_data/error) in the list for honest rendering", async () => {
		mockFetch({
			success: true,
			data: {
				digest: {
					generatedAt: "2026-08-31T00:00:00.000Z",
					series: [OK_ENTRY, { slug: "brl_usd", status: "no_data" }],
				},
			},
		});
		const { result } = renderHook(() => useMarketDigest());

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.digest?.series).toHaveLength(2);
		expect(result.current.digest?.series[1].status).toBe("no_data");
	});
});
