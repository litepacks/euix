import { test, expect } from '@playwright/test';
import { euix } from '../src/plugins/inspector/playwright.js';

test.describe('EUIX Engine Real Chrome Browser Benchmark Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/playground');
    await page.locator('h1').first().waitFor();
    await euix(page).waitForIdle();
  });

  test('should benchmark Real Chrome 1,000 Rows Render & Paint', async ({ page }) => {
    const loadBtn = page.locator('button:has-text("Load 1,000 Items")');
    await expect(loadBtn).toBeVisible();

    await loadBtn.click();
    await euix(page).waitForIdle();

    const itemCard = page.locator('span:has-text("High-Frequency Telemetry Packet")').first();
    await expect(itemCard).toBeVisible();
  });

  test('should benchmark Real Chrome Fine-Grained Single State Mutation', async ({ page }) => {
    const counterSpan = page.locator('.text-5xl.font-black.font-mono').first();
    await expect(counterSpan).toHaveText('0');

    // Click +
    await page.locator('button:text-is("+")').click();
    await euix(page).waitForIdle();
    await expect(counterSpan).toHaveText('1');
  });

  test('should benchmark Real Chrome Clear 1,000 Rows', async ({ page }) => {
    const loadBtn = page.locator('button:has-text("Load 1,000 Items")');
    await loadBtn.click();
    await euix(page).waitForIdle();

    const clearBtn = page.locator('button:has-text("Clear")').first();
    if (await clearBtn.count() > 0) {
      await clearBtn.click();
      await euix(page).waitForIdle();
    }
  });
});
