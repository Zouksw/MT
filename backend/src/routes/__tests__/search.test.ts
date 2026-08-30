/**
 * Global search route tests (round-146, v3.4.0 批 1/D15).
 *
 * Pins the topbar search contract: auth-gated, three whitelisted sources
 * (beef cut taxonomy incl. CJK names / commodities / published news only),
 * contains-match, empty-q returns empty sets rather than 4xx.
 */

import type { Express } from "express";
import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestApp, getAdminToken, requireDb } from "@/test/helpers/testApp";

let app: Express;
let token: string;

describe("GET /api/search", () => {
	beforeAll(async () => {
		app = createTestApp();
		await requireDb("search routes");
		token = await getAdminToken(app);
	});

	it("rejects unauthenticated requests (401)", async () => {
		const res = await request(app).get("/api/search?q=beef");
		expect(res.status).toBe(401);
	});

	it("returns empty sets (not 4xx) for empty or missing q", async () => {
		for (const qs of ["", "?q=", "?q=%20"]) {
			const res = await request(app)
				.get(`/api/search${qs}`)
				.set("Authorization", `Bearer ${token}`);
			expect(res.status).toBe(200);
			expect(res.body.data.cuts).toEqual([]);
			expect(res.body.data.commodities).toEqual([]);
			expect(res.body.data.news).toEqual([]);
		}
	});

	it("matches beef cuts by English and Chinese names", async () => {
		const en = await request(app)
			.get("/api/search?q=tongue")
			.set("Authorization", `Bearer ${token}`);
		expect(en.status).toBe(200);
		expect(en.body.data.cuts.some((c: { cutCode: string }) => c.cutCode === "TONGUE")).toBe(true);

		const zh = await request(app)
			.get("/api/search?q=%E7%89%9B%E8%88%8C") // 牛舌
			.set("Authorization", `Bearer ${token}`);
		expect(zh.body.data.cuts.some((c: { cutCode: string }) => c.cutCode === "TONGUE")).toBe(true);
	});

	it("matches commodities by slug (case-insensitive)", async () => {
		const res = await request(app)
			.get("/api/search?q=WHEAT")
			.set("Authorization", `Bearer ${token}`);
		expect(res.status).toBe(200);
		expect(res.body.data.commodities.some((c: { slug: string }) => c.slug.includes("wheat"))).toBe(
			true,
		);
	});

	it("matches published news by title", async () => {
		const res = await request(app)
			.get("/api/search?q=live%20cattle")
			.set("Authorization", `Bearer ${token}`);
		expect(res.status).toBe(200);
		expect(res.body.data.news.length).toBeGreaterThan(0);
		for (const n of res.body.data.news) {
			expect(n).toHaveProperty("id");
			expect(n).toHaveProperty("title");
			expect(n).toHaveProperty("publishedAt");
		}
	});

	it("caps each source at 5 results", async () => {
		// "beef" hits many rows across all three sources — none may exceed 5.
		const res = await request(app)
			.get("/api/search?q=beef")
			.set("Authorization", `Bearer ${token}`);
		expect(res.status).toBe(200);
		expect(res.body.data.cuts.length).toBeLessThanOrEqual(5);
		expect(res.body.data.commodities.length).toBeLessThanOrEqual(5);
		expect(res.body.data.news.length).toBeLessThanOrEqual(5);
	});
});
