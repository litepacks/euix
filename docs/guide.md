# EUIX Engine - Architecture & Developer Guide (`docs/guide.md`)

Welcome to the **EUIX Engine** developer guide. This guide explains core architectural principles, state reactivity, design token constants, DevTools inspection, and testing practices.

---

## 🚀 Architectural Principles

1. **Zero Dependencies (0-Dep):** No third-party dependencies or heavy runtime frameworks.
2. **Zero Build Step Required (No-Build):** Runs directly in modern web browsers via standard DOM APIs.
3. **Fine-Grained In-Place Reactivity:** Uses Proxy-based state observers to update only affected DOM nodes without Virtual DOM diffing overhead.
4. **Declarative Component Model:** HTML/XML templates with custom component imports (`<import src="..." />`) and definitions (`<component_def>`).
5. **Design Tokens & Constants (`<constants>` / `<vars>`):** Scoped and inherited CSS class and variable tokens.

---

## 🎨 Constants & Design Tokens (`<constants>`, `<vars>`)

EUIX Engine supports defining design tokens and reusable CSS class sets using `<constants>` or `<vars>` nodes:

```xml
<constants>
    <const id="card_box">w-full bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100</const>
    <const id="btn_primary">px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer</const>
    <const id="badge_blue">px-2.5 py-1 bg-blue-50 text-blue-700 font-semibold rounded-lg text-xs</const>
</constants>

<vars>
    <var id="api_base">https://pokeapi.co/api/v2</var>
</vars>
```

### Template & Class Usage:
- `class="{const.card_box}"`
- `<span class="{const.badge_blue}">Active Token</span>`
- `<url>{var.api_base}/pokemon?limit=12</url>`

---

## 📊 State Management (`<data_model>`)

State is declared inside `<data_model>` using `<state>` nodes:

```xml
<data_model>
    <state id="user_name" type="string">John Doe</state>
    <state id="todos" type="array">
        <item id="1" text="Task 1" completed="false" />
    </state>
</data_model>
```

---

## 🛠️ EUIX DevTools Inspector

EUIX DevTools provides a live inspector overlay, State Tree drawer, and Action log stream:

- **Shortcut:** Press **`Alt + Shift + I`** or **`Escape`** to toggle.
- **State Drawer:** View all reactive states in real time (`$state`).
- **Action Log Stream:** Streams every `SET_STATE`, `MUTATE_STATE`, and `XHR` execution.
- **Console API:** Access `window.$state` and `window.$engine` directly in browser dev tools.

```javascript
// Programmatic DevTools Activation
engine.enableDevTools();
```

---

## 🧪 Testing & Verification

EUIX Engine includes comprehensive unit, component, contract, and browser E2E test suites:

```bash
# Run Vitest Unit, Component, Benchmark & Contract Tests (38 Tests)
npm run test

# Run Playwright Real Browser E2E Tests (7 Tests)
npm run test:e2e
```

---

## ⚡ Performance Benchmarks

```javascript
// Run live performance benchmark
const report = EUIXEngine.runBenchmark(1000);
console.log(report.durationMs, report.opsPerSec);
```

| Scale | Duration (ms) | Ops/sec |
| :--- | :--- | :--- |
| **1,000 Bulk Render** | ~ 170 ms | ~ 7,600 ops/sec |
| **3,000 Bulk Render** | ~ 300 ms | ~ 12,500 ops/sec |
| **In-place Single State Update** | **0.12 ms** | Instant |
