import { test, expect } from '@playwright/test';

test.describe('Marketing Pages (No Auth Required)', () => {
  test('/landing - landing page renders', async ({ page }) => {
    await page.goto('/landing');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
    // Should have main content
    const content = await page.locator('body').textContent();
    expect(content!.length).toBeGreaterThan(100);
  });

  test('/about - about page renders', async ({ page }) => {
    await page.goto('/about');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });

  test('/pricing - pricing page renders', async ({ page }) => {
    await page.goto('/pricing');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});
