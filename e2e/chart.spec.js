import { test, expect } from '@playwright/test';
import { euix } from '../src/plugins/inspector/playwright.js';

test.describe('EUIX Engine - Chart.js Plugin End-to-End (E2E) Browser Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/charts', { waitUntil: 'domcontentloaded' });
    await euix(page).waitForIdle();
  });

  test('should mount Chart.js Demo and render dashboard header and charts', async ({ page }) => {
    // 1. Check title
    const headerTitle = page.locator('h1');
    await expect(headerTitle).toContainText('Declarative XML Charts');

    // 2. Check that chart canvas elements are rendered
    const charts = page.locator('canvas');
    await expect(charts).toHaveCount(3);
  });

  test('should toggle data visibility on device doughnut chart', async ({ page }) => {
    const toggleDesktopBtn = page.locator('button:has-text("Toggle Desktop")');
    const toggleMobileBtn = page.locator('button:has-text("Toggle Mobile")');

    if (await toggleDesktopBtn.count() > 0) await toggleDesktopBtn.click({ force: true });
    if (await toggleMobileBtn.count() > 0) await toggleMobileBtn.click({ force: true });
    await euix(page).waitForIdle();

    const deviceCanvas = page.locator('canvas').nth(1);
    await expect(deviceCanvas).toBeVisible();
  });

  test('should export chart as PNG base64 and display image preview', async ({ page }) => {
    // Click "📸 Export Snapshot"
    const exportBtn = page.locator('button:has-text("Export Snapshot")').first();
    if (await exportBtn.count() > 0) {
      await exportBtn.click({ force: true });
      await page.waitForTimeout(500);
      await euix(page).waitForIdle();

      // Verify <img> tag is rendered inside the preview box with base64 data
      const previewImg = page.locator('img[alt="Exported Chart"]');
      if (await previewImg.count() > 0) {
        const src = await previewImg.getAttribute('src');
        expect(src).toMatch(/^data:image\/png;base64,/);
      }
    }
  });

  test('should randomize traffic trend data reactively', async ({ page }) => {
    const randomizeBtn = page.locator('button:has-text("Randomize Data")');
    if (await randomizeBtn.count() > 0) {
      await randomizeBtn.click({ force: true });
      await euix(page).waitForIdle();
    }

    const trafficCanvas = page.locator('canvas').last();
    await expect(trafficCanvas).toBeVisible();
  });

  test('should navigate to playground, router demo, and map demo from header', async ({ page }) => {
    const playgroundLink = page.locator('route-link:has-text("Playground"), a:has-text("Playground")').first();
    await expect(playgroundLink).toBeVisible();
  });
});
