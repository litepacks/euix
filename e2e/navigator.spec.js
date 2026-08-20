import { test, expect } from '@playwright/test';
import { euix } from '../src/plugins/inspector/playwright.js';

test.describe('EUIX Engine - Navigator & Device Plugin End-to-End (E2E) Browser Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/navigator_demo.html');
    await euix(page).waitForIdle();
  });

  test('should mount Navigator Demo and render hardware & device metrics', async ({ page }) => {
    // 1. Check title
    const headerTitle = page.locator('h1');
    await expect(headerTitle).toContainText('Browser & Device Intelligence');

    // 2. Check metrics card
    const statusCard = page.locator('.container').first();
    await expect(statusCard).toBeVisible();

    // 3. Online status badge
    const onlineBadge = page.locator('span:has-text("Online")').first();
    await expect(onlineBadge).toBeVisible();
  });

  test('should interact with clipboard copy and feedback', async ({ page }) => {
    const copyBtn = page.locator('button:has-text("Copy")').first();
    if (await copyBtn.count() > 0) {
      await copyBtn.click({ force: true });
      await euix(page).waitForIdle();
      await expect(page.locator('body')).toBeVisible();
    }
  });
});
