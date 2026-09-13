# EUIX Core Diet — Simplification & Pruning Architectural Plan

> **Core Philosophy:** *Make EUIX minimal by default and powerful by opt-in.*
> **Core Identity:** *A lightweight reactive declarative UI runtime that turns markup + state + events into DOM updates without requiring a build step or a virtual DOM.*

---

## 1. Executive Summary & Audit Overview

Over its development history, EUIX evolved from a fast, zero-VDOM XML/HTML declarative runtime into an expansive application framework. While individual capabilities (SWR client, nested router with data loaders, SQL-like XML array mutations, WebMCP LLM tools, SVG charts, Leaflet GIS) are impressive in isolation, their combined presence in the default distribution has caused significant issues:

* **Bundle Inflation:** The default bundle (`dist/EUIXEngine.es.js`) stands at **755.4 KB raw** and **148.0 KB gzip**. Even Lite Core (`dist/EUIXEngineCore.es.js`) is **355.0 KB raw** and **69.5 KB gzip**.
* **Inverted Dependency Direction:** Core runtime files (`DOMRenderer.js`, `Lifecycle.js`, `constants.js`, `EUIXEngineCore.js`) have hardcoded knowledge of optional plugins (e.g., `$route`, `$api`, `$stream`, `errors.`, `navigator_config`, `date_config`, `REVALIDATE_API`, `ANIMATE`).
* **XML Programming Language Anti-Pattern:** XML templates acquired imperative programming constructs: `<try><catch><finally>`, `<throw>`, `<action_def><param><step><return>`, and a 600-line pseudo-SQL array query engine in `MUTATE_STATE`.
* **Platform Duplication:** Declarative abstractions like `<flex direction="..." gap="...">` duplicate native CSS flexbox/grid that developers already write with utility classes.
* **Conceptual Overload:** Instead of learning 5–8 intuitive concepts, a newcomer faces SWR, resilience pipelines, state history snapshots, navigation blockers, and chart specifications on day one.

This plan details the **Milestone 1 Audit** and provides the architectural blueprint to return EUIX to an ultra-fast, lean core runtime (<= ~20 KB gzip target) while preserving advanced capabilities through decoupled, opt-in plugins.

---

## 2. Baseline Measurements & Bundle Analysis

Measured on Node v23.1.0 with Terser minification and zlib compression:

### 2.1 Core & Primary Bundles

| Bundle / Distribution | File | Raw Size | Gzip Size | Share of Default |
| :--- | :--- | ---: | ---: | ---: |
| **Default Entry (All Plugins Preloaded)** | `dist/EUIXEngine.es.js` | 755.4 KB | 148.0 KB | 100% |
| **Default UMD (Browser Script Tag)** | `dist/EUIXEngine.umd.js` | 390.7 KB | 105.8 KB | 71.5% |
| **Lite Core (Current EUIXEngineCore)** | `dist/EUIXEngineCore.es.js` | 355.0 KB | 69.5 KB | 47.0% |
| **Lite Core UMD** | `dist/EUIXEngineCore.umd.js` | 181.4 KB | 49.9 KB | 33.7% |
| **DevTools Standalone Inspector** | `dist/EUIXDevTools.es.js` | 123.3 KB | 23.8 KB | 16.1% |
| **Compiler (XML AST & Code Gen)** | `dist/EUIXCompiler.es.js` | 36.7 KB | 6.4 KB | 4.3% |
| **Server-Side Renderer (Zero-JSDOM SSR)** | `dist/EUIXServer.es.js` | 18.6 KB | 4.4 KB | 3.0% |

### 2.2 Modular Plugins Breakdown

| Plugin Package | Module Path | Raw Size | Gzip Size | Source LOC |
| :--- | :--- | ---: | ---: | ---: |
| **Inspector Plugin** | `euixjs/inspector` | 103.1 KB | 20.2 KB | 3,020 LOC |
| **Router Plugin** | `euixjs/router` | 89.6 KB | 18.5 KB | 3,552 LOC |
| **Date Plugin** | `euixjs/date` | 33.3 KB | 6.3 KB | 1,046 LOC |
| **API / SWR Client** | `euixjs/api` | 31.2 KB | 6.4 KB | 870 LOC |
| **WebMCP (AI Agent Tools)** | `euixjs/webmcp` | 28.0 KB | 6.6 KB | 1,017 LOC |
| **Leaflet GIS Integration** | `euixjs/leaflet` | 27.5 KB | 6.4 KB | 743 LOC |
| **SVG Chart Plugin** | `euixjs/chart` | 22.4 KB | 4.8 KB | 715 LOC |
| **Animation Plugin** | `euixjs/animation` | 21.0 KB | 4.3 KB | 670 LOC |
| **Action Composer Plugin** | `euixjs/composer` | 19.5 KB | 4.4 KB | 584 LOC |
| **Resilience Primitives** | `euixjs/resilience` | 17.1 KB | 3.6 KB | 524 LOC |
| **Navigator Plugin (Mobile Tabs)** | `euixjs/navigator` | 15.8 KB | 3.2 KB | 483 LOC |
| **Stream Plugin (WebSocket / SSE)** | `euixjs/stream` | 15.4 KB | 3.1 KB | 492 LOC |
| **Reactive Plugin (Computed Graph)** | `euixjs/reactive` | 13.8 KB | 3.3 KB | 446 LOC |
| **Validation Plugin (Schema)** | `euixjs/validation` | 12.1 KB | 2.6 KB | 387 LOC |
| **Dialog / Modal Plugin** | `euixjs/dialog` | 7.9 KB | 2.2 KB | 245 LOC |
| **Head / Helmet Plugin** | `euixjs/head` | 7.2 KB | 1.8 KB | 237 LOC |
| **Drag & Drop Plugin** | `euixjs/dnd` | 5.7 KB | 1.6 KB | 178 LOC |
| **Collapse / Accordion Plugin** | `euixjs/collapse` | 5.4 KB | 1.6 KB | 164 LOC |
| **A11y / Focus Trap Plugin** | `euixjs/a11y` | 5.3 KB | 1.6 KB | 347 LOC |
| **Storage Persistence Plugin** | `euixjs/storage` | 3.3 KB | 1.0 KB | 100 LOC |

### 2.3 Repository Source Code Volume

* **`src/core/`**: 11,367 LOC across 17 files
* **`src/plugins/`**: 16,331 LOC across 38 files
* **`src/compiler/`**: 1,117 LOC across 3 files
* **`src/server/`**: 600 LOC across 1 file
* **`tests/`**: 31,009 LOC across 162 files (790 automated test cases)
* **`docs/`**: 4,350 LOC across 55 documentation files

---

## 3. Dependency Map & Architectural Hotspots

### 3.1 Existing Inverted Dependencies (Core Leaks)

Core should have zero knowledge of plugins. Currently, several core modules reach out or bake in awareness of specific plugins:

```
[Core: DOMRenderer.js]   ── hardcodes ──> $route, $router, $fetcher (Router)
                         ── hardcodes ──> api, $api (Api Plugin)
                         ── hardcodes ──> stream, $stream (Stream Plugin)
                         ── hardcodes ──> errors, $errors (Validation Plugin)

[Core: constants.js]     ── hardcodes ──> METADATA_AND_EVENT_TAGS:
                                            navigator_config, device_config,
                                            date_config, date_settings,
                                            actions, action_def, workflow_def,
                                            animations, keyframe_def,
                                            api_config, api_endpoint, persistence
                         ── hardcodes ──> ACTION_DISPATCH_TABLE:
                                            REVALIDATE_API, ANIMATE, TRANSITION,
                                            RETRY_ERROR_BOUNDARY, UNDO_STATE,
                                            REDO_STATE, TAKE_SNAPSHOT

[Core: Lifecycle.js]     ── hardcodes ──> initDataModel queries:
                                            <computed>, <watch>, <animation_def>,
                                            <persistence>, <api_config>, <api_endpoint>

[Core: EUIXEngineCore.js]── hardcodes ──> constructor initializes:
                                            _apiConfig, _registeredXhrs, _xhrCache,
                                            _actionRegistry, _depGraph,
                                            _computedRegistry, _watchRegistry,
                                            _setupStorageListener, _initRevalidationListeners
```

### 3.2 Target Dependency Direction

The target architecture enforces strict unidirectionality:

```
                  +-----------------------------------+
                  |            EUIX Core              |
                  |  State, Parser, Renderer, Events, |
                  |       Components, Slots, Hooks    |
                  +-----------------------------------+
                                    ▲
                                    │ (public extension APIs:
                                    │  .use(), hooks, registerAction,
                                    │  registerBindingNamespace)
         +--------------------------+--------------------------+
         │                          │                          │
+-----------------+        +-----------------+        +-----------------+
|   Core Plugins  |        | UI Convenience  |        |   Ecosystem     |
|   (Api, Router, |        | (Animation, Dnd,|        | (Leaflet, Chart,|
|   Composer,     |        |  A11y, Storage, |        |  Date, WebMCP,  |
|   Reactive)     |        |  VirtualList)   |        |  DevTools)      |
+-----------------+        +-----------------+        +-----------------+
```

---

## 4. Complete Feature Classification Matrix

Every capability in EUIX is classified into one of five categories:

### 4.1 KEEP IN CORE

Essential to the fundamental EUIX runtime.

| Feature | Implementation Location | Weight (LOC) | Why It Stays in Core | Compatibility / API Impact |
| :--- | :--- | ---: | :--- | :--- |
| **Engine Lifecycle & Mounting** | `src/core/lifecycle/Lifecycle.js`, `EUIXEngineCore.js` | ~300 LOC | Fundamental requirement to mount XML specifications to DOM containers, tear down instances, and manage microtasks. | None. `EUIXEngine.mount()`, `engine.unmount()`, `engine.destroy()` preserved. |
| **Reactive State Store** | `src/core/state/ReactiveStore.js` | ~450 LOC | Primitives (`number`, `string`, `boolean`) and collections (`array`, `object`) with microtask update batching (`batchUpdates`). | None. `getState()`, `setState()`, `batchUpdates()` preserved. |
| **AST XML Parser & Cache** | `src/core/parser/AstParser.js` | ~400 LOC | Zero-DOMParser fast AST generation with LRU caching (`_astCache`) and source code frames. | None. Core parsing remains 100% compatible. |
| **Expression Parser & Transpiler** | `src/core/parser/ExpressionParser.js` | ~400 LOC | JIT expression evaluator for `{data.count + 1}`, ternaries, and member access without `eval()`. | None. Template interpolation preserved. |
| **Conditional Rendering** | `src/core/renderer/DOMRenderer.js` | ~150 LOC | `<if condition="...">`, `<else_if>`, `<else>` rendering with branch toggling and preservation. | None. |
| **Iteration & Keyed Reconciliation** | `src/core/renderer/ForEachRenderer.js` | ~450 LOC | `<for_each items="{data.items}" var="item" key="id">` with LIS diffing, index tracking, and event delegation. | None. Keyed reconciliation preserved. |
| **Component System & Slots** | `src/core/components/ComponentLoader.js`, `DOMRenderer.js` | ~500 LOC | `<component_def name="...">`, `<component name="...">`, `<slot name="...">`, scoped slots (`let="..."`). | None. Full slot and scoped-slot projection preserved. |
| **Two-Way Binding** | `src/core/binding/BindingResolver.js` | ~200 LOC | `bind="path"`, `bind.number`, `bind.boolean`, `bind.trim` for native inputs (`input`, `textarea`, `select`, `checkbox`). | None. Form controls work natively. |
| **Basic Action Dispatcher** | `src/core/actions/ActionDispatcher.js` | ~250 LOC | Core event handling: `SET_STATE`, `CALL_ACTION`, `TOGGLE_STATE`, `FOCUS`, event delegation. | Streamlined. Custom actions registered via `engine.action(name, fn)`. |
| **Plugin Registration System** | `src/core/EUIXEngineCore.js` | ~50 LOC | `.use(plugin)` extension mechanism and lifecycle hooks (`HookEmitter`). | None. Foundation for all opt-in plugins. |
| **Error Boundary** | `src/core/renderer/ErrorBoundaryRenderer.js` | ~180 LOC | `<error_boundary fallback="...">` for declarative UI recovery and resilience. | Retained as declarative UI boundary. |

---

### 4.2 SIMPLIFY

Belongs in core, but its implementation has become unnecessarily complex.

| Feature | Current Location | Problem / Complexity | Simplification Strategy | Migration Risk |
| :--- | :--- | :--- | :--- | :--- |
| **Core Action System** | `src/core/actions/BuiltInActions.js` (1,222 LOC), `ActionDispatcher.js` (778 LOC) | Hardcodes 15 action types, SQL-like query parsing in XML, XML try/catch, snapshot time-travel. | Converge Core action model to **SET**, **CALL**, **TOGGLE**, and **RUN_SCRIPT** (escape hatch). Move multi-step subroutines, workflows, and time-travel to plugins. | Low. 95% of apps only use `SET_STATE`, `TOGGLE_STATE`, and named action calls. |
| **Array Mutations (`MUTATE_STATE`)** | `src/core/actions/BuiltInActions.js` (lines 563–1178, ~615 LOC) | 600 lines of XML query parsing (`where field="..." equals="..."`, `when`, `set`). | Keep fast simple operations (`PUSH`, `REMOVE` by key/id, `CLEAR`) in Core. Complex queries belong in JS action handlers. | Low. Provide helper functions in JS. |
| **Binding Resolver Plugin Coupling** | `src/core/renderer/DOMRenderer.js` (lines 1620–1678) | Hardcodes `$route`, `$api`, `$stream`, `$errors` string parsing directly in text node interpolation. | Replace hardcoded checks with a clean **Binding Namespace Provider** hook: plugins register custom prefixes (e.g. `engine.registerScope('$route', fn)`). | Zero. Plugin capabilities remain identical, but Core becomes completely decoupled. |
| **Metadata Tag Handling** | `src/core/utils/constants.js`, `Lifecycle.js` | `METADATA_AND_EVENT_TAGS` contains 35 hardcoded tags from 8 different plugins. | Core registers only core tags (`state`, `data_model`, `constants`, `component_def`, `if`, `for_each`). Plugins register their own metadata processors via hook `engine.on('parse:metadata', ...)`. | Zero. |
| **State Watchers** | `src/core/state/Watchers.js` (91 LOC) | Core already has clean `watch(key, cb)` and `onStateChange(cb)`. But `Lifecycle.js` attempts to parse `<watch>` and `<computed>` tags even when `EUIXReactivePlugin` is absent. | Keep `watch()` and `onStateChange()` as lightweight JS APIs in Core. Leave declarative `<watch>` and `<computed>` XML tags to `EUIXReactivePlugin`. | Zero. |

---

### 4.3 MOVE TO PLUGIN

Useful capability, but not required for basic EUIX applications.

| Feature | Current Location | LOC / Gzip | Why It Moves to Plugin | Target Subpath Import |
| :--- | :--- | ---: | :--- | :--- |
| **API / SWR Client** | `src/plugins/EUIXApiPlugin.js` | 870 LOC / 6.4 KB | Core should not be an HTTP client. Apps fetching data with `fetch()` or external clients should not pay for SWR caching, offline queues, or XHR registries. | `import { EUIXApiPlugin } from 'euixjs/api'` |
| **Router** | `src/plugins/router/` | 3,552 LOC / 18.5 KB | Routing is an application concern. Single-page widgets, embedded components, and dashboard panels do not need router matching, history management, or data fetchers. | `import { EUIXRouterPlugin } from 'euixjs/router'` |
| **Action Composer (Workflows)** | `src/plugins/EUIXComposerPlugin.js` | 584 LOC / 4.4 KB | Multi-step XML action subroutines with `<param>`, `<step>`, and recursion guards are advanced orchestration tools. | `import { EUIXComposerPlugin } from 'euixjs/composer'` |
| **Resilience System** | `src/plugins/EUIXResiliencePlugin.js` | 524 LOC / 3.6 KB | Circuit breakers, retries, timeouts, and `EUIXCancellationController` are enterprise-grade resilience tools. | `import { EUIXResiliencePlugin } from 'euixjs/resilience'` |
| **Computed Dependency Graph** | `src/plugins/EUIXReactivePlugin.js` | 446 LOC / 3.3 KB | Fine-grained topological dependency graph and declarative `<computed>` XML tags are advanced reactive utilities. | `import { EUIXReactivePlugin } from 'euixjs/reactive'` |
| **State Persistence** | `src/plugins/EUIXStoragePlugin.js` | 100 LOC / 1.0 KB | Synchronizing state to `localStorage` / `sessionStorage` with cross-tab event listeners. | `import { EUIXStoragePlugin } from 'euixjs/storage'` |
| **Web Animations & Transitions** | `src/plugins/EUIXAnimationPlugin.js` | 670 LOC / 4.3 KB | Declarative Web Animations API wrappers, keyframe definitions, and enter/leave transition coordination. | `import { EUIXAnimationPlugin } from 'euixjs/animation'` |
| **Virtual Scrolling** | `src/core/renderer/ForEachRenderer.js` (lines 640–880) | ~250 LOC / 2.5 KB | Virtual list slicing, DOM spacers, and scroll listeners extracted from `ForEachRenderer` into a modular virtual list plugin or wrapper. | `import { EUIXVirtualListPlugin } from 'euixjs/virtual'` |
| **Drag and Drop** | `src/plugins/EUIXDragDropPlugin.js` | 178 LOC / 1.6 KB | Pointer-based drag handles, ghost elements, and drop targets. | `import { EUIXDragDropPlugin } from 'euixjs/dnd'` |
| **Head / Meta Management** | `src/plugins/EUIXHeadPlugin.js` | 237 LOC / 1.8 KB | Dynamic document head/meta/title management. | `import { EUIXHeadPlugin } from 'euixjs/head'` |
| **Form Validation** | `src/plugins/EUIXValidationPlugin.js` | 387 LOC / 2.6 KB | XML-declared field validation rules, error objects, and form validation lifecycle. | `import { EUIXValidationPlugin } from 'euixjs/validation'` |
| **Streaming (WS / SSE)** | `src/plugins/EUIXStreamPlugin.js` | 492 LOC / 3.1 KB | WebSocket and Server-Sent Events client with auto-reconnect and message binding. | `import { EUIXStreamPlugin } from 'euixjs/stream'` |
| **DevTools & Inspector** | `src/EUIXDevTools.js`, `src/plugins/inspector/` | 3,020 LOC / 23.8 KB | Standalone HUD, state live editor, event logger, and Playwright driver. | `import { EUIXDevTools } from 'euixjs/devtools'` |

---

### 4.4 ECOSYSTEM / INTEGRATION

Domain-specific capabilities that belong in external/ecosystem packages rather than defining the EUIX runtime.

| Integration | Current Location | Weight (LOC / Gzip) | Why It Belongs in Ecosystem | Recommendation |
| :--- | :--- | ---: | :--- | :--- |
| **Leaflet GIS Integration** | `src/plugins/EUIXLeafletPlugin.js` | 743 LOC / 6.4 KB | Geographic map rendering, OpenStreetMap tiles, layer markers, and drawing tools are highly domain-specific. | Move to `euixjs/leaflet` or separate `@euix/leaflet` package. |
| **SVG / Canvas Charts** | `src/plugins/EUIXChartPlugin.js` | 715 LOC / 4.8 KB | Dedicated chart renderer (bar, line, radar, pie, donut) with coordinate projections and tooltips. | Move to `euixjs/chart` or separate `@euix/chart` package. |
| **Date & Time (Intl / Presets)** | `src/plugins/EUIXDatePlugin.js` | 1,046 LOC / 6.3 KB | Comprehensive date formatting, relative time, timezones, and DayJS-like XML tags. | Move to `euixjs/date` ecosystem package. |
| **WebMCP (AI Agent Tools)** | `src/plugins/EUIXWebMCPPlugin.js` | 1,017 LOC / 6.6 KB | Model Context Protocol integration exposing declarative UI tools to LLMs. | Move to `euixjs/webmcp` ecosystem package. |
| **Mobile Navigator (Tabs)** | `src/plugins/EUIXNavigatorPlugin.js` | 483 LOC / 3.2 KB | Native-like bottom tab bar and header navigation for mobile web applications. | Move to `euixjs/navigator` ecosystem package. |

---

### 4.5 DEPRECATE / REMOVE

Features that duplicate native browser/HTML/CSS functionality or introduce disproportionate complexity.

| Feature / Abstraction | Current Location | Why Deprecate or Remove | Replacement (Native Platform First) |
| :--- | :--- | :--- | :--- |
| **`<flex>` & `<grid>` Tags** | `src/core/renderer/DOMRenderer.js` (lines 45–230, 1879–1906) | Duplicates native CSS. Creates runtime overhead parsing `direction`, `align`, `justify`, `gap`, `cols`, `rows` on every element. | Native HTML `<div class="flex flex-col gap-4">` or standard `style="..."`. A lightweight compatibility shim can be provided. |
| **Layout Child Attributes** (`flex`, `col_span`, `row_span`) | `src/core/renderer/DOMRenderer.js` (lines 211–230) | Non-standard attributes converted into inline styles at runtime. | Standard CSS classes: `class="col-span-2 flex-1"`. |
| **XML `<try>`, `<catch>`, `<finally>`** | `src/core/actions/ActionDispatcher.js` (lines 89–218) | Implementing programming language control flow inside XML is an anti-pattern. | Named JavaScript actions with standard JS `try/catch`, or declarative `<error_boundary>`. |
| **XML `<throw>` & `<rethrow>`** | `src/core/actions/BuiltInActions.js` (lines 239–263) | Imperative exception handling in XML. | Throw directly in JavaScript handlers. |
| **Script / Style Loader Aliases** | `src/core/renderer/DOMRenderer.js` (lines 1713–1722) | 6 redundant aliases: `<use_script>`, `<script_loader>`, `<load_script>`, `<use_style>`, `<style_loader>`, `<load_style>`. | Standard `<script src="...">` and `<link rel="stylesheet">`, or JS module imports. |
| **Built-in Undo/Redo/Snapshot Actions** | `src/core/actions/BuiltInActions.js` (lines 1179–1197) | `UNDO_STATE`, `REDO_STATE`, `TAKE_SNAPSHOT` bake a time-travel undo manager directly into Core actions. | Move to an optional `EUIXHistoryPlugin` or application state. |
| **Duplicate `<collapse>` Plugin** | `src/plugins/EUIXCollapsePlugin.js` (164 LOC) | HTML5 `<details>` and `<summary>` are native browser elements supported in all modern browsers. | Native `<details><summary>Title</summary>Content</details>`. |
| **Duplicate `<dialog>` Plugin** | `src/plugins/EUIXDialogPlugin.js` (245 LOC) | HTML5 `<dialog>` is supported natively in all browsers with `.showModal()`, `.close()`, and `::backdrop`. | Native `<dialog>` with `open` binding or native `.showModal()`. |

---

## 5. Architectural Deep Dives

### 5.1 Removing Duplicate Platform Abstractions

Currently, `DOMRenderer.js` executes `applyLayoutStyles()` and `applyItemChildStyles()` across every `<flex>` and `<grid>` element:
```javascript
// BEFORE: DOMRenderer.js parses 16 different layout attributes
const direction = xmlNode.getAttribute("direction") || xmlNode.getAttribute("flex_direction") || xmlNode.getAttribute("dir");
const align = xmlNode.getAttribute("align") || xmlNode.getAttribute("align_items");
const justify = xmlNode.getAttribute("justify") || xmlNode.getAttribute("justify_content");
const gap = xmlNode.getAttribute("gap");
// ... 150 more lines of string parsing and regex matching
```

**Diet Decision:**
1. Core stops treating `<flex>` and `<grid>` as special privileged tags. They render as standard HTML elements or can be written cleanly as:
   ```xml
   <!-- Native HTML & CSS: Zero runtime cost, zero bytes in core -->
   <div class="flex flex-col gap-4 items-center justify-between">
     <h1>Clean Markup</h1>
   </div>
   ```
2. For backward compatibility, an optional **`EUIXLayoutCompatPlugin`** or legacy shim can translate legacy `<flex>` and `<grid>` attributes if explicitly loaded.

---

### 5.2 Action System Simplification

#### The Problem: XML as a Programming Language
Currently, developers can write entire imperative programs in XML:
```xml
<!-- ANTI-PATTERN: Imperative programming inside XML -->
<on_click action="TRY">
  <try>
    <step action="MUTATE_STATE">
      <path>users</path>
      <operation>REMOVE</operation>
      <where field="id" equals="{item.id}" />
    </step>
    <step action="REVALIDATE_API" tag="get_users" />
  </try>
  <catch>
    <step action="RUN_SCRIPT">alert('Failed!');</step>
  </catch>
</on_click>
```

#### The Solution: Declarative for Simple, JavaScript for Complex
The core action dispatcher converges to 4 fundamental primitives:

1. **`SET`**: Update a state path directly (e.g. `on_click:set="count={data.count + 1}"` or `<on_click set="count" value="10" />`).
2. **`TOGGLE`**: Invert a boolean state path (e.g. `on_click:toggle="isOpen"`).
3. **`CALL`**: Invoke a registered JavaScript function with context (e.g. `on_click="deleteUser"` or `<on_click action="deleteUser" />`).
4. **`EMIT`**: Dispatch a custom DOM/EUIX event.

```xml
<!-- REFACTORED: Clean, declarative, maintainable -->
<button on_click="deleteUser" data-id="{item.id}">Delete</button>
```
With application logic defined where it belongs — in JavaScript:
```javascript
engine.action("deleteUser", async ({ $data, $el }) => {
  const id = $el.dataset.id;
  try {
    $data.users = $data.users.filter(u => u.id !== id);
    await api.delete(`/users/${id}`);
  } catch (err) {
    alert("Failed to delete user");
  }
});
```

* **Action Composer (`<action_def>`)**: Remains available as an opt-in plugin (`euixjs/composer`) for users who specifically need XML workflow orchestration.
* **`RUN_SCRIPT`**: Preserved as an advanced escape hatch for rapid prototyping and zero-build demos, but de-emphasized in documentation.

---

### 5.3 Decoupling the API Layer

#### The Boundary:
Core should have **zero** references to:
* `_apiConfig`
* `_registeredXhrs`
* `_xhrCache`
* `REVALIDATE_API`
* `{api.<id>.<prop>}`

#### Extension Mechanism:
`EUIXApiPlugin` uses documented extension points:
1. **Hook:** `engine.on('lifecycle:init', () => { /* setup endpoints */ })`
2. **Custom Action:** `engine.registerAction('REVALIDATE_API', (actionNode, ctx) => { ... })`
3. **Namespace Resolver:** `engine.registerBindingNamespace('api', (key, ctx) => apiStatusTracker.get(key))`

A developer who does not use `euixjs/api` pays **0 KB** and learns **0 API concepts**.

---

### 5.4 Decoupling the Router

The router currently weighs 89.6 KB raw / 18.5 KB gzip and imports features matching React Router / TanStack:
* `data/loader.js`, `data/action.js`, `data/fetcher.js`, `data/cache.js`, `data/revalidation.js`
* `navigation/blocker.js`, `navigation/prefetch.js`, `navigation/scroll.js`, `navigation/transitions.js`
* `server/static-router.js`, `server/hydration.js`

#### Router Diet:
1. **Minimal Router (`euixjs/router`):**
   * Route matching (path parsing, wildcard, params `:id`)
   * Navigation (`navigate(to)`, pushState/replaceState, popstate)
   * `<route path="..." component="...">` and `<outlet />` rendering
   * `<route_link to="...">`
   * Target weight: **< 15 KB raw / ~4 KB gzip**.
2. **Advanced Router Capabilities (`euixjs/router/advanced` or modular opt-ins):**
   * Loaders, actions, fetchers, navigation blockers, scroll restoration, and View Transitions become opt-in extensions or secondary modules.

---

### 5.5 Reactive Utilities Boundary

| Core State Runtime (Small & Fast) | Advanced Reactive Plugin (`euixjs/reactive`) |
| :--- | :--- |
| `getState(key)` | `<computed id="..." deps="...">expr</computed>` |
| `setState(key, value, options)` | Fine-grained topological dependency graph (`EUIXDependencyGraph`) |
| `mutateState(key, op, payload)` | Reactive cycle detection with graph traversal |
| `batchUpdates(fn)` (Microtask coalescing) | `<watch path="...">` XML tags |
| `watch(key, callback)` (Simple JS key listener) | Computed property caching and lazy invalidation |
| `onStateChange(callback)` (Global state change hook) | Component-scoped computed/watcher teardown |

---

## 6. Default Import Philosophy & Package Strategy

### 6.1 Desired Default Import

`import { EUIX } from 'euixjs'` must import the **lightweight Core runtime**.

```javascript
// NEW DEFAULT: Clean, lean, modular (< 20 KB gzip target)
import { EUIXEngine } from 'euixjs';

// Mount core application (zero unused plugin bloat)
const engine = EUIXEngine.mount(xmlString, '#app');
```

When optional capabilities are needed, they are imported explicitly:

```javascript
import { EUIXEngine } from 'euixjs';
import { EUIXApiPlugin } from 'euixjs/api';
import { EUIXRouterPlugin } from 'euixjs/router';

EUIXEngine.use(EUIXApiPlugin).use(EUIXRouterPlugin);

const engine = EUIXEngine.mount(xmlString, '#app');
```

### 6.2 Backward Compatibility Shim (`euixjs/full`)

To avoid breaking existing codebases that expect all 20+ plugins to be pre-registered:

```javascript
// BACKWARD COMPATIBLE: Full bundle for existing legacy apps
import { EUIXEngine } from 'euixjs/full';
```

In `package.json`:
```json
{
  "exports": {
    ".": {
      "types": "./types/core.d.ts",
      "import": "./dist/EUIXEngineCore.es.js",
      "require": "./dist/EUIXEngineCore.umd.js"
    },
    "./core": {
      "types": "./types/core.d.ts",
      "import": "./dist/EUIXEngineCore.es.js",
      "require": "./dist/EUIXEngineCore.umd.js"
    },
    "./full": {
      "types": "./types/index.d.ts",
      "import": "./dist/EUIXEngineFull.es.js",
      "require": "./dist/EUIXEngineFull.umd.js"
    },
    "./api": "./dist/plugins/EUIXApiPlugin.es.js",
    "./router": "./dist/plugins/EUIXRouterPlugin.es.js",
    "./composer": "./dist/plugins/EUIXComposerPlugin.es.js",
    "./reactive": "./dist/plugins/EUIXReactivePlugin.es.js",
    "./storage": "./dist/plugins/EUIXStoragePlugin.es.js",
    "./animation": "./dist/plugins/EUIXAnimationPlugin.es.js",
    "./devtools": "./dist/EUIXDevTools.es.js"
  }
}
```

---

## 7. Documentation & Playground Diet

### 7.1 Documentation Reorganization (Progressive Disclosure)

A new developer should learn only **6 concepts** to be fully productive:
1. **Getting Started:** Installation & Mounting (`EUIXEngine.mount()`)
2. **Templates & Expressions:** XML markup, `{data.variable}`, interpolation
3. **State:** `<data_model>`, `getState()`, `setState()`
4. **Logic:** Conditional rendering (`<if>`), loops (`<for_each>`)
5. **Events & Actions:** `on_click`, `bind`, named JavaScript actions (`engine.action()`)
6. **Components:** `<component_def>`, `<slot>`, props

All advanced, plugin, and ecosystem documentation will be cleanly separated:
```
docs/
├── 01-getting-started/   # 15-minute quickstart (6 core concepts only)
├── 02-core/              # Templates, State, Reactivity, Components, Actions
├── 03-plugins/           # Opt-in: Api, Router, Composer, Storage, Reactive
├── 04-integrations/      # Ecosystem: Leaflet, Charts, Date, WebMCP
├── 05-advanced/          # SSR, Compiler, DevTools, Performance
└── 06-reference/         # Complete API reference
```

### 7.2 Playground Simplification

Currently, `index.html` loads 15+ sections including GIS maps, live cryptocurrency portfolio, SVG charts, and a 106 KB documentation portal.

**Target Playground:**
Reduce the primary playground to 4 crystal-clear demonstrations:
1. **Counter:** Basic state, expressions, and event handling.
2. **Todo List:** Arrays, keyed `<for_each>`, conditional rendering, and form input bindings.
3. **User Directory (API):** Demonstrates `euixjs/api` with fetch, loading, and error states.
4. **Mini-App (Interactive Component):** Demonstrates components, slots, and named JS actions.

Move complex examples (Crypto Portfolio, GIS Maps, WebMCP, Gantt Chart) to `examples/` and `demos/`.

---

## 8. Target Architecture & Project Structure

```
xui/
├── src/
│   ├── core/                        # Lightweight Core Runtime (<= ~20 KB gzip target)
│   │   ├── EUIXEngineCore.js        # Engine class, mount/unmount, plugin system
│   │   ├── state/                   # Reactive state store, microtask batching, dirty bitmask
│   │   ├── parser/                  # Fast AST parser & JIT expression evaluator
│   │   ├── renderer/                # DOM renderer, keyed reconciliation, slots
│   │   ├── components/              # Component definition, props, template unwrapping
│   │   ├── actions/                 # Core action dispatcher (SET, CALL, TOGGLE, RUN_SCRIPT)
│   │   ├── binding/                 # Input bindings (bind, bind.number, bind.boolean)
│   │   └── utils/                   # Shared DOM helpers and constants (zero external deps)
│   │
│   ├── plugins/                     # Official Opt-in Plugins
│   │   ├── api/                     # SWR API client & offline mutation queue
│   │   ├── router/                  # Lightweight client-side router
│   │   ├── composer/                # Multi-step action workflows (<action_def>)
│   │   ├── resilience/              # Circuit breakers, retries, timeouts
│   │   ├── reactive/                # Dependency graph & <computed> tags
│   │   ├── storage/                 # Persistence (localStorage/sessionStorage)
│   │   ├── animation/               # Web Animations & transition orchestration
│   │   ├── virtual/                 # Virtual list scrolling
│   │   ├── validation/              # Form schema validation
│   │   ├── stream/                  # WebSocket / SSE client
│   │   ├── dnd/                     # Drag and drop pointer events
│   │   └── head/                    # Document head/meta manager
│   │
│   ├── integrations/                # Ecosystem Integrations
│   │   ├── leaflet/                 # Interactive GIS mapping
│   │   ├── chart/                   # SVG data visualization
│   │   ├── date/                    # Intl date/time formatting & presets
│   │   └── webmcp/                  # AI WebMCP agent tooling
│   │
│   ├── devtools/                    # Developer Tools & Inspector HUD
│   │   ├── EUIXDevTools.js
│   │   └── inspector/
│   │
│   ├── compiler/                    # Ahead-of-Time AST Compiler & Typegen
│   └── server/                      # Zero-JSDOM Server-Side Renderer (SSR)
```

---

## 9. Execution Plan & Milestones

| Milestone | Scope | Deliverables / Gates |
| :--- | :--- | :--- |
| **Milestone 1: Audit & Diet Plan** *(Current)* | Complete inventory, bundle analysis, dependency map, classification matrix. | `EUIX_DIET_PLAN.md` created. Presented to user for approval. |
| **Milestone 2: Core Boundary & Decoupling** | Remove plugin-specific hardcoded logic from Core (`DOMRenderer.js`, `Lifecycle.js`, `constants.js`, `EUIXEngineCore.js`). Introduce plugin hooks. | Core builds with zero plugin imports. All 132 test files run and pass. |
| **Milestone 3: Action System Diet** | Streamline action dispatcher to SET, CALL, TOGGLE, EMIT, RUN_SCRIPT. Deprecate XML `<try>/<catch>`, `<throw>`, time-travel in core. | Simplified action dispatcher. Backwards-compatible action shims where needed. |
| **Milestone 4: Plugin Extraction & Hardening** | Clean up `euixjs/api`, `euixjs/router`, `euixjs/composer`, `euixjs/reactive` to communicate with Core via public extension APIs. | Modular plugins import Core cleanly without prototype monkey-patching leaks. |
| **Milestone 5: Ecosystem Separation** | Move Leaflet, Charts, Date, WebMCP under `integrations/` with clean subpath exports. | Separate build bundles for ecosystem modules. |
| **Milestone 6: Documentation Diet** | Rewrite docs with progressive disclosure. Main docs teach only the 6 core concepts. | Cleaned up documentation portal. |
| **Milestone 7: Playground Diet** | Refactor `index.html` to showcase 4 core examples (Counter, Todo, API, Mini-App). Move advanced demos to `examples/`. | Clean, fast-loading playground. |
| **Milestone 8: Final Measurement & Verification** | Re-run bundle analysis (Before vs. After). Measure gzip sizes, LOC, and export counts. | Final walkthrough report verifying all success criteria. |

---

## 10. Success Criteria Checklist

- [ ] **One-Sentence Identity:** "EUIX is a lightweight declarative reactive UI runtime."
- [ ] **Core Mental Model:** New developers need to understand only 6 concepts to build applications.
- [ ] **Pay-For-What-You-Use:** Basic apps import only the core runtime (`euixjs`). Unused features cost 0 KB.
- [ ] **Clean Dependency Direction:** Core has zero imports or hardcoded knowledge of plugins or integrations.
- [ ] **JavaScript Escape Hatch:** Developers can drop down to native JavaScript (`engine.action()`) rather than programming in XML.
- [ ] **Bundle Size Target:** Core bundle target <= ~20 KB gzip (down from 69.5 KB / 148 KB).
- [ ] **No Unnecessary Breakage:** Compatibility shims provided for legacy apps via `euixjs/full`.
- [ ] **100% Test Passing:** All 790 existing automated tests remain green throughout each milestone.
