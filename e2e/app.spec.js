import { test, expect } from '@playwright/test';

test.describe('EUIX Engine End-to-End (E2E) Browser Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should mount EUIX Engine Demo page and render header', async ({ page }) => {
    const title = await page.locator('h1').textContent();
    expect(title).toBe('EUIX Engine Demo');
  });

  test('should interact with Counter Section math operations (+1, +5, -1, -5, Reset)', async ({ page }) => {
    const counterSpan = page.locator('.text-4xl.font-mono');
    await expect(counterSpan).toHaveText('0');

    // Click +1
    await page.locator('button:has-text("+")').first().click();
    await expect(counterSpan).toHaveText('1');

    // Click +5
    await page.locator('button:has-text("+5")').click();
    await expect(counterSpan).toHaveText('6');

    // Click -1
    await page.locator('button:has-text("-")').first().click();
    await expect(counterSpan).toHaveText('5');

    // Click -5
    await page.locator('button:has-text("-5")').click();
    await expect(counterSpan).toHaveText('0');

    // Click Reset
    await page.locator('button:has-text("+")').first().click();
    await page.locator('button:has-text("Reset")').click();
    await expect(counterSpan).toHaveText('0');
  });

  test('should delete SINGLE item when clicking Delete button on that specific task', async ({ page }) => {
    // Wait for todo checkboxes to render in DOM
    const firstCheckbox = page.locator('input[type="checkbox"]').first();
    await expect(firstCheckbox).toBeVisible();

    const tasksBefore = await page.locator('input[type="checkbox"]').count();
    expect(tasksBefore).toBe(5);

    // Verify first task is "Task 1"
    const firstTask = page.locator('.euix-if-branch span').first();
    await expect(firstTask).toHaveText('Task 1');

    // Click Delete on first task
    await page.locator('button:has-text("Delete")').first().click();

    // Confirm dialog backdrop should open
    const modalTitle = page.locator('.dialog-title');
    await expect(modalTitle).toHaveText('Delete Task?');

    // Click "Yes, Delete" in modal
    await page.locator('button:has-text("Yes, Delete")').click();

    // Verify only ONE task was removed (remaining count = 4)
    const tasksAfter = await page.locator('input[type="checkbox"]').count();
    expect(tasksAfter).toBe(4);

    // Verify Task 1 is gone, but Task 2 is now first
    await expect(page.locator('.euix-if-branch span').first()).toHaveText('Task 2');
  });

  test('should add a new task and toggle completion', async ({ page }) => {
    const input = page.locator('input[placeholder="Enter a new task..."]');
    await input.fill('Playwright E2E Test Task');
    await page.locator('button:has-text("Add Task")').click();

    // Verify new task was appended
    const lastTask = page.locator('span:has-text("Playwright E2E Test Task")');
    await expect(lastTask).toHaveText('Playwright E2E Test Task');
  });

  test('should reflect form inputs live in the summary box', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="biography"]');
    await textarea.fill('Playwright Engineer Bio');

    const summary = page.locator('.bg-indigo-50\\/50');
    await expect(summary).toContainText('Playwright Engineer Bio');
  });

  test('should toggle DevTools overlay off when pressing Escape key', async ({ page }) => {
    const devHud = page.locator('#euix-devtools-hud');
    await expect(devHud).toBeVisible();

    const dot = page.locator('#euix-dev-dot');

    // Press Escape key to deactivate inspector
    await page.keyboard.press('Escape');

    // Dot background should turn grey (#64748b)
    const dotBackground = await dot.evaluate(el => el.style.background);
    expect(dotBackground).toBe('rgb(100, 116, 139)');
  });

  test('should open DevTools State & Log Panel when clicking panel button', async ({ page }) => {
    const panelBtn = page.locator('#euix-dev-panel-btn');
    await expect(panelBtn).toBeVisible();

    // Click panel button
    await panelBtn.click();

    const panel = page.locator('#euix-devtools-panel');
    await expect(panel).toBeVisible();

    // Verify State keys are listed in panel
    await expect(panel).toContainText('counter_value');
    await expect(panel).toContainText('todos');

    // Click Logs tab
    await page.locator('#euix-tab-logs').click();
    await expect(panel).toContainText('Logs');
  });

  test('should interact with JSONPlaceholder Posts CRUD section (create new post and delete post)', async ({ page }) => {
    // Fill title and body for new post
    const titleInput = page.locator('input[placeholder="Post title..."]');
    const bodyTextarea = page.locator('textarea[placeholder="Post body content..."]');
    await titleInput.fill('Playwright Test Post Title');
    await bodyTextarea.fill('Playwright Test Post Body Content');

    // Click Publish Post
    await page.locator('button:has-text("Publish Post")').click();

    // Verify post was prepended
    const newPostTitle = page.locator('span:has-text("Playwright Test Post Title")');
    await expect(newPostTitle).toBeVisible();

    // Delete the new post
    const deleteBtn = page.locator('button:has-text("Delete")').first();
    await deleteBtn.click();
  });

  test('should reload Pokémon cards from PokéAPI and display cards', async ({ page }) => {
    const reloadBtn = page.locator('button:has-text("Reload Pokémon")');
    await expect(reloadBtn).toBeVisible();

    // Click Reload Pokémon
    await reloadBtn.click();

    // Verify Pokémon cards are rendered in grid
    const cards = page.locator('.pokemon-name, span.capitalize');
    await expect(cards.first()).toBeVisible();
  });
});
