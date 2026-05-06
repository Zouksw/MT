import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('AI Models Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('/ai/models - models list page loads', async ({ page }) => {
    await page.goto('/ai/models');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('/ai/predict - prediction page loads', async ({ page }) => {
    await page.goto('/ai/predict');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('/ai/anomalies - anomalies page loads', async ({ page }) => {
    await page.goto('/ai/anomalies');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});
