import { test, expect } from '@playwright/test';

test('Kanban Drag & Drop task card transfer between columns', async ({ page }) => {
    await page.goto('http://localhost:5173');

    // Wait for Kanban component to render
    const card = page.locator('.bg-slate-50\\/80 [draggable="true"]').first();
    await expect(card).toBeVisible();

    const col1CountBefore = await page.locator('.bg-slate-50\\/80 [draggable="true"]').count();
    const col2CountBefore = await page.locator('.bg-amber-50\\/40 [draggable="true"]').count();

    console.log(`Before Drag: Col 1 = ${col1CountBefore}, Col 2 = ${col2CountBefore}`);

    const targetCol = page.locator('.bg-amber-50\\/40');

    // Trigger pointerdown on card and pointerup on column
    await card.dispatchEvent('pointerdown');
    await targetCol.dispatchEvent('pointerup');

    await page.waitForTimeout(500);

    const col1CountAfter = await page.locator('.bg-slate-50\\/80 [draggable="true"]').count();
    const col2CountAfter = await page.locator('.bg-amber-50\\/40 [draggable="true"]').count();

    console.log(`After Drag: Col 1 = ${col1CountAfter}, Col 2 = ${col2CountAfter}`);

    expect(col1CountAfter).toBe(col1CountBefore - 1);
    expect(col2CountAfter).toBe(col2CountBefore + 1);
});
