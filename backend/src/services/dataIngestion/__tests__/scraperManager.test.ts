/**
 * Tests for ScraperManager
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib", () => ({
	logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import type { Scraper, ScraperResult } from "../scraperManager";
import { ScraperManager } from "../scraperManager";

function createMockScraper(name: string, result?: ScraperResult, shouldThrow?: boolean): Scraper {
	return {
		name,
		fetch: vi.fn(async () => {
			if (shouldThrow) throw new Error(`${name} failed`);
			return result ?? { inserted: 0, updated: 0 };
		}),
	};
}

describe("ScraperManager", () => {
	let manager: ScraperManager;

	beforeEach(() => {
		vi.clearAllMocks();
		manager = new ScraperManager();
	});

	describe("registerSource", () => {
		it("should register a scraper source", () => {
			const scraper = createMockScraper("test");
			manager.registerSource("test", scraper);

			const health = manager.getHealth();
			expect(health.test).toBeDefined();
			expect(health.test.lastRun).toBeNull();
			expect(health.test.success).toBe(false);
			expect(health.test.error).toBeNull();
		});
	});

	describe("runSource", () => {
		it("should run a registered source and return result", async () => {
			const scraper = createMockScraper("usda", { inserted: 10, updated: 5 });
			manager.registerSource("usda", scraper);

			const result = await manager.runSource("usda");

			expect(result.inserted).toBe(10);
			expect(result.updated).toBe(5);
			expect(scraper.fetch).toHaveBeenCalledTimes(1);
		});

		it("should update health on success", async () => {
			const scraper = createMockScraper("fao", { inserted: 3, updated: 1 });
			manager.registerSource("fao", scraper);

			await manager.runSource("fao");

			const health = manager.getHealth();
			expect(health.fao.success).toBe(true);
			expect(health.fao.lastRun).toBeInstanceOf(Date);
			expect(health.fao.error).toBeNull();
			expect(health.fao.lastResult).toEqual({ inserted: 3, updated: 1 });
		});

		it("flags a 0-row run as emptyAfterRun (silent-failure detection — DATA-2)", async () => {
			// A scraper that returns without throwing but writes 0 rows is the
			// silent-failure case (e.g. Cloudflare block, page reformat). It
			// must NOT be reported as a clean success — the freshness board
			// needs to surface `empty` so operators see the source is
			// effectively dormant.
			// Mutation guard: flipping the result to {inserted:1} must fail
			// this test (emptyAfterRun → false).
			const scraper = createMockScraper("cepea", { inserted: 0, updated: 0 });
			manager.registerSource("cepea", scraper);

			await manager.runSource("cepea");

			const health = manager.getHealth();
			expect(health.cepea.success).toBe(true);
			expect(health.cepea.emptyAfterRun).toBe(true);
		});

		it("does not flag a productive run as emptyAfterRun", async () => {
			// Regression guard: a real refresh with rows must stay
			// emptyAfterRun === false. Prevents the empty-classifier from
			// over-triggering and mislabeling healthy sources.
			const scraper = createMockScraper("fred", { inserted: 4, updated: 2 });
			manager.registerSource("fred", scraper);

			await manager.runSource("fred");

			const health = manager.getHealth();
			expect(health.fred.emptyAfterRun).toBe(false);
			expect(health.fred.success).toBe(true);
		});

		it("a partial run (inserts only) is not empty", async () => {
			// Edge case: inserted>0, updated=0 → productive, not empty.
			const scraper = createMockScraper("partial", { inserted: 1, updated: 0 });
			manager.registerSource("partial", scraper);

			await manager.runSource("partial");

			expect(manager.getHealth().partial.emptyAfterRun).toBe(false);
		});

		it("does not set emptyAfterRun for key-skipped sources", async () => {
			// Key-skip path returns {0,0} but must NOT be classified as empty
			// — it's a different state (skipped_no_key) and the status
			// precedence in /sources handles it first. emptyAfterRun should
			// be undefined here, not true.
			process.env.TEST_MISSING_KEY = "";
			try {
				const scraper: Scraper = {
					name: "gated",
					fetch: vi.fn(),
					requiresKey: "TEST_MISSING_KEY",
				};
				manager.registerSource("gated", scraper);

				await manager.runSource("gated");

				const health = manager.getHealth();
				expect(health.gated.skippedNoKey).toBe(true);
				expect(health.gated.emptyAfterRun).toBeUndefined();
			} finally {
				delete process.env.TEST_MISSING_KEY;
			}
		});

		it("should throw for unknown source", async () => {
			await expect(manager.runSource("unknown")).rejects.toThrow("Unknown source: unknown");
		});

		it("should update health on failure", async () => {
			const scraper = createMockScraper("bad", undefined, true);
			manager.registerSource("bad", scraper);

			await expect(manager.runSource("bad")).rejects.toThrow("bad failed");

			const health = manager.getHealth();
			expect(health.bad.success).toBe(false);
			expect(health.bad.error).toBe("bad failed");
			expect(health.bad.lastRun).toBeInstanceOf(Date);
		});

		it("should handle non-Error exceptions", async () => {
			const scraper: Scraper = {
				name: "string-error",
				fetch: vi.fn(async () => {
					throw "string error";
				}),
			};
			manager.registerSource("string-error", scraper);

			await expect(manager.runSource("string-error")).rejects.toBe("string error");

			const health = manager.getHealth();
			expect(health["string-error"].error).toBe("string error");
		});
	});

	describe("runAll", () => {
		it("should run all registered sources in parallel", async () => {
			const s1 = createMockScraper("a", { inserted: 1, updated: 0 });
			const s2 = createMockScraper("b", { inserted: 2, updated: 1 });
			manager.registerSource("a", s1);
			manager.registerSource("b", s2);

			const results = await manager.runAll();

			expect(results.a).toEqual({ inserted: 1, updated: 0 });
			expect(results.b).toEqual({ inserted: 2, updated: 1 });
			expect(s1.fetch).toHaveBeenCalledTimes(1);
			expect(s2.fetch).toHaveBeenCalledTimes(1);
		});

		it("should handle mixed success and failure", async () => {
			const good = createMockScraper("good", { inserted: 5, updated: 0 });
			const bad = createMockScraper("bad", undefined, true);
			manager.registerSource("good", good);
			manager.registerSource("bad", bad);

			const results = await manager.runAll();

			expect(results.good).toEqual({ inserted: 5, updated: 0 });
			// Failed sources are now included with an {error} entry so the
			// refresh-all route can log them. Previously rejected sources were
			// dropped entirely, hiding failures from the freshness board.
			expect(results.bad).toEqual({ error: "bad failed" });
		});

		it("should return empty object when no sources registered", async () => {
			const results = await manager.runAll();
			expect(results).toEqual({});
		});

		it("should include rejected sources as {error} entries (regression)", async () => {
			// Regression: rejected sources were previously dropped from the
			// summary entirely, making the refresh-all route's `if ("error" in result)`
			// branch dead code and silently hiding failed sources.
			const bad = createMockScraper("crashed", undefined, true);
			manager.registerSource("crashed", bad);

			const results = await manager.runAll();

			expect(results.crashed).toEqual({ error: "crashed failed" });
			expect("error" in results.crashed).toBe(true);
		});
	});

	describe("getHealth", () => {
		it("should return health for all sources", () => {
			manager.registerSource("a", createMockScraper("a"));
			manager.registerSource("b", createMockScraper("b"));

			const health = manager.getHealth();

			expect(Object.keys(health)).toEqual(["a", "b"]);
		});

		it("should reflect run results", async () => {
			manager.registerSource("ok", createMockScraper("ok", { inserted: 1, updated: 0 }));
			await manager.runSource("ok");

			const health = manager.getHealth();
			expect(health.ok.lastResult).toEqual({ inserted: 1, updated: 0 });
		});
	});
});
