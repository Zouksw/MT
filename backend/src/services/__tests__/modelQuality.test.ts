import { describe, expect, it } from "vitest";
import { weightedDirectionVote, weightedMedian } from "../modelQuality";

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
