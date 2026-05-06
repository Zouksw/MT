import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Settings Pages', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('/settings/profile - profile page loads', async ({ page }) => {
    await page.goto('/settings/profile');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('/settings/notifications - notifications settings loads', async ({ page }) => {
    await page.goto('/settings/notifications');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('/settings/billing - billing page loads', async ({ page }) => {
    await page.goto('/settings/billing');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('/settings/sessions - sessions page loads', async ({ page }) => {
    await page.goto('/settings/sessions');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });

  test('/apikeys - API keys page loads', async ({ page }) => {
    await page.goto('/apikeys');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});
