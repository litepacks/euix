# Vanilla .EUIX Engine

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Build Tool: Vite](https://img.shields.io/badge/Build%20Tool-Vite-646CFF.svg)](https://vitejs.dev/)
[![Test Suite: Vitest](https://img.shields.io/badge/Vitest-100%25%20Passed-brightgreen.svg)]()
[![E2E Suite: Playwright](https://img.shields.io/badge/Playwright-100%25%20Passed-brightgreen.svg)]()

---

## ❓ What is .EUIX Engine?

**Vanilla .EUIX Engine** is an ultra-lightweight, zero-dependency, high-performance web framework designed for modern browsers. It processes declarative XML/HTML templates (`.EUIX` format), reactive data models (`<data_model>`), and event-driven actions (`<on_click>`, `<on_drop>`, `<on_mount>`) directly into fine-grained native browser DOM elements with **zero Virtual DOM overhead**.

### Why .EUIX?
- **⚡ No Virtual DOM Overhead:** Bypasses Virtual DOM diffing algorithms. State mutations update only the exact target DOM node in-place (<0.4ms latency).
- **📝 Declarative XML Syntax:** Build full web applications using intuitive `<flex>`, `<grid>`, `<data_model>`, `<constants>`, `<if>`, `<for_each>`, and event action tags.
- **🛡️ Component-Scoped Isolation:** Modular components (`<component_def>`) with component-scoped API client configurations (`<api_config>`), design tokens (`<constants>`), and isolated reactive states.
- **🗂️ Native Drag & Drop + Touch Support:** Declarative HTML5 & Pointer Drag & Drop (`draggable="true"`, `<on_dragstart>`, `<on_drop>`) with zero-lag floating drag previews (`#euix-drag-ghost`).

---

## 🚀 Usage Guide

### 1. Embedded HTML Script Spec (`type="application/euix"`):
```html
<!DOCTYPE html>
<html>
<head>
  <script src="dist/EUIXEngine.umd.js"></script>
</head>
<body>
  <div id="app"></div>

  <!-- Declarative EUIX Application Spec -->
  <script type="application/euix" target="#app">
  <uid_spec>
      <data_model>
          <state id="counter">0</state>
          <state id="tasks" type="array">
              <item id="1" title="Learn EUIX Engine" status="done" />
              <item id="2" title="Build Drag & Drop App" status="todo" />
          </state>
      </data_model>

      <flex direction="column" gap="16" class="p-6 bg-white rounded-2xl shadow-xl">
          <h1 class="text-xl font-bold text-slate-800">Counter: {data.counter}</h1>
          <flex direction="row" gap="8">
              <button class="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold cursor-pointer">
                  <on_click action="SET_STATE">
                      <path>data.counter</path>
                      <value>{data.counter + 1}</value>
                  </on_click>
                  ➕ Increment
              </button>
          </flex>

          <!-- List Rendering & Drag Drop -->
          <for_each items="{data.tasks}" var="task">
              <div draggable="true" data-id="{task.id}" class="p-3 bg-slate-50 rounded-lg flex justify-between">
                  <span>{task.title}</span>
                  <button class="text-rose-500 font-bold cursor-pointer">
                      <on_click action="MUTATE_STATE" operation="REMOVE">
                          <path>data.tasks</path>
                          <index>{task._index}</index>
                      </on_click>
                      ✕
                  </button>
              </div>
          </for_each>
      </flex>
  </uid_spec>
  </script>
</body>
</html>
```

### 2. Programmatic JavaScript API:
```javascript
import EUIXEngine from './src/EUIXEngine.js';

// Mount EUIX XML spec directly to a target container
const engine = EUIXEngine.mount(xmlString, '#app');

// Programmatically inspect or mutate reactive state
console.log(engine.getState('counter'));
engine.setState('counter', 10);

// Programmatically revalidate API data or persist state
await engine.revalidateApi('data.user_list');
```

---

## 📦 Bundle Sizes & Optimization

Thanks to Terser AST minification and Vite/Rollup tree-shaking optimizations, EUIX Engine delivers an extremely small footprint:

| Dist File | Format / Description | Raw Size | Compressed (Gzip) |
| :--- | :--- | :--- | :--- |
| **`dist/EUIXEngine.umd.js`** | **EUIX Engine Core (Minified UMD Build)** | **67.4 KB** | **18.7 KB** |
| **`dist/EUIXEngine.es.js`** | **EUIX Engine Core (Modern ESM Build)** | **102.5 KB** | **21.4 KB** |
| **`dist/EUIXDevTools.umd.js`** | **EUIX DevTools Inspector (Standalone Plugin)** | **14.1 KB** | **4.2 KB** |

---

## ⚡ Performance Benchmark Matrix (`js-framework-benchmark`)

EUIX Engine bypasses Virtual DOM overhead by manipulating native browser DOM elements directly. Proxy-based **Fine-Grained Reactivity** ensures that state changes update only the exact target DOM node in-place.

| Benchmark Operation | Scale | Duration (ms) | Description |
| :--- | :--- | :--- | :--- |
| **Initial XML Mount** | Full App Spec | **< 2.5 ms** | XML parsing, Data Model & DOM tree creation |
| **Clear All Rows** | **1,000 Items** | **5.3 ms** | Batch unmount and GC DOM removal |
| **Single State Mutation** | 1 Item Field | **0.4 ms** | Direct fine-grained node mutation |
| **Interaction Latency (INP)** | Button Click -> DOM | **4.0 ms** | Click event to DOM paint (<16ms 60fps budget) |
| **Partial Row Update** | 1,000 Items (10th row) | **268 ms** | Selective re-render of matching items |
| **Swap 2 Rows** | 1,000 Items | **833 ms** | Re-ordering 2 items in 1,000 item list |
| **Bulk Item Push (`PUSH`)** | **1,000 Items** | **~ 890 ms** | In-place DOM node creation (batch render) |
| **Append 1,000 Rows** | 1,000 -> 2,000 Items | **1,603 ms** | Append batch rendering |

### 🌐 Real Chrome Browser Benchmark (Playwright E2E with V8 JIT & GPU Painting)

| Benchmark Operation | Scale | Real Chrome Duration | V8 JIT & GPU Paint Performance |
| :--- | :--- | :--- | :--- |
| **1,000 Rows Render & Paint** | **1,000 Items** | **42.8 ms** | 🔥 Ultra-fast V8 JIT + Native DOM creation |
| **3,000 Rows Render & Paint** | **3,000 Items** | **102.3 ms** | 🚀 Full Layout & Rasterization in ~100ms |
| **Clear All 1,000 Rows** | **1,000 Items** | **20.5 ms** | ⚡ Instant GC Memory Reclamation |
| **Single State Mutation** | 1 Field | **7.8 ms** | ⚡ In-place Fine-Grained Node Update |

---

## ✨ Key Features & Capability Matrix

- **🗂️ Native & Pointer Drag & Drop (`draggable="true"`, `<on_dragstart>`, `<on_drop>`):** Fine-grained HTML5 & Pointer Drag & Drop support with zero-lag custom floating drag preview (`#euix-drag-ghost`) and automatic `dragover` preventDefault handling.
- **🔀 Reactive List Mutations (`MUTATE_STATE` `PUSH`, `REMOVE`, `UPDATE`, `SWAP`, `MOVE_UP`, `MOVE_DOWN`):** High-performance array list mutations including item insertion, property updates, index deletion, item swapping (`SWAP`), and quick index reordering (`MOVE_UP`, `MOVE_DOWN`).
- **🔄 SWR API Revalidation (`REVALIDATE_API`, `<revalidate>`):** Stale-While-Revalidate API data refetching triggered declaratively or programmatically (`revalidateApi()`).
- **🎨 Design Tokens & Constants (`<constants>`, `<vars>`):** Define reusable CSS utility classes, design tokens, or API URLs at root or component level and reference them via `{const.key}` or `{var.key}` (supports external JSON files via `src="..."`).
- **📡 Declarative & Component-Scoped API Client (`<api_config>`):** Configurable base URL, CORS credentials (`include`/`same-origin`), default headers, timeouts, and request/response interceptors with zero-leakage component-level scoping.
- **📁 External JSON Resource Loading (`src="..."`):** Declaratively fetch initial `<data_model>` states, `<constants>` tokens, or individual `<state>` values directly from JSON files (`<data_model src="...">`, `<constants src="...">`, `loadDataModel()`, `loadConstants()`, `mountAsync()`).
- **⏱️ Lifecycle Timers & Intervals (`<on_interval>`):** Declarative recurring timers with conditional evaluation (`if="..."`) and automatic unmount cleanup.
- **🛑 Infinite Loop Guard:** Built-in reactivity cascade depth guard (>50 updates) and component recursion depth guard (>20 depth) preventing browser freezes or crashes.
- **🛠️ EUIX DevTools Inspector:** Floating Inspector, real-time **State Tree Inspector**, and **Action Log Stream** panel with global `$state` and `$engine` console exposure.
- **🛡️ Contract & E2E Test Suite:** Fully verified with 10 Vitest unit/component/contract/benchmark test files (100% passing) and Playwright E2E browser tests.

---

## 📁 External JSON Resource Loading (`src="..."`)

EUIX Engine supports fetching initial `<data_model>` states, design token `<constants>`, or individual `<state>` values directly from external JSON files:

```xml
<uid_spec>
    <!-- Load design tokens from JSON file -->
    <constants src="/data/app-tokens.json" />

    <!-- Load initial data model states from JSON file -->
    <data_model src="/data/app-config.json">
        <!-- Local fallback states -->
        <state id="local_counter">0</state>
        <!-- Single state from JSON file -->
        <state id="user_profile" src="/api/profile.json" />
    </data_model>

    <flex direction="column">
        <span class="{const.info_banner}">Portal Status: {data.portal_status}</span>
    </flex>
</uid_spec>
```

#### Programmatic JS API:
```javascript
// Programmatically fetch & merge data model or constants from JSON files
await engine.loadDataModel('/data/app-config.json');
await engine.loadConstants('/data/app-tokens.json');

// Flicker-free async mount (awaits all external JSON resources before rendering)
const engine = await EUIXEngine.mountAsync(xml, '#app');
```

---

## 🔒 Component Isolation & Scoping Matrix

Below is a reference of how metadata & configuration tags behave regarding component scoping vs global state:

| Tag / Feature | Scope Level | Leakage Risk | Scoping Behavior & Precedence |
| :--- | :--- | :--- | :--- |
| **`<api_config>`** | Component & Global | 🟢 **Zero Leakage** | Component-level `<api_config>` overrides global config for all XHR calls within that component tree. |
| **`<constants>` / `<vars>`** | Component & Global | 🟢 **Zero Leakage** | Component design tokens inherit from parent components and override parent/global constants locally. |
| **`<on_mount>`, `<on_interval>`** | Component & Element | 🟢 **Zero Leakage** | Timers and lifecycle hooks are tied strictly to the lifecycle of the mounting component instance. |
| **`<state>` / `<data_model>`** | Global Reactive Store | 🟡 **Shared State** | States reside in global reactive `_rawState`. Component props (`{props.key}`) allow passing isolated values. |

---

## 🎨 Constants & Design Tokens (`<constants>`, `<vars>`)

Define reusable CSS utility class tokens or configuration variables at root or component level:

```xml
<uid_spec>
    <constants src="data/app-tokens.json">
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
