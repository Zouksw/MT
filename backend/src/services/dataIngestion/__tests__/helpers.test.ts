/**
 * classifyIngestionStatus — the 0-row honesty contract (round-58).
 *
 * This is the single source of truth that decides whether a scraper run is
 * `success` / `warning` / `error` in IngestionLog. The contract matters because
 * `getSourceFreshness` (marketService.ts) computes `successRate` from
 * `status === "success"` — if a 0-row run were mis-classified as success, the
 * freshness board would report a never-writing scraper as "healthy" (the bug
 * this classifier centralized: previously the scheduled path got it right but
 * the manual single-source + refresh-all paths wrote "success" unconditionally).
 *
 * These tests pin the classification so a regression in any of the 3 writers
 * (server.ts scheduled, marketData single, marketData all) that drops back to
 * unconditional "success" fails loudly. Pure function — no DB.
 */

import { describe, expect, it } from "vitest";
import { classifyIngestionStatus } from "@/services/dataIngestion/helpers";

describe("classifyIngestionStatus — 0-row honesty contract", () => {
	it("classifies a run that wrote rows as 'success'", () => {
		expect(classifyIngestionStatus({ inserted: 5, updated: 2 })).toEqual({
			status: "success",
		});
		// inserted-only counts as a real write too.
		expect(classifyIngestionStatus({ inserted: 1, updated: 0 })).toEqual({
			status: "success",
		});
		// updated-only counts.
		expect(classifyIngestionStatus({ inserted: 0, updated: 1 })).toEqual({
			status: "success",
		});
	});

	it("classifies a run that returned without throwing but wrote 0 rows as 'warning'", () => {
		// THE core honesty assertion: 0-row must NOT be "success". This is what
		// the manual-refresh writers previously got wrong (logged "success" for
		// empty results, inflating successRate for never-writing scrapers).
		expect(classifyIngestionStatus({ inserted: 0, updated: 0 })).toEqual({
			status: "warning",
		});
	});

	it("classifies a skipped run (e.g. missing API key) as 'error' with the reason", () => {
		expect(
			classifyIngestionStatus({
				inserted: 0,
				updated: 0,
				skipped: true,
				skipReason: "MLA_API_KEY not set",
			}),
		).toEqual({ status: "error", errorMessage: "MLA_API_KEY not set" });
		// Skipped without a reason still surfaces a generic message.
		expect(classifyIngestionStatus({ inserted: 0, updated: 0, skipped: true })).toEqual({
			status: "error",
			errorMessage: "skipped",
		});
	});

	it("classifies a thrown run (error set by the caller) as 'error'", () => {
		expect(
			classifyIngestionStatus({
				inserted: 0,
				updated: 0,
				error: "ECONNREFUSED",
			}),
		).toEqual({ status: "error", errorMessage: "ECONNREFUSED" });
	});

	it("does not let skipped/error mask a real write (defensive — should not happen in practice)", () => {
		// If a buggy caller sets skipped:true but also reports inserted>0, the
		// skip flag wins (the source declared it didn't really run). Pin so the
		// precedence is explicit: skipped → error → warning → success.
		expect(classifyIngestionStatus({ inserted: 5, updated: 0, skipped: true })).toEqual({
			status: "error",
			errorMessage: "skipped",
		});
	});
});
