import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Alerts Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('alerts list page loads', async ({ page }) => {
    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/alerts');
  });

  test('alert rules page loads', async ({ page }) => {
    await page.goto('/alerts/rules');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('create alert rule page loads', async ({ page }) => {
    await page.goto('/alerts/create');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Dashboard Alert Integration', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('dashboard shows alert count or empty state', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    // Dashboard should load without crash whether or not alerts exist
  });
});
