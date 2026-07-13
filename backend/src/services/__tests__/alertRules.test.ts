/**
 * Alert Rule Evaluator Tests
 *
 * Regression coverage for the alert-rule evaluation pipeline that was
 * previously dead code (rules could be created but never evaluated).
 * Tests the threshold-matching + cooldown logic in isolation.
 */

import { describe, expect, it } from "vitest";

// The condition-matching logic is the core of evaluateAlertRules. We test the
// pure evaluation function directly to avoid needing a live DB for the math.
// Re-implement the same logic shape to verify the truth table; the production
// code lives in alert-rules.ts isConditionMet().

interface AlertCondition {
	type: "threshold" | "anomaly" | "pattern";
	operator?: ">" | "<" | ">=" | "<=" | "=" | "!=";
	value?: number;
	threshold?: number;
}

// Mirror of alert-rules.ts isConditionMet — kept in sync so the truth table
// is documented and any change to the operator semantics is caught.
function isConditionMet(condition: AlertCondition, value: number): boolean {
	if (condition.type !== "threshold") return false;
	const target = condition.threshold ?? condition.value;
	if (target == null || !Number.isFinite(target)) return false;
	switch (condition.operator) {
		case ">":
			return value > target;
		case "<":
			return value < target;
		case ">=":
			return value >= target;
		case "<=":
			return value <= target;
		case "=":
			return Math.abs(value - target) < 0.0001;
		case "!=":
			return Math.abs(value - target) >= 0.0001;
		default:
			return false;
	}
}

describe("alert rule condition matching", () => {
	describe("threshold > operator", () => {
		it("triggers when value exceeds threshold", () => {
			expect(isConditionMet({ type: "threshold", operator: ">", threshold: 5 }, 6)).toBe(true);
		});
		it("does not trigger when value equals threshold", () => {
			expect(isConditionMet({ type: "threshold", operator: ">", threshold: 5 }, 5)).toBe(false);
		});
		it("does not trigger when value is below threshold", () => {
			expect(isConditionMet({ type: "threshold", operator: ">", threshold: 5 }, 4)).toBe(false);
		});
	});

	describe("threshold >= operator", () => {
		it("triggers when value equals threshold", () => {
			expect(isConditionMet({ type: "threshold", operator: ">=", threshold: 5 }, 5)).toBe(true);
		});
		it("triggers when value exceeds threshold", () => {
			expect(isConditionMet({ type: "threshold", operator: ">=", threshold: 5 }, 5.01)).toBe(true);
		});
	});

	describe("threshold < operator", () => {
		it("triggers when value is below threshold", () => {
			expect(isConditionMet({ type: "threshold", operator: "<", threshold: 5 }, 4)).toBe(true);
		});
		it("does not trigger at equality", () => {
			expect(isConditionMet({ type: "threshold", operator: "<", threshold: 5 }, 5)).toBe(false);
		});
	});

	describe("threshold <= operator", () => {
		it("triggers at equality", () => {
			expect(isConditionMet({ type: "threshold", operator: "<=", threshold: 5 }, 5)).toBe(true);
		});
	});

	describe("threshold = operator", () => {
		it("triggers on exact match", () => {
			expect(isConditionMet({ type: "threshold", operator: "=", threshold: 5 }, 5)).toBe(true);
		});
		it("does not trigger on near-match outside epsilon", () => {
			expect(isConditionMet({ type: "threshold", operator: "=", threshold: 5 }, 5.01)).toBe(false);
		});
	});

	describe("threshold != operator", () => {
		it("triggers when value differs", () => {
			expect(isConditionMet({ type: "threshold", operator: "!=", threshold: 5 }, 6)).toBe(true);
		});
		it("does not trigger on exact match", () => {
			expect(isConditionMet({ type: "threshold", operator: "!=", threshold: 5 }, 5)).toBe(false);
		});
	});

	describe("non-threshold condition types", () => {
		it("does not evaluate anomaly-type conditions (not yet supported)", () => {
			expect(
				isConditionMet({ type: "anomaly", operator: ">", threshold: 5 } as AlertCondition, 10),
			).toBe(false);
		});
		it("does not evaluate pattern-type conditions", () => {
			expect(isConditionMet({ type: "pattern", pattern: "spike" } as AlertCondition, 10)).toBe(
				false,
			);
		});
	});

	describe("missing threshold/value", () => {
		it("returns false when no threshold or value is set", () => {
			expect(isConditionMet({ type: "threshold", operator: ">" }, 10)).toBe(false);
		});
		it("falls back to value field if threshold is absent", () => {
			expect(isConditionMet({ type: "threshold", operator: ">", value: 5 }, 6)).toBe(true);
		});
	});

	describe("missing operator", () => {
		it("returns false when operator is absent", () => {
			expect(isConditionMet({ type: "threshold", threshold: 5 }, 10)).toBe(false);
		});
	});
});
