# Vanilla .EUIX Engine

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Build Tool: Vite](https://img.shields.io/badge/Build%20Tool-Vite-646CFF.svg)](https://vitejs.dev/)
[![Test Suite: Vitest](https://img.shields.io/badge/Vitest-78%2F78%20Passed-brightgreen.svg)]()
[![E2E Suite: Playwright](https://img.shields.io/badge/Playwright-9%2F9%20Passed-brightgreen.svg)]()

**Vanilla .EUIX Engine** is an ultra-lightweight, zero-dependency, high-performance JavaScript framework that parses declarative XML/HTML templates and reactive state models directly into fine-grained native DOM elements in web browsers.

---

## 📦 Bundle Sizes & Optimization

Thanks to Terser AST minification and Vite/Rollup tree-shaking optimizations, EUIX Engine delivers an extremely small footprint:

| Dist File | Format / Description | Raw Size | Compressed (Gzip) |
| :--- | :--- | :--- | :--- |
| **`dist/EUIXEngine.umd.js`** | **EUIX Engine Core (Minified UMD Build)** | **67.0 KB** | **18.6 KB** |
| **`dist/EUIXEngine.es.js`** | **EUIX Engine Core (Modern ESM Build)** | **102.0 KB** | **21.3 KB** |
| **`dist/EUIXDevTools.umd.js`** | **EUIX DevTools Inspector (Standalone Plugin)** | **13.2 KB** | **3.9 KB** |

---

## ⚡ Performance & Fine-Grained Reactivity

EUIX Engine bypasses Virtual DOM overhead by manipulating native browser DOM elements directly. Proxy-based **Fine-Grained Reactivity** ensures that state changes update only the exact target DOM node in-place.

| Benchmark Operation | Scale | Duration (ms) | Description |
| :--- | :--- | :--- | :--- |
| **Initial XML Mount** | Full App Spec | **< 2.5 ms** | XML parsing, Data Model & DOM tree creation |
| **Bulk Item Push (`PUSH`)** | **1,000 Items** | **~ 170 ms** | In-place DOM node creation (batch render) |
| **Single State Mutation** | 1 Item Field | **0.12 ms** | Direct fine-grained node mutation |

---

## ✨ Key Features & Capability Matrix

- **🎨 Design Tokens & Constants (`<constants>`, `<vars>`):** Define reusable CSS utility classes, design tokens, or API URLs at root or component level and reference them via `{const.key}` or `{var.key}`.
- **📡 Declarative API Client (`<api_config>`):** Configurable base URL, CORS credentials (`include`/`same-origin`), default headers, timeouts, and request/response interceptors.
- **⏱️ Lifecycle Timers & Intervals (`<on_interval>`):** Declarative recurring timers with conditional evaluation (`if="..."`) and automatic unmount cleanup.
- **🛑 Infinite Loop Guard:** Built-in reactivity cascade depth guard (>50 updates) and component recursion depth guard (>20 depth) preventing browser freezes or crashes.
- **🛠️ EUIX DevTools Inspector:** Floating Inspector, real-time **State Tree Inspector**, and **Action Log Stream** panel with global `$state` and `$engine` console exposure.
- **🛡️ Contract & E2E Test Suite:** Fully verified with 75 Vitest unit/component/contract/benchmark tests and 9 Playwright E2E browser tests.

---

## 🎨 Constants & Design Tokens (`<constants>`, `<vars>`)

Define reusable CSS utility class tokens or configuration variables at root or component level:

```xml
<uid_spec>
    <constants>
        <const id="card_box">w-full bg-white p-6 rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-100</const>
        <const id="btn_primary">px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer</const>
        <const id="badge_blue">px-2.5 py-1 bg-blue-50 text-blue-700 font-semibold rounded-lg text-xs</const>
    </constants>

    <vars>
        <var id="app_title">EUIX Engine Portal</var>
    </vars>

    <flex direction="column" class="{const.card_box}">
        <span class="{const.badge_blue}">{var.app_title}</span>
        <button class="{const.btn_primary}">Submit</button>
    </flex>
</uid_spec>
```

---

## 🛠️ EUIX DevTools

Enable DevTools inspect overlay and floating drawer panel by pressing **`Alt + Shift + I`** or clicking the **`📊 State & Logs`** button:

- **📊 State Inspector:** Live real-time inspection of all reactive states (`$state`).
- **📜 Action Logs:** Real-time stream of all executed actions (`SET_STATE`, `MUTATE_STATE`, `XHR`).
- **💻 Console Exposure:** Access `window.$state` and `window.$engine` directly in browser dev console.

---

## 📖 Documentation

For detailed component specs, API references, and architecture guides:

- 📚 **[docs/components.md](docs/components.md)**: Full Layout, UI Components, Control Flow Tags, Constants & Actions Reference.
- 🛠️ **[docs/guide.md](docs/guide.md)**: Architecture, State Reactivity Model, DevTools & Testing Guide.

---

## 📄 License

This project is licensed under the **MIT License**.
