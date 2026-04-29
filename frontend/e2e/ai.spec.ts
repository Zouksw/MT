import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('AI Models Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('/ai/models - models list page loads', async ({ page }) => {
    await page.goto('/ai/models');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/ai/models');
  });

  test('/ai/predict - prediction page loads', async ({ page }) => {
    await page.goto('/ai/predict');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    // Should have form elements for prediction config
    const formElements = page.locator('select, .ant-select, input, button');
    expect(await formElements.count()).toBeGreaterThan(0);
  });

  test('/ai/anomalies - anomalies page loads', async ({ page }) => {
    await page.goto('/ai/anomalies');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});
