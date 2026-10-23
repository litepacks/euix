---
name: euix
description: >-
  Comprehensive guide, patterns, and cheatsheet for building and testing applications with EUIX Engine (euixjs).
  Use when writing, refactoring, or reviewing EUIX XML/HTML markup, declarative island auto-mounting (data-euix),
  state models, action shorthands, EUIX Doctor static validation, and modular plugins.
---

# EUIX Engine: Declarative XML & Island Architecture Guide

EUIX (`euixjs`) is an ultra-lightweight, zero Virtual DOM declarative UI runtime that directly mutates affected DOM nodes via microtask batching (`queueMicrotask`).

---

## 🏝️ 1. Declarative Island Mount Architecture (`data-euix`)

Drop reactivity into any server-rendered or static HTML page (Blade, Django, WordPress, Rails, static HTML) without a build step:

```html
<!-- 1. Single script tag with `euix` attribute activates auto-scanner and MutationObserver -->
<script src="https://unpkg.com/euixjs@latest/dist/EUIXEngine.umd.js" euix></script>

<!-- Option A: Remote component XML with props and initial state overrides -->
<div data-euix="/components/counter.xml" data-prop-title="Live Counter" data-state-count="10"></div>

<!-- Option B: Template reference by element ID -->
<div data-euix="#card-template" data-prop-author="Ahmet"></div>

<template id="card-template">
  <uid_spec>
    <div class="card">
      <h4>Author: {props.author}</h4>
    </div>
  </uid_spec>
</template>

<!-- Option C: Inline XML directly inside attribute -->
<div data-euix="<uid_spec><span>Count: {data.count}</span></uid_spec>" data-state-count="5"></div>
```

### Global Programmatic API (`window.euix`)
```js
// Mount element imperatively
const engine = await window.euix.mountElement(element);

// Update props dynamically without re-mounting
engine.setProps({ title: 'New Title', step: 5 });

// Retrieve engine instance for any element
const inst = window.euix.get('#my-island');

// Scan container for newly inserted [data-euix] elements
await window.euix.scan(document.body);

// Cleanly unmount element and clear event listeners
window.euix.unmount(element);
```

---

## 📜 2. XML Component Specification (`<uid_spec>`)

```xml
<uid_spec>
  <!-- 1. Typed Reactive State Model -->
  <data_model>
    <state id="counter" type="number">0</state>
    <state id="user_name" type="string">Guest</state>
    <state id="is_active" type="boolean">true</state>
    <state id="items" type="array">[{"id": 1, "title": "First Item"}]</state>
  </data_model>

  <!-- 2. Layout & DOM Bindings -->
  <flex direction="column" gap="16" class="p-6 bg-slate-900 text-white rounded-2xl">
    <h3>{props.title || "Default Title"}</h3>
    <div>Count: <span class="font-mono text-emerald-400">{data.counter}</span></div>

    <!-- 3. Action Shorthands -->
    <flex direction="row" gap="8">
      <button on_click:set="counter={data.counter + 1}">+1</button>
      <button on_click:set="counter=0">Reset</button>
      <button on_click:toggle="is_active">Toggle Active</button>
    </flex>

    <!-- Two-way form input binding -->
    <input bind="user_name" class="input" />

    <!-- Keyed Array Reconciliation -->
    <for_each items="{data.items}" var="item" key="id">
      <div class="row">
        <span>{item.title}</span>
        <button on_click:mutate="items.REMOVE where id={item.id}">Delete</button>
      </div>
    </for_each>
  </flex>
</uid_spec>
```

### Supported State Data Types (`type="..."`)
- `number`: Parses into native number, evaluates `{data.counter + 1}` numerically (prevents string concatenation `"01"`).
- `string`: Text string, two-way bound via `<input bind="state_id" />`.
- `boolean`: Native boolean, toggled via `on_click:toggle="key"`.
- `array`: Native array, rendered via `<for_each key="id">`, mutated via `items.PUSH()`, `items.REMOVE`, `items.CLEAR`.
- `object`: JSON object, accessed via dot-notation `{data.user.name}`.

---

## ⚡ 3. Declarative Action Shorthands

| Shorthand | Example Syntax | Behavior |
| :--- | :--- | :--- |
| `on_click:set` | `on_click:set="count={data.count + 1}"` | Evaluates math/expression and updates state path |
| `on_click:set` | `on_click:set="theme={data.theme == 'dark' ? 'light' : 'dark'}"` | Evaluates ternary expression |
| `on_click:toggle` | `on_click:toggle="is_modal_open"` | Toggles boolean state between `true` and `false` |
| `on_click:mutate` | `on_click:mutate="items.PUSH({id: 2, title: 'New'})"` | Appends new item to array state |
| `on_click:mutate` | `on_click:mutate="items.REMOVE where id={item.id}"` | Removes item matching criteria |
| `on_click:mutate` | `on_click:mutate="items.CLEAR"` | Empties array |
| `on_click:revalidate`| `on_click:revalidate="get_users"` | Revalidates SWR REST API endpoint |
| `on_click:call` | `on_click:call="saveUser"` | Calls registered JS action (`EUIX.action('saveUser', ...)`) |

---

## 🩺 4. Static Validation with EUIX Doctor

**Rule:** Always validate markup and components with `@euix/doctor` before committing changes.

```bash
# Scan directory or component
node packages/core/bin/euix.js doctor apps/playground
node packages/core/bin/euix.js doctor path/to/Component.xml

# Auto-fix rule EUIX0001 (wraps JS scripts in CDATA)
node packages/core/bin/euix.js doctor path/to/App.xml --fix

# Run safe generated test scenarios statically
node packages/core/bin/euix.js doctor apps/playground --test
```

### Critical Doctor Diagnostics
- `EUIX0001` (error): Wrap inline JS in `<![CDATA[ ... ]]>` inside `<computed>`, `<step>`, or `RUN_SCRIPT`.
- `EUIX1001` (error): Action writes to state path missing from `<data_model>`.
- `EUIX1101` (error): Dependency cycle detected in `<computed>` expressions.
- `EUIX1201` (warning): Watcher writes to the exact state key it watches (loop risk).
- `EUIX1401` (error): Missing component source or unresolved child component.

---

## 🧪 5. Testing & Verification Standards

### Vitest Unit & Integration
```bash
# Run unit tests
npm test

# Run specific test file
npx vitest run tests/declarative_automount.test.js
```

### Playwright Cross-Browser E2E (Chromium, Firefox, WebKit)
```bash
# Run browser E2E suite
npx playwright test

# Run specific E2E test
npx playwright test apps/playground/e2e/declarative_automount.spec.js
```

### Monorepo Release Gate & Version Bump
```bash
# Automatically bump versions across all monorepo packages (patch, minor, or major)
npm run version:bump
npm run version:bump:minor
npm run version:bump:major

# Verify all release invariants
node scripts/verify-release.js
```
