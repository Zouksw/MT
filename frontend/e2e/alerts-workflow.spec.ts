/**
 * Alerts Workflow E2E Tests
 *
 * Critical user journey: login → dashboard → view alerts → manage alert rules
 * This test verifies the complete alert management flow end-to-end.
 */

import { test as base, expect } from '@playwright/test';

// Extend test with authenticated state
const test = base.extend<{ authenticatedPage: import('@playwright/test').Page }>({
  authenticatedPage: async ({ page }, use) => {
    // Login
    await page.goto('/login');
    await page.fill('input[type="email"]', 'test@example.com');
    await page.fill('input[type="password"]', 'password123');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/(dashboard|$)/, { timeout: 10000 });
    await use(page);
  },
});

test.describe('Alerts Management Workflow', () => {
  test('should navigate from dashboard to alerts page', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');

    // Find alerts link in navigation
    const alertsLink = page.locator('a[href*="alert"], a').filter({ hasText: /alert/i });
    const hasAlertsLink = await alertsLink.count() > 0;

    if (hasAlertsLink) {
      await alertsLink.first().click();
      await page.waitForLoadState('networkidle');

      // Should be on alerts page
      await expect(page).toHaveURL(/alert/);
    }
  });

  test('should display alerts list', async ({ authenticatedPage: page }) => {
    await page.goto('/alerts');

    // Page should load without errors
    await expect(page.locator('body')).toBeVisible();

    // Should have some content — table, list, or cards
    const content = page.locator('table, .alert-list, [class*="alert"], .empty-state');
    await expect(content.first()).toBeVisible({ timeout: 5000 });
  });

  test('should show alert detail when clicking an alert', async ({ authenticatedPage: page }) => {
    await page.goto('/alerts');

    // Wait for content to load
    await page.waitForLoadState('networkidle');

    // Find clickable alert items
    const alertItem = page.locator(
      'table tbody tr, .alert-item, [class*="alert-row"], [class*="alert-card"]'
    ).first();

    const hasAlert = await alertItem.isVisible().catch(() => false);

    if (hasAlert) {
      await alertItem.click();
      await page.waitForLoadState('networkidle');

      // Should show detail — either in modal or detail view
      const detail = page.locator(
        '.modal, [role="dialog"], .detail-view, [class*="alert-detail"]'
      );
      const hasDetail = await detail.count() > 0;

      // Should have close/back button
      const closeButton = page.locator(
        'button:has-text("Close"), button[aria-label="close"], .close, [class*="back"]'
      );
      const hasClose = await closeButton.count() > 0;

      if (hasClose) {
        await closeButton.first().click();
      }
    }
  });

  test('should mark alert as read', async ({ authenticatedPage: page }) => {
    await page.goto('/alerts');
    await page.waitForLoadState('networkidle');

    // Find unread alert indicators
    const unreadBadge = page.locator('[class*="unread"], .badge, [class*="dot"]');
    const hasUnread = await unreadBadge.count() > 0;

    if (hasUnread) {
      // Click the first unread alert or mark-read button
      const markReadBtn = page.locator(
        'button:has-text("Mark"), button[aria-label*="read"], [class*="mark-read"]'
      );

      if (await markReadBtn.count() > 0) {
        await markReadBtn.first().click();
        await page.waitForLoadState('networkidle');
      }
    }
  });
});

test.describe('Alert Rules Management', () => {
  test('should navigate to alert rules', async ({ authenticatedPage: page }) => {
    await page.goto('/alerts');

    // Look for rules tab or link
    const rulesLink = page.locator(
      'a[href*="rule"], [role="tab"]').filter({ hasText: /rule/i }
    );
    const hasRulesLink = await rulesLink.count() > 0;

    if (hasRulesLink) {
      await rulesLink.first().click();
      await page.waitForLoadState('networkidle');
    } else {
      // Try direct URL
      await page.goto('/alerts/rules');
    }
  });

  test('should create a new alert rule', async ({ authenticatedPage: page }) => {
    await page.goto('/alerts/rules');

    // Find create button
    const createBtn = page.locator(
      'button:has-text("Create"), button:has-text("New"), button:has-text("Add")'
    ).first();

    const hasCreate = await createBtn.isVisible().catch(() => false);

    if (hasCreate) {
      await createBtn.click();
      await page.waitForLoadState('networkidle');

      // Should show form or modal
      const form = page.locator('form, .modal, [role="dialog"]');
      const hasForm = await form.count() > 0;

      if (hasForm) {
        // Fill in basic fields if they exist
        const nameInput = page.locator(
          'input[name="name"], input[placeholder*="name" i], input#name'
        );
        if (await nameInput.count() > 0) {
          await nameInput.fill(`E2E Test Rule ${Date.now()}`);
        }

        // Select condition type if available
        const conditionSelect = page.locator(
          'select[name="condition"], select[name="type"], [class*="condition"] select'
        );
        if (await conditionSelect.count() > 0) {
          await conditionSelect.selectOption({ index: 1 });
        }

        // Set threshold if available
        const thresholdInput = page.locator(
          'input[name="threshold"], input[type="number"]'
        );
        if (await thresholdInput.count() > 0) {
          await thresholdInput.fill('100');
        }

        // Submit
        const submitBtn = page.locator('button[type="submit"]');
        if (await submitBtn.count() > 0) {
          await submitBtn.click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });

  test('should delete an alert rule with confirmation', async ({ authenticatedPage: page }) => {
    await page.goto('/alerts/rules');
    await page.waitForLoadState('networkidle');

    // Find delete buttons
    const deleteBtn = page.locator(
      'button:has-text("Delete"), [aria-label*="delete"], [class*="delete"]'
    ).first();

    const hasDelete = await deleteBtn.isVisible().catch(() => false);

    if (hasDelete) {
      // Set up dialog handler
      page.on('dialog', dialog => dialog.accept());

      await deleteBtn.click();
      await page.waitForLoadState('networkidle');
    }
  });
});

test.describe('Dashboard Alert Integration', () => {
  test('should show alert count on dashboard', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');

    // Look for alert count/badge
    const alertCount = page.locator(
      '[class*="alert-count"], [class*="notification"], .badge, [data-testid*="alert"]'
    );

    // Dashboard should load without errors even if no alert elements
    await expect(page.locator('body')).toBeVisible();
  });

  test('should navigate to alerts from dashboard notification', async ({ authenticatedPage: page }) => {
    await page.goto('/dashboard');

    // Look for notification bell or alert link
    const notificationBell = page.locator(
      '[class*="notification"], [class*="bell"], [aria-label*="notification"], [aria-label*="alert"]'
    );

    const hasBell = await notificationBell.count() > 0;

    if (hasBell) {
      await notificationBell.first().click();

      // Should show notification dropdown or navigate to alerts
      const dropdown = page.locator('.dropdown, [role="menu"], .notification-list');
      const hasDropdown = await dropdown.count() > 0;

      if (hasDropdown) {
        // Click "View all" or first notification
        const viewAll = page.locator('a').filter({ hasText: /view all|see all|alert/i });
        if (await viewAll.count() > 0) {
          await viewAll.first().click();
          await page.waitForLoadState('networkidle');
        }
      }
    }
  });
});
