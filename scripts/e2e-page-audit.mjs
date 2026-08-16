/**
 * E2E page audit — visits every frontend route in a real browser (logged in
 * as seeded admin through the same-origin proxy) and records per-page:
 *   - API responses with status >= 400 (broken frontend↔backend calls)
 *   - network-level request failures
 *   - whether the page rendered meaningful content vs an error boundary
 *
 * net::ERR_ABORTED on page routes is Next.js prefetch cancellation (normal).
 *
 * PREREQUISITE: [id] routes need owned fixtures; create via the proxy before
 * running (they are deliberately deleted after each audit session):
 *   login:   POST /api/auth/login {"email":"admin@trademind.com","password":"Admin123!"}
 *   apikey:  POST /api/api-keys   {"name":"e2e-audit-key"}
 *   dataset: POST /api/datasets   {"name":"e2e-audit-ds","slug":"e2e-audit-ds","source":"MANUAL","storageFormat":"TIMESERIES","frequency":"DAILY","isPublic":false}
 *   series:  POST /api/timeseries {"datasetId":"<ds>","name":"ts","slug":"e2e-audit-ts"}
 *   news:    POST /api/news       {"title":"t","summary":"s","body":"b","source":"MANUAL","category":"MARKET_INSIGHT","status":"published"}
 *   alert:   prisma insert (Alert row owned by admin, timeseriesId from above)
 * then paste the returned ids into IDS below.
 *
 * Usage: node scripts/e2e-page-audit.mjs
 */
import { createRequire } from "node:module";
// Resolve Playwright through the frontend's own @playwright/test install so
// browser binaries (ms-playwright cache) are shared with `pnpm test:e2e`.
const require = createRequire("/root/frontend/package.json");
const { chromium } = require("@playwright/test");

const BASE = "http://localhost:3000";

// Dynamic ids were created via the API in this audit session (e2e-audit-*
// records) so [id] routes resolve to real owned data.
const IDS = {
	apikey: "32ecf017-979e-49dc-85c6-7fea752b0f32",
	dataset: "240ef912-fbab-4261-8a0c-78d148be7111",
	timeseries: "cd4eb271-5a1a-468f-b6d9-7fda05d85b3f",
	news: "e56614d3-c2b0-4b38-b806-36c7aba8ebf3",
	rule: "76d4a48d-df4a-4e46-8506-fac995052e4f",
	alert: "b85e992b-a14b-4fef-957c-7dcfeb041469",
	cut: "BRISKET_NAVEL",
	// No model row is owned by the audit user; synthetic uuid probes the
	// graceful-404 path instead.
	model: "00000000-0000-0000-0000-000000000000",
};

const ROUTES = [
	"/", "/ai", "/ai/accuracy", "/ai/anomalies", "/ai/backtest", "/ai/models",
	"/ai/predict", "/alerts", "/alerts/rules", "/apikeys", "/beef",
	"/beef/factories", "/beef/import", "/dashboard", "/dashboard/analysis",
	"/dashboard/analysis/origin", "/dashboard/models", "/dashboard/performance",
	"/datasets", "/landing", "/login", "/about", "/pricing", "/market-news",
	"/market-news/create", "/register", "/settings", "/settings/billing",
	"/settings/data-sources", "/settings/notifications", "/settings/profile",
	"/settings/sessions", "/timeseries", "/timeseries/create", "/trading",
	`/ai/accuracy/${IDS.model}`,
	`/alerts/show/${IDS.alert}`,
	`/apikeys/edit/${IDS.apikey}`,
	`/apikeys/show/${IDS.apikey}`,
	`/beef/cuts/${IDS.cut}`,
	`/datasets/show/${IDS.dataset}`,
	`/market-news/edit/${IDS.news}`,
	`/market-news/show/${IDS.news}`,
	`/timeseries/edit/${IDS.timeseries}`,
];

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });

const loginRes = await context.request.post(`${BASE}/api/auth/login`, {
	data: { email: "admin@trademind.com", password: "Admin123!" },
});
if (!loginRes.ok()) throw new Error(`login failed: ${loginRes.status()}`);
const body = await loginRes.json();
const u = body?.data?.user ?? {};
await context.addInitScript(
	(user) => localStorage.setItem("user", JSON.stringify(user)),
	{ id: u.id, email: u.email, name: u.name, avatar: u.avatarUrl, roles: [u.role].filter(Boolean) },
);

const results = [];
for (const route of ROUTES) {
	const page = await context.newPage();
	const apiErrors = [];
	const netErrors = [];
	const onRes = (r) => {
		if (r.url().includes("/api/") && r.status() >= 400) {
			apiErrors.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname + new URL(r.url()).search}`);
		}
	};
	const onFail = (r) => {
		if (!r.url().startsWith("data:")) netErrors.push(`${new URL(r.url()).pathname} ${r.failure()?.errorText ?? ""}`);
	};
	page.on("response", onRes);
	page.on("requestfailed", onFail);
	let ok = true;
	let text = "";
	try {
		const resp = await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded", timeout: 15000 });
		ok = !!resp?.ok();
		await page.waitForTimeout(2500);
		text = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").trim());
	} catch (e) {
		ok = false;
		netErrors.push(`goto: ${e.message.split("\n")[0]}`);
	}
	page.off("response", onRes);
	page.off("requestfailed", onFail);
	await page.close();
	results.push({ route, ok, apiErrors, netErrors, textLen: text.length });
	const flag = !ok || apiErrors.length || netErrors.length ? "⚠" : "✓";
	console.log(
		`${flag} ${route} page:${ok ? "200" : "ERR"} text:${text.length}` +
			(apiErrors.length ? ` api:[${apiErrors.join(" | ")}]` : "") +
			(netErrors.length ? ` net:[${netErrors.slice(0, 2).join(" | ")}]` : ""),
	);
}

await browser.close();
const bad = results.filter((r) => !r.ok || r.apiErrors.length || r.netErrors.length);
console.log(`\nSUMMARY: ${results.length - bad.length}/${results.length} clean, ${bad.length} with findings`);
for (const b of bad) console.log(`  ${b.route}: api=${b.apiErrors.length} net=${b.netErrors.length}`);
