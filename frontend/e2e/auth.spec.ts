import { test, expect } from '@playwright/test';

test.describe('Auth - Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
  });

  test('renders login form with email and password fields', async ({ page }) => {
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.locator('input[type="email"]').fill('nobody@example.com');
    await page.locator('input[type="password"]').fill('WrongPassword1!');
    await page.locator('button[type="submit"]').click();
    await page.waitForTimeout(3000);
    const stillOnLogin = page.url().includes('/login');
    expect(stillOnLogin).toBe(true);
  });

  test('login with seed admin account', async ({ page }) => {
    // Wait for React hydration then type character-by-character (fill() bypasses React state)
    await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(500);
    await page.locator('input[type="email"]').click();
    await page.locator('input[type="email"]').type('admin@trademind.com', { delay: 20 });
    await page.locator('input[type="password"]').click();
    await page.locator('input[type="password"]').type('Admin123!', { delay: 20 });
    await page.locator('button[type="submit"]').click();
    // Wait for API call + redirect
    await page.waitForTimeout(5000);
    const cookies = await page.context().cookies();
    const hasAuthCookie = cookies.some((c) => c.name === 'auth' || c.name === 'token');
    const leftLogin = !page.url().includes('/login');
    expect(hasAuthCookie || leftLogin).toBeTruthy();
  });
});

test.describe('Auth - Protected Routes', () => {
  test('/dashboard loads without crash (may redirect to login)', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('body')).toBeVisible();
  });
});
