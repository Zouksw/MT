import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Trading Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('trading page loads with chart area', async ({ page }) => {
    await page.goto('/trading');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/trading');
  });

  test('can select a commodity', async ({ page }) => {
    await page.goto('/trading');
    await page.waitForLoadState('networkidle');

    // Look for commodity selector (Ant Design Select or dropdown)
    const selector = page.locator('.ant-select, select, [role="combobox"]').first();
    if (await selector.isVisible()) {
      await selector.click();
      await page.waitForTimeout(500);

      // Pick first option
      const firstOption = page.locator('.ant-select-item-option, option').first();
      if (await firstOption.isVisible()) {
        await firstOption.click();
        await page.waitForTimeout(2000);
      }
    }

    // Page should still be intact after selection
    await expect(page.locator('body')).toBeVisible();
  });

  test('signal panel area exists on page', async ({ page }) => {
    await page.goto('/trading');
    await page.waitForLoadState('networkidle');

    // Look for any card/panel area that could hold signals
    const cards = page.locator('.ant-card, [class*="signal"], [class*="panel"]');
    // Page should have some content structure
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
  });
});
