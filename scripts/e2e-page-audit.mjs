/**
 * E2E page audit — visits every frontend route in a real browser (logged in
 * as seeded admin through the same-origin proxy) and records per-page:
 *   - API responses with status >= 400 (broken frontend↔backend calls)
 *   - network-level request failures
 *   - whether the page rendered meaningful content vs an error boundary
 *
 * Usage: node scripts/e2e-page-audit.mjs
 */
import { createRequire } from "node:module";
const require = createRequire(
	"/root/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/package.json",
);
const { chromium } = require("playwright");

const BASE = "http://localhost:3000";

// Dynamic ids were created via the API in this audit session (e2e-audit-*
// records) so [id] routes resolve to real owned data.
const IDS = {
	apikey: "5aa82d39-ce8f-43e9-8682-559bafa68a74",
	dataset: "75d4d5e7-8419-4a59-b855-11ee787fc526",
	timeseries: "217d2abd-08bd-4bb0-ab7f-eb0d2b1b0b28",
	news: "e1b4fcc8-aff1-4a86-aca0-1fc1f2b2c5a3",
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
