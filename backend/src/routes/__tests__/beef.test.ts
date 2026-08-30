/**
 * Beef Route Integration Tests (TD-6).
 *
 * `routes/beef.ts` was the last high-logic route with zero test coverage.
 * These tests drive the in-process Express app via supertest against the
 * real mt_db (where seed data — beef cuts, factories, BeefCutPrice rows —
 * lives), pinning the contracts that were previously unguarded.
 *
 * The /by-country aggregation was extracted to services/beefAggregation.ts
 * in the same change; these tests exercise it end-to-end through the route.
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/lib";
import { createTestApp, getAdminToken, requireDb } from "@/test/helpers/testApp";

let app: Express;
let token: string;

function authHeaders(t?: string) {
	return t ? { Authorization: `Bearer ${t}` } : {};
}

describe("Beef Routes (Integration)", () => {
	beforeAll(async () => {
		app = createTestApp();
		await requireDb("beef routes");
		token = await getAdminToken(app);
	});

	describe("GET /api/beef/factories", () => {
		it("lists active factories (public, no auth)", async () => {
			const res = await request(app).get("/api/beef/factories");

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(Array.isArray(res.body.data.factories)).toBe(true);
			expect(res.body.data.count).toBe(res.body.data.factories.length);
		});
	});

	describe("GET /api/beef/cuts", () => {
		it("lists beef cut taxonomy (public)", async () => {
			const res = await request(app).get("/api/beef/cuts");

			expect(res.status).toBe(200);
			expect(Array.isArray(res.body.data.cuts)).toBe(true);
			expect(res.body.data.cuts.length).toBeGreaterThan(0);
		});

		it("groups cuts by primal", async () => {
			const res = await request(app).get("/api/beef/cuts/by-primal");

			expect(res.status).toBe(200);
			expect(typeof res.body.data).toBe("object");
			// Each key maps to an array of cuts.
			for (const cuts of Object.values(res.body.data) as unknown[][]) {
				expect(Array.isArray(cuts)).toBe(true);
			}
		});

		it("returns 404 for an unknown cut code", async () => {
			const res = await request(app).get("/api/beef/cuts/NO_SUCH_CUT_xyz");

			expect(res.status).toBe(404);
		});
	});

	describe("GET /api/beef/by-country (aggregation — extracted logic)", () => {
		it("aggregates the latest BeefCutPrice snapshot by country", async () => {
			const res = await request(app).get("/api/beef/by-country");

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			const { countries, date, count } = res.body.data;

			// Seed data has BeefCutPrice rows → the snapshot is non-empty.
			expect(date).not.toBeNull();
			expect(count).toBe(countries.length);
			expect(count).toBeGreaterThan(0);

			// Each country row carries the full aggregate contract.
			for (const c of countries) {
				expect(c).toHaveProperty("country");
				expect(c).toHaveProperty("avgPrice");
				expect(c).toHaveProperty("minPrice");
				expect(c).toHaveProperty("maxPrice");
				expect(c).toHaveProperty("cutCount");
				expect(c).toHaveProperty("factoryCount");
				expect(Array.isArray(c.topCuts)).toBe(true);
				// Numeric invariants: avg within [min, max].
				expect(c.minPrice).toBeLessThanOrEqual(c.avgPrice);
				expect(c.avgPrice).toBeLessThanOrEqual(c.maxPrice);
				// cutCount is the total distinct cuts in the country snapshot;
				// topCuts is the capped breakdown (≤ cutsLimit). The breakdown
				// can never exceed the distinct cut count.
				expect(typeof c.cutCount).toBe("number");
				expect(c.topCuts.length).toBeLessThanOrEqual(c.cutCount);
			}

			// Sort invariant: countries are in locale order (the aggregation
			// sorts by country name).
			const names = countries.map((c: { country: string }) => c.country);
			const sorted = [...names].sort((a, b) => a.localeCompare(b));
			expect(names).toEqual(sorted);
		});

		it("caps the per-cut breakdown at the requested limit", async () => {
			// Request cuts=2 → no country row should expose more than 2 topCuts.
			const res = await request(app).get("/api/beef/by-country?cuts=2");

			expect(res.status).toBe(200);
			for (const c of res.body.data.countries) {
				expect(c.topCuts.length).toBeLessThanOrEqual(2);
			}
		});
	});

	describe("GET /api/beef/prices", () => {
		it("returns paginated price rows with freshness + pagination metadata", async () => {
			const res = await request(app).get("/api/beef/prices?days=365");

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toHaveProperty("prices");
			expect(res.body.data).toHaveProperty("count");
			expect(res.body.data).toHaveProperty("total");
			expect(res.body.data).toHaveProperty("freshness");
			expect(res.body.data).toHaveProperty("pagination");
			expect(Array.isArray(res.body.data.prices)).toBe(true);
		});
	});

	describe("GET /api/beef/forecasts (auth required)", () => {
		it("rejects unauthenticated requests", async () => {
			const res = await request(app).get("/api/beef/forecasts");
			expect(res.status).toBe(401);
		});

		it("returns a forecasts map when authenticated", async () => {
			const res = await request(app).get("/api/beef/forecasts").set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toHaveProperty("forecasts");
			expect(typeof res.body.data.forecasts).toBe("object");
			expect(res.body.data).toHaveProperty("count");
			expect(res.body.data).toHaveProperty("horizon");
			// forecasts may be empty (D1: beef data stale) but the contract
			// (forecasts/count/horizon keys) must always be present.
		});
	});

	describe("GET /api/beef/forecasts/:cutCode (auth required)", () => {
		it("rejects unauthenticated requests", async () => {
			const res = await request(app).get("/api/beef/forecasts/some_cut");
			expect(res.status).toBe(401);
		});

		it("returns 404 for an unknown cut", async () => {
			const res = await request(app)
				.get("/api/beef/forecasts/NO_SUCH_CUT_xyz")
				.set(authHeaders(token));
			expect(res.status).toBe(404);
		});

		it("returns 404 for an unknown factoryCode (round-146 批 2 pin)", async () => {
			const res = await request(app)
				.get("/api/beef/forecasts/STRIPLOIN?factoryCode=NO-SUCH-99")
				.set(authHeaders(token));
			expect(res.status).toBe(404);
		});

		it("?factoryCode= scopes the honesty gate to THAT factory (round-146 批 2)", async () => {
			// Pin a factory that has ZERO rows for a cut with data elsewhere —
			// the pinned series must fail the ≥2-points gate even though the
			// cut is forecastable via other factories (mt_test seed data is
			// fresh, so the no-pin path CAN return a real forecast).
			const someRow = await prisma.beefCutPrice.findFirst({
				where: { source: { not: { startsWith: "bridge:" } } },
				select: { cutCode: true, factoryId: true, factory: { select: { code: true } } },
			});
			if (!someRow) throw new Error("seed invariant: no non-bridge beef rows in mt_test");

			const emptyFactory = await prisma.factory.findFirst({
				where: { prices: { none: { cutCode: someRow.cutCode } } },
				select: { code: true },
			});
			if (!emptyFactory) throw new Error("seed invariant: no factory without rows for this cut");

			const res = await request(app)
				.get(`/api/beef/forecasts/${someRow.cutCode}?factoryCode=${emptyFactory.code}`)
				.set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.data.forecastable).toBe(false);
			expect(res.body.data.factoryCode).toBe(emptyFactory.code);
			expect(res.body.data.reason).toContain(`factory ${emptyFactory.code}`);
			expect(res.body.data.reason).toContain("Insufficient");
		});

		it("?factoryCode= forecasts the PINNED factory's series, not the representative pick", async () => {
			const someRow = await prisma.beefCutPrice.findFirst({
				where: { source: { not: { startsWith: "bridge:" } } },
				select: { cutCode: true, factoryId: true, factory: { select: { code: true } } },
			});
			if (!someRow) throw new Error("seed invariant: no non-bridge beef rows in mt_test");

			const res = await request(app)
				.get(`/api/beef/forecasts/${someRow.cutCode}?factoryCode=${someRow.factory.code}`)
				.set(authHeaders(token));

			expect(res.status).toBe(200);
			expect(res.body.data.factoryCode).toBe(someRow.factory.code);
			// The pin contract: whichever series the gate accepts, it MUST be
			// the pinned factory's — never silently falling back to another.
			if (res.body.data.forecastable) {
				expect(res.body.data.factoryId).toBe(someRow.factoryId);
			} else {
				expect(res.body.data.reason).toContain(`factory ${someRow.factory.code}`);
			}
		});
	});

	describe("GET /api/beef/prices?region= (round-146 批 2)", () => {
		it("filters rows to factories in the region (case-insensitive)", async () => {
			const res = await request(app)
				.get("/api/beef/prices?region=QLD&days=365&limit=100")
				.set(authHeaders(token));

			expect(res.status).toBe(200);
			const qldCodes = new Set(
				(await prisma.factory.findMany({ where: { region: "QLD" }, select: { code: true } })).map(
					(f) => f.code,
				),
			);
			expect(qldCodes.size).toBeGreaterThan(0);
			for (const p of res.body.data.prices) {
				expect(qldCodes.has(p.factory.code)).toBe(true);
			}
		});

		it("composes region with country (AND, not OR)", async () => {
			const res = await request(app)
				.get("/api/beef/prices?country=AU&region=QLD&days=365&limit=100")
				.set(authHeaders(token));

			expect(res.status).toBe(200);
			for (const p of res.body.data.prices) {
				expect(p.factory.country).toBe("AU");
			}
		});
	});

	// CSV import — the no-API-key real-data injection point (D1 workaround).
	// This is the only path that can put live beef_cut_prices rows into the
	// platform when all scraper API endpoints are network-blocked. It must be
	// guarded: transactional, idempotent, validated, and ADMIN-gated.
	describe("POST /api/beef/import (CSV upload, ADMIN-only)", () => {
		// The backend stamps source='manual:<uploaderEmail>'. The admin token
		// comes from the seeded admin (admin@trademind.com), so all test uploads
		// land under this source. Cleanup targets it to avoid polluting prod.
		const adminSource = "manual:admin@trademind.com";
		const today = new Date().toISOString().slice(0, 10);

		// Helper: build a CSV buffer from an array of row arrays.
		function csvBuffer(rows: string[][]): Buffer {
			const lines = rows.map((r) => r.join(","));
			return Buffer.from(lines.join("\n"), "utf-8");
		}

		// Cleanup: remove any rows this test suite wrote. Runs after the whole
		// import describe block so idempotency tests (which upload twice) don't
		// fight each other's cleanup.
		afterAll(async () => {
			await prisma.beefCutPrice.deleteMany({ where: { source: adminSource } });
		});

		it("rejects unauthenticated requests (401)", async () => {
			const csv = csvBuffer([
				["factoryCode", "cutCode", "price", "date"],
				["AU-847", "BRISKET_NAVEL", "8.45", today],
			]);
			const res = await request(app).post("/api/beef/import").attach("file", csv, "test.csv");

			expect(res.status).toBe(401);
		});

		it("rejects non-ADMIN users (403)", async () => {
			// Log in as the seeded regular user (role: USER, not ADMIN).
			const loginRes = await request(app)
				.post("/api/auth/login")
				.send({ email: "user@trademind.com", password: "User123!" });
			const userToken = loginRes.body.data.token;

			const csv = csvBuffer([
				["factoryCode", "cutCode", "price", "date"],
				["AU-847", "BRISKET_NAVEL", "8.45", today],
			]);
			const res = await request(app)
				.post("/api/beef/import")
				.set(authHeaders(userToken))
				.attach("file", csv, "test.csv");

			expect(res.status).toBe(403);
		});

		it("imports valid rows (happy path)", async () => {
			const csv = csvBuffer([
				["factoryCode", "cutCode", "price", "date", "currency", "unit", "grade"],
				["AU-847", "BRISKET_NAVEL", "8.45", today, "USD", "USD/kg", "Choice"],
				["BR-SIF2057", "STRIPLOIN", "12.30", today, "USD", "USD/kg", "M7"],
			]);
			const res = await request(app)
				.post("/api/beef/import")
				.set(authHeaders(token))
				.attach("file", csv, "prices.csv");

			expect(res.status).toBe(201);
			expect(res.body.success).toBe(true);
			expect(res.body.data.imported).toBe(2);
			expect(res.body.data.affectedCuts).toHaveLength(2);
		});

		it("is idempotent — re-uploading the same rows updates, not duplicates", async () => {
			const csv = csvBuffer([
				["factoryCode", "cutCode", "price", "date"],
				["AU-847", "BRISKET_NAVEL", "9.99", today],
				["BR-SIF2057", "STRIPLOIN", "13.99", today],
			]);
			// Second upload of the same (factory, cut, date, source) — should
			// update the price, not insert new rows.
			const res = await request(app)
				.post("/api/beef/import")
				.set(authHeaders(token))
				.attach("file", csv, "prices-v2.csv");

			expect(res.status).toBe(201);
			expect(res.body.data.imported).toBe(0);
			expect(res.body.data.updated).toBe(2);
		});

		it("lands optional spec columns in BeefCutPrice.metadata (V7 批3)", async () => {
			const specDate = today; // same-day rows are cleaned by afterAll
			const csv = csvBuffer([
				[
					"factoryCode",
					"cutCode",
					"price",
					"date",
					"feedingMethod",
					"feedingDays",
					"vendorLabel",
					"breed",
					"storage",
				],
				["AU-847", "TOPSIDE", "6.10", specDate, "Grain-fed", "150", "MSA", "Angus", "Port"],
				["BR-SIF2057", "TOPSIDE", "5.40", specDate, "Grass-fed", "", "", "", "Warehouse"],
			]);
			const res = await request(app)
				.post("/api/beef/import")
				.set(authHeaders(token))
				.attach("file", csv, "spec.csv");

			expect(res.status).toBe(201);
			expect(res.body.data.imported).toBe(2);

			const rows = await prisma.beefCutPrice.findMany({
				where: { source: adminSource, cutCode: "TOPSIDE", date: new Date(`${specDate}T00:00:00Z`) },
				orderBy: { factoryId: "asc" },
			});
			expect(rows).toHaveLength(2);
			const byFactory = new Map(rows.map((r) => [r.factoryId, r.metadata]));
			const metas = [...byFactory.values()];
			// Full-spec row: every non-empty cell landed under its metadata key.
			expect(metas).toContainEqual({
				feedingMethod: "Grain-fed",
				feedingDays: 150,
				vendorLabel: "MSA",
				breed: "Angus",
				storage: "Port",
			});
			// Partial-spec row: empty cells dropped, not stored as "".
			expect(metas).toContainEqual({
				feedingMethod: "Grass-fed",
				storage: "Warehouse",
			});
		});

		it("skips a row with a malformed feedingDays (wrong spec never lands)", async () => {
			const csv = csvBuffer([
				["factoryCode", "cutCode", "price", "date", "feedingDays"],
				["AU-847", "HEEL_MUSCLE", "4.20", today, "abc"],
			]);
			const res = await request(app)
				.post("/api/beef/import")
				.set(authHeaders(token))
				.attach("file", csv, "bad-spec.csv");

			expect(res.status).toBe(201);
			expect(res.body.data.imported).toBe(0);
			expect(res.body.data.skipped).toBe(1);
			expect(res.body.data.errors[0].message).toMatch(/feedingDays/);
		});

		it("skips invalid rows but imports valid ones (partial success)", async () => {
			const csv = csvBuffer([
				["factoryCode", "cutCode", "price", "date"],
				["AU-847", "BLADE", "7.50", today], // valid
				["NO-SUCH-FACTORY", "BLADE", "7.50", today], // unknown factory → skipped
				["AU-847", "NO_SUCH_CUT", "7.50", today], // unknown cut → skipped
				["AU-847", "BLADE", "not-a-number", today], // bad price → skipped
			]);
			const res = await request(app)
				.post("/api/beef/import")
				.set(authHeaders(token))
				.attach("file", csv, "mixed.csv");

			expect(res.status).toBe(201);
			expect(res.body.data.imported).toBe(1);
			expect(res.body.data.skipped).toBe(3);
			expect(res.body.data.errors).toHaveLength(3);
			// Each error names its row number so the operator can fix the CSV.
			for (const err of res.body.data.errors) {
				expect(err).toHaveProperty("row");
				expect(err).toHaveProperty("message");
			}
		});

		it("rejects empty CSV (400)", async () => {
			const csv = Buffer.from("factoryCode,cutCode,price,date\n", "utf-8");
			const res = await request(app)
				.post("/api/beef/import")
				.set(authHeaders(token))
				.attach("file", csv, "empty.csv");

			expect(res.status).toBe(400);
		});

		it("rejects non-multipart request (400)", async () => {
			const res = await request(app)
				.post("/api/beef/import")
				.set(authHeaders(token))
				.set("Content-Type", "application/json")
				.send({ factoryCode: "AU-847" });

			expect(res.status).toBe(400);
		});
	});

	// Mixed-currency spread grouping (round-144): BeefCutPrice rows carry
	// USD/BRL/AUD currencies; a spread bucket that merges a USD/kg row with a
	// BRL/kg row produces numeric noise. Currency must be part of the group key.
	describe("GET /api/beef/spreads (currency-aware grouping)", () => {
		const testSource = "test:spreads-currency";

		afterAll(async () => {
			await prisma.beefCutPrice.deleteMany({ where: { source: testSource } });
		});

		it("splits same-source rows into per-currency buckets", async () => {
			const factory = await prisma.factory.findFirst({});
			if (!factory) throw new Error("seed invariant: no factory rows in mt_test");

			const today = new Date();
			const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
			// Same factory/cut/source, different dates (unique constraint),
			// different currencies — must land in two separate buckets.
			for (const [date, currency, price] of [
				[today, "USD", 10],
				[yesterday, "BRL", 50],
			] as const) {
				await prisma.beefCutPrice.create({
					data: {
						factoryId: factory.id,
						cutCode: "STRIPLOIN",
						price,
						currency,
						unit: currency === "USD" ? "USD/kg" : "BRL/kg",
						source: testSource,
						date,
					},
				});
			}

			const res = await request(app)
				.get("/api/beef/spreads")
				.query({ cutCode: "STRIPLOIN" })
				.set(authHeaders(token));

			expect(res.status).toBe(200);
			const striploin = res.body.data.spreads.STRIPLOIN ?? {};
			const buckets = Object.entries(striploin).filter(([key]) => key.includes(testSource));
			// The same source appears twice — once per currency — never merged.
			expect(buckets).toHaveLength(2);
			const usd = buckets.find(([key]) => key.endsWith("[USD]"));
			const brl = buckets.find(([key]) => key.endsWith("[BRL]"));
			expect(usd?.[1]).toMatchObject({ min: 10, max: 10, avg: 10, count: 1 });
			expect(brl?.[1]).toMatchObject({ min: 50, max: 50, avg: 50, count: 1 });
		});
	});
});
