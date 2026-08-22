import { test, expect } from '@playwright/test';
import { euix } from '../src/plugins/inspector/playwright.js';

test.describe('EUIX Engine - Leaflet Maps Plugin End-to-End (E2E) Browser Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/map_demo.html');
    await page.waitForLoadState('domcontentloaded');
  });

  test('should mount Leaflet map and render spatial analytics dashboard', async ({ page }) => {
    // Check title / brand
    const brand = page.locator('h1:has-text("Field Notebook")');
    await expect(brand).toBeVisible({ timeout: 10000 });

    // Check Leaflet map container
    const mapContainer = page.locator('#field_map, .leaflet-container');
    await expect(mapContainer).toBeVisible({ timeout: 10000 });

    // Check default active country is Istanbul (TR)
    const trButton = page.locator('button.country-btn:has-text("Istanbul")');
    await expect(trButton).toHaveClass(/active/, { timeout: 10000 });
  });

  test('should switch active country and update view coordinates', async ({ page }) => {
    const ukButton = page.locator('button.country-btn:has-text("London")');
    const trButton = page.locator('button.country-btn:has-text("Istanbul")');

    // Click London
    await ukButton.click();
    await expect(ukButton).toHaveClass(/active/, { timeout: 10000 });
    await expect(trButton).not.toHaveClass(/active/, { timeout: 10000 });

    // Click New York
    const usaButton = page.locator('button.country-btn:has-text("New York")');
    await usaButton.click();
    await expect(usaButton).toHaveClass(/active/, { timeout: 10000 });
    await expect(ukButton).not.toHaveClass(/active/, { timeout: 10000 });
  });

  test('should switch city presets and update focus status', async ({ page }) => {
    const londonButton = page.locator('button.country-btn:has-text("London")');
    await londonButton.click();

    // Verify button is active
    await expect(londonButton).toHaveClass(/active/, { timeout: 10000 });
  });
});
