---
title: Testing & Playwright
description: Unit testing components with Vitest/JSDOM and end-to-end testing with Playwright helpers.
order: 6
group: Guides
---

# Testing & Quality Assurance

EUIX applications can be thoroughly tested using standard Node.js test runners (like **Vitest**) and browser automation tools (like **Playwright**).

---

## 🧪 1. Unit Testing with Vitest & JSDOM

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { EUIXEngine } from 'euixjs';

describe('Counter Application', () => {
  let container;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
  });

  it('increments counter on button click', async () => {
    const xml = `
      <uid_spec>
        <data_model>
          <state id="count" type="number">0</state>
        </data_model>
        <div>
          <span id="label">{data.count}</span>
          <button id="inc-btn">
            <on_click action="SET_STATE">
              <path>data.count</path>
              <value>{data.count + 1}</value>
            </on_click>
            +1
          </button>
        </div>
      </uid_spec>
    `;

    const engine = EUIXEngine.mount(xml, container);
    
    // Initial state assertion
    expect(container.querySelector('#label').textContent).toBe('0');

    // Simulate click
    container.querySelector('#inc-btn').click();

    // Wait for microtask batching
    await new Promise((r) => setTimeout(r, 10));

    expect(container.querySelector('#label').textContent).toBe('1');
    expect(engine.getState('count')).toBe(1);
  });
});
```

---

## 🎭 2. E2E Testing with Playwright Helpers (`euixjs/playwright`)

EUIX exports official Playwright utilities for deterministic E2E assertions:

```javascript
import { test, expect } from '@playwright/test';
import { euix } from 'euixjs/inspector/playwright';

test('completes task creation flow', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  const app = euix(page);
  await app.waitForIdle();

  // Type new task title
  await page.fill('input[placeholder="Enter task..."]', 'Write Unit Tests');
  await page.click('button:has-text("Add Task")');

  // Verify DOM updated
  await expect(page.locator('text=Write Unit Tests')).toBeVisible();
});
```

---

## 🧭 Next Section: Examples & Tutorials

Step through complete, functional application examples in **[Counter Widget](/examples/counter)**.
