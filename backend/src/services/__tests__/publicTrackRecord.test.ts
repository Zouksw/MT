/**
 * Public track record (batch 2) — the security-critical suite.
 *
 * The endpoint is UNAUTHENTICATED, so its privacy contract is load-bearing:
 * a prediction logged against a user's private timeseries (commodityId =
 * that timeseries' uuid) must NEVER appear in the sample list. The whitelist
 * is positive (macro commodity OR cut: key); anything else fails closed.
 */

import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { prisma } from "@/lib";
import { getPublicTrackRecord, RECENT_SAMPLE_LIMIT } from "@/services/publicTrackRecord";
import { createTestApp, requireDb } from "@/test/helpers/testApp";

let app: Express;

const PROBE = "trackrecord-probe";

/** A commodityId that is NOT a commodity row and NOT a cut: key — i.e. what
 * a private user-timeseries prediction looks like from prediction_logs. */
const PRIVATE_ID = "11111111-2222-4333-8444-555566667777";

beforeAll(async () => {
	app = createTestApp();
	await requireDb("publicTrackRecord");

	// Seed three verified probe rows newest-first interference-safe:
	//  - private id (must be excluded),
	//  - cut: key (must be included),
	//  - a real macro commodity (must be included with slug label).
	const macro = await prisma.commodity.findFirst({ select: { id: true, slug: true } });
	if (!macro) throw new Error("publicTrackRecord: test DB has no commodities seeded");

	const base = {
		status: "verified",
		mape: 3.21,
		horizon: 10,
		predictedValues: [1, 2, 3],
		actualValues: [1, 2, 2.9],
		verifiedAt: new Date(),
		predictedAt: new Date(),
	};
	await prisma.predictionLog.createMany({
		data: [
			{ ...base, commodityId: PRIVATE_ID, modelId: `${PROBE}-private` },
			{
				...base,
				commodityId: "cut:AU-847:BRISKET_POINT",
				modelId: `${PROBE}-cut`,
			},
			{ ...base, commodityId: macro.id, modelId: `${PROBE}-macro` },
			// test-artifact exclusion: even a whitelisted-looking id containing
			// "test" must be dropped.
			{
				...base,
				commodityId: "cut:TEST-PLANT:TEST_CUT",
				modelId: `${PROBE}-testish`,
			},
		],
	});
});

afterAll(async () => {
	await prisma.predictionLog.deleteMany({ where: { modelId: { startsWith: `${PROBE}-` } } });
});

describe("getPublicTrackRecord — privacy whitelist (fails closed)", () => {
	test("private/unresolvable series ids NEVER appear in samples", async () => {
		const record = await getPublicTrackRecord();
		const keys = record.samples.map((s) => s.seriesKey);
		expect(keys).not.toContain(PRIVATE_ID);
		// And no sample row references the private prediction at all.
		expect(record.samples.every((s) => s.modelId !== `${PROBE}-private`)).toBe(true);
	});

	test("macro commodity and cut: series ARE exposed, with readable labels", async () => {
		const record = await getPublicTrackRecord();
		const probeModels = record.samples.filter((s) => s.modelId.startsWith(`${PROBE}-`));
		const ids = probeModels.map((s) => s.modelId);
		expect(ids).toContain(`${PROBE}-cut`);
		expect(ids).toContain(`${PROBE}-macro`);
		expect(ids).not.toContain(`${PROBE}-testish`);

		const cut = record.samples.find((s) => s.modelId === `${PROBE}-cut`);
		expect(cut?.seriesKey).toBe("cut:AU-847:BRISKET_POINT");
		expect(cut?.seriesLabel).toContain("BRISKET_POINT");
		expect(cut?.predicted).toBe(3);
		expect(cut?.actual).toBe(2.9);
		expect(cut?.mape).toBe(3.21);
	});

	test("every sample key is provably whitelisted (macro slug or cut:)", async () => {
		const record = await getPublicTrackRecord();
		const commodities = await prisma.commodity.findMany({ select: { slug: true } });
		const slugs = new Set(commodities.map((c) => c.slug));
		for (const s of record.samples) {
			const isCut = /^cut:[^:]+:[^:]+$/.test(s.seriesKey);
			expect(isCut || slugs.has(s.seriesKey)).toBe(true);
		}
	});

	test("sample cap holds", async () => {
		const record = await getPublicTrackRecord();
		expect(record.samples.length).toBeLessThanOrEqual(RECENT_SAMPLE_LIMIT);
	});
});

describe("GET /api/signals/models/accuracy/public — public route contract", () => {
	test("is accessible WITHOUT authentication", async () => {
		const res = await request(app).get("/api/signals/models/accuracy/public");
		expect(res.status).toBe(200);
		expect(res.body.success).toBe(true);
		expect(Array.isArray(res.body.data.leaderboard)).toBe(true);
		expect(Array.isArray(res.body.data.samples)).toBe(true);
		expect(res.body.data.methodology).toBeDefined();
		// The authed variant stays authed (contrast pin).
		const authed = await request(app).get("/api/signals/models/accuracy");
		expect(authed.status).toBe(401);
	});

	test("response contains no private-series keys", async () => {
		const res = await request(app).get("/api/signals/models/accuracy/public");
		const keys: string[] = res.body.data.samples.map((s: { seriesKey: string }) => s.seriesKey);
		expect(keys).not.toContain(PRIVATE_ID);
	});
});
