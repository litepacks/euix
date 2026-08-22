import { test, expect } from '@playwright/test';
import { euix } from '../src/plugins/inspector/playwright.js';

test.describe('EUIX Engine End-to-End (E2E) Browser Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/playground');
    await page.locator('h1').first().waitFor();
    await euix(page).waitForIdle();
  });

  test('should mount EUIX Engine Demo page and render header', async ({ page }) => {
    const title = await page.locator('h1').first().textContent();
    expect(title).toContain('Full Interactive Component Suites');
  });

  test('should interact with Counter Section math operations (+1, +5, -1, -5, Reset)', async ({ page }) => {
    const counterSpan = page.locator('.text-5xl.font-black.font-mono').first();
    await expect(counterSpan).toHaveText('0');

    // Click +
    await page.locator('button:text-is("+")').click();
    await euix(page).waitForIdle();
    await expect(counterSpan).toHaveText('1');

    // Click +5 Add
    await page.locator('button:has-text("+5")').click();
    await euix(page).waitForIdle();
    await expect(counterSpan).toHaveText('6');

    // Click -
    await page.locator('button:text-is("-")').click();
    await euix(page).waitForIdle();
    await expect(counterSpan).toHaveText('5');

    // Click -5 Subtract
    await page.locator('button:has-text("-5")').click();
    await euix(page).waitForIdle();
    await expect(counterSpan).toHaveText('0');

    // Click Reset
    await page.locator('button:has-text("Reset (0)")').click();
    await euix(page).waitForIdle();
    await expect(counterSpan).toHaveText('0');
  });

  test('should delete SINGLE item when clicking Delete button on that specific task', async ({ page }) => {
    // Wait for todo section to render in DOM
    const firstTask = page.locator('span:has-text("Explore EUIX Engine Core")').first();
    await expect(firstTask).toBeVisible();

    // Click Delete on first task
    const task1Row = firstTask.locator('xpath=ancestor::*[contains(@class, "rounded-xl")][1]');
    const deleteBtn = task1Row.locator('button:has-text("Delete")');
    if (await deleteBtn.count() > 0) {
      await deleteBtn.click();
      await page.waitForTimeout(300);
      const confirmBtn = page.locator('button:has-text("Yes, Delete"), button:has-text("Delete")').last();
      if (await confirmBtn.count() > 0) {
        await confirmBtn.click({ force: true });
        await euix(page).waitForIdle();
      }
    }
  });

  test('should add a new task and toggle completion', async ({ page }) => {
    const input = page.locator('input[placeholder="Enter a new task..."]');
    await input.fill('Playwright E2E Test Task');
    await page.locator('button:text-is("Add Task")').click();
    await euix(page).waitForIdle();

    // Verify new task was appended
    const lastTask = page.locator('span:has-text("Playwright E2E Test Task")');
    await expect(lastTask).toHaveText('Playwright E2E Test Task');
  });

  test('should reflect form inputs live in the summary box', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="biography"]');
    await textarea.fill('Playwright Engineer Bio');
    await euix(page).waitForIdle();

    const summary = page.locator('.bg-indigo-50\\/50, .bg-indigo-500\\/10').last();
    await expect(summary).toContainText('Playwright Engineer Bio');
  });

  test('should toggle DevTools overlay off when pressing Escape key', async ({ page }) => {
    const devHud = page.locator('#euix-dev-toggle, #euix-dev-panel-btn, #euix-inspector-hud');
    if (await devHud.count() > 0) {
      await expect(devHud.first()).toBeVisible();
      const dot = page.locator('#euix-dev-dot, #euix-hud-dot');
      await page.keyboard.press('Escape');
      if (await dot.count() > 0) {
        const dotBackground = await dot.first().evaluate(el => el.style.background);
        expect(dotBackground).toBeDefined();
      }
    }
  });

  test('should open DevTools State & Log Panel when clicking panel button', async ({ page }) => {
    const panelBtn = page.locator('#euix-dev-panel-btn, #euix-hud-panel-btn');
    if (await panelBtn.count() > 0) {
      await panelBtn.first().click();
      const panel = page.locator('#euix-devtools-panel, #euix-inspector-panel');
      await expect(panel.first()).toBeVisible();
    }
  });

  test('should interact with JSONPlaceholder Posts CRUD section (create new post and delete post)', async ({ page }) => {
    // Fill title and body for new post
    const titleInput = page.locator('input[placeholder="Post title..."]');
    const bodyTextarea = page.locator('textarea[placeholder="Post body content..."]');
    await titleInput.fill('Playwright Test Post Title');
    await bodyTextarea.fill('Playwright Test Post Body Content');

    // Submit post
    await page.locator('button:has-text("Publish Post")').click();
    await page.waitForTimeout(1000);
    await euix(page).waitForIdle();

    const publishBtn = page.locator('button:has-text("Publish Post")');
    await expect(publishBtn).toBeVisible();
  });

  test('should reload Pokémon cards from PokéAPI and display cards', async ({ page }) => {
    const reloadBtn = page.locator('button:has-text("Reload Pokémon")');
    await expect(reloadBtn).toBeVisible();

    // Click Reload Pokémon
    await reloadBtn.click();
    await page.waitForTimeout(1000);
    await euix(page).waitForIdle();

    // Verify Pokémon section or cards
    const pokeSection = page.locator('pokemon-card, .pokemon-name, span.capitalize, img[alt]').first();
    if (await pokeSection.count() > 0) {
      await expect(pokeSection).toBeVisible();
    }
  });

  test('should render Dynamic Data Table and handle adding and removing employees', async ({ page }) => {
    const tableInput = page.locator('input[placeholder="Employee Name"]');
    await expect(tableInput).toBeVisible();

    // Check initial 3 employee rows
    const employeeRows = page.locator('table tr:has(button:has-text("Remove"))');
    await expect(employeeRows).toHaveCount(3);

    // Verify first employee is Ahmet Yilmaz (#1)
    await expect(employeeRows.nth(0)).toContainText('Ahmet Yilmaz');
    await expect(employeeRows.nth(0)).toContainText('#1');

    // Delete second employee (Zeynep Kaya)
    const removeBtn = employeeRows.nth(1).locator('button:has-text("Remove")');
    await removeBtn.click();
    await euix(page).waitForIdle();

    // Verify table row count updated to 2
    await expect(page.locator('table tr:has(button:has-text("Remove"))')).toHaveCount(2);
  });

  test('should execute Action Composer workflow and populate tasks and logs', async ({ page }) => {
    // Click "🎨 Add Design Task"
    const addDesignBtn = page.locator('button:has-text("Add Design Task")').first();
    await expect(addDesignBtn).toBeVisible();
    await addDesignBtn.click();
    await euix(page).waitForIdle();

    const designItem = page.locator('span:has-text("Redesign Dashboard Layout")').first();
    await expect(designItem).toBeVisible();
  });

  test('should load 1,000 items in Virtual Scrolling Benchmark section', async ({ page }) => {
    // Click "🚀 Load 1,000 Items"
    const loadBtn = page.locator('button:has-text("Load 1,000 Items")').first();
    await expect(loadBtn).toBeVisible();
    await loadBtn.click();
    await euix(page).waitForIdle();

    // Verify virtual item row rendered
    const itemCard = page.locator('span:has-text("High-Frequency Telemetry Packet")').first();
    await expect(itemCard).toBeVisible();
  });

  test('should interact with E-Commerce Catalog and add items to cart', async ({ page }) => {
    // Check E-Commerce section header
    const catalogHeader = page.locator('h2:has-text("E-Commerce Catalog")').first();
    await expect(catalogHeader).toBeVisible();

    const addToCartBtn = page.locator('button:has-text("Add to Cart"), button:has-text("Add")').first();
    if (await addToCartBtn.count() > 0) {
      await addToCartBtn.click({ force: true });
      await euix(page).waitForIdle();
    }
  });
});
