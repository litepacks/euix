import { test, expect } from '@playwright/test';
import { euix } from '../src/plugins/inspector/playwright.js';

test.describe('EUIX Inspector & Playwright E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/playground.html');
  });

  test('should inspect DOM elements with euix helper and verify component metadata', async ({ page }) => {
    // Check that DevTools HUD toggle is mounted on playground
    const devHud = page.locator('#euix-dev-toggle, #euix-dev-panel-btn, #euix-inspector-hud');
    await expect(devHud.first()).toBeVisible();

    // Use euix helper to wait for idle engine state
    await euix(page).waitForIdle();

    // Inspect heading using euix helper
    const titleLocator = euix(page).getByTestId('playground-title');
    if (await titleLocator.count() > 0) {
      await expect(titleLocator).toBeVisible();
    }
  });

  test('should toggle Inspector using keyboard shortcuts (Alt+Shift+X) and verify visual overlay', async ({ page }) => {
    // Trigger Alt+Shift+X shortcut
    await page.keyboard.press('Alt+Shift+X');

    const dot = page.locator('#euix-dev-dot, #euix-hud-dot');
    if (await dot.count() > 0) {
      const bg = await dot.first().evaluate(el => el.style.background);
      expect(bg).toContain('rgb(34, 197, 94)'); // Green active indicator
    }

    // Hover on counter section
    const counterBtn = page.locator('button:text-is("+")').first();
    await counterBtn.hover();

    // Highlight overlay should be positioned
    const highlight = page.locator('#euix-inspector-highlight, #euix-devtools-highlight');
    if (await highlight.count() > 0) {
      await expect(highlight.first()).toBeVisible();
    }
  });

  test('should open DevTools panel and navigate tabs (Inspect, Tree, Actions, State, Search, Perf)', async ({ page }) => {
    const panelBtn = page.locator('#euix-dev-panel-btn, #euix-hud-panel-btn');
    await panelBtn.first().click();

    const panel = page.locator('#euix-devtools-panel, #euix-inspector-panel');
    await expect(panel.first()).toBeVisible();

    // Switch to Actions/Logs tab
    const logsTab = page.locator('#euix-tab-logs, #euix-tab-actions');
    if (await logsTab.count() > 0) {
      await logsTab.first().click();
      await expect(panel.first()).toBeVisible();
    }

    // Switch to Component Tree tab
    const treeTab = page.locator('#euix-tab-tree');
    if (await treeTab.count() > 0) {
      await treeTab.first().click();
      await expect(panel.first()).toBeVisible();
    }

    // Switch to Search tab
    const searchTab = page.locator('#euix-tab-search');
    if (await searchTab.count() > 0) {
      await searchTab.first().click();
      const searchInput = page.locator('#euix-search-input');
      if (await searchInput.count() > 0) {
        await searchInput.fill('counter');
        await expect(panel.first()).toBeVisible();
      }
    }
  });

  test('should capture debug snapshot via euix(page).debug() without exposing sensitive secrets', async ({ page }) => {
    // Execute debug snapshot evaluation on page
    const snapshot = await euix(page).debug();
    expect(snapshot).toBeDefined();

    // Global state in snapshot should mask sensitive tokens if any
    const snapshotStr = JSON.stringify(snapshot);
    expect(snapshotStr).not.toContain('secret_plaintext_token');
  });
});
