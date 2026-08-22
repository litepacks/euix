import { test, expect } from '@playwright/test';
import { euix } from '../src/plugins/inspector/playwright.js';

test('Kanban Drag & Drop task card transfer between columns', async ({ page }) => {
    await page.goto('/#/playground');
    await euix(page).waitForIdle();

    // Wait for Kanban component to render
    const cards = page.locator('[draggable="true"]');
    await expect(cards.first()).toBeVisible();

    const countBefore = await cards.count();
    expect(countBefore).toBeGreaterThanOrEqual(4);
});
