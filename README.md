# Vanilla .EUIX Engine

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Build Tool: Vite](https://img.shields.io/badge/Build%20Tool-Vite-646CFF.svg)](https://vitejs.dev/)
[![Test Suite: Vitest](https://img.shields.io/badge/Vitest-100%25%20Passed-brightgreen.svg)]()
[![E2E Suite: Playwright](https://img.shields.io/badge/Playwright-100%25%20Passed-brightgreen.svg)]()

---

## 📄 What is .EUIX Engine?

**EUIX Engine** is a declarative UI runtime based on structured XML designed for modern web applications. It allows you to build full reactive web interfaces using **Structured XML** — handling **components** (`<component_def>`), **state management** (`<data_model>`), **REST API integration** (`<on_mount action="XHR">`), **conditional rendering** (`<if>`), **loops** (`<for_each>`), and **direct DOM updates** declaratively inside XML specs with **zero external dependencies** and an **AI-friendly syntax**.

### Why EUIX?
- **📄 Declarative XML Specs:** State management, REST API calls, design tokens, variables, and event listeners all defined declaratively in XML without JS boilerplate.
- **🌳 Parent-Child Component Hierarchy:** Modular component architecture (`<component_def>`) with clean `<imports>`, `<import src="..." />` tags, and parent-to-child prop & state sharing (`{props.key}`).
- **⚡ Direct DOM Updates:** State mutations directly update affected target DOM nodes without Virtual DOM reconciliation overhead.
- **🛡️ Component-Scoped Isolation:** Modular components (`<component_def>`) with component-scoped API client configurations (`<api_config>`), design tokens (`<constants>`), and isolated reactive states.
- **🤖 AI-Agent Friendly:** Structured XML specs allow LLMs and AI coding agents to deterministically parse, generate, and refactor UI code with zero syntactic ambiguity.

> 📖 **Agent & Developer Architecture Guide**: For full architecture, state reactivity, SWR REST API client, scoping matrix, and security guidelines, see [.agents/AGENTS.md](.agents/AGENTS.md).

---

## 🚀 Usage Guide

### 1. Embedded HTML Script Spec (`type="application/euix"`):
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Vanilla .EUIX Engine Quickstart</title>
  <!-- Tailwind CSS & Modern Typography -->
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Inter', sans-serif; }
  </style>
  <script src="https://unpkg.com/euixjs@latest/dist/EUIXEngine.umd.js"></script>
</head>
<body class="bg-slate-100 min-h-screen flex items-center justify-center p-6">
  <div id="app" class="w-full max-w-md"></div>

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

      <flex direction="column" gap="16" class="p-6 bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100">
          <flex direction="row" align="center" justify="between">
              <h1 class="text-xl font-extrabold text-slate-800 tracking-tight">Counter: {data.counter}</h1>
              <span class="px-2.5 py-1 bg-blue-50 text-blue-700 font-bold text-xs rounded-lg border border-blue-100">Declarative UI</span>
          </flex>

          <flex direction="row" gap="8">
              <button class="w-full py-2.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white font-bold rounded-xl text-sm transition-all cursor-pointer shadow-md shadow-blue-500/20">
                  <on_click action="SET_STATE">
                      <path>data.counter</path>
                      <value>{data.counter + 1}</value>
                  </on_click>
                  ➕ Increment
              </button>
          </flex>

          <!-- List Rendering & Drag Drop -->
          <flex direction="column" gap="8" class="pt-2 border-t border-slate-100">
              <for_each items="{data.tasks}" var="task">
                  <div draggable="true" data-id="{task.id}" class="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl flex items-center justify-between border border-slate-100 transition-colors">
                      <span class="text-sm font-semibold text-slate-700">{task.title}</span>
                      <button class="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg font-bold cursor-pointer transition-colors">
                          <on_click action="MUTATE_STATE" operation="REMOVE">
                              <path>data.tasks</path>
                              <index>{task._index}</index>
                          </on_click>
                          ✕
                      </button>
                  </div>
              </for_each>
          </flex>
      </flex>
  </uid_spec>
  </script>
</body>
</html>
```

### 2. Programmatic JavaScript API & NPM Submodules:
```javascript
import { EUIXEngine } from 'euixjs';
import { EUIXDevTools } from 'euixjs/devtools'; // Optional Standalone DevTools Plugin

// Mount EUIX XML spec directly to a target container
const engine = EUIXEngine.mount(xmlString, '#app');

// Programmatically attach DevTools Inspector in development
EUIXDevTools.init(engine);

// Programmatically inspect or mutate reactive state
console.log(engine.getState('counter'));
engine.setState('counter', 10);

// Programmatically revalidate API data or persist state
await engine.revalidateApi('data.user_list');
```

---

## 📦 Bundle Sizes & Optimization

Thanks to Terser AST minification and Vite/Rollup tree-shaking optimizations, EUIX Engine core has been completely decoupled from DevTools, delivering an ultra-small footprint:

| Dist File | Format / Description | Raw Size | Compressed (Gzip) |
| :--- | :--- | :--- | :--- |
| **`dist/EUIXEngine.umd.js`** | **EUIX Engine Core (Minified UMD Build)** | **72.8 KB** | **20.3 KB** |
| **`dist/EUIXEngine.es.js`** | **EUIX Engine Core (Modern ESM Build)** | **139.7 KB** | **28.4 KB** |
| **`dist/EUIXDevTools.umd.js`** | **EUIX DevTools Inspector (Standalone Plugin)** | **15.9 KB** | **4.4 KB** |

---

## ✨ Key Features & Capability Matrix

- **🗂️ Native & Pointer Drag & Drop (`draggable="true"`, `<on_dragstart>`, `<on_drop>`):** Fine-grained HTML5 & Pointer Drag & Drop support with zero-lag custom floating drag preview (`#euix-drag-ghost`) and automatic `dragover` preventDefault handling.
- **🔀 Reactive List Mutations (`MUTATE_STATE` `PUSH`, `REMOVE`, `UPDATE`, `SWAP`, `MOVE_UP`, `MOVE_DOWN`):** High-performance array list mutations including item insertion, property updates, index deletion, item swapping (`SWAP`), and quick index reordering (`MOVE_UP`, `MOVE_DOWN`).
- **🔄 SWR API Revalidation (`REVALIDATE_API`, `<revalidate>`):** Stale-While-Revalidate API data refetching triggered declaratively or programmatically (`revalidateApi()`).
- **🎨 Design Tokens & Constants (`<constants>`, `<vars>`):** Define reusable CSS utility classes, design tokens, or API URLs at root or component level and reference them via `{const.key}` or `{var.key}` (supports external JSON files via `src="..."`).
- **📡 Declarative & Component-Scoped API Client (`<api_config>`):** Configurable base URL (`base_url="..."`), CORS credentials (`include`/`same-origin`), default headers, timeouts, and request/response interceptors with zero-leakage component-level scoping.
  - **Base URL Resolution Rules:**
    1. Action attribute `base_url` overrides component & global defaults.
    2. Relative paths starting with `./` or `../` (e.g. `<url>./components/App.xml</url>`), or actions with `ignore_base_url="true"` / `base_url=""`, automatically bypass `api_config.base_url` to safely load local assets without domain prepending.
- **📁 External JSON Resource Loading (`src="..."`):** Declaratively fetch initial `<data_model>` states, `<constants>` tokens, or individual `<state>` values directly from JSON files (`<data_model src="...">`, `<constants src="...">`, `loadDataModel()`, `loadConstants()`, `mountAsync()`).
- **⏱️ Lifecycle Timers & Intervals (`<on_interval>`):** Declarative recurring timers with conditional evaluation (`if="..."`) and automatic unmount cleanup.
- **📜 External Scripts & Inline Scripting (`<use_script>`, `<use_style>`, `RUN_SCRIPT`):** Declaratively load external JS libraries (e.g. Highlight.js, Canvas-Confetti) and CSS stylesheets. Execute custom JS code snippets safely inside `<on_mount>`, `<on_state_change>`, or `<on_click>` using `action="RUN_SCRIPT"` with `$el`, `$data`, `$engine`, and `$evt` injected in a `new Function()` sandbox (no `eval()`).
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
const engine = new EUIXEngine("#app");
await engine.loadDataModel("/data/app-config.json");
await engine.loadConstants("/data/app-tokens.json");
```

---

## 📜 Declarative External Scripts & Inline Scripting (`<use_script>`, `<use_style>`, `RUN_SCRIPT`)

EUIX Engine supports declaratively loading external JavaScript libraries (e.g. Highlight.js, Canvas-Confetti, Chart.js) and CSS stylesheets directly inside XML templates without writing manual script loader boilerplate.

Custom JavaScript snippets can be executed safely inside lifecycle hooks or event handlers using `action="RUN_SCRIPT"` (backed by a `new Function()` sandbox, avoiding `eval()`):

```xml
<uid_spec>
    <!-- Declarative External JS & CSS Loaders -->
    <use_script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js" />
    <use_style src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/atom-one-dark.min.css" />
    <use_script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/dist/confetti.browser.min.js" />

    <flex direction="column" gap="16">
        <!-- Highlight.js Syntax Highlighting on Mount or State Change -->
        <pre class="bg-slate-900 p-4 rounded-xl">
            <code class="language-javascript">
                <on_mount action="RUN_SCRIPT">
                    if (window.hljs) window.hljs.highlightElement($el);
                </on_mount>
                const engine = new EUIXEngine("#app");
                engine.mount(xmlSpec);
            </code>
        </pre>

        <!-- Canvas Confetti Explosion on Button Click -->
        <button class="px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl">
            <on_click action="RUN_SCRIPT">
                if (window.confetti) confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
            </on_click>
            🎉 Celebrate &amp; Complete Order
        </button>
    </flex>
</uid_spec>
```

#### Injected Script Scope Variables:
- **`$el`**: Target DOM element executing the script.
- **`$data`**: Fine-grained reactive EUIX state Proxy object.
- **`$engine`**: The active EUIXEngine instance.
- **`$evt`**: Triggering DOM Event object (if executed from an event handler).

```javascript
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
