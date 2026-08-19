import { test, expect } from '@playwright/test';

test.describe('EUIX Web Router E2E Browser Test Suite', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/router_demo.html');
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

        const heading = page.locator('.content-view h1');
        await expect(heading).toHaveText('📁 Project Directory');

        // Check that project cards loaded from loader are visible on direct load
        await expect(page.locator('.content-view h3:has-text("Next-Gen UI Engine")')).toBeVisible();
        await expect(page.locator('.content-view h3:has-text("Spatial Leaflet Studio")')).toBeVisible();
        await expect(page.locator('.content-view h3:has-text("Resilient API Pipeline")')).toBeVisible();
    });

    test('should render Project 1 directly on initial load or page refresh on /#/projects/1', async ({ page }) => {
        await page.goto('/router_demo.html#/projects/1');

        // Verify Project 1 title, description, and stats loaded via loader
        await expect(page.locator('.content-view h1')).toHaveText('Next-Gen UI Engine');
        await expect(page.locator('.content-view')).toContainText('Ultra-fast XML reactive UI runtime');
        await expect(page.locator('.content-view')).toContainText('Stars: 256');

        // Verify route context & HUD panel
        await expect(page.locator('.inspect-panel')).toContainText('Pathname: /projects/1');
        await expect(page.locator('.inspect-panel')).toContainText('ProjectId: 1');
        await expect(page.locator('.inspect-panel')).toContainText('Title: Next-Gen UI Engine');

        // Verify active link in Quick Links has proper hash href and active class
        const q1 = page.locator('.nav-links a:has-text("Next-Gen Engine")');
        await expect(q1).toHaveAttribute('href', '#/projects/1');
        await expect(q1).toHaveClass(/active/);
    });

    test('should render Project 2 directly on initial load or page refresh on /#/projects/2', async ({ page }) => {
        await page.goto('/router_demo.html#/projects/2');

        // Verify Project 2 title, description, and stats loaded via loader
        await expect(page.locator('.content-view h1')).toHaveText('Spatial Leaflet Studio');
        await expect(page.locator('.content-view')).toContainText('Declarative maps with real-time polygon area calculations.');
        await expect(page.locator('.content-view')).toContainText('Stars: 184');

        // Verify route context & HUD panel
        await expect(page.locator('.inspect-panel')).toContainText('Pathname: /projects/2');
        await expect(page.locator('.inspect-panel')).toContainText('ProjectId: 2');
        await expect(page.locator('.inspect-panel')).toContainText('Title: Spatial Leaflet Studio');

        // Verify active link in Quick Links has proper hash href and active class
        const q2 = page.locator('.nav-links a:has-text("Spatial Studio")');
        await expect(q2).toHaveAttribute('href', '#/projects/2');
        await expect(q2).toHaveClass(/active/);
    });

    test('should navigate via Quick Links and correctly switch back and forth between Project 1 and Project 2', async ({ page }) => {
        await page.goto('/router_demo.html');

        const q1 = page.locator('.nav-links a:has-text("Next-Gen Engine")');
        const q2 = page.locator('.nav-links a:has-text("Spatial Studio")');

        // Verify proper hash hrefs generated by HashHistory
        await expect(q1).toHaveAttribute('href', '#/projects/1');
        await expect(q2).toHaveAttribute('href', '#/projects/2');

        // 1. Click Quick Link for Project 1
        await q1.click();
        await expect(page).toHaveURL(/#\/projects\/1/);
        await expect(page.locator('.content-view h1')).toHaveText('Next-Gen UI Engine');
        await expect(page.locator('.content-view')).toContainText('Ultra-fast XML reactive UI runtime');
        await expect(page.locator('.inspect-panel')).toContainText('ProjectId: 1');
        await expect(page.locator('.inspect-panel')).toContainText('Title: Next-Gen UI Engine');
        await expect(q1).toHaveClass(/active/);
        await expect(q2).not.toHaveClass(/active/);

        // 2. Click Quick Link for Project 2
        await q2.click();
        await expect(page).toHaveURL(/#\/projects\/2/);
        await expect(page.locator('.content-view h1')).toHaveText('Spatial Leaflet Studio');
        await expect(page.locator('.content-view')).toContainText('Declarative maps with real-time polygon area calculations.');
        await expect(page.locator('.inspect-panel')).toContainText('ProjectId: 2');
        await expect(page.locator('.inspect-panel')).toContainText('Title: Spatial Leaflet Studio');
        await expect(q2).toHaveClass(/active/);
        await expect(q1).not.toHaveClass(/active/);

        // 3. Switch back to Project 1
        await q1.click();
        await expect(page).toHaveURL(/#\/projects\/1/);
        await expect(page.locator('.content-view h1')).toHaveText('Next-Gen UI Engine');
        await expect(page.locator('.content-view')).toContainText('Ultra-fast XML reactive UI runtime');
        await expect(page.locator('.inspect-panel')).toContainText('ProjectId: 1');
        await expect(page.locator('.inspect-panel')).toContainText('Title: Next-Gen UI Engine');
        await expect(q1).toHaveClass(/active/);
        await expect(q2).not.toHaveClass(/active/);

        // 4. Switch back to Project 2
        await q2.click();
        await expect(page).toHaveURL(/#\/projects\/2/);
        await expect(page.locator('.content-view h1')).toHaveText('Spatial Leaflet Studio');
        await expect(page.locator('.content-view')).toContainText('Declarative maps with real-time polygon area calculations.');
        await expect(page.locator('.inspect-panel')).toContainText('ProjectId: 2');
        await expect(page.locator('.inspect-panel')).toContainText('Title: Spatial Leaflet Studio');
        await expect(q2).toHaveClass(/active/);
        await expect(q1).not.toHaveClass(/active/);
    });

    test('should switch nested tabs (Overview, Tasks, Settings) preserving parent layout', async ({ page }) => {
        // Navigate to Project 1
        await page.locator('.nav-links a:has-text("Next-Gen Engine")').click();
        await expect(page.locator('.content-view h1')).toHaveText('Next-Gen UI Engine');

        // Tab: Overview is active by default
        await expect(page.locator('.tabs a:has-text("Overview")')).toHaveClass(/active/);
        await expect(page.locator('.content-view')).toContainText('Ultra-fast XML reactive UI runtime');

        // Click Tasks tab
        await page.locator('.tabs a:has-text("Tasks")').click();
        await expect(page).toHaveURL(/#\/projects\/1\/tasks/);
        await expect(page.locator('.tabs a:has-text("Tasks")')).toHaveClass(/active/);
        await expect(page.locator('.content-view h3:has-text("Active Tasks")')).toBeVisible();
        // Parent title must remain preserved
        await expect(page.locator('.content-view h1')).toHaveText('Next-Gen UI Engine');

        // Click Settings tab
        await page.locator('.tabs a:has-text("Settings")').click();
        await expect(page).toHaveURL(/#\/projects\/1\/settings/);
        await expect(page.locator('.tabs a:has-text("Settings")')).toHaveClass(/active/);
        await expect(page.locator('.content-view h3:has-text("Project Settings")')).toBeVisible();
        await expect(page.locator('input[name="title"]')).toHaveValue('Next-Gen UI Engine');
    });

    test('should submit route form in settings and update project title', async ({ page }) => {
        // Navigate to Project 1 Settings
        await page.locator('.nav-links a:has-text("Next-Gen Engine")').click();
        await page.locator('.tabs a:has-text("Settings")').click();

        // Change title in form
        const titleInput = page.locator('input[name="title"]');
        await titleInput.fill('Next-Gen UI Engine v2.0');

        // Click Save Changes
        await page.locator('button:has-text("Save Changes")').click();

        // Title in header should update via action and loader revalidation
        await expect(page.locator('.content-view h1')).toHaveText('Next-Gen UI Engine v2.0');
    });

    test('should navigate to About view and show 404 for unknown routes', async ({ page }) => {
        // Navigate to About
        await page.locator('.nav-links a:has-text("About")').click();
        await expect(page).toHaveURL(/#\/about/);
        await expect(page.locator('.content-view h1')).toHaveText('ℹ️ About EUIX Router');

        // Navigate to invalid route
        await page.goto('/router_demo.html#/unknown/route/path');
        await expect(page.locator('.content-view h1')).toHaveText('404 - Route Not Found');
    });

    test('should navigate to homepage when clicking the header logo', async ({ page }) => {
        // Navigate to Projects
        await page.goto('/router_demo.html#/projects/1');
        await expect(page.locator('.content-view h1')).toHaveText('Next-Gen UI Engine');

        // Click Logo in Header
        await page.locator('header.app-header a.logo-box').click();
        await expect(page).toHaveURL(/#\//);

        // Verify Home view is rendered
        await expect(page.locator('.content-view h1')).toHaveText('🚀 Welcome to EUIX Router');
    });
});
