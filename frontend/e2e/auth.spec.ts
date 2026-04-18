import { test, expect } from '@playwright/test';

test.describe('Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Visit login page
    await page.goto('/login');
  });

  test('should display login form', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/login|sign in/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should show validation errors for empty fields', async ({ page }) => {
    // Try to submit without filling fields
    await page.click('button[type="submit"]');

    // Should show validation messages
    const errorMessage = page.locator('text=/email is required|required/i');
    await expect(errorMessage).toBeVisible();
  });

  test('should show error for invalid credentials', async ({ page }) => {
    // Fill in invalid credentials
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');

    // Submit form
    await page.click('button[type="submit"]');

    // Should show error message
    const errorMessage = page.locator('text=/invalid credentials|email or password incorrect/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test('should navigate to register page', async ({ page }) => {
    // Click register link
    const registerLink = page.locator('a').filter({ hasText: /register|sign up/i });
    await registerLink.click();

    // Should be on register page
    await expect(page).toHaveURL(/\/register/);
    await expect(page.locator('h1, h2')).toContainText(/register|sign up/i);
  });

  test('should successfully login and redirect to dashboard', async ({ page }) => {
    // Note: This test requires a test user to exist in the database
    // For CI/CD, consider seeding test data before running tests

    // Fill in credentials (adjust with test user credentials)
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to dashboard or home
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('should logout successfully', async ({ page }) => {
    // First login
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for navigation
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Find and click logout button/menu
    const logoutButton = page.locator('button').filter({ hasText: /logout|sign out/i });
    await logoutButton.click();

    // Should redirect to login page
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe('Registration Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('should display registration form', async ({ page }) => {
    await expect(page.locator('h1, h2')).toContainText(/register|sign up/i);
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should validate password match', async ({ page }) => {
    // Check if there's a confirm password field
    const confirmPasswordInput = page.locator('input[name="confirmPassword"], input[name="confirm_password"]');
    if (await confirmPasswordInput.count() > 0) {
      await page.fill('input[type="email"]', 'new@example.com');
      await page.fill('input[type="password"]', 'password123');
      await confirmPasswordInput.fill('different123');

      await page.click('button[type="submit"]');

      // Should show password mismatch error
      const errorMessage = page.locator('text=/passwords do not match|password mismatch/i');
      await expect(errorMessage).toBeVisible();
    }
  });

  test('should register new user successfully', async ({ page }) => {
    // Generate unique email
    const uniqueEmail = `test-${Date.now()}@example.com`;

    await page.fill('input[type="email"]', uniqueEmail);
    await page.fill('input[type="password"]', 'password123');

    // Submit form
    await page.click('button[type="submit"]');

    // Should redirect to dashboard or show success message
    await expect(page).toHaveURL('/', { timeout: 10000 });
  });

  test('should show error for duplicate email', async ({ page }) => {
    // Try to register with existing email
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');

    await page.click('button[type="submit"]');

    // Should show error
    const errorMessage = page.locator('text=/email already exists|user already registered/i');
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Protected Routes', () => {
  test('should redirect unauthenticated users to login', async ({ page }) => {
    // Try to access a protected route
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL(/\/login/);
  });

  test('should allow authenticated users to access protected routes', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Wait for successful login
    await expect(page).toHaveURL('/', { timeout: 10000 });

    // Now try to access protected route
    await page.goto('/dashboard');

    // Should be able to access it
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
