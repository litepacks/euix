# Vanilla .EUIX Engine

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Build Tool: Vite](https://img.shields.io/badge/Build%20Tool-Vite-646CFF.svg)](https://vitejs.dev/)
[![Test Suite: Vitest](https://img.shields.io/badge/Vitest-100%25%20Passed-brightgreen.svg)]()
[![E2E Suite: Playwright](https://img.shields.io/badge/Playwright-100%25%20Passed-brightgreen.svg)]()

---

## 📄 What is .EUIX Engine?

**EUIX Engine** is a declarative UI runtime based on structured XML designed for modern web applications. It allows you to build full reactive web interfaces using **Structured XML** — handling **components** (`<component_def>`), **state management** (`<data_model>`), **Action Composer workflows** (`<action_def>`), **REST API integration** (`<api_endpoint>`), **conditional rendering** (`<if>`), **loops** (`<for_each>`), and **direct DOM updates** declaratively inside XML specs with **zero external dependencies** and an **AI-friendly syntax**.

### Why EUIX?
- **📄 Declarative XML Specs:** State management, REST API calls, design tokens, variables, and event listeners all defined declaratively in XML without JS boilerplate.
- **⚡ High Performance Primitives:** XML AST Caching, Expression AST LRU Caching, Keyed DOM Reconciliation (`key="id"`), State Mutation Batching (`queueMicrotask`), Event Delegation, and `DocumentFragment` DOM Batching.
- **🧩 Modular Plugin Architecture:** Ultra-lightweight core (`euixjs/core`) with tree-shakeable eklenti extensions (`composer`, `api`, `dnd`, `storage`, `collapse`, `dialog`).
- **🌳 Parent-Child Component Hierarchy:** Modular component architecture (`<component_def>`) with clean `<imports>`, `<import src="..." />` tags, and parent-to-child prop & state sharing (`{props.key}`).
- **⚡ Direct DOM Updates:** State mutations directly update affected target DOM nodes without Virtual DOM reconciliation overhead.
- **🛡️ Component-Scoped Isolation:** Modular components (`<component_def>`) with component-scoped API client configurations (`<api_config>`), design tokens (`<constants>`), and isolated reactive states.
- **🤖 AI-Agent Friendly:** Structured XML specs allow LLMs and AI coding agents to deterministically parse, generate, and refactor UI code with zero syntactic ambiguity.

> 📖 **Agent & Developer Architecture Guide**: For full architecture, state reactivity, SWR REST API client, scoping matrix, and security guidelines, see [.agents/AGENTS.md](.agents/AGENTS.md).

---

## ⚡ Performance Benchmarks (`js-framework-benchmark` standard)

EUIX Engine is engineered for maximum performance on modern web applications with zero Virtual DOM overhead:

| Benchmark Scenario | Initial Baseline | Optimized EUIX Engine | Performance Gain |
| :--- | :--- | :--- | :--- |
| **Fine-Grained Single Item Update** | `15.41 ms` | **`0.34 ms`** | ⚡ **~98% Faster** |
| **Swap 2 Rows (1,000 items)** | `1,762.45 ms` | **`14.80 ms`** | 🚀 **~99% Faster** |
| **Partial Update (every 10th row)** | `530.40 ms` | **`33.19 ms`** | ⚡ **~93% Faster** |
| **3,000 Item Bulk Render** | `2,609.51 ms` | **`470.85 ms`** | 🚀 **~82% Faster** |
| **1,000 Item Bulk Render** | `2,007.30 ms` | **`296.17 ms`** | ⚡ **~85% Faster** |
| **Append 1,000 Rows (Total 2,000)** | `1,289.50 ms` | **`155.36 ms`** | 🚀 **~88% Faster** |
| **Interaction Latency (Click -> DOM)** | `15.41 ms` | **`3.99 ms`** | ⚡ **~74% Faster** |
| **Initial XML Mount Latency** | `125.74 ms` | **`25.78 ms`** | 🚀 **~80% Faster** |
| **Total Test Suite Time** | `13.66 s` | **`1.84 s`** | 🔥 **~86% Time Reduction** |

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

          <!-- List Rendering with Keyed DOM Reconciliation -->
          <flex direction="column" gap="8" class="pt-2 border-t border-slate-100">
              <for_each items="{data.tasks}" var="task" key="id">
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

---

### 2. Modular Plugin API (`euixjs/core` + Subpaths)

For custom builds and minimum bundle sizes, load **Lite Core** (`euixjs/core`) and register only the plugins you need:

```javascript
import { EUIXEngineCore } from 'euixjs/core';
import { EUIXComposerPlugin } from 'euixjs/composer';
import { EUIXApiPlugin } from 'euixjs/api';
import { EUIXStoragePlugin } from 'euixjs/storage';
import { EUIXDevTools } from 'euixjs/devtools';

// Register plugins on Lite Core
EUIXEngineCore
  .use(EUIXComposerPlugin)
  .use(EUIXApiPlugin)
  .use(EUIXStoragePlugin);

// Mount spec using Lite Core
const engine = EUIXEngineCore.mount(xmlString, '#app');
EUIXDevTools.init(engine);
```

#### Full Bundle API (`euixjs`)
For full bundle backward compatibility with all plugins pre-registered:
```javascript
import { EUIXEngine } from 'euixjs';
const engine = EUIXEngine.mount(xmlString, '#app');
```

---

## 📦 Subpath Package Exports & Bundle Metrics

| Subpath Import | Module / Description | Raw Size (UMD / ESM) | Compressed (Gzip) |
| :--- | :--- | :--- | :--- |
| **`euixjs/core`** | **`EUIXEngineCore` (Lite Core Build)** | **94.8 kB / 189.4 kB** | **26.3 kB / 37.6 kB** |
| **`euixjs`** | **`EUIXEngine` (Full Bundle Build)** | **143.1 kB / 285.4 kB** | **39.1 kB / 56.0 kB** |
| **`euixjs/animation`** | **Declarative Animation System** | **21.1 kB** | **4.3 kB** |
| **`euixjs/resilience`** | **Resilience Execution Primitives** | **17.0 kB** | **3.5 kB** |
| **`euixjs/api`** | **REST SWR HTTP Client Engine** | **14.5 kB** | **3.4 kB** |
| **`euixjs/reactive`** | **Watch & Computed State System** | **13.9 kB** | **3.3 kB** |
| **`euixjs/composer`** | **Action Composer Workflow System** | **11.9 kB** | **3.1 kB** |
| **`euixjs/dnd`** | **HTML5 & Pointer Drag and Drop** | **5.1 kB** | **1.4 kB** |
| **`euixjs/dialog`** | **Modal Dialog Overlay Component** | **5.4 kB** | **1.6 kB** |
| **`euixjs/collapse`** | **Accordion / Collapse Component** | **3.3 kB** | **1.2 kB** |
| **`euixjs/storage`** | **State Storage & Persistence** | **3.1 kB** | **0.9 kB** |
| **`euixjs/devtools`** | **DevTools Inspector Panel** | **17.0 kB / 21.6 kB** | **4.8 kB / 5.3 kB** |

---

## ✨ Features & Capabilities

- **⚡ Action Composer System (`<action_def>`, `<param>`, `<return>`):** Define reusable named action workflows with parameters (`required="true"`, `default="..."`), sequential step execution, nested action calls, `{result}` data flow propagation, circular loop guards, and programmatic execution (`engine.executeAction()`).
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
- **🛑 Infinite Loop Guard:** Built-in reactivity cascade depth guard (>50 updates), component recursion depth guard (>20 depth), and circular action recursion guard preventing browser freezes or crashes.
- **🛠️ EUIX DevTools Inspector:** Floating Inspector, real-time **State Tree Inspector**, and **Action Log Stream** panel with global `$state` and `$engine` console exposure.
- **🛡️ Contract & E2E Test Suite:** Fully verified with 14 Vitest unit/component/contract/benchmark test files (100% passing) and Playwright E2E browser tests.

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

## 🧩 Dual-Mode State Architecture: Component-Scoped Isolation & Global Stores

EUIX Engine supports a versatile **Dual-Mode State System** that enables both **Application-Wide Shared Stores** and **Strict Component-Scoped Instance Isolation**:

```
                             +-----------------------------------+
                             |     Central Global State Pool     |
                             |  (data.*, global.*, states.xml)   |
                             +-----------------------------------+
                                               ^
                                               | (reads / writes)
                       +-----------------------+-----------------------+
                       |                                               |
                       v                                               v
        +-----------------------------+                 +-----------------------------+
        | Component Instance 1        |                 | Component Instance 2        |
        | (e.g. <accordion-card />)   |                 | (e.g. <accordion-card />)   |
        +-----------------------------+                 +-----------------------------+
        | Private Local State         |                 | Private Local State         |
        | (local.isOpen = true)       |                 | (local.isOpen = false)      |
        +-----------------------------+                 +-----------------------------+
```

### 1. Global / Shared State Store (`states.xml` / `scope="global"`)
When a component or external file (e.g. `states.xml`) defines global states or uses `<data_model scope="global">`, its states are merged into the central state pool and become accessible across the entire application:

```xml
<!-- components/states.xml -->
<component_def name="app-store">
  <data_model scope="global">
    <state id="theme">dark</state>
    <state id="user" type="object">{"name": "Ahmet", "role": "Admin"}</state>
  </data_model>
</component_def>
```

### 2. Component-Scoped Instance Isolation (`isolated="true"` / `scope="local"`)
When a component is marked with `isolated="true"` (or `<data_model scope="local">` / `<state scope="local">`), each rendered instance of that component receives its own independent reactive state. Mutating local state on one instance does not affect any other instance:

```xml
<!-- components/AccordionCard.xml -->
<component_def name="accordion-card" isolated="true">
  <data_model>
    <state id="isOpen" type="boolean">false</state>
    <state id="clicks" type="number">0</state>
  </data_model>

  <div class="card-box">
    <h3>{props.title}</h3>
    <p>Status: {local.isOpen ? 'OPEN' : 'CLOSED'}</p>
    <p>Clicks: {local.clicks}</p>

    <!-- Mutates ONLY this component instance's state -->
    <button class="btn">
      <on_click action="SET_STATE">
        <path>local.isOpen</path>
        <value>{local.isOpen ? 'false' : 'true'}</value>
      </on_click>
      <on_click action="SET_STATE">
        <path>local.clicks</path>
        <value>{local.clicks} + 1</value>
      </on_click>
      Toggle Card
    </button>
  </div>
</component_def>
```

### 3. Hybrid State Access (Local + Global in the Same Component)
An isolated component can seamlessly access and mutate both its private local state (`local.*`) and application-wide global state (`global.*` or `data.*`):

```xml
<component_def name="user-panel" isolated="true">
  <data_model>
    <state id="panel_open" type="boolean">false</state>
  </data_model>

  <div class="panel {data.theme}">
    <span>User: {data.user.name}</span>
    <span>Panel: {local.panel_open ? 'Open' : 'Closed'}</span>

    <!-- Mutates local instance state -->
    <button>
      <on_click action="SET_STATE">
        <path>local.panel_open</path>
        <value>{local.panel_open ? 'false' : 'true'}</value>
      </on_click>
      Toggle Panel
    </button>

    <!-- Mutates global application state -->
    <button>
      <on_click action="SET_STATE">
        <path>global.theme</path>
        <value>{data.theme == 'dark' ? 'light' : 'dark'}</value>
      </on_click>
      Switch Theme
    </button>
  </div>
</component_def>
```

---

## 🔒 Component Isolation & Scoping Matrix

Below is a reference of how metadata & configuration tags behave regarding component scoping vs global state:

| Tag / Feature | Scope Level | Leakage Risk | Scoping Behavior & Precedence |
| :--- | :--- | :--- | :--- |
| **`isolated="true"` / `scope="local"`** | Component Instance | 🟢 **Zero Leakage** | Isolated state (`local.*`) is instantiated per rendered component instance. Multiple copies maintain completely separate state. |
| **`states.xml` / `scope="global"`** | Global Reactive Store | 🟢 **By Design** | Shared stores merge their `<data_model>` into the global `data.*` pool, accessible by root and all components. |
| **`<api_config>`** | Component & Global | 🟢 **Zero Leakage** | Component-level `<api_config>` overrides global config for all XHR calls within that component tree. |
| **`<constants>` / `<vars>`** | Component & Global | 🟢 **Zero Leakage** | Component design tokens inherit from parent components and override parent/global constants locally. |
| **`<on_mount>`, `<on_interval>`** | Component & Element | 🟢 **Zero Leakage** | Timers and lifecycle hooks are tied strictly to the lifecycle of the mounting component instance. |

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

## 🛡️ Declarative Try / Catch / Finally Error Handling (`<try>`, `<catch var="err">`, `<finally>`)

EUIX Engine supports declarative, structured error handling across both synchronous and asynchronous actions (`XHR`, `RUN_SCRIPT`, `Action Composer` workflows).

```xml
<uid_spec>
    <flex direction="column" gap="12">
        <button class="btn">
            <on_click action="TRY">
                <!-- Protected Actions -->
                <step action="XHR">
                    <url>https://api.example.com/data</url>
                    <method>POST</method>
                </step>

                <!-- Catch Scope: Executes if Try throws or rejects -->
                <catch var="err">
                    <step action="SET_STATE">
                        <path>data.error_message</path>
                        <value>[{err.code}] {err.message} (Status: {err.status})</value>
                    </step>
                </catch>

                <!-- Finally Scope: Always executes after Try / Catch -->
                <finally>
                    <step action="SET_STATE">
                        <path>data.is_loading</path>
                        <value>false</value>
                    </step>
                </finally>
            </on_click>
            Submit Data
        </button>
    </flex>
</uid_spec>
```

### Structured Error Object (`EUIXStructuredError`)
Errors caught inside `<catch var="err">` provide structured properties:
- `{err.message}`: Human-readable error message
- `{err.code}`: Categorized error code (`ACTION_EXECUTION_ERROR`, `API_HTTP_ERROR`, `API_NETWORK_ERROR`, `VALIDATION_ERROR`, `TIMEOUT_ERROR`)
- `{err.status}`: HTTP status code (e.g. 500, 404) for network errors
- `{err.originatingAction}`: Action or tag name that produced the failure
- `{err.component}`: Originating component name
- `<rethrow />`: Explicitly re-throw caught error to propagate to parent scope

### Visual Component Fallback (Inline Error Boundary)
When an XML element or custom component fails during rendering, EUIX Engine isolates the failure and renders a graceful inline error fallback element (`.euix-error-fallback`) without unmounting or crashing the rest of the application tree:
```html
<!-- Automatically rendered inline on component render failure -->
<div class="euix-error-fallback">⚠️ Component Error: &lt;broken_component&gt;</div>
```

### Programmatic Global Error Handler (`engine.onError`)
Register a global `onError` callback on the engine instance to capture all uncaught runtime errors, XML parsing failures, XHR errors, or component rendering exceptions for telemetry or error monitoring (e.g. Sentry, LogRocket):
```javascript
const engine = EUIXEngine.mount(xmlString, '#app');

engine.onError = (error, contextInfo) => {
    console.error(`[EUIX Error Boundary] ${contextInfo}:`, error);
    // Send to logging or error reporting service
};
```

---

## ⚡ Declarative Resilience Primitives & `EUIXResiliencePlugin` (`<retry>`, `<timeout>`, `<delay>`)

EUIX Engine provides tree-shakeable resilience execution primitives (`<retry>`, `<timeout>`, `<delay>`, `EUIXCancellationController`) via `EUIXResiliencePlugin`:

```xml
<uid_spec>
    <flex direction="column" gap="12">
        <button class="btn">
            <on_click action="TRY">
                <!-- Retry with Exponential Backoff Strategy -->
                <retry attempts="3" delay="500" backoff="exponential" max_delay="3000" on_error="API_HTTP_ERROR,API_NETWORK_ERROR,TIMEOUT_ERROR">
                    <timeout ms="2000" message="Request timed out after 2 seconds">
                        <step action="XHR">
                            <url>https://api.example.com/data</url>
                            <target>data.items</target>
                        </step>
                    </timeout>
                </retry>

                <delay ms="500" />

                <catch var="err">
                    <step action="SET_STATE">
                        <path>data.error_message</path>
                        <value>[{err.code}] {err.message}</value>
                    </step>
                </catch>
            </on_click>
            Resilient Fetch
        </button>
    </flex>
</uid_spec>
```

---

## ⚡ Watch & Computed State (`EUIXReactivePlugin` - `<computed>`, `<watch>`)

EUIX Engine provides tree-shakeable derived state (`<computed>`) and reactive side-effect watchers (`<watch>`) via `EUIXReactivePlugin` (`euixjs/reactive`):

```xml
<uid_spec>
    <data_model>
        <state id="firstName">Jane</state>
        <state id="lastName">Smith</state>
        <state id="user_role">Admin</state>
        <state id="searchQuery"></state>

        <!-- 1. Memoized Computed Derived Property -->
        <computed id="fullName" deps="firstName, lastName">
            return $data.firstName + " " + $data.lastName;
        </computed>

        <!-- 2. Reactive Watcher Declared Inside <data_model> -->
        <watch path="searchQuery">
            <step action="REVALIDATE_API" tag="get_countries" />
        </watch>
    </data_model>

    <!-- 3. Side-Effect Watcher Triggering Actions on Change -->
    <watch path="user_role">
        <step action="MUTATE_STATE">
            <path>audit_logs</path>
            <operation>UNSHIFT</operation>
            <value>Role changed from {prevValue} to {newValue}</value>
        </step>
    </watch>

    <flex direction="column">
        <h1>Welcome, {data.fullName}!</h1>
    </flex>
</uid_spec>
```

---

## 🎭 Declarative Animation System (`EUIXAnimationPlugin` - `<animation_def>`, `<animate>`)

EUIX Engine provides a complete keyframe animation engine with enter and deferred leave transitions (`euixjs/animation`):

```xml
<uid_spec>
    <!-- 1. Reusable Keyframe Animation Definition -->
    <animations>
        <animation_def name="customPulse" duration="400" easing="ease-in-out">
            <keyframe offset="0" transform="scale(1)" opacity="1" />
            <keyframe offset="0.5" transform="scale(1.1)" opacity="0.8" />
            <keyframe offset="1" transform="scale(1)" opacity="1" />
        </animation_def>
    </animations>

    <flex direction="column" gap="16">
        <!-- 2. Enter and Deferred Leave Lifecycle Transitions -->
        <div id="hero" enter_animation="slide-in-down" leave_animation="fade-out">
            <h1>Animated Element</h1>
        </div>

        <!-- 3. Event-Triggered Declarative Animation Action -->
        <button class="btn">
            <on_click action="ANIMATE" target="#hero" name="customPulse" duration="500" />
            Animate Hero
        </button>
    </flex>
</uid_spec>
```

---

## 🛠️ EUIX DevTools & Performance Profiler

Enable DevTools inspect overlay and floating drawer panel by pressing **`Alt + Shift + I`** or clicking the **`📊 State & Logs`** button:

- **📊 State Inspector:** Live real-time inspection and search across all reactive states (`$state`).
- **📜 Action Logs:** Real-time stream of all executed actions (`SET_STATE`, `MUTATE_STATE`, `XHR`).
- **⚡ Performance Profiler (`engine.getPerformanceMetrics()`):** Live monitoring of initial mount time (ms), active reactive DOM bindings, unique elements count, AST cache hit ratio, state watchers, and JS heap memory.
- **🛡️ Visual XML Error Code Frames (`EUIXXMLParseError`):** Precise line and column error reporting with visual code snippet pointers on malformed XML specifications.
- **💻 Console Exposure:** Access `window.$state` and `window.$engine` directly in browser dev console.

---

## 🛡️ Battle-Testing & Release Verification Suite

EUIX Engine is systematically battle-tested under malformed input, concurrency, cancellation, long-running workloads, and complex execution combinations.

### Test Architecture Overview
- **Property-Based Testing (`fast-check`)**: Validates structural invariants across randomly generated valid EUIX applications.
- **Invalid Input Fuzzing**: Tests hostile XML, unclosed tags, duplicate state IDs, 150-depth DOM nesting, and circular computed dependencies (`COMPUTED_CYCLE_ERROR`) without process crashes.
- **AST Round-Trip Equivalence**: Asserts `XML -> Spec AST -> JSON -> Spec AST -> XML` semantic equivalence.
- **Action Permutation Engine**: Tests nested combinations of `TRY`, `RETRY`, `TIMEOUT`, `DELAY`, `COMPOSED_ACTION`, `XHR`, `MUTATE_STATE`.
- **Async Chaos & Late Mutation Protection**: Uses a seedable PRNG to simulate network delays and guarantees that timed-out/cancelled operations CANNOT mutate state after scope exit.
- **Torture Suites & Stress Fixtures**: Includes 10k reactive storms, 5-level computed DAG torture, 200 cycle mount/unmount leak checks, resource single-disposal (`dispose()`), and 4 permanent engineering stress fixtures (*StressDashboard*, *HugeList*, *WorkflowHell*, *LifecycleHell*).
- **Package Artifact Smoke Test**: Builds, packs (`npm pack`), extracts, and verifies UMD/ESM distribution integrity.
- **Cross-Browser Matrix**: Playwright testing across Chromium, Firefox, and WebKit.

### Test Commands
```bash
# Fast Unit & Integration Suite (185 tests)
npm test

# Battle-Testing Suite (Property, Fuzz, Chaos, Permutations, Torture)
npm run test:battle

# Playwright Cross-Browser Matrix (Chromium, Firefox, WebKit)
npm run test:browser

# Configurable Duration Soak Load Test
npm run test:soak

# Package Artifact Tarball Smoke Test
npm run test:package

# Full Release Verification Gate (Build, Unit, Battle, Package Smoke Dashboard)
npm run verify:release
```
