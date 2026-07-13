/**
 * Market News Service — unit tests for the ownership + slug logic.
 *
 * The route integration test (marketNews.test.ts) drives the admin token end
 * to end against a real DB. What it does NOT cover is the two-user ownership
 * gate at the heart of getManagedNews(): "author OR ADMIN may edit; anyone
 * else sees NotFound (not Forbidden, to avoid leaking existence)". The route
 * test can't exercise that because it only has an admin token.
 *
 * These tests mock prisma.marketNews so we can vary authorId / callerId /
 * callerRole freely and assert the ownership truth table in isolation. Also
 * covers slugifyTitle (pure) and createNews's duplicate-slug guard.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoist the mock fns so the vi.mock factory (hoisted above imports) can see them.
const mocks = vi.hoisted(() => ({
	findUnique: vi.fn(),
	findFirst: vi.fn(),
	create: vi.fn(),
	update: vi.fn(),
	delete: vi.fn(),
}));
vi.mock("@/lib", () => ({
	prisma: { marketNews: { ...mocks } },
}));
// BadRequestError / NotFoundError are real classes — import actual so instanceof
// and the status code (400 / 404) are exercised, not re-implemented in the test.
vi.mock("@/middleware/errorHandler", async () => {
	const actual = await vi.importActual<typeof import("@/middleware/errorHandler")>(
		"@/middleware/errorHandler",
	);
	return { ...actual };
});

import { BadRequestError, NotFoundError } from "@/middleware/errorHandler";
import { createNews, deleteNews, slugifyTitle, updateNews } from "@/services/marketNewsService";

const AUTHOR = "user-author";
const OTHER_EDITOR = "user-other-editor";
const ADMIN = "user-admin";
const POST_ID = "post-1";

/** A news row shape that getManagedNews selects (id/authorId/slug). */
function ownedBy(authorId: string) {
	return { id: POST_ID, authorId, slug: "existing-slug" };
}

beforeEach(() => {
	vi.clearAllMocks();
});

describe("slugifyTitle", () => {
	it("lowercases and hyphenates ASCII titles", () => {
		expect(slugifyTitle("Brazil Beef Outlook 2026")).toBe("brazil-beef-outlook-2026");
	});

	it("preserves CJK characters (the [^...] range keeps \u4e00-\u9fff)", () => {
		// News titles on this platform are Chinese-language; the slugifier must
		// not strip them. A regression to /[^a-z0-9]+/ would blank this out.
		expect(slugifyTitle("中国牛肉市场")).toBe("中国牛肉市场");
	});

	it("collapses runs of non-alphanumerics into a single hyphen", () => {
		expect(slugifyTitle("Prices   &   Supply!!!")).toBe("prices-supply");
	});

	it("trims leading/trailing hyphens", () => {
		expect(slugifyTitle("  --spaced--  ")).toBe("spaced");
	});
});

describe("ownership gate (getManagedNews via updateNews/deleteNews)", () => {
	it("allows the AUTHOR to update their own post", async () => {
		mocks.findUnique.mockResolvedValueOnce(ownedBy(AUTHOR));
		mocks.update.mockResolvedValueOnce({ id: POST_ID, authorId: AUTHOR });

		// Should NOT throw. A thrown NotFoundError here means ownership failed.
		await expect(updateNews(POST_ID, AUTHOR, "EDITOR", { summary: "new" })).resolves.toBeDefined();
		expect(mocks.update).toHaveBeenCalledTimes(1);
	});

	it("allows an ADMIN to update someone else's post", async () => {
		mocks.findUnique.mockResolvedValueOnce(ownedBy(AUTHOR));
		mocks.update.mockResolvedValueOnce({ id: POST_ID, authorId: AUTHOR });

		await expect(
			updateNews(POST_ID, ADMIN, "ADMIN", { summary: "admin edit" }),
		).resolves.toBeDefined();
		expect(mocks.update).toHaveBeenCalledTimes(1);
	});

	it("DENIES a non-author EDITOR with NotFound (not Forbidden, not data)", async () => {
		// This is the core security property: an editor editing another editor's
		// post must not learn the post exists. getManagedNews returns null → the
		// service throws NotFoundError. Crucially, prisma.update is never called.
		mocks.findUnique.mockResolvedValueOnce(ownedBy(AUTHOR));

		await expect(
			updateNews(POST_ID, OTHER_EDITOR, "EDITOR", { summary: "snooping" }),
		).rejects.toBeInstanceOf(NotFoundError);
		expect(mocks.update).not.toHaveBeenCalled();
	});

	it("DENIES a non-author VIEWER with NotFound", async () => {
		mocks.findUnique.mockResolvedValueOnce(ownedBy(AUTHOR));
		await expect(deleteNews(POST_ID, OTHER_EDITOR, "VIEWER")).rejects.toBeInstanceOf(NotFoundError);
		expect(mocks.delete).not.toHaveBeenCalled();
	});

	it("reports NotFound when the post does not exist at all", async () => {
		mocks.findUnique.mockResolvedValueOnce(null);
		await expect(deleteNews(POST_ID, AUTHOR, "EDITOR")).rejects.toBeInstanceOf(NotFoundError);
	});
});

describe("createNews — duplicate slug guard", () => {
	it("throws BadRequestError when the slugified title already exists", async () => {
		// findUnique is used twice in createNews: first the duplicate check,
		// then (if it proceeds) Prisma's create. Returning a truthy row from
		// the first call must short-circuit to BadRequest before create runs.
		mocks.findUnique.mockResolvedValueOnce({ id: "existing" }); // duplicate

		await expect(
			createNews(AUTHOR, {
				title: "Duplicate Title",
				summary: "s",
				body: "b",
				category: "MARKET_INSIGHT",
				source: "src",
			}),
		).rejects.toBeInstanceOf(BadRequestError);
		expect(mocks.create).not.toHaveBeenCalled();
	});

	it("creates the post when the title is unique", async () => {
		mocks.findUnique.mockResolvedValueOnce(null); // no duplicate
		mocks.create.mockResolvedValueOnce({
			id: "new-1",
			title: "Fresh Title",
			slug: "fresh-title",
			author: { id: AUTHOR, name: "Author" },
		});

		const created = await createNews(AUTHOR, {
			title: "Fresh Title",
			summary: "s",
			body: "b",
			category: "MARKET_INSIGHT",
			source: "src",
		});
		expect(created.id).toBe("new-1");
		expect(mocks.create).toHaveBeenCalledTimes(1);
	});
});
