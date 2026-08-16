/**
 * Integration coverage for endpoints added by the round-107 e2e page audit.
 *
 * Each of these pages had been calling an endpoint that never existed, so
 * the page was permanently broken: /timeseries/create (POST /api/timeseries),
 * /apikeys/show + /apikeys/edit (GET/PATCH /api/api-keys/:id), and
 * /alerts/show (GET /api/alerts/:id).
 */
import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { createTestApp, getAdminToken, getPrisma, requireDb } from "@/test/helpers/testApp";

const TEST_PREFIX = `audit-${Date.now()}`;

let app: Express;
const prisma = getPrisma();

describe("Round-107 page-audit endpoints", () => {
	let adminToken: string;
	let userBToken: string;
	let userBId: string;
	let datasetId: string;
	let timeseriesId: string;
	let apiKeyId: string;

	beforeAll(async () => {
		app = createTestApp();
		await requireDb("page-audit-endpoints");
		adminToken = await getAdminToken(app);

		// Second user for ownership scoping assertions.
		const email = `${TEST_PREFIX}-b@example.com`;
		await request(app).post("/api/auth/register").send({
			email,
			password: "Password123!",
			name: "Audit User B",
		});
		const login = await request(app)
			.post("/api/auth/login")
			.send({ email, password: "Password123!" });
		userBToken = login.body?.data?.token ?? login.body?.token;
		const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${userBToken}`);
		userBId = me.body?.data?.user?.id ?? me.body?.user?.id;

		// Owned dataset for the timeseries flow.
		const ds = await request(app)
			.post("/api/datasets")
			.set("Authorization", `Bearer ${adminToken}`)
			.send({
				name: "Audit Dataset",
				slug: `${TEST_PREFIX}-ds`,
				storageFormat: "TIMESERIES",
			});
		datasetId = ds.body.data.id;
	});

	afterAll(async () => {
		try {
			await prisma.user.deleteMany({ where: { email: { startsWith: TEST_PREFIX } } });
			await prisma.dataset.deleteMany({ where: { slug: { startsWith: TEST_PREFIX } } });
		} catch {
			/* ignore cleanup errors */
		}
	});

	describe("POST /api/timeseries (create under owned dataset)", () => {
		test("creates a timeseries for the dataset owner", async () => {
			const res = await request(app)
				.post("/api/timeseries")
				.set("Authorization", `Bearer ${adminToken}`)
				.send({
					datasetId,
					name: "Audit Series",
					slug: `${TEST_PREFIX}-ts`,
					unit: "USD/kg",
				});

			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.data.slug).toBe(`${TEST_PREFIX}-ts`);
			timeseriesId = res.body.data.id;
		});

		test("404s for a dataset owned by someone else (no existence disclosure)", async () => {
			const res = await request(app)
				.post("/api/timeseries")
				.set("Authorization", `Bearer ${userBToken}`)
				.send({ datasetId, name: "Stolen", slug: `${TEST_PREFIX}-ts-b` });

			expect(res.status).toBe(404);
		});

		test("400 on duplicate slug within the dataset", async () => {
			const res = await request(app)
				.post("/api/timeseries")
				.set("Authorization", `Bearer ${adminToken}`)
				.send({ datasetId, name: "Dup", slug: `${TEST_PREFIX}-ts` });

			expect(res.status).toBe(400);
		});

		test("400 on invalid slug charset", async () => {
			const res = await request(app)
				.post("/api/timeseries")
				.set("Authorization", `Bearer ${adminToken}`)
				.send({ datasetId, name: "Bad", slug: "Not Valid!" });

			expect(res.status).toBe(400);
		});
	});

	describe("GET+PATCH /api/api-keys/:id (show/edit pages)", () => {
		beforeAll(async () => {
			const res = await request(app)
				.post("/api/api-keys")
				.set("Authorization", `Bearer ${adminToken}`)
				.send({ name: `${TEST_PREFIX}-key` });
			apiKeyId = res.body.data.id;
		});

		test("GET returns safe fields for the owner (never the raw key)", async () => {
			const res = await request(app)
				.get(`/api/api-keys/${apiKeyId}`)
				.set("Authorization", `Bearer ${adminToken}`);

			expect(res.status).toBe(200);
			expect(res.body.data.id).toBe(apiKeyId);
			expect(res.body.data).toHaveProperty("lastCharacters");
			expect(res.body.data).not.toHaveProperty("key");
			expect(res.body.data).not.toHaveProperty("keyHash");
		});

		test("GET 404s for another user's key", async () => {
			const res = await request(app)
				.get(`/api/api-keys/${apiKeyId}`)
				.set("Authorization", `Bearer ${userBToken}`);

			expect(res.status).toBe(404);
		});

		test("PATCH renames and returns updated safe fields", async () => {
			const res = await request(app)
				.patch(`/api/api-keys/${apiKeyId}`)
				.set("Authorization", `Bearer ${adminToken}`)
				.send({ name: `${TEST_PREFIX}-key-renamed`, isActive: false });

			expect(res.status).toBe(200);
			expect(res.body.data.name).toBe(`${TEST_PREFIX}-key-renamed`);
			expect(res.body.data.isActive).toBe(false);
		});

		test("PATCH rejects an empty name", async () => {
			const res = await request(app)
				.patch(`/api/api-keys/${apiKeyId}`)
				.set("Authorization", `Bearer ${adminToken}`)
				.send({ name: "" });

			expect(res.status).toBe(400);
		});
	});

	describe("GET /api/alerts/:id (show page)", () => {
		test("requires authentication", async () => {
			const res = await request(app).get(`/api/alerts/00000000-0000-0000-0000-000000000000`);
			expect(res.status).toBe(401);
		});

		test("404s for a missing id without leaking existence", async () => {
			const res = await request(app)
				.get(`/api/alerts/00000000-0000-0000-0000-000000000000`)
				.set("Authorization", `Bearer ${adminToken}`);

			expect(res.status).toBe(404);
		});

		test("does not swallow /stats or /rules literal routes", async () => {
			const stats = await request(app)
				.get("/api/alerts/stats")
				.set("Authorization", `Bearer ${adminToken}`);
			expect(stats.status).toBe(200);

			const rules = await request(app)
				.get("/api/alerts/rules")
				.set("Authorization", `Bearer ${adminToken}`);
			expect(rules.status).toBe(200);
		});
	});

	// Reference timeseriesId so the linter doesn't flag read-only usage above.
	test("timeseries id captured", () => {
		expect(typeof timeseriesId).toBe("string");
		expect(typeof userBId).toBe("string");
	});
});
