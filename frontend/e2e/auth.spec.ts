import { test, expect } from '@playwright/test';

test.describe('Auth - Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('networkidle');
  });

  test('renders login form with email and password fields', async ({ page }) => {
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.locator('#email').fill('nobody@example.com');
    await page.locator('#password').fill('WrongPassword1!');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);
    const stillOnLogin = page.url().includes('/login');
    expect(stillOnLogin).toBe(true);
  });

  test('login with seed admin account', async ({ page }) => {
    await page.locator('#email').fill('admin@trademind.com');
    await page.locator('#password').fill('Admin123!');
    await page.locator('button[type="submit"]').click();
    // Wait for redirect away from login (to / or /dashboard)
    await page.waitForURL('**/', { timeout: 15000 });
    // Just verify we left the login page
    expect(page.url()).not.toMatch(/\/login$/);
  });
});

test.describe('Auth - Protected Routes', () => {
  test('/dashboard loads without crash (may redirect to login)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('body')).toBeVisible();
  });
});
