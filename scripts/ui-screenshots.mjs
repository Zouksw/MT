/**
 * UI screenshot harness — captures key MT pages for design before/after review.
 * Usage: node scripts/ui-screenshots.mjs [outdir] [tag]
 * Logs in as seeded admin via the frontend proxy so the HttpOnly auth cookie
 * lands in the Playwright browser context.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// Resolve Playwright through the frontend's own @playwright/test install so
// browser binaries (ms-playwright cache) are shared with `pnpm test:e2e`.
const require = createRequire("/root/frontend/package.json");
const { chromium } = require("@playwright/test");

const BASE = "http://localhost:3000";
const outDir = process.argv[2] ?? "/tmp/ui-before";
const tag = process.argv[3] ?? "before";
mkdirSync(outDir, { recursive: true });

const PAGES = [
	{ name: "landing", path: "/", auth: false },
	{ name: "login", path: "/login", auth: false },
	{ name: "dashboard", path: "/dashboard", auth: true },
	{ name: "beef", path: "/beef", auth: true },
	{ name: "ai-predict", path: "/ai/predict", auth: true },
	{ name: "trading", path: "/trading", auth: true },
];

const browser = await chromium.launch();
const context = await browser.newContext({
	viewport: { width: 1440, height: 900 },
	deviceScaleFactor: 1,
});

// Seed auth cookie through the frontend proxy (same origin => cookie stored),
// plus the localStorage `user` object the UI reads for logged-in state.
const loginRes = await context.request.post(`${BASE}/api/auth/login`, {
	data: { email: "admin@trademind.com", password: "Admin123!" },
});
const loginOk = loginRes.ok();
console.log("login:", loginRes.status());
if (loginOk) {
	const body = await loginRes.json();
	const u = body?.data?.user ?? {};
	const cachedUser = {
		id: u.id,
		email: u.email,
		name: u.name,
		avatar: u.avatarUrl ?? u.avatar,
		roles: [u.role].filter(Boolean),
	};
	await context.addInitScript(
		(user) => localStorage.setItem("user", JSON.stringify(user)),
		cachedUser,
	);
}

for (const p of PAGES) {
	if (p.auth && !loginOk) {
		console.log(`skip ${p.name} (no auth)`);
		continue;
	}
	const page = await context.newPage();
	try {
		await page.goto(`${BASE}${p.path}`, { waitUntil: "domcontentloaded" });
		await page.waitForTimeout(4000); // charts/SWR settle
		const file = join(outDir, `${p.name}-${tag}.png`);
		await page.screenshot({ path: file, fullPage: false });
		console.log(`ok ${p.name} -> ${file}`);
	} catch (e) {
		console.log(`fail ${p.name}: ${e.message.split("\n")[0]}`);
	} finally {
		await page.close();
	}
}

await browser.close();
