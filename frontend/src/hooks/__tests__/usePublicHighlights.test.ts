import { renderHook, waitFor } from "@testing-library/react";
import { usePublicHighlights } from "../usePublicHighlights";

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

const OK_HIGHLIGHT = {
	slug: "beef_carcass_us",
	name: "US Beef Carcass Price (FRED)",
	unit: "USD/cwt",
	status: "ok",
	latest: { date: "2026-08-22T00:00:00.000Z", close: 391.2, source: "fred" },
	dayChangePct: 0.68,
	series: [
		{ date: "2026-08-21T00:00:00.000Z", close: 388.6 },
		{ date: "2026-08-22T00:00:00.000Z", close: 391.2 },
	],
};

describe("usePublicHighlights", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("maps the whitelisted live series onto `live`", async () => {
		mockFetch({ success: true, data: { highlights: [OK_HIGHLIGHT] } });
		const { result } = renderHook(() => usePublicHighlights());

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error).toBeNull();
		expect(result.current.highlights).toHaveLength(1);
		expect(result.current.live?.slug).toBe("beef_carcass_us");
		expect(result.current.live?.latest?.close).toBe(391.2);
		expect(result.current.live?.series).toHaveLength(2);
	});

	it("degrades honestly on fetch failure — empty list, never fabricated data", async () => {
		mockFetch({ error: { message: "boom" } }, false, 503);
		const { result } = renderHook(() => usePublicHighlights());

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error).toBeInstanceOf(Error);
		expect(result.current.highlights).toEqual([]);
		expect(result.current.live).toBeNull();
	});

	it("does not promote no_data/error entries to `live`", async () => {
		mockFetch({ success: true, data: { highlights: [{ slug: "x", status: "no_data" }] } });
		const { result } = renderHook(() => usePublicHighlights());

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.live).toBeNull();
	});
});
