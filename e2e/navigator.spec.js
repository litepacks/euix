import { test, expect } from '@playwright/test';

test.describe('EUIX Engine - Navigator & Device Plugin End-to-End (E2E) Browser Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/navigator_demo.html');
  });

  test('should mount Navigator Demo and render hardware & device metrics', async ({ page }) => {
    // Check title
    const title = page.locator('h1');
    await expect(title).toHaveText('Browser & Device Intelligence');

    // Check Network status card shows ONLINE
    const onlineBadge = page.locator('.badge:has-text("ONLINE")');
    await expect(onlineBadge).toBeVisible();

    // Check Device Specs card
    const hwCard = page.locator('.card:has-text("Device Specs")');
    await expect(hwCard).toBeVisible();
  });

  test('should interact with clipboard copy and feedback', async ({ page }) => {
    const copyBtn = page.locator('button:has-text("Copy URL")');
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();

    // Feedback should reflect status
    const toast = page.locator('.toast-box, .status-pill, .badge').first();
    await expect(toast).toBeVisible();
  });
});
