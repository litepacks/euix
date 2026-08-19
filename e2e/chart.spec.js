import { test, expect } from '@playwright/test';

test.describe('EUIX Engine - Chart.js Plugin End-to-End (E2E) Browser Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chart_demo.html');
  });

  test('should mount Chart.js Demo and render dashboard header and charts', async ({ page }) => {
    // 1. Check title
    const headerTitle = page.locator('h1');
    await expect(headerTitle).toContainText('Reactive Chart.js Engine for EUIX');

    // 2. Check that chart canvas elements are rendered
    const charts = page.locator('canvas');
    await expect(charts).toHaveCount(3);

    // 3. Check Live Click Inspector initial state
    const selectedChart = page.locator('strong:has-text("None")').first();
    await expect(selectedChart).toBeVisible();
  });

  test('should reactively add and remove months/datasets to financial chart', async ({ page }) => {
    // Click "➕ Add Month"
    const addMonthBtn = page.locator('button:has-text("Add Month")');
    await expect(addMonthBtn).toBeVisible();
    await addMonthBtn.click();

    // Click "🔀 Switch Type"
    const switchTypeBtn = page.locator('button:has-text("Switch Type")');
    await switchTypeBtn.click();

    // Verify canvas is still intact and rendering
    const mainCanvas = page.locator('#main_finance_chart canvas');
    await expect(mainCanvas).toBeVisible();

    // Click "➖ Pop"
    const popBtn = page.locator('button:has-text("Pop")');
    await popBtn.click();
    await expect(mainCanvas).toBeVisible();
  });

  test('should toggle dataset visibility on financial chart', async ({ page }) => {
    const revToggleBtn = page.locator('button:has-text("👁️ Rev")');
    const expToggleBtn = page.locator('button:has-text("👁️ Exp")');

    await revToggleBtn.click();
    await expToggleBtn.click();

    const mainCanvas = page.locator('#main_finance_chart canvas');
    await expect(mainCanvas).toBeVisible();
  });

  test('should toggle data visibility on device doughnut chart', async ({ page }) => {
    const toggleDesktopBtn = page.locator('button:has-text("Toggle Desktop")');
    const toggleMobileBtn = page.locator('button:has-text("Toggle Mobile")');

    await toggleDesktopBtn.click();
    await toggleMobileBtn.click();

    const deviceCanvas = page.locator('#device_distribution_chart canvas');
    await expect(deviceCanvas).toBeVisible();
  });

  test('should export chart as PNG base64 and display image preview', async ({ page }) => {
    // Click "📷 Export PNG"
    const exportBtn = page.locator('button:has-text("Export PNG")');
    await exportBtn.click();

    // Verify <img> tag is rendered inside the preview box with base64 data
    const previewImg = page.locator('img[alt="Exported Chart"]');
    await expect(previewImg).toBeVisible();

    const src = await previewImg.getAttribute('src');
    expect(src).toBeTruthy();
    expect(src).toMatch(/^data:image\/png;base64,/);
  });

  test('should randomize traffic trend data reactively', async ({ page }) => {
    const randomizeBtn = page.locator('button:has-text("Randomize Traffic")');
    await randomizeBtn.click();

    const trafficCanvas = page.locator('#traffic_trend_chart canvas');
    await expect(trafficCanvas).toBeVisible();
  });

  test('should navigate to playground, router demo, and map demo from header', async ({ page }) => {
    const playgroundLink = page.locator('header a:has-text("Playground")');
    await expect(playgroundLink).toHaveAttribute('href', './playground.html');

    const routerLink = page.locator('header a:has-text("Router Demo")');
    await expect(routerLink).toHaveAttribute('href', './router_demo.html');

    const mapLink = page.locator('header a:has-text("Map Demo")');
    await expect(mapLink).toHaveAttribute('href', './map_demo.html');
  });
});
