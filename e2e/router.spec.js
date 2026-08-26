import { test, expect } from '@playwright/test';
import { euix } from '../src/plugins/inspector/playwright.js';

test.describe('EUIX Web Router E2E Browser Test Suite', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/#/router-showcase', { waitUntil: 'domcontentloaded' });
        await page.locator('h1').first().waitFor({ timeout: 15000 });
        await euix(page).waitForIdle();
    });

    test('should render router showcase view and header', async ({ page }) => {
        const h1 = page.locator('h1').first();
        await expect(h1).toContainText('Declarative Routing');

        // Check active project 1 title in dynamic outlet view
        const projectTitle = page.locator('h2:has-text("Next-Gen Core UI Engine")');
        await expect(projectTitle).toBeVisible();
    });

    test('should switch projects and update outlet view reactively', async ({ page }) => {
        // Click Project 2 (Spatial Leaflet Studio)
        const proj2Btn = page.locator('button:has-text("Spatial Leaflet Studio")');
        await proj2Btn.click();
        await euix(page).waitForIdle();

        await expect(page.locator('h2:has-text("Spatial Leaflet Studio")')).toBeVisible();

        // Click Project 3 (Resilient API Pipeline)
        const proj3Btn = page.locator('button:has-text("Resilient API Pipeline")');
        await proj3Btn.click();
        await euix(page).waitForIdle();

        await expect(page.locator('h2:has-text("Resilient API Pipeline")')).toBeVisible();
    });

    test('should switch nested tabs (Overview, Tasks, Settings) preserving active project', async ({ page }) => {
        // Click Tasks tab
        const tasksTab = page.locator('button:has-text("Tasks")');
        await tasksTab.click();
        await euix(page).waitForIdle();

        await expect(page.locator('span:has-text("TASKS TAB ACTIVE")')).toBeVisible();

        // Click Settings tab
        const settingsTab = page.locator('button:has-text("Settings")');
        await settingsTab.click();
        await euix(page).waitForIdle();

        await expect(page.locator('span:has-text("SETTINGS TAB ACTIVE")')).toBeVisible();
    });

    test('should navigate via top navigation links across SPA routes', async ({ page }) => {
        // 1. Click Charts route link
        const chartsLink = page.locator('route-link:has-text("Charts"), a:has-text("Charts")').first();
        await chartsLink.click();
        await euix(page).waitForIdle();

        await expect(page).toHaveURL(/#\/charts/);
        await expect(page.locator('h1').first()).toContainText('Declarative XML Charts');

        // 2. Click Home link
        const homeLink = page.locator('route-link:has-text("Home"), a:has-text("Home")').first();
        await homeLink.click();
        await euix(page).waitForIdle();

        await expect(page).toHaveURL(/#\/?$/);
    });

    test('should navigate to homepage when clicking the header logo', async ({ page }) => {
        await page.goto('/#/navigator');
        await euix(page).waitForIdle();

        // Click header logo link
        const logo = page.locator('header a, header route-link').first();
        await logo.click();
        await euix(page).waitForIdle();

        // Verify back on home
        await expect(page).toHaveURL(/#\/?$/);
    });
});
