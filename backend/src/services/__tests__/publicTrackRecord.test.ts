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
import {
	BEEF_SAMPLE_SLOTS,
	getPublicTrackRecord,
	RECENT_SAMPLE_LIMIT,
} from "@/services/publicTrackRecord";
import { BASELINE_MODELS, getAllModels } from "@/services/tradingSignals";
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

describe("beef reserved slots (round-164 批0a) — buried beef evidence stays visible", () => {
	// Production shape (2026-09 finding): the verify loop lands thousands of
	// daily-macro rows, so beef rows verified on the monthly cadence sink past
	// the newest-400 over-fetch and never reach the 50-sample cap. Reserved
	// slots must surface beef regardless of macro volume.
	const BULK = 410; // > SAMPLE_FETCH_LIMIT (400) so the beef row is provably outside the general pool
	const beefProbe = `${PROBE}-beef`;
	const bulkProbe = `${PROBE}-bulk`;

	test("a beef verified row older than 400 newer macro rows still appears", async () => {
		const beef = await prisma.commodity.findFirst({
			where: { slug: { startsWith: "beef" } },
			select: { id: true, slug: true },
		});
		if (!beef) throw new Error("publicTrackRecord: test DB has no beef-family commodity");
		const macro = await prisma.commodity.findFirst({
			where: { NOT: [{ slug: { startsWith: "beef" } }] },
			select: { id: true },
		});
		if (!macro) throw new Error("publicTrackRecord: test DB has no non-beef commodity");

		const now = Date.now();
		const beefRow = {
			status: "verified",
			mape: 0.55,
			horizon: 1,
			predictedValues: [820, 825],
			actualValues: [820, 826],
			verifiedAt: new Date(now - 15 * 86_400_000), // 15d old — buried
			predictedAt: new Date(now - 20 * 86_400_000),
			commodityId: beef.id,
			modelId: beefProbe,
		};
		const bulkRows = Array.from({ length: BULK }, (_, i) => ({
			...beefRow,
			mape: 1.5,
			// Newer than the beef row, staggered so they fill the whole
			// newest-first over-fetch window ahead of it.
			verifiedAt: new Date(now - (i + 1) * 60_000),
			predictedAt: new Date(now - (i + 1) * 61_000),
			commodityId: macro.id,
			modelId: bulkProbe,
		}));
		await prisma.predictionLog.createMany({ data: [beefRow, ...bulkRows] });

		try {
			const record = await getPublicTrackRecord();
			const beefSamples = record.samples.filter((s) => s.modelId === beefProbe);
			expect(beefSamples.length).toBe(1);
			expect(beefSamples[0].seriesKey).toBe(beef.slug);
			expect(beefSamples[0].mape).toBe(0.55);
			// The reserved slots cannot break the published cap.
			expect(record.samples.length).toBeLessThanOrEqual(RECENT_SAMPLE_LIMIT);
			// Beef rows lead the sample list (reserved slots first).
			expect(record.samples.findIndex((s) => s.modelId === beefProbe)).toBeLessThan(
				record.samples.findIndex((s) => s.modelId === bulkProbe),
			);
		} finally {
			await prisma.predictionLog.deleteMany({
				where: { modelId: { in: [beefProbe, bulkProbe] } },
			});
		}
	});

	test("beef slots are capped so a beef-heavy DB cannot monopolize the digest", async () => {
		// Structural pin: the reserved query's take is BEEF_SAMPLE_SLOTS, well
		// under the 50-row cap — the general pool always keeps the majority.
		expect(BEEF_SAMPLE_SLOTS).toBeLessThanOrEqual(10);
		expect(BEEF_SAMPLE_SLOTS).toBeLessThan(RECENT_SAMPLE_LIMIT / 2);
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

describe("leaderboard — engine-registry pinning (round-129 batch 8)", () => {
	// computeAllModelAccuracy enumerates the LIVE registry (getAllModels +
	// BASELINE_MODELS), so removed models — dead-era sundial/timer_xl, 332
	// legacy rows in production — can never surface on the public leaderboard,
	// regardless of window. This tripwire pins that structural property
	// before someone "simplifies" the enumeration into a GROUP BY model_id.
	for (const days of [7, 30, 90]) {
		test(`days=${days}: leaderboard models == engine registry set, dead models absent, no duplicates`, async () => {
			const record = await getPublicTrackRecord(days);
			const ids = record.leaderboard.map((m) => m.modelId);

			expect(ids).not.toContain("sundial");
			expect(ids).not.toContain("timer_xl");
			expect(new Set(ids).size).toBe(ids.length);

			const expected = new Set([...getAllModels(), ...BASELINE_MODELS]);
			for (const id of ids) expect(expected.has(id)).toBe(true);
		});
	}

	test("methodology states the verified-only scoring caliber and the predictionCount denominator difference", async () => {
		const record = await getPublicTrackRecord(30);
		const m = record.methodology;
		expect(m.metric).toContain("status=verified");
		expect(m.metric).toContain("predictionCount");
	});
});
