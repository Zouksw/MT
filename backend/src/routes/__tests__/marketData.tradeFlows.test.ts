/**
 * GET /api/market/trade-flows (V8 批4, round-151).
 *
 * The read side of the comtrade_mirror lanes (V8 批0). Contract under test:
 * auth gating (D25 鉴权内先行), the per-country latest + MoM shape, the
 * annual-lane distinction (AR/UY: freq A, no MoM), the side-by-side CIF
 * calibration table, and the mandatory 口径注记 (notes). Seeds its own factor
 * rows in mt_test and cleans both the rows and the route's Redis cache key
 * (the 3600s TTL would otherwise serve deleted rows to the next run).
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { redis } from "@/lib/redis";
import { createTestApp, getAdminToken, getPrisma, requireDb } from "@/test/helpers/testApp";

let app: Express;
let adminToken: string;

/** Months relative to "now" so stale flags stay deterministic. */
function monthsAgo(n: number): Date {
	const d = new Date();
	d.setUTCDate(1);
	d.setUTCMonth(d.getUTCMonth() - n);
	return d;
}

const MIRROR_TYPE = "export_to_cn_0202";
const EU_TYPE = "export_eu_to_cn_0202";
const CALIB_TYPE = "import_cn_cif_0202";
const AR_FOB_TYPE = "export_fob_carnes";
const UY_INAC_TYPE = "export_fob_inac_bovina";
const UY_CUT_PREFIX = "export_fob_cut_uy_";
// Router-relative paths (Express req.path inside a mounted router — the
// full /api/market prefix is NOT part of the cache key; live-verified).
const CACHE_KEYS = ["market:trade-flows:/trade-flows", "market:trade-flows:/trade-flows:hs=0202"];

beforeAll(async () => {
	app = createTestApp();
	await requireDb("trade-flows routes");
	adminToken = await getAdminToken(app);

	// A previous run can leak its cache keys (see the del note in afterAll;
	// TTL is 3600s) — clear here too, or this run reads a stale response
	// shape (live-found round-155: a leaked old-shape key made the new
	// `history` assertions fail).
	try {
		const r = await redis();
		if (r) for (const key of CACHE_KEYS) await r.del(key);
	} catch {
		// Redis down — cacheRoute is best-effort too; tests proceed.
	}

	const prisma = getPrisma();
	await prisma.marketFactor.deleteMany({
		where: {
			type: {
				in: [MIRROR_TYPE, EU_TYPE, CALIB_TYPE, AR_FOB_TYPE, UY_INAC_TYPE],
			},
		},
	});
	await prisma.marketFactor.deleteMany({
		where: { type: { startsWith: UY_CUT_PREFIX } },
	});
	await prisma.marketFactor.createMany({
		data: [
			{
				// BR monthly, latest + previous → MoM computable, fresh (1 month back)
				type: MIRROR_TYPE,
				region: "BR→CN",
				date: monthsAgo(1),
				value: 6751.24,
				unit: "USD/ton",
				source: "comtrade_mirror",
				seriesKey: "",
				metadata: {
					freq: "M",
					period: "202606",
					quantityKg: 158364760,
					valueUsd: 1069158523,
					basis: "FOB (partner-reported export)",
				},
			},
			{
				type: MIRROR_TYPE,
				region: "BR→CN",
				date: monthsAgo(2),
				value: 6400.0,
				unit: "USD/ton",
				source: "comtrade_mirror",
				seriesKey: "",
				metadata: { freq: "M", period: "202605", quantityKg: 150000000, valueUsd: 960000000 },
			},
			{
				// AR annual fallback: freq A, single row → no MoM
				type: MIRROR_TYPE,
				region: "AR→CN",
				date: new Date(new Date().getUTCFullYear() - 1, 0, 1),
				value: 3723.5,
				unit: "USD/ton",
				source: "comtrade_mirror",
				seriesKey: "",
				metadata: {
					freq: "A",
					period: String(new Date().getUTCFullYear() - 1),
					quantityKg: 592359800,
					valueUsd: 2205121511,
				},
			},
			{
				// Argentina monthly meat-rubro FOB, ALL destinations (context —
				// no to-China monthly cross exists at this level). Value is
				// already USD millions (unit "USD M").
				type: AR_FOB_TYPE,
				region: "AR→WORLD",
				date: monthsAgo(2),
				value: 210.534,
				unit: "USD M",
				source: "argentina_exports",
				seriesKey: "",
				metadata: { serie: "ica_carnes", dataset: "sspm-75.3" },
			},
			{
				// EU lane (round-161 批1): Comext FOB-EUR, its own type — the
				// live IE shape (2026-06: €129,310 / 50.5 t = €2,560.59/t).
				type: EU_TYPE,
				region: "IE→CN",
				date: monthsAgo(2),
				value: 2560.594059,
				unit: "EUR/ton",
				source: "comext_eu",
				seriesKey: "",
				metadata: {
					freq: "M",
					period: "202606",
					quantityKg: 50500,
					valueEur: 129310,
					currency: "EUR",
					basis: "FOB-EUR (EU-reported export, Comext DS-045409)",
				},
			},
			{
				// Uruguay INAC official monthly to-China bovine FOB value
				// (round-162 批1) — value-only lane, USD millions.
				type: UY_INAC_TYPE,
				region: "UY→CN",
				date: monthsAgo(1),
				value: 67.491,
				unit: "USD M",
				source: "inac_expo",
				seriesKey: "",
				metadata: {
					freq: "M",
					period: monthsAgo(1).toISOString().slice(0, 7),
					usdThousands: 67491,
					ytdUsdThousands: 381236,
					currency: "USD",
					basis: "FOB-USD (Uruguay INAC eDIAE, Carne bovina, Cifras primarias)",
				},
			},
			{
				// Uruguay cut-family FOB unit prices (round-162 批1) —
				// hindquarter boneless, frozen, latest month + prior (history).
				type: `${UY_CUT_PREFIX}frozen_hindquarter_boneless`,
				region: "UY→WORLD",
				date: monthsAgo(1),
				value: 8.941123,
				unit: "USD/kg",
				source: "inac_expo",
				seriesKey: "",
				metadata: {
					freq: "M",
					period: monthsAgo(1).toISOString().slice(0, 7),
					usdThousands: 33216,
					tonnes: 3711,
					process: "frozen",
					currency: "USD",
				},
			},
			{
				type: `${UY_CUT_PREFIX}frozen_hindquarter_boneless`,
				region: "UY→WORLD",
				date: monthsAgo(2),
				value: 8.5,
				unit: "USD/kg",
				source: "inac_expo",
				seriesKey: "",
				metadata: {
					freq: "M",
					period: monthsAgo(2).toISOString().slice(0, 7),
					tonnes: 3600,
					process: "frozen",
					currency: "USD",
				},
			},
			{
				// Chilled lane rows exist too — sorted after frozen families.
				type: `${UY_CUT_PREFIX}chilled_forequarter_boneless`,
				region: "UY→WORLD",
				date: monthsAgo(1),
				value: 12.5,
				unit: "USD/kg",
				source: "inac_expo",
				seriesKey: "",
				metadata: {
					freq: "M",
					period: monthsAgo(1).toISOString().slice(0, 7),
					tonnes: 758,
					process: "chilled",
					currency: "USD",
				},
			},
			{
				type: CALIB_TYPE,
				region: "CN←BR",
				date: new Date(new Date().getUTCFullYear() - 1, 0, 1),
				value: 4621.36,
				unit: "USD/ton",
				source: "comtrade_mirror",
				seriesKey: "",
				metadata: {
					freq: "A",
					period: String(new Date().getUTCFullYear() - 1),
					quantityKg: 1339849200,
					valueUsd: 6191927449,
					basis: "CIF (China-reported import)",
				},
			},
		],
	});
});

afterAll(async () => {
	await getPrisma().marketFactor.deleteMany({
		where: {
			type: {
				in: [MIRROR_TYPE, EU_TYPE, CALIB_TYPE, AR_FOB_TYPE, UY_INAC_TYPE],
			},
		},
	});
	await getPrisma().marketFactor.deleteMany({
		where: { type: { startsWith: UY_CUT_PREFIX } },
	});
	try {
		const r = await redis();
		// NOTE: del one key per call. node-redis 4.7.1's variadic form
		// `del(k1, k2)` deletes only k1 (live-proven round-155 — the spread
		// here had silently leaked the `hs=0202` key for its full 3600s TTL,
		// which then served a stale response shape to the next run).
		if (r) for (const key of CACHE_KEYS) await r.del(key);
	} catch {
		// Redis down — the key expires on its own TTL.
	}
});

describe("GET /api/market/trade-flows", () => {
	test("requires authentication (D25 鉴权内先行)", async () => {
		const res = await request(app).get("/api/market/trade-flows");
		expect(res.status).toBe(401);
	});

	test("returns monthly flows with latest + MoM and annual lanes without", async () => {
		const res = await request(app)
			.get("/api/market/trade-flows?hs=0202")
			.set({ Authorization: `Bearer ${adminToken}` });
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);

		const { flows, calibration, notes } = res.body.data;
		expect(res.body.data.hs).toBe("0202");

		const br = flows.find((f: { region: string }) => f.region === "BR→CN");
		expect(br).toBeDefined();
		expect(br.freq).toBe("M");
		expect(br.stale).toBe(false);
		expect(br.currency).toBe("USD");
		expect(br.latest.currency).toBe("USD");
		expect(br.latest.unitPricePerT).toBeCloseTo(6751.2, 1);
		expect(br.latest.qtyTons).toBeCloseTo(158364.8, 1);
		expect(br.latest.valueM).toBeCloseTo(1069.2, 1);
		// (6751.24 − 6400) / 6400 = 5.5%
		expect(br.momPct).toBeCloseTo(5.5, 1);
		// History (round-155 批C): oldest-first monthly series for charting.
		expect(Array.isArray(br.history)).toBe(true);
		expect(br.history.length).toBe(2);
		expect(br.history[0].period).toBe("202605");
		expect(br.history[1].period).toBe("202606");
		expect(br.history[1].unitPricePerT).toBeCloseTo(6751.2, 1);

		// EU lane (round-161 批1): Comext EUR row sits in the same flows list
		// — explicit currency, no conversion, no merge with the USD lanes.
		const ie = flows.find((f: { region: string }) => f.region === "IE→CN");
		expect(ie).toBeDefined();
		expect(ie.freq).toBe("M");
		expect(ie.currency).toBe("EUR");
		expect(ie.latest.unitPricePerT).toBeCloseTo(2560.6, 1);
		expect(ie.latest.valueM).toBeCloseTo(0.1, 2);
		expect(ie.latest.qtyTons).toBeCloseTo(50.5, 1);
		expect(ie.momPct).toBeNull(); // single seeded row
		expect(ie.stale).toBe(false);

		const ar = flows.find((f: { region: string }) => f.region === "AR→CN");
		expect(ar.freq).toBe("A");
		expect(ar.momPct).toBeNull();
		expect(ar.stale).toBe(false);
		expect(ar.history.length).toBe(1);

		// Calibration lane: CIF, separate table, never merged into flows.
		const cnBr = calibration.find((c: { region: string }) => c.region === "CN←BR");
		expect(cnBr.basis).toContain("CIF");
		expect(cnBr.latest.unitPricePerT).toBeCloseTo(4621.4, 1);
		expect(calibration.some((c: { region: string }) => c.region.includes("→CN"))).toBe(false);

		// 口径注记 mandatory: the response always travels with its caliber notes
		// (incl. the EU EUR-lane note, round-161 批1).
		expect(Array.isArray(notes)).toBe(true);
		expect(notes.length).toBeGreaterThanOrEqual(2);
		expect(notes.join("")).toContain("绝不合并");
		expect(notes.join("")).toContain("Comext");

		// Argentina all-destinations FOB context (round-155 批C).
		const { arFobTotal } = res.body.data;
		expect(arFobTotal).not.toBeNull();
		expect(arFobTotal.valueUsdM).toBeCloseTo(210.5, 1);
		expect(arFobTotal.period).toMatch(/^\d{4}-\d{2}$/);

		// Uruguay INAC official to-China value + cut-family unit prices
		// (round-162 批1): separate payload fields, never flows rows.
		const { uyInacTotal, uyCuts } = res.body.data;
		expect(uyInacTotal).not.toBeNull();
		expect(uyInacTotal.valueUsdM).toBeCloseTo(67.5, 1);
		expect(uyInacTotal.period).toMatch(/^\d{4}-\d{2}$/);
		expect(flows.some((f: { region: string }) => f.region === "UY→CN")).toBe(false);

		expect(Array.isArray(uyCuts)).toBe(true);
		const hind = uyCuts.find((c: { key: string }) => c.key === "frozen_hindquarter_boneless");
		expect(hind).toBeDefined();
		expect(hind.process).toBe("frozen");
		expect(hind.period).toBe(monthsAgo(1).toISOString().slice(0, 7));
		expect(hind.usdPerKg).toBeCloseTo(8.94, 2);
		expect(hind.tonnes).toBe(3711);
		// History oldest-first (round-155 批C convention).
		expect(hind.history.length).toBe(1);
		expect(hind.history[0].usdPerKg).toBeCloseTo(8.5, 2);
		const chilled = uyCuts.find((c: { key: string }) => c.key === "chilled_forequarter_boneless");
		expect(chilled?.process).toBe("chilled");
		// Frozen families sort before chilled ones.
		expect(uyCuts.indexOf(hind)).toBeLessThan(uyCuts.indexOf(chilled));
		expect(notes.join("")).toContain("INAC");
	});

	test("accepts the Comext CN8 cut-level lanes (round-162 批2)", async () => {
		for (const hs of ["02023050", "02023090", "02022090", "02022010"]) {
			const res = await request(app)
				.get(`/api/market/trade-flows?hs=${hs}`)
				.set({ Authorization: `Bearer ${adminToken}` });
			expect(res.status, hs).toBe(200);
			expect(res.body.data.hs).toBe(hs);
		}
	});

	test("rejects an hs code outside the mirror's pinned set", async () => {
		const res = await request(app)
			.get("/api/market/trade-flows?hs=999999")
			.set({ Authorization: `Bearer ${adminToken}` });
		expect(res.status).toBe(400);
	});

	test("defaults to hs=0202 when no param is given", async () => {
		const res = await request(app)
			.get("/api/market/trade-flows")
			.set({ Authorization: `Bearer ${adminToken}` });
		expect(res.status).toBe(200);
		expect(res.body.data.hs).toBe("0202");
	});
});
