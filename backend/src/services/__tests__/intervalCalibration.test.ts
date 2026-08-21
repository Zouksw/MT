/**
 * intervalCalibration — unit tests (Node-side contract).
 *
 * Since round-114 the multiplier derivation (residual extraction, row-count
 * evidence bar, split-conformal order statistic, test-artifact exclusion)
 * runs entirely in SQL; its semantics are pinned against the real test DB in
 * intervalCalibration.integration.test.ts. Here prisma.$queryRaw is mocked;
 * these tests pin:
 *  - applyConformalInterval bounds replacement + guards (unchanged);
 *  - SQL-row → multiplier mapping and the q∈(0,1) gate;
 *  - the test-artifact exclusion reaching SQL;
 *  - days-keyed caching and the single-flight (stampede) guard.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	applyConformalInterval,
	getIntervalMultipliers,
	resetCalibrationCacheForTests,
} from "../intervalCalibration";

const mocks = vi.hoisted(() => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
	queryRaw: vi.fn(),
}));

vi.mock("@/lib", () => ({
	logger: mocks.logger,
	prisma: { $queryRaw: (...a: unknown[]) => mocks.queryRaw(...a) },
}));

beforeEach(() => {
	vi.clearAllMocks();
	resetCalibrationCacheForTests();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("applyConformalInterval", () => {
	it("replaces bounds multiplicatively", () => {
		const out = applyConformalInterval([100, 200], 0.1);
		expect(out.lowerBound?.[0]).toBeCloseTo(90, 8);
		expect(out.lowerBound?.[1]).toBeCloseTo(180, 8);
		expect(out.upperBound?.[0]).toBeCloseTo(110, 8);
		expect(out.upperBound?.[1]).toBeCloseTo(220, 8);
	});

	it("keeps native interval when no multiplier (undefined q)", () => {
		expect(applyConformalInterval([100], undefined)).toEqual({});
	});

	it("keeps native interval for non-positive series (multiplicative form would flip bounds)", () => {
		expect(applyConformalInterval([100, -5], 0.1)).toEqual({});
		expect(applyConformalInterval([0], 0.1)).toEqual({});
	});
});

describe("getIntervalMultipliers", () => {
	it("maps SQL rows to multipliers and rejects q outside (0,1)", async () => {
		// q ≥ 1 would make ŷ·(1−q) negative; q = 0 is no calibration at all.
		mocks.queryRaw.mockResolvedValue([
			{ model_id: "healthy_model", q: 0.29, n_rows: 26446 },
			{ model_id: "poisoned_model", q: 1.4, n_rows: 100 },
			{ model_id: "zero_model", q: 0, n_rows: 100 },
		]);
		const m = await getIntervalMultipliers();
		expect(m.get("healthy_model")).toBe(0.29);
		expect(m.has("poisoned_model")).toBe(false);
		expect(m.has("zero_model")).toBe(false);
	});

	it("sends the verified-status + test-artifact exclusion to SQL", async () => {
		// Mirrors mapeTracking's EXCLUDE_TEST_ARTIFACTS (round-113, A1-1) —
		// the clause must live in the SQL text, not just in a JS where-object.
		mocks.queryRaw.mockResolvedValue([]);
		await getIntervalMultipliers();
		const sql = String(mocks.queryRaw.mock.calls[0]?.[0]?.join?.(" ") ?? "");
		expect(sql).toContain("status = 'verified'");
		expect(sql).toContain("NOT ILIKE '%test%'");
	});

	it("keys the 60s cache by `days` — a 7-day fetch must not serve a 60-day call", async () => {
		// Round-113, A1-5: a single cache slot served any `days` within TTL.
		mocks.queryRaw.mockResolvedValueOnce([{ model_id: "m", q: 0.2, n_rows: 50 }]);
		await getIntervalMultipliers(60);
		mocks.queryRaw.mockResolvedValueOnce([{ model_id: "m", q: 0.4, n_rows: 70 }]);
		const m7 = await getIntervalMultipliers(7); // within TTL, different key
		expect(m7.get("m")).toBe(0.4);
		expect(mocks.queryRaw).toHaveBeenCalledTimes(2);
		await getIntervalMultipliers(7); // cache hit — no third query
		expect(mocks.queryRaw).toHaveBeenCalledTimes(2);
	});

	it("shares one rebuild between concurrent callers after TTL expiry (stampede guard)", async () => {
		// Round-114, A1-6: at expiry the 3-model background refresh and
		// per-request route calls can overlap — they must fire ONE query.
		let release: (v: unknown) => void = () => {};
		const gate = new Promise((resolve) => {
			release = resolve;
		});
		mocks.queryRaw.mockImplementation(() =>
			gate.then(() => [{ model_id: "m", q: 0.1, n_rows: 40 }]),
		);

		const p1 = getIntervalMultipliers();
		const p2 = getIntervalMultipliers();
		// Both calls entered before the query resolved, yet only one query.
		expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
		release(null);
		const [a, b] = await Promise.all([p1, p2]);
		expect(a.get("m")).toBe(0.1);
		expect(b.get("m")).toBe(0.1);
		expect(mocks.queryRaw).toHaveBeenCalledTimes(1);
	});
});
