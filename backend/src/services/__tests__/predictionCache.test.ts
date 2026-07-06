/**
 * Prediction Cache Tests
 *
 * Two layers worth testing:
 *  1. Subscription lifecycle (subscribe/unsubscribe/getSubscribedCommodities) —
 *     pure in-memory Map state, no I/O. Pins the "stop the timer when empty"
 *     behaviour (a leak here keeps a background interval alive in tests).
 *  2. getCachedPrediction — Redis read path with TTL'd JSON.
 *
 * Redis and the cache invalidation writer are mocked; logger is silenced.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the Redis client getter.
const mockRedis = {
	get: vi.fn(),
	setEx: vi.fn(),
	del: vi.fn(),
};
vi.mock("@/lib/redis", () => ({
	getRedisClient: vi.fn(async () => mockRedis),
}));

// Mock logger.
vi.mock("@/lib", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// prisma is imported by the module (used in schedulePredictionsFromPostgreSQL);
// stub it so module load doesn't touch a real DB.
vi.mock("@/lib", async () => {
	const actual = await vi.importActual<typeof import("@/lib")>("@/lib");
	return { ...actual, prisma: { commodity: { findMany: vi.fn() } } };
});

import {
	getAllCachedPredictions,
	getCachedPrediction,
	getSubscribedCommodities,
	subscribeCommodity,
	unsubscribeCommodity,
} from "@/services/predictionCache";

describe("Prediction Cache — subscription lifecycle", () => {
	beforeEach(() => {
		// Clear all subscriptions between tests. unsubscribe until empty so the
		// background timer is torn down (prevents cross-test interference).
		for (const id of getSubscribedCommodities()) {
			unsubscribeCommodity(id);
		}
	});

	it("tracks a subscribed commodity", () => {
		subscribeCommodity("c1", ["arima"], 10);
		expect(getSubscribedCommodities()).toContain("c1");
	});

	it("stops tracking after unsubscribe", () => {
		subscribeCommodity("c1", ["arima"], 10);
		unsubscribeCommodity("c1");
		expect(getSubscribedCommodities()).not.toContain("c1");
	});

	it("re-subscribing replaces (not duplicates) an existing entry", () => {
		subscribeCommodity("c1", ["arima"], 10);
		subscribeCommodity("c1", ["arima", "holtwinters"], 5);
		expect(getSubscribedCommodities().filter((id) => id === "c1")).toHaveLength(1);
	});

	it("returns empty list when nothing is subscribed", () => {
		expect(getSubscribedCommodities()).toEqual([]);
	});

	it("unsubscribing an unknown commodity is a no-op (no throw)", () => {
		expect(() => unsubscribeCommodity("never-subscribed")).not.toThrow();
	});
});

describe("Prediction Cache — getCachedPrediction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns the parsed prediction when Redis has the key", async () => {
		const cached = {
			timestamps: [1, 2],
			values: [100, 110],
			algorithm: "arima",
			cachedAt: 123,
			commodityId: "c1",
			horizon: 10,
		};
		mockRedis.get.mockResolvedValue(JSON.stringify(cached));

		const result = await getCachedPrediction("c1", "arima", 10);

		expect(result).not.toBeNull();
		expect(result?.values).toEqual([100, 110]);
		expect(result?.algorithm).toBe("arima");
		expect(mockRedis.get).toHaveBeenCalledWith("prediction:c1:arima:10");
	});

	it("returns null when the key is absent (cache miss)", async () => {
		mockRedis.get.mockResolvedValue(null);

		const result = await getCachedPrediction("c1", "arima", 10);
		expect(result).toBeNull();
	});

	it("returns null (not throws) when Redis returns corrupt JSON", async () => {
		mockRedis.get.mockResolvedValue("{not valid json");

		const result = await getCachedPrediction("c1", "arima", 10);
		// Must degrade to null — a throw here would 500 the dashboard endpoint.
		expect(result).toBeNull();
	});
});

describe("Prediction Cache — getAllCachedPredictions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("collects cached predictions keyed by model, skipping misses", async () => {
		mockRedis.get.mockImplementation(async (key: string) => {
			if (key.endsWith(":arima:10")) return JSON.stringify({ values: [1], algorithm: "arima" });
			if (key.endsWith(":stl_forecaster:10"))
				return JSON.stringify({ values: [2], algorithm: "stl_forecaster" });
			return null; // holtwinters miss
		});

		const map = await getAllCachedPredictions("c1", 10, ["arima", "holtwinters", "stl_forecaster"]);

		expect(map.size).toBe(2);
		expect(map.has("arima")).toBe(true);
		expect(map.has("stl_forecaster")).toBe(true);
		expect(map.has("holtwinters")).toBe(false);
	});

	it("returns an empty map when all models miss", async () => {
		mockRedis.get.mockResolvedValue(null);

		const map = await getAllCachedPredictions("c1", 10, ["arima", "naive_forecaster"]);
		expect(map.size).toBe(0);
	});
});
