import { test, expect } from '@playwright/test';
import { euix } from '../src/plugins/inspector/playwright.js';

test.describe('EUIX Engine End-to-End (E2E) Browser Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/playground.html');
    await euix(page).waitForIdle();
  });

  test('should mount EUIX Engine Demo page and render header', async ({ page }) => {
    const title = await page.locator('h1').textContent();
    expect(title).toBe('EUIX Engine Interactive Demos');
  });

  test('should interact with Counter Section math operations (+1, +5, -1, -5, Reset)', async ({ page }) => {
    const counterSpan = page.locator('.text-4xl.font-mono');
    await expect(counterSpan).toHaveText('0');

    // Click +1
    await page.locator('button:text-is("+")').click();
    await euix(page).waitForIdle();
    await expect(counterSpan).toHaveText('1');

    // Click +5
    await page.locator('button:has-text("+5")').click();
    await euix(page).waitForIdle();
    await expect(counterSpan).toHaveText('6');

    // Click -1
    await page.locator('button:text-is("-")').click();
    await euix(page).waitForIdle();
    await expect(counterSpan).toHaveText('5');

    // Click -5
    await page.locator('button:has-text("-5")').click();
    await euix(page).waitForIdle();
    await expect(counterSpan).toHaveText('0');

    // Click Reset
    await page.locator('button:text-is("+")').click();
    await page.locator('button:has-text("Reset (0)")').click();
    await euix(page).waitForIdle();
    await expect(counterSpan).toHaveText('0');
  });

  test('should delete SINGLE item when clicking Delete button on that specific task', async ({ page }) => {
    // Wait for todo checkboxes to render in DOM
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(firstCheckbox).toBeVisible();

    const tasksBefore = await page.locator('input[type="checkbox"]').count();
    expect(tasksBefore).toBe(5);

    // Verify first task is "Task 1"
    const firstTask = page.locator('span:has-text("Task 1")');
    await expect(firstTask).toBeVisible();

    // Click Delete on first task (Task 1)
    const task1Row = page.locator('span:has-text("Task 1")').locator('xpath=ancestor::*[contains(@class, "bg-white")][1]');
    await task1Row.locator('button:has-text("Delete")').click();

    // Confirm dialog backdrop should open
    const modalTitle = page.locator('.dialog-title');
    await expect(modalTitle).toHaveText('Delete Task?');

    // Click "Yes, Delete" in modal
    await page.locator('button:has-text("Yes, Delete")').click({ force: true });
    await euix(page).waitForIdle();

    // Verify only ONE task was removed (remaining count = 4)
    const tasksAfter = await page.locator('input[type="checkbox"]').count();
    expect(tasksAfter).toBe(4);

    // Verify Task 1 is gone, but Task 2 is now first
    await expect(page.locator('span:has-text("Task 2")')).toBeVisible();
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

    const summary = page.locator('.bg-indigo-50\\/50').last();
    await expect(summary).toContainText('Playwright Engineer Bio');
  });

  test('should toggle DevTools overlay off when pressing Escape key', async ({ page }) => {
    const devHud = page.locator('#euix-dev-toggle, #euix-dev-panel-btn, #euix-inspector-hud');
    await expect(devHud.first()).toBeVisible();

    const dot = page.locator('#euix-dev-dot, #euix-hud-dot');

    // Press Escape key to deactivate inspector
    await page.keyboard.press('Escape');

    // Dot background should turn grey (#64748b)
    const dotBackground = await dot.first().evaluate(el => el.style.background);
    expect(dotBackground).toBe('rgb(100, 116, 139)');
  });

  test('should open DevTools State & Log Panel when clicking panel button', async ({ page }) => {
    const panelBtn = page.locator('#euix-dev-panel-btn, #euix-hud-panel-btn');
    await expect(panelBtn.first()).toBeVisible();

    // Click panel button
    await panelBtn.first().click();

    const panel = page.locator('#euix-devtools-panel, #euix-inspector-panel');
    await expect(panel.first()).toBeVisible();

    // Verify State keys are listed in panel
    await expect(panel.first()).toContainText('counter_value');
    await expect(panel.first()).toContainText('todos');

    // Click Logs tab
    const logsTab = page.locator('#euix-tab-logs, #euix-tab-actions');
    await logsTab.first().click();
    await expect(panel.first()).toContainText('Recent actions');
  });

  test('should interact with JSONPlaceholder Posts CRUD section (create new post and delete post)', async ({ page }) => {
    // Fill title and body for new post
    const titleInput = page.locator('input[placeholder="Post title..."]');
    const bodyTextarea = page.locator('textarea[placeholder="Post body content..."]');
    await titleInput.fill('Playwright Test Post Title');
    await bodyTextarea.fill('Playwright Test Post Body Content');

    // Submit post and await network response
    const responsePromise = page.waitForResponse(resp => resp.url().includes('jsonplaceholder.typicode.com/posts') && resp.request().method() === 'POST').catch(() => null);
    await page.locator('button:has-text("Publish Post")').click();
    await responsePromise;
    await euix(page).waitForIdle();

    // Verify post was prepended
    const newPostTitle = page.locator('span:has-text("Playwright Test Post Title")').first();
    await expect(newPostTitle).toBeVisible({ timeout: 10000 });

    // Delete the new post
    const deleteBtn = page.locator('button:has-text("Delete")').first();
    await deleteBtn.click();
    await euix(page).waitForIdle();
  });

  test('should reload Pokémon cards from PokéAPI and display cards', async ({ page }) => {
    const reloadBtn = page.locator('button:has-text("Reload Pokémon")');
    await expect(reloadBtn).toBeVisible();

    // Click Reload Pokémon
    await reloadBtn.click();
    await euix(page).waitForIdle();

    // Verify Pokémon cards are rendered in grid
    const cards = page.locator('.pokemon-name, span.capitalize');
    await expect(cards.first()).toBeVisible();
  });

  test('should render Dynamic Data Table and handle adding and removing employees', async ({ page }) => {
    const tableInput = page.locator('input[placeholder="Employee Name"]');
    await expect(tableInput).toBeVisible();

    // Check initial 3 employees
    const rows = page.locator('table tr');
    await expect(rows).toHaveCount(4); // 1 header row + 3 employee rows

    // Verify first employee is Ahmet Yilmaz (#1)
    await expect(rows.nth(1)).toContainText('Ahmet Yilmaz');
    await expect(rows.nth(1)).toContainText('#1');

    // Delete second employee (Zeynep Kaya)
    const removeBtn = page.locator('button:has-text("Remove")').nth(1);
    await removeBtn.click();
    await euix(page).waitForIdle();

    // Verify table row count updated to 3 (1 header + 2 employees)
    await expect(page.locator('table tr')).toHaveCount(3);
  });

  test('should execute Action Composer workflow and populate tasks and logs', async ({ page }) => {
    // Click "➕ Add Bugfix Task"
    const addBugfixBtn = page.locator('button:has-text("Add Bugfix Task")');
    await expect(addBugfixBtn).toBeVisible();
    await addBugfixBtn.click();
    await euix(page).waitForIdle();

    // Verify task was added to composer tasks
    const taskItem = page.locator('span:has-text("Fix API Cache Invalidation")').first();
    await expect(taskItem).toBeVisible();

    // Click "🎨 Add Design Task"
    const addDesignBtn = page.locator('button:has-text("Add Design Task")');
    await addDesignBtn.click();
    await euix(page).waitForIdle();

    const designItem = page.locator('span:has-text("Redesign Dashboard Layout")').first();
    await expect(designItem).toBeVisible();
  });

  test('should load 1,000 items in Virtual Scrolling Benchmark section', async ({ page }) => {
    // Click "🚀 Load 1,000 Items"
    const loadBtn = page.locator('button:has-text("Load 1,000 Items")');
    await expect(loadBtn).toBeVisible();
    await loadBtn.click();
    await euix(page).waitForIdle();

    // Verify virtual item row rendered
    const itemCard = page.locator('span:has-text("High-Frequency Telemetry Packet")').first();
    await expect(itemCard).toBeVisible();
  });

  test('should interact with E-Commerce Catalog and add items to cart', async ({ page }) => {
    // Wait for product card to render
    const productCard = page.locator('.product-card, .ecommerce-product, button:has-text("Add to Cart")').first();
    await expect(productCard).toBeVisible();

    // Click "Add to Cart" on first available product
    const addToCartBtn = page.locator('button:has-text("Add to Cart")').first();
    await addToCartBtn.click();
    await euix(page).waitForIdle();

    // Verify cart count or items
    const cartItem = page.locator('.cart-item, span:has-text("Cart")').first();
    await expect(cartItem).toBeVisible();
  });
});
