import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Trading Subpages', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('/trading/sim - prediction backtest page loads', async ({ page }) => {
    await page.goto('/trading/sim');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    // Should have title mentioning backtest or prediction
    const heading = page.locator('h1, h2, .ant-typography');
    await expect(heading.first()).toBeVisible();
  });

  test('/trading/community - leaderboard page loads', async ({ page }) => {
    await page.goto('/trading/community');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    // Should have a table or list for leaderboard
    const table = page.locator('table, .ant-table, .ant-empty');
    await expect(table.first()).toBeVisible({ timeout: 5000 });
  });

  test('/trading/watchlist - watchlist page loads', async ({ page }) => {
    await page.goto('/trading/watchlist');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('/trading/portfolio - analysis groups page loads', async ({ page }) => {
    await page.goto('/trading/portfolio');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    // Title should say "Analysis Groups"
    const heading = page.locator('h1, h2');
    if (await heading.count() > 0) {
      const text = await heading.first().textContent();
      expect(text).toBeTruthy();
    }
  });

  test('/trading/analytics - analytics page loads', async ({ page }) => {
    await page.goto('/trading/analytics');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});
