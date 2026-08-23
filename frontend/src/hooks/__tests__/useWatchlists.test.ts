import { renderHook, waitFor } from "@testing-library/react";
import {
	addWatchlistItem,
	createWatchlist,
	removeWatchlistItem,
	useWatchlistQuotes,
	useWatchlists,
} from "../useWatchlists";

// Mock tokenManager so the bearer header is deterministic (apiFetch attaches
// it when present; the backend keys watchlists by the token's user id).
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

const WATCHLIST_PAYLOAD = {
	success: true,
	data: {
		watchlists: [
			{
				id: "wl-1",
				name: "我的自选",
				isDefault: false,
				itemCount: 1,
				items: [
					{
						id: "item-1",
						commodityId: "c-uuid-1",
						commodity: {
							slug: "beef_carcass_us",
							name: "US Beef Carcass",
							nameCn: "美国胴体",
							category: "beef_cuts",
							unit: "USD/cwt",
						},
						latestPrice: 391.2,
						latestDate: "2026-08-22T00:00:00.000Z",
						notes: null,
						addedAt: "2026-08-23T00:00:00.000Z",
					},
				],
				createdAt: "2026-08-23T00:00:00.000Z",
			},
		],
	},
};

describe("useWatchlists", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it("maps the authenticated list payload", async () => {
		mockFetch(WATCHLIST_PAYLOAD);
		const { result } = renderHook(() => useWatchlists());

		await waitFor(() => expect(result.current.loading).toBe(false));
		expect(result.current.error).toBeUndefined();
		expect(result.current.watchlists).toHaveLength(1);
		expect(result.current.watchlists[0].items[0].commodity.slug).toBe("beef_carcass_us");
	});

	it("skips fetching quotes when no watchlist is selected (SWR null key)", async () => {
		mockFetch({});
		renderHook(() => useWatchlistQuotes(null));

		// Give a would-be fetch a chance to fire, then assert it never did.
		await new Promise((r) => setTimeout(r, 50));
		expect(global.fetch).not.toHaveBeenCalled();
	});
});

describe("watchlist mutations", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockFetch({ success: true, data: { item: {} } }, true, 201);
	});

	it("createWatchlist POSTs the name as JSON", async () => {
		await createWatchlist("我的自选");

		const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
		expect(url).toContain("/api/watchlists");
		expect(init.method).toBe("POST");
		expect(JSON.parse(init.body)).toEqual({ name: "我的自选" });
	});

	it("addWatchlistItem POSTs the commodity id under the list", async () => {
		await addWatchlistItem("wl-1", "c-uuid-1");

		const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
		expect(url).toContain("/api/watchlists/wl-1/items");
		expect(init.method).toBe("POST");
		expect(JSON.parse(init.body)).toEqual({ commodityId: "c-uuid-1" });
	});

	it("removeWatchlistItem DELETEs the item row", async () => {
		await removeWatchlistItem("wl-1", "c-uuid-1");

		const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
		expect(url).toContain("/api/watchlists/wl-1/items/c-uuid-1");
		expect(init.method).toBe("DELETE");
	});
});
