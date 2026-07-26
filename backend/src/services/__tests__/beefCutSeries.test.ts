import { describe, expect, it } from "vitest";
import { cutSeriesKey, isCutSeriesKey, parseCutSeriesKey } from "../beefCutSeries";

describe("cutSeriesKey", () => {
	it("produces the cut:{factoryId}:{cutCode} format", () => {
		expect(cutSeriesKey("factory-123", "BRISKET_NAVEL")).toBe("cut:factory-123:BRISKET_NAVEL");
	});

	it("is stable — same inputs → same key", () => {
		const a = cutSeriesKey("f1", "RIB_EYE_ROLL");
		const b = cutSeriesKey("f1", "RIB_EYE_ROLL");
		expect(a).toBe(b);
	});

	it("different factories produce different keys for the same cut", () => {
		expect(cutSeriesKey("f1", "TOPSIDE")).not.toBe(cutSeriesKey("f2", "TOPSIDE"));
	});

	it("different cuts produce different keys for the same factory", () => {
		expect(cutSeriesKey("f1", "TOPSIDE")).not.toBe(cutSeriesKey("f1", "STRIPLOIN"));
	});
});

describe("isCutSeriesKey", () => {
	it("true for a cut: prefixed key", () => {
		expect(isCutSeriesKey("cut:factory-1:BRISKET_NAVEL")).toBe(true);
	});

	it("false for a plain commodityId (UUID-like)", () => {
		expect(isCutSeriesKey("a1b2c3d4-e5f6-7890-abcd-ef1234567890")).toBe(false);
	});

	it("false for a macro slug-like id", () => {
		expect(isCutSeriesKey("beef_carcass_us")).toBe(false);
	});

	it("false for empty string", () => {
		expect(isCutSeriesKey("")).toBe(false);
	});
});

describe("parseCutSeriesKey", () => {
	it("round-trips a key back to {factoryId, cutCode}", () => {
		const key = cutSeriesKey("factory-abc", "RIB_EYE_ROLL");
		const parsed = parseCutSeriesKey(key);
		expect(parsed).toEqual({ factoryId: "factory-abc", cutCode: "RIB_EYE_ROLL" });
	});

	it("returns null for a non-cut key", () => {
		expect(parseCutSeriesKey("beef_carcass_us")).toBeNull();
	});

	it("returns null for a malformed cut key (wrong part count)", () => {
		// cut:only-one-part → 2 colons → split gives 3 parts, not 4
		expect(parseCutSeriesKey("cut:only-one-part")).toBeNull();
	});

	it("handles factoryId that looks like a UUID (contains no colon)", () => {
		const key = cutSeriesKey("a1b2-c3d4", "TOPSIDE");
		expect(parseCutSeriesKey(key)).toEqual({ factoryId: "a1b2-c3d4", cutCode: "TOPSIDE" });
	});
});
