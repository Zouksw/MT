import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resolveModelWeights, weightedDirectionVote, weightedMedian } from "../modelQuality";

// resolveModelWeights tests mock the accuracy source (mapeTracking → DB).
const mocks = vi.hoisted(() => ({
	getAllModelAccuracy: vi.fn(),
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib", () => ({ logger: mocks.logger }));
vi.mock("../mapeTracking", () => ({
	getAllModelAccuracy: (...args: unknown[]) => mocks.getAllModelAccuracy(...args),
}));

function acc(modelId: string, avgMape: number | null, verifiedCount = 50) {
	return {
		modelId,
		avgMape,
		predictionCount: verifiedCount,
		verifiedCount,
		last7dMape: null,
		last30dMape: null,
		lastVerifiedAt: null,
		isPrimary: true,
	};
}

describe("resolveModelWeights — elimination bar (round-110)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("gives weight 0 to a model strictly worse than naive with thick evidence", async () => {
		// naive 3.0 with 50 verified rows = active bar; chronos_x at 5.0 with
		// 50 rows is strictly worse → eliminated. chronos_y at 1.5 survives.
		mocks.getAllModelAccuracy.mockResolvedValue([
			acc("naive_forecaster", 3.0),
			acc("chronos_x", 5.0),
			acc("chronos_y", 1.5),
		]);

		const weights = await resolveModelWeights(["chronos_x", "chronos_y"]);

		expect(weights.get("chronos_x")).toBe(0);
		expect(weights.get("chronos_y")).toBe(1); // sole survivor takes all
	});

	it("does not eliminate on thin evidence (below the verified-count guard)", async () => {
		// Both worse than naive, but chronos_x has only 5 verified rows —
		// noise, not evidence. It keeps an ordinary (small) weight.
		mocks.getAllModelAccuracy.mockResolvedValue([
			acc("naive_forecaster", 3.0),
			acc("chronos_x", 9.0, 5),
			acc("chronos_y", 2.0),
		]);

		const weights = await resolveModelWeights(["chronos_x", "chronos_y"]);

		expect(weights.get("chronos_x")).toBeGreaterThan(0);
		expect(weights.get("chronos_y")).toBeGreaterThan(weights.get("chronos_x") as number);
	});

	it("does not eliminate when the naive bar itself is thin", async () => {
		// naive has only 3 verified rows — the bar can't be trusted, nobody is
		// eliminated even though chronos_x is nominally worse.
		mocks.getAllModelAccuracy.mockResolvedValue([
			acc("naive_forecaster", 3.0, 3),
			acc("chronos_x", 6.0),
			acc("chronos_y", 2.0),
		]);

		const weights = await resolveModelWeights(["chronos_x", "chronos_y"]);

		expect(weights.get("chronos_x")).toBeGreaterThan(0);
	});

	it("never eliminates naive_forecaster itself", async () => {
		mocks.getAllModelAccuracy.mockResolvedValue([
			acc("naive_forecaster", 3.0),
			acc("chronos_y", 1.5),
		]);

		const weights = await resolveModelWeights(["naive_forecaster", "chronos_y"]);

		expect(weights.get("naive_forecaster")).toBeGreaterThan(0);
	});

	it("equal-weight fallback when every model is eliminated", async () => {
		mocks.getAllModelAccuracy.mockResolvedValue([
			acc("naive_forecaster", 3.0),
			acc("chronos_x", 6.0),
			acc("chronos_y", 5.0),
		]);

		const weights = await resolveModelWeights(["chronos_x", "chronos_y"]);

		expect(weights.get("chronos_x")).toBeCloseTo(0.5);
		expect(weights.get("chronos_y")).toBeCloseTo(0.5);
	});
});

describe("weightedMedian", () => {
	it("returns the plain median when all weights are equal", () => {
		// 5 prices, equal weights → median is the middle (3rd) value = 30.
		const result = weightedMedian([
			{ price: 10, weight: 1 },
			{ price: 20, weight: 1 },
			{ price: 30, weight: 1 },
			{ price: 40, weight: 1 },
			{ price: 50, weight: 1 },
		]);
		expect(result).toBe(30);
	});

	it("shifts toward higher-weighted prices", () => {
		// If the high price (50) has 10x the weight, the weighted median should
		// be >= the plain median of 30.
		const result = weightedMedian([
			{ price: 10, weight: 1 },
			{ price: 20, weight: 1 },
			{ price: 30, weight: 1 },
			{ price: 40, weight: 1 },
			{ price: 50, weight: 10 },
		]);
		expect(result).toBeGreaterThanOrEqual(40);
		expect(result).toBe(50); // cumulative weight crosses 50% at price=50
	});

	it("returns 0 for empty input", () => {
		expect(weightedMedian([])).toBe(0);
	});

	it("handles a single price", () => {
		expect(weightedMedian([{ price: 7.5, weight: 1 }])).toBe(7.5);
	});

	it("falls back to plain median when total weight is 0", () => {
		const result = weightedMedian([
			{ price: 10, weight: 0 },
			{ price: 20, weight: 0 },
			{ price: 30, weight: 0 },
			{ price: 40, weight: 0 },
		]);
		// Plain median of 4 values = avg of middle two = (20+30)/2 = 25
		expect(result).toBe(25);
	});

	it("even-count equal weights return the midpoint, not the lower item (round-106)", () => {
		// Two models at 0.5/0.5: cumulative hits exactly 0.5 after the first.
		// The old `>= 0.5` check returned the LOWER price, biasing 2-model
		// consensus downward; the plain-median contract demands the midpoint.
		const result = weightedMedian([
			{ price: 9.5, weight: 0.5 },
			{ price: 11.0, weight: 0.5 },
		]);
		expect(result).toBe(10.25);
	});
});

describe("weightedDirectionVote", () => {
	it("returns flat on a true tie (conservative — ambiguous signal)", () => {
		const result = weightedDirectionVote([
			{ direction: "up", weight: 0.3 },
			{ direction: "up", weight: 0.2 },
			{ direction: "down", weight: 0.5 },
		]);
		// up total = 0.5, down total = 0.5 — tie → conservative flat.
		expect(result.direction).toBe("flat");
		expect(result.agreementRatio).toBe(0.5);
	});

	it("lets a quality minority beat a quantity majority", () => {
		// 2 models say up with high weights; 3 say down with low weights.
		// up total = 0.6, down total = 0.35 → up wins despite fewer heads.
		const result = weightedDirectionVote([
			{ direction: "up", weight: 0.4 },
			{ direction: "up", weight: 0.2 },
			{ direction: "down", weight: 0.1 },
			{ direction: "down", weight: 0.15 },
			{ direction: "down", weight: 0.1 },
		]);
		expect(result.direction).toBe("up");
		// up raw weight = 0.6, total = 0.95 → ratio = 0.6/0.95 ≈ 0.632
		expect(result.agreementRatio).toBeCloseTo(0.6 / 0.95, 2);
	});

	it("returns flat with 0 ratio for empty input", () => {
		const result = weightedDirectionVote([]);
		expect(result.direction).toBe("flat");
		expect(result.agreementRatio).toBe(0);
	});

	it("returns flat when all weights are 0", () => {
		const result = weightedDirectionVote([
			{ direction: "up", weight: 0 },
			{ direction: "down", weight: 0 },
		]);
		expect(result.direction).toBe("flat");
	});

	it("computes agreement ratio as winner's share of total weight", () => {
		const result = weightedDirectionVote([
			{ direction: "up", weight: 3 },
			{ direction: "down", weight: 1 },
		]);
		// up share = 3/4 = 0.75
		expect(result.direction).toBe("up");
		expect(result.agreementRatio).toBe(0.75);
	});
});
