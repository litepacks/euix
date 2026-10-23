import { test, expect } from '@playwright/test';

test.describe('EUIX Declarative Island Auto-Mount E2E Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/declarative_demo.html', { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.euix-mounted', { timeout: 10000 });
  });

  test('should mount remote XML component with props and state overrides (Island #1 & #2)', async ({ page }) => {
    const islands = page.locator('div[data-euix="/counter.xml"]');
    await expect(islands).toHaveCount(2);

    // Island #1 assertions
    const island1 = islands.nth(0);
    await expect(island1).toHaveClass(/euix-mounted/);
    await expect(island1.locator('h3')).toHaveText('Canlı Sayaç #1');
    const island1Count = island1.locator('.text-5xl');
    await expect(island1Count).toHaveText('10');

    // Island #2 assertions
    const island2 = islands.nth(1);
    await expect(island2).toHaveClass(/euix-mounted/);
    await expect(island2.locator('h3')).toHaveText('Canlı Sayaç #2');
    const island2Count = island2.locator('.text-5xl');
    await expect(island2Count).toHaveText('100');

    // Increment Island #1 (+1)
    await island1.locator('button:text-is("+")').click();
    await expect(island1Count).toHaveText('11');

    // Verify Island #2 is completely isolated and unchanged
    await expect(island2Count).toHaveText('100');

    // Decrement Island #2 (-1)
    await island2.locator('button:text-is("-")').click();
    await expect(island2Count).toHaveText('99');
    await expect(island1Count).toHaveText('11');
  });

  test('should mount template reference with props and toggle state (Island #3)', async ({ page }) => {
    const island3 = page.locator('div[data-euix="#quick-card"]');
    await expect(island3).toHaveCount(1);
    await expect(island3).toHaveClass(/euix-mounted/);
    await expect(island3.locator('h4')).toHaveText('Yazar: Ahmet');

    const toggleBtn = island3.locator('button');
    await expect(toggleBtn).toHaveText('🤍 Beğen');

    await toggleBtn.click();
    await expect(toggleBtn).toHaveText('❤️ Beğenildi');

    await toggleBtn.click();
    await expect(toggleBtn).toHaveText('🤍 Beğen');
  });

  test('should support global window.euix API in browser', async ({ page }) => {
    const result = await page.evaluate(() => {
      return {
        hasEuix: typeof window.euix === 'object',
        hasMount: typeof window.euix.mount === 'function',
        hasScan: typeof window.euix.scan === 'function',
        hasGet: typeof window.euix.get === 'function',
        instancesCount: window.euix.instances ? window.euix.instances.size : 0,
      };
    });

    expect(result.hasEuix).toBe(true);
    expect(result.hasMount).toBe(true);
    expect(result.hasScan).toBe(true);
    expect(result.hasGet).toBe(true);
    expect(result.instancesCount).toBeGreaterThanOrEqual(3);
  });
});
