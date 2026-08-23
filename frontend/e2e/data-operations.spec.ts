import { expect, test } from "@playwright/test";
import { loginAsAdmin } from "./helpers/auth";

test.describe("Datasets Page", () => {
	test.beforeEach(async ({ page }) => {
		await loginAsAdmin(page);
	});

	test("datasets page loads without crash", async ({ page }) => {
		await page.goto("/datasets");
		await page.waitForLoadState("domcontentloaded");
		await expect(page.locator("body")).toBeVisible();
	});

	test("timeseries page loads", async ({ page }) => {
		await page.goto("/timeseries");
		await page.waitForLoadState("domcontentloaded");
		await expect(page.locator("body")).toBeVisible();
	});
});
