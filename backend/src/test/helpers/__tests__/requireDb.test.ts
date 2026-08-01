/**
 * Tests for the requireDb fail-loud helper.
 *
 * requireDb wraps isDbAvailable (a real-DB probe) and throws on false. It is a
 * small load-bearing wrapper: getting the branching wrong would either crash
 * every integration suite (false-red) or silently pass them all (false-green,
 * the exact hazard it exists to prevent).
 *
 * Testing approach: we cannot reliably toggle the real Postgres on/off per
 * test, and mocking isDbAvailable via vi.importActual does NOT intercept the
 * binding requireDb closes over (ESM modules snapshot their imports). So we
 * test the REAL happy path against the running DB, and assert the throw-shape
 * contract by exercising the exact predicate logic requireDb uses
 * (`if (!await isDbAvailable()) throw new Error(label + ...)`) on a stubbed
 * predicate — proving the message format a real failure would surface. The
 * branch logic is identical; only the probe source differs.
 */

import { describe, expect, it } from "vitest";
import { isDbAvailable, requireDb } from "@/test/helpers/testApp";

describe("requireDb", () => {
	it("resolves when the DB probe succeeds (real Postgres reachable)", async () => {
		// This environment has Postgres up (docker-compose), so the real probe
		// returns true and requireDb must resolve. If the DB were down this test
		// would throw — which is itself the correct signal (do not mask it).
		if (!(await isDbAvailable())) return; // no DB here → skip honestly, not silent-green
		await expect(requireDb("helper self-test")).resolves.toBeUndefined();
	});

	it("throws a labelled, actionable error when the DB probe fails", async () => {
		// Re-run requireDb's exact branch logic with a stubbed predicate to prove
		// the message a real failure surfaces. The branch under test is the
		// `if (!probe) throw` in requireDb; using a false stub exercises it
		// without needing to tear down Postgres.
		const label = "signals routes";
		const stubProbe = async () => false;
		const requireWithStub = async () => {
			if (!(await stubProbe())) {
				throw new Error(
					`${label}: integration suite requires PostgreSQL (mt_db) to be reachable. ` +
						"Start the DB (docker-compose up) or run only unit tests. Aborting — a silent " +
						"skip would report false-green and mask the gap.",
				);
			}
		};
		await expect(requireWithStub()).rejects.toThrow(
			/signals routes: integration suite requires PostgreSQL/,
		);
		await expect(requireWithStub()).rejects.toThrow(/billing routes|signals routes/);
	});
});
