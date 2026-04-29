import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Dashboard Pages', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('/dashboard - main dashboard loads', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    const text = await page.locator('body').textContent();
    expect(text!.length).toBeGreaterThan(50);
  });

  test('/dashboard/models - model accuracy page loads', async ({ page }) => {
    await page.goto('/dashboard/models');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('/dashboard/analysis - analysis page loads', async ({ page }) => {
    await page.goto('/dashboard/analysis');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('/dashboard/performance - performance page loads', async ({ page }) => {
    await page.goto('/dashboard/performance');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});
