/**
 * Prediction Lifecycle module tests.
 *
 * The module is a pure constants/types leaf — these tests pin the status
 * vocabulary so a typo or rename in one consumer doesn't silently break
 * the DB queries that filter by status string.
 */
import { describe, expect, it } from "vitest";
import {
	ACCURACY_ELIGIBLE_STATUSES,
	canVerify,
	PredictionStatus,
	TERMINAL_STATUSES,
} from "@/services/predictionLifecycle";

describe("predictionLifecycle constants", () => {
	it("exports the 5 lifecycle statuses matching the DB column values", () => {
		expect(PredictionStatus.COMPLETED).toBe("completed");
		expect(PredictionStatus.VERIFIED).toBe("verified");
		expect(PredictionStatus.STALE).toBe("stale");
		expect(PredictionStatus.UNVERIFIABLE).toBe("unverifiable");
		expect(PredictionStatus.PENDING).toBe("pending");
	});

	it("TERMINAL_STATUSES excludes pending (in-flight predictions)", () => {
		expect(TERMINAL_STATUSES).not.toContain(PredictionStatus.PENDING);
		expect(TERMINAL_STATUSES).toContain(PredictionStatus.COMPLETED);
		expect(TERMINAL_STATUSES).toContain(PredictionStatus.VERIFIED);
		expect(TERMINAL_STATUSES).toContain(PredictionStatus.STALE);
		expect(TERMINAL_STATUSES).toContain(PredictionStatus.UNVERIFIABLE);
	});

	it("ACCURACY_ELIGIBLE_STATUSES is verified-only (MAPE requires actuals)", () => {
		expect(ACCURACY_ELIGIBLE_STATUSES).toEqual([PredictionStatus.VERIFIED]);
	});

	// REGRESSION (round-93): canVerify is the transition guard that prevents
	// verifyPrediction from resurrecting excluded rows. Only completed/verified
	// rows may receive a verification write; stale/unverifiable/pending must be
	// refused so a concurrent mark pass can't be undone.
	it("canVerify admits only completed and verified statuses", () => {
		expect(canVerify(PredictionStatus.COMPLETED)).toBe(true);
		expect(canVerify(PredictionStatus.VERIFIED)).toBe(true); // idempotent re-verify
		expect(canVerify(PredictionStatus.STALE)).toBe(false);
		expect(canVerify(PredictionStatus.UNVERIFIABLE)).toBe(false);
		expect(canVerify(PredictionStatus.PENDING)).toBe(false);
		expect(canVerify(null)).toBe(false);
		expect(canVerify(undefined)).toBe(false);
	});
});
