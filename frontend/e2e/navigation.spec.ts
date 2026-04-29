import { test, expect } from '@playwright/test';
import { loginAsAdmin } from './helpers/auth';

test.describe('Public Navigation', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/landing');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/landing');
  });

  test('about page loads', async ({ page }) => {
    await page.goto('/about');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('pricing page loads', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('login page loads', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('#email, input[name="email"]')).toBeVisible();
  });

  test('404 page handles gracefully', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-xyz');
    // Next.js returns 404 but page should still render
    await expect(page.locator('body')).toBeVisible();
  });
});

test.describe('Authenticated Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
  });

  test('page renders after login', async ({ page }) => {
    // Dashboard should have content
    const text = await page.locator('body').textContent();
    expect(text!.length).toBeGreaterThan(50);
  });

  test('can navigate to dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/dashboard');
  });

  test('can navigate to trading page', async ({ page }) => {
    await page.goto('/trading');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/trading');
  });

  test('mobile viewport does not crash', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});
