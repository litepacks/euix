import { test, expect } from '@playwright/test';
import { euix } from '../src/plugins/inspector/playwright.js';

test.describe('EUIX Web Router E2E Browser Test Suite', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/router_demo.html');
        await euix(page).waitForIdle();
        // Wait for router app shell to mount
        await expect(page.locator('.app-container')).toBeVisible();
    });

    test('should render initial home view with navigation and inspect panel', async ({ page }) => {
        const h1 = page.locator('.content-view h1');
        await expect(h1).toHaveText('🚀 Welcome to EUIX Router');

        // Check active link class on Home
        const homeLink = page.locator('.nav-links a:has-text("Home")');
        await expect(homeLink).toHaveClass(/active/);

        // Check inspect panel
        const inspectPanel = page.locator('.inspect-panel');
        await expect(inspectPanel).toContainText('Pathname: /');
        await expect(inspectPanel).toContainText('Route ID: home');
    });

    test('should navigate to Projects directory and render project list from loader', async ({ page }) => {
        // Click Projects in sidebar
        await page.locator('.nav-links a:has-text("Projects")').click();
        await euix(page).waitForIdle();

        // Verify URL hash
        await expect(page).toHaveURL(/#\/projects/);

        // Content should display projects loaded via loader
        const heading = page.locator('.content-view h1');
        await expect(heading).toHaveText('📁 Project Directory');

        // Check project cards
        await expect(page.locator('.content-view h3:has-text("Next-Gen UI Engine")')).toBeVisible();
        await expect(page.locator('.content-view h3:has-text("Spatial Leaflet Studio")')).toBeVisible();

        // Inspect panel should reflect /projects
        await expect(page.locator('.inspect-panel')).toContainText('Pathname: /projects');
    });

    test('should render projects list directly on initial load or page refresh on /#/projects', async ({ page }) => {
        await page.goto('/router_demo.html#/projects');
        await euix(page).waitForIdle();

        const heading = page.locator('.content-view h1');
        await expect(heading).toHaveText('📁 Project Directory');

        // Check that project cards loaded from loader are visible on direct load
        await expect(page.locator('.content-view h3:has-text("Next-Gen UI Engine")')).toBeVisible();
        await expect(page.locator('.content-view h3:has-text("Spatial Leaflet Studio")')).toBeVisible();
        await expect(page.locator('.content-view h3:has-text("Resilient API Pipeline")')).toBeVisible();
    });

    test('should render Project 1 directly on initial load or page refresh on /#/projects/1', async ({ page }) => {
        await page.goto('/router_demo.html#/projects/1');
        await euix(page).waitForIdle();

        // Verify Project 1 title, description, and stats loaded via loader
        await expect(page.locator('.content-view h1')).toHaveText('Next-Gen UI Engine');
        await expect(page.locator('.content-view')).toContainText('Ultra-fast XML reactive UI runtime with zero VDOM overhead.');
        await expect(page.locator('.content-view')).toContainText('Stars: 256');

        // Verify active sub-tab defaults to Overview
        const overviewTab = page.locator('.tabs a:has-text("Overview")');
        await expect(overviewTab).toHaveClass(/active/);
    });

    test('should render Project 2 directly on initial load or page refresh on /#/projects/2', async ({ page }) => {
        await page.goto('/router_demo.html#/projects/2');
        await euix(page).waitForIdle();

        // Verify Project 2 title, description, and stats loaded via loader
        await expect(page.locator('.content-view h1')).toHaveText('Spatial Leaflet Studio');
        await expect(page.locator('.content-view')).toContainText('Declarative maps with real-time polygon area calculations.');
        await expect(page.locator('.content-view')).toContainText('Stars: 184');

        // Verify active sub-tab defaults to Overview
        const overviewTab = page.locator('.tabs a:has-text("Overview")');
        await expect(overviewTab).toHaveClass(/active/);
    });

    test('should navigate via Quick Links and correctly switch back and forth between Project 1 and Project 2', async ({ page }) => {
        // Start on Home
        await page.goto('/router_demo.html');
        await euix(page).waitForIdle();

        // 1. Click Project 1 Quick Link
        await page.locator('.nav-links a:has-text("Next-Gen Engine")').click();
        await euix(page).waitForIdle();

        // Verify Project 1 is loaded
        await expect(page).toHaveURL(/#\/projects\/1/);
        await expect(page.locator('.content-view h1')).toHaveText('Next-Gen UI Engine');

        // 2. Click Projects link in sidebar to go back to directory
        await page.locator('.nav-links a:has-text("Projects")').click();
        await euix(page).waitForIdle();
        await expect(page).toHaveURL(/#\/projects/);
        await expect(page.locator('.content-view h1')).toHaveText('📁 Project Directory');

        // 3. Click Project 2 Quick Link
        await page.locator('.nav-links a:has-text("Spatial Studio")').click();
        await euix(page).waitForIdle();

        // Verify Project 2 is loaded
        await expect(page).toHaveURL(/#\/projects\/2/);
        await expect(page.locator('.content-view h1')).toHaveText('Spatial Leaflet Studio');

        // 4. Click Project 1 directly from Quick Links
        await page.locator('.nav-links a:has-text("Next-Gen Engine")').click();
        await euix(page).waitForIdle();

        // Verify Project 1 is correctly re-rendered
        await expect(page).toHaveURL(/#\/projects\/1/);
        await expect(page.locator('.content-view h1')).toHaveText('Next-Gen UI Engine');
    });

    test('should switch nested tabs (Overview, Tasks, Settings) preserving parent layout', async ({ page }) => {
        await page.goto('/router_demo.html#/projects/1');
        await euix(page).waitForIdle();

        // Parent layout remains mounted
        const projectTitle = page.locator('.content-view h1');
        await expect(projectTitle).toHaveText('Next-Gen UI Engine');

        // 1. Click Tasks sub-tab
        await page.locator('.tabs a:has-text("Tasks")').click();
        await euix(page).waitForIdle();
        await expect(page).toHaveURL(/#\/projects\/1\/tasks/);

        // Verify Tasks content in nested outlet
        await expect(page.locator('.content-view')).toContainText('Nested tab outlet loaded seamlessly without remounting parent project layout!');

        // 2. Click Settings sub-tab
        await page.locator('.tabs a:has-text("Settings")').click();
        await euix(page).waitForIdle();
        await expect(page).toHaveURL(/#\/projects\/1\/settings/);

        // Verify Settings form in nested outlet
        await expect(page.locator('.content-view input[name="title"]')).toHaveValue('Next-Gen UI Engine');

        // Parent layout is still preserved
        await expect(projectTitle).toHaveText('Next-Gen UI Engine');
    });

    test('should submit route form in settings and update project title', async ({ page }) => {
        await page.goto('/router_demo.html#/projects/1/settings');
        await euix(page).waitForIdle();

        // Fill new title in form
        const input = page.locator('.content-view input[name="title"]');
        await input.fill('EUIX Next-Gen Supercharged');

        // Submit form via route action
        await page.locator('.content-view button:has-text("Save Changes")').click();
        await euix(page).waitForIdle();

        // Check parent heading updated
        await expect(page.locator('.content-view h1')).toHaveText('EUIX Next-Gen Supercharged');
    });

    test('should navigate to About view and show 404 for unknown routes', async ({ page }) => {
        // Navigate to About
        await page.locator('.nav-links a:has-text("About")').click();
        await euix(page).waitForIdle();
        await expect(page).toHaveURL(/#\/about/);
        await expect(page.locator('.content-view h1')).toHaveText('ℹ️ About EUIX Router');

        // Navigate to non-existent route
        await page.goto('/router_demo.html#/non-existent-page');
        await euix(page).waitForIdle();
        await expect(page.locator('.content-view h1')).toHaveText('404 - Route Not Found');
        await expect(page.locator('.content-view p')).toContainText('The requested route does not exist.');
    });

    test('should navigate to homepage when clicking the header logo', async ({ page }) => {
        await page.goto('/router_demo.html#/projects/1/tasks');
        await euix(page).waitForIdle();

        // Click header logo link
        await page.locator('.logo-box').click();
        await euix(page).waitForIdle();

        // Verify back on home
        await expect(page).toHaveURL(/#\/$/);
        await expect(page.locator('.content-view h1')).toHaveText('🚀 Welcome to EUIX Router');
    });
});
