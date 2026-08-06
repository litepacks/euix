import { test, expect } from '@playwright/test';

test.describe('EUIX Engine Real Chrome Browser Benchmark Suite', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should benchmark Real Chrome 1,000 Rows Render & Paint', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const EUIXEngine = window.EUIXEngine || window.EUIXEnginePkg;
      const container = document.createElement('div');
      container.id = 'bench-container-1k';
      document.body.appendChild(container);

      const xml = `
      <uid_spec>
          <data_model>
              <state id="rows" type="array"></state>
          </data_model>
          <flex direction="column">
              <for_each items="{data.rows}" var="row">
                  <flex direction="row" align="center" gap="8">
                      <component type="text">{row.label}</component>
                  </flex>
              </for_each>
          </flex>
      </uid_spec>
      `;

      const engine = EUIXEngine.mount(xml, '#bench-container-1k');
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: `${i}`, label: `Real Chrome Row ${i}` }));

      const start = performance.now();
      engine.setState('rows', items);
      
      // Wait for next animation frame to guarantee layout & paint completion
      await new Promise(requestAnimationFrame);
      const duration = performance.now() - start;

      const elementCount = container.querySelectorAll('span').length;
      container.remove();

      return { duration, elementCount };
    });

    console.log(`\n[Real Chrome E2E Bench] 1,000 Rows Render & Paint: ${result.duration.toFixed(2)} ms`);
    expect(result.elementCount).toBe(1000);
    expect(result.duration).toBeGreaterThan(0);
  });

  test('should benchmark Real Chrome 3,000 Rows Render & Paint', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const EUIXEngine = window.EUIXEngine || window.EUIXEnginePkg;
      const container = document.createElement('div');
      container.id = 'bench-container-3k';
      document.body.appendChild(container);

      const xml = `
      <uid_spec>
          <data_model>
              <state id="rows" type="array"></state>
          </data_model>
          <flex direction="column">
              <for_each items="{data.rows}" var="row">
                  <flex direction="row" align="center" gap="8">
                      <component type="text">{row.label}</component>
                  </flex>
              </for_each>
          </flex>
      </uid_spec>
      `;

      const engine = EUIXEngine.mount(xml, '#bench-container-3k');
      const items = Array.from({ length: 3000 }, (_, i) => ({ id: `${i}`, label: `Chrome Row ${i}` }));

      const start = performance.now();
      engine.setState('rows', items);
      
      await new Promise(requestAnimationFrame);
      const duration = performance.now() - start;

      const elementCount = container.querySelectorAll('span').length;
      container.remove();

      return { duration, elementCount };
    });

    console.log(`[Real Chrome E2E Bench] 3,000 Rows Render & Paint: ${result.duration.toFixed(2)} ms`);
    expect(result.elementCount).toBe(3000);
  });

  test('should benchmark Real Chrome Fine-Grained Single State Mutation', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const EUIXEngine = window.EUIXEngine || window.EUIXEnginePkg;
      const container = document.createElement('div');
      container.id = 'bench-container-single';
      document.body.appendChild(container);

      const xml = `
      <uid_spec>
          <data_model>
              <state id="counter" type="string">0</state>
          </data_model>
          <flex direction="column">
              <span id="fine_span">{data.counter}</span>
          </flex>
      </uid_spec>
      `;

      const engine = EUIXEngine.mount(xml, '#bench-container-single');

      const start = performance.now();
      engine.setState('counter', '99999');
      
      await new Promise(requestAnimationFrame);
      const duration = performance.now() - start;

      const text = container.querySelector('#fine_span').textContent;
      container.remove();

      return { duration, text };
    });

    console.log(`[Real Chrome E2E Bench] Single State Fine-Grained Mutation: ${result.duration.toFixed(2)} ms`);
    expect(result.text).toBe('99999');
  });

  test('should benchmark Real Chrome Clear 1,000 Rows', async ({ page }) => {
    const result = await page.evaluate(async () => {
      const EUIXEngine = window.EUIXEngine || window.EUIXEnginePkg;
      const container = document.createElement('div');
      container.id = 'bench-container-clear';
      document.body.appendChild(container);

      const xml = `
      <uid_spec>
          <data_model>
              <state id="rows" type="array"></state>
          </data_model>
          <flex direction="column">
              <for_each items="{data.rows}" var="row">
                  <flex direction="row"><component type="text">{row.label}</component></flex>
              </for_each>
          </flex>
      </uid_spec>
      `;

      const engine = EUIXEngine.mount(xml, '#bench-container-clear');
      const items = Array.from({ length: 1000 }, (_, i) => ({ id: `${i}`, label: `Item ${i}` }));
      engine.setState('rows', items);

      const start = performance.now();
      engine.setState('rows', []);
      
      await new Promise(requestAnimationFrame);
      const duration = performance.now() - start;

      const elementCount = container.querySelectorAll('span').length;
      container.remove();

      return { duration, elementCount };
    });

    console.log(`[Real Chrome E2E Bench] Clear All 1,000 Rows: ${result.duration.toFixed(2)} ms\n`);
    expect(result.elementCount).toBe(0);
  });
});
