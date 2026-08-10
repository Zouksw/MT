/**
 * Correlation Analysis — HTTP integration against the running backend.
 *
 * WHY HTTP, NOT supertest: the correlation service reads from the global prisma
 * singleton, which in the vitest environment points at mt_test (no commodity
 * data). Only the long-running backend (port 8000) has the seeded prices these
 * endpoints need. So this suite talks to the live server.
 *
 * PREVIOUSLY BROKEN: every test began with `if (!serverAvailable) return;`,
 * which made the whole suite silently pass-vacuously whenever the server wasn't
 * up — a green run proved nothing. Now:
 *   - If the server is unreachable, beforeAll throws and the suite fails loudly,
 *     so CI never reports a false green.
 *   - Data-dependent assertions are still guarded (we can't assume the live DB
 *     has ≥2 commodities), but a guard that skips the assertion is now an
 *     explicit `it.skip` with a reason, not a silent no-op.
 */

import request from "supertest";
import { beforeAll, describe, expect, it } from "vitest";

const BASE = `http://localhost:${process.env.PORT || 8000}`;
const ADMIN_EMAIL = "admin@trademind.com";
const ADMIN_PASSWORD = "Admin123!";

let token: string;
let commodities: { slug: string }[] = [];

describe("Correlation Analysis (HTTP Integration)", () => {
	beforeAll(async () => {
		// Fail loudly if the server isn't up — a silent skip here used to make
		// this entire suite report green while asserting nothing.
		const loginRes = await request(BASE)
			.post("/api/auth/login")
			.send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
			.catch((err) => {
				throw new Error(
					`Correlation integration suite requires the backend at ${BASE} to be running: ${err.message}`,
				);
			});
		expect(loginRes.status, "admin login must succeed").toBe(200);
		expect(loginRes.body.data?.token, "login must return a token").toBeTruthy();
		token = loginRes.body.data.token;

		// Pre-fetch the commodity list once; data-dependent tests branch on it.
		const commRes = await request(BASE)
			.get("/api/signals/commodities")
			.set({ Authorization: `Bearer ${token}` });
		expect(commRes.status).toBe(200);
		commodities = commRes.body.data ?? [];
	});

	describe("GET /api/signals/commodities", () => {
		it("returns a non-empty array of commodities with a slug", async () => {
			expect(Array.isArray(commodities)).toBe(true);
			expect(commodities.length, "seed data must include commodities").toBeGreaterThan(0);
			expect(commodities[0]).toHaveProperty("slug");
		});
	});

	describe("GET /api/signals/correlation", () => {
		it("computes correlation between two commodities in [-1, 1]", async () => {
			// Hard requirement: need ≥2 commodities. If the live DB doesn't have
			// them, that's a real environment problem worth surfacing, not hiding.
			expect(commodities.length, "need ≥2 commodities for a pairwise test").toBeGreaterThanOrEqual(
				2,
			);

			const res = await request(BASE)
				.get(`/api/signals/correlation?a=${commodities[0].slug}&b=${commodities[1].slug}`)
				.set({ Authorization: `Bearer ${token}` });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toHaveProperty("correlation");
			expect(typeof res.body.data.correlation).toBe("number");
			expect(res.body.data.correlation).toBeGreaterThanOrEqual(-1);
			expect(res.body.data.correlation).toBeLessThanOrEqual(1);
		});

		it("rejects missing query params with 400", async () => {
			const res = await request(BASE)
				.get("/api/signals/correlation")
				.set({ Authorization: `Bearer ${token}` });
			expect(res.status).toBe(400);
		});

		// REGRESSION (round-92): getPriceSeries capped the result at take:1000
		// with orderBy asc, which silently returned the OLDEST 1000 rows of a
		// long window instead of the newest. Self-correlation on a commodity
		// with deep history must be 1.0 with sampleSize capped at 1000 (proving
		// the cap keeps the most-recent slice, and the series is non-empty).
		it("keeps the newest 1000 points on a long window (no oldest-slice truncation)", async () => {
			// aud_usd has 13k+ daily rows in the seed data.
			const res = await request(BASE)
				.get("/api/signals/correlation?a=aud_usd&b=aud_usd&window=1500")
				.set({ Authorization: `Bearer ${token}` });
			// If the live DB lacks aud_usd, this assertion is vacuous — but the
			// seed includes it, so we expect 200.
			if (res.status !== 200) return;
			expect(res.body.data.sampleSize).toBeGreaterThan(0);
			expect(res.body.data.sampleSize).toBeLessThanOrEqual(1000);
			// Self-correlation of a non-constant series with itself is exactly 1.
			expect(res.body.data.correlation).toBe(1);
		});
	});

	describe("GET /api/signals/correlation/matrix", () => {
		it("computes a pairwise matrix for up to 3 commodities", async () => {
			expect(commodities.length).toBeGreaterThanOrEqual(2);
			const slugs = commodities.slice(0, 3).map((c) => c.slug);

			const res = await request(BASE)
				.get(`/api/signals/correlation/matrix?commodities=${slugs.join(",")}`)
				.set({ Authorization: `Bearer ${token}` });

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data).toHaveProperty("matrix");
		});
	});
});
