# AGENTS.md

This guide explains the **Core Architecture** of **EUIX Engine** (`euixjs`) and how to build declarative reactive UIs, manage state, handle API data fetching, load modular plugins, and mount components.

---

## 🧠 1. Core Architecture & Concepts

EUIX Engine is built on a **Modular Plugin Architecture**:

```
                                  +-----------------------------------------------------------------------------------+
                                  |                             EUIXEngine (Full Bundle)                              |
                                  +-----------------------------------------------------------------------------------+
                                                                            |
         +--------------------+-----------------------+---------------------+---------------------+-------------------+
         |                    |                       |                     |                     |                   |
         v                    v                       v                     v                     v                   v
  +--------------+    +---------------+       +---------------+     +---------------+     +---------------+   +---------------+
  |EUIXEngineCore|    | EUIXApiPlugin |       |EUIXComposerPlg|     |EUIXStoragePlg |     | EUIXDialogPlg |   |EUIXRouterPlg  |
  | (Lite Core)  |    | (SWR Client)  |       | (Workflows)   |     | (Persistence) |     |   (Modals)    |   | (Web Router)  |
  +--------------+    +---------------+       +---------------+     +---------------+     +---------------+   +---------------+
         |
         +--------------------+-----------------------+---------------------+---------------------+-------------------+
         |                    |                       |                     |                     |                   |
         v                    v                       v                     v                     v                   v
  +--------------+    +---------------+       +---------------+     +---------------+     +---------------+   +---------------+
  | EUIXDragDrop |    |EUIXCollapsePlg|       | EUIXDatePlugin|     |EUIXChartPlugin|     |EUIXLeafletPlg |   |EUIXNavigator  |
  |  (Pointer)   |    |  (Accordions) |       | (Intl & Dayjs)|     | (SVG Charts)  |     | (Interactive) |   | (Bottom Tabs) |
  +--------------+    +---------------+       +---------------+     +---------------+     +---------------+   +---------------+
```

1. **XML UI Specification Parser (`<uid_spec>`)**: Parses XML templates into an in-memory specification tree with zero Virtual DOM overhead, converting XML elements directly into optimized DOM nodes with AST Caching (`_astCache`).
2. **Reactive Data Model (`<data_model>`)**: Centralized reactive state store supporting primitives (`string`, `number`, `boolean`) and complex types (`array`, `object`) with microtask state mutation batching (`queueMicrotask`).
3. **Declarative Event Action Dispatcher**: Evaluates actions (`SET_STATE`, `MUTATE_STATE`, `REVALIDATE_API`, `RUN_SCRIPT`) declaratively via child action tags (`<on_click action="...">`) with event delegation on `<for_each>` containers.
4. **Modular Plugin System (`.use(plugin)`)**: Extend Lite Core (`EUIXEngineCore`) dynamically with tree-shakeable plugins (`euixjs/api`, `euixjs/composer`, `euixjs/dnd`, `euixjs/storage`, `euixjs/collapse`, `euixjs/dialog`, `euixjs/head`).
5. **Component Registry & Async Loader**: Loads modular XML components dynamically via `fetch()`, executing scoped state models and prop passing.
6. **High Performance Primitives**: Single-Pass Zero-Allocation JIT Expression Transpiler (`EUIXExpressionParser.parseToJs`), Virtual Scrolling (`<for_each virtual="true">`), Keyed Reconciliation (`key="id"`), Container Event Delegation, Static Layout Pre-calculation (`_staticLayoutStyle`), and `DocumentFragment` DOM Batching.

---

## 🚀 2. Import & Mounting

### ESM (Bundlers / Node)

#### Option A: Modular Subpath Imports (Recommended for Minimal Bundle Size)
```js
import { EUIXEngineCore } from 'euixjs/core';
import { EUIXComposerPlugin } from 'euixjs/composer';
import { EUIXApiPlugin } from 'euixjs/api';
import { EUIXStoragePlugin } from 'euixjs/storage';
import { EUIXDevTools } from 'euixjs/devtools';

// Register required plugins on Lite Core
EUIXEngineCore
  .use(EUIXComposerPlugin)
  .use(EUIXApiPlugin)
  .use(EUIXStoragePlugin);

// Mount XML specification to a DOM container
const engine = EUIXEngineCore.mount(xmlString, document.getElementById('app'));

// Initialize DevTools Inspector (optional)
EUIXDevTools.init(engine);
```

#### Option B: Full Bundle (Backwards Compatible)
```js
import { EUIXEngine } from 'euixjs';
import { EUIXDevTools } from 'euixjs/devtools';

// Mount XML specification to a DOM container (all plugins pre-registered)
const engine = EUIXEngine.mount(xmlString, document.getElementById('app'));

// Initialize DevTools Inspector (optional)
EUIXDevTools.init(engine);
```

### HTML Script Tag (Browser CDN / UMD)

#### Local or Relative Path (`./` and `../`)
When serving files locally or from a relative web server path, use `./` or `../` prefixes:
```html
<!-- Local build files relative to current page -->
<script src="./dist/EUIXEngine.umd.js"></script>
<script src="./dist/EUIXDevTools.umd.js" data-euix-devtools="open"></script>
```

#### Relative Path Resolution Rules (`./` & `../`)
1. **Script Tags & Components (`src="./..."`):** Standard relative HTTP requests resolve from the hosting document location.
2. **API & Resource URL Bypass:** Paths starting with `./` or `../` (e.g., `<url>./data/initial.json</url>`) or setting `ignore_base_url="true"` automatically bypass `api_config.base_url` to load local project assets cleanly without domain prepending.

#### UNPKG CDN
```html
<!-- Core EUIX Engine (unpkg CDN) -->
<script src="https://unpkg.com/euixjs/dist/EUIXEngine.umd.js"></script>

<!-- Standalone DevTools Inspector (unpkg CDN) -->
<script src="https://unpkg.com/euixjs/dist/EUIXDevTools.umd.js" data-euix-devtools="open"></script>
```

---

## 📜 3. XML UI Specification Syntax

Every UI is defined using a declarative `<uid_spec>` XML template:

```xml
<uid_spec>
  <!-- 1. State Data Model (Always use id="..." and specify type="..." for numbers/arrays/objects) -->
  <data_model>
    <state id="counter" type="number">0</state>
    <state id="user_name" type="string">Guest</state>
    <state id="is_active" type="boolean">true</state>
    <state id="items" type="array"></state>
  </data_model>

  <!-- 2. Declarative Layout & Bindings -->
  <flex direction="column" gap="16" class="p-6 bg-white rounded-2xl shadow-xl">
    <h1>Hello, {data.user_name}!</h1>
    <p>Counter value: <strong>{data.counter}</strong></p>

    <!-- State Mutation Actions (Math expressions evaluate numerically for type="number") -->
    <flex direction="row" gap="8">
      <button class="btn">
        <on_click action="SET_STATE">
          <path>data.counter</path>
          <value>{data.counter + 1}</value>
        </on_click>
        +1
      </button>
      <button class="btn">
        <on_click action="SET_STATE">
          <path>data.counter</path>
          <value>{data.counter - 1}</value>
        </on_click>
        -1
      </button>
    </flex>

    <!-- Form Inputs with Two-Way Binding -->
    <input bind="user_name" placeholder="Enter your name" class="input" />

    <!-- Array Rendering & Keyed Reconciliation (<for_each key="id">) -->
    <flex direction="column" gap="8">
      <for_each items="{data.items}" var="item" key="id">
        <flex direction="row" align="center" justify="between" class="item-row">
          <span>{item.title}</span>
          <button class="btn-danger">
            <on_click action="MUTATE_STATE">
              <path>items</path>
              <operation>REMOVE</operation>
              <where field="id" equals="{item.id}" />
            </on_click>
            Delete
          </button>
        </flex>
      </for_each>
    </flex>
  </flex>
</uid_spec>
```

### Supported State Data Types (`type="..."`)
EUIX Engine supports core state data types inside `<data_model>` using `id="..."` and `type="..."`:

| Data Type (`type`) | Example Specification | Parsing Behavior & Arithmetic Rules |
| :--- | :--- | :--- |
| **`number`** *(Recommended for Math & Counters)* | `<state id="counter" type="number">0</state>` | Stored as a native JS `number` (`0, 1, 2...`). Evaluates math expressions (`{data.counter + 1}`) without string concatenation. `SET_STATE` preserves numeric type. |
| **`string`** | `<state id="user_name" type="string">Guest</state>` | Default type if `type` attribute is omitted. Supports string interpolation (`{data.user_name}`) and text bindings (`<input bind="user_name">`). |
| **`boolean`** | `<state id="is_active" type="boolean">true</state>` | Parsed into JS boolean (`true`/`false`). Toggleable via `<on_click action="TOGGLE_STATE">` or boolean expressions. |
| **`array`** | `<state id="items" type="array">[]</state>` | Parsed into JS Array. Loopable via `<for_each items="{data.items}">`, supports `MUTATE_STATE` (`PUSH`, `REMOVE`, `SWAP`, `CLEAR`, `REVERSE`). |
| **`object`** | `<state id="user" type="object">{"name": "Ahmet"}</state>` | Parsed into JS Object. Property access via dot notation (`{data.user.name}`). |

> [!IMPORTANT]
> **Numeric State Best Practice (`type="number"` vs Default `string`)**:
> Always specify `type="number"` for numeric variables (e.g. `<state id="count" type="number">0</state>`). When `type="number"` is set:
> 1. The initial state is parsed into a real JavaScript `number`.
> 2. `SET_STATE` and `<on_interval>` actions evaluate mathematical expressions (`{data.count + 1}` or `{data.count} + 1`) and automatically maintain numeric typing rather than coercing into string concatenations (`"01"`).

---

## 📡 4. REST API & SWR Data Fetching

Use `<api_config>` and `<api_endpoint>` to manage HTTP endpoints with reactive binding:

```xml
<uid_spec>
  <!-- Declarative API Configuration & Pre-Registration -->
  <api_config base_url="https://api.example.com">
    <!-- 1. Auto-fetching GET Endpoint -->
    <api_endpoint 
      id="get_posts" 
      url="/posts" 
      method="GET" 
      bind_target="posts_list" 
      auto_fetch="true" 
      revalidate_focus="true" 
    />

    <!-- 2. On-demand Tagged Endpoint (Pre-registered, auto_fetch="false") -->
    <api_endpoint 
      id="get_countries" 
      tag="get_countries" 
      url="/countries/search" 
      method="POST" 
      target="countries" 
      auto_fetch="false" 
    >
      <body>{"search": "{data.searchQuery}"}</body>
    </api_endpoint>
  </api_config>

  <container>
    <button>
      <on_click action="REVALIDATE_API" tag="get_posts" />
      Refresh Posts
    </button>

    <for_each items="{data.posts_list}" var="post">
      <card>
        <h3>{post.title}</h3>
        <p>{post.body}</p>
      </card>
    </for_each>
  </container>
</uid_spec>
```

### `<api_endpoint>` Attributes & Behavior
- **`auto_fetch="true"`** *(default)*: Fetches automatically when component/app mounts.
- **`auto_fetch="false"`**: Pre-registers endpoint into engine's `_registeredXhrs` registry without fetching immediately, enabling on-demand execution via `<on_click action="REVALIDATE_API" tag="...">` or `<watch>`.
- **`persist="localStorage|sessionStorage"`**: Enables persistent Stale-While-Revalidate caching across browser refreshes and offline sessions.
- **`queue_offline="true"`**: Queues mutation requests (`POST`/`PUT`/`DELETE`) in persistent storage when offline, automatically flushing them when the browser comes back online.
- **`loading="state_key"`**: Automatically binds request in-flight status (`true`/`false`) to the specified `<data_model>` state key.
- **`error="state_key"`**: Automatically binds request failure error message to the specified `<data_model>` state key.
- **Automatic ID-based Reactive Status (`{api.<id>.<prop>}` / `{$api.<id>.<prop>}`):** Access `{api.<id>.loading}`, `{api.<id>.error}`, `{api.<id>.status}`, `{api.<id>.data}`, `{api.<id>.timestamp}`, `{api.<id>.stale}`, and `{api.<id>.isOffline}` directly in templates and expressions.
- **Programmatic Status (`engine.getApiStatus(endpointId)`):** Returns `{ loading, error, status, data, timestamp, stale, isOffline }`.
- **Programmatic Cache Controls**: `engine.clearApiCache(tagOrUrl)` and `engine.flushOfflineQueue()`.
- **Method & Attribute Support**: Endpoint attributes (`url`, `method`, `target`, `bind_target`, `tag`, `select`, `auto_fetch`, `revalidate_focus`, `revalidate_online`, `persist`, `queue_offline`, `loading`, `error`) can be specified directly as attributes or nested child elements.
- **Reentrancy Safeguard**: Built-in `_isRevalidating` guard prevents infinite loops when mutation `POST` endpoints trigger `REVALIDATE_API`.

---

## 🧩 5. Components & Dynamic Loading

Modular XML components can be loaded asynchronously:

```xml
<uid_spec>
  <!-- Load External Component -->
  <component name="app-header" src="./components/AppHeader.xml" title="My Dashboard" />

  <container class="content">
    <p>Page Content</p>
  </container>
</uid_spec>
```

---

## 🛠️ 6. State API (Programmatic Control)

```js
// Read state
const currentCount = engine.getState('counter');

// Update state reactively
engine.setState('counter', 42);

// Mutate array state
engine.mutateState('items', 'PUSH', { id: Date.now(), title: 'New Item' });

// Programmatically revalidate SWR API endpoints
engine.revalidateApi('get_posts');

// Programmatically execute composed action workflow
const result = await engine.executeAction('SaveUserWorkflow', { userName: 'Alice', role: 'Admin' });
```

---

## ⚡ 6.5. Action Composer Workflow System (`<action_def>`)

Define reusable named action subroutines with parameters (`<param>`), default values, required parameter validation (`required="true"`), sequential step execution (`<step action="...">`), and optional return expressions (`<return>`):

```xml
<uid_spec>
  <actions>
    <action_def name="SaveUserWorkflow">
      <param name="userName" required="true" />
      <param name="role" default="User" />

      <step action="SET_STATE">
        <path>data.user_name</path>
        <value>{args.userName}</value>
      </step>

      <step action="MUTATE_STATE">
        <path>data.logs</path>
        <operation>UNSHIFT</operation>
        <value>Added user {args.userName} ({args.role})</value>
      </step>

      <return>{data.user_name}</return>
    </action_def>
  </actions>

  <flex direction="column">
    <!-- Declarative Invocation -->
    <button class="btn">
      <on_click action="SaveUserWorkflow">
        <arg name="userName">Bob</arg>
        <arg name="role">Admin</arg>
      </on_click>
      Save Admin
    </button>
  </flex>
</uid_spec>
```

---

## 🪝 7. Lifecycle Hooks & Event Interceptors

### XML Lifecycle Hooks
EUIX Engine provides declarative lifecycle hooks embedded directly inside XML specifications:

```xml
<uid_spec>
  <!-- Mount Hook: Runs when component/view is mounted -->
  <on_mount action="SET_STATE">
    <path>data.is_loaded</path>
    <value>true</value>
  </on_mount>
  
  <!-- Inline Script Mount Hook -->
  <on_mount action="RUN_SCRIPT">
    console.log("Component mounted!", $data.user_name);
  </on_mount>

  <!-- State Change Hook: Triggers whenever 'counter' state changes -->
  <on_state_change key="counter" action="RUN_SCRIPT">
    console.log("Counter updated to:", $data.counter);
  </on_state_change>

  <!-- Timer Hook: Runs every 1000ms -->
  <on_interval ms="1000" action="SET_STATE">
    <path>data.seconds</path>
    <value>{data.seconds} + 1</value>
  </on_interval>

  <!-- Unmount Hook: Runs when DOM element/component is removed -->
  <on_unmount action="RUN_SCRIPT">
    console.log("Cleanup on unmount");
  </on_unmount>
</uid_spec>
```

### Script Execution Context & Auto-Injected Variables (`action="RUN_SCRIPT"`)
Inside `<on_mount>`, `<on_state_change>`, or `<on_click action="RUN_SCRIPT">`, JavaScript executes in a zero-boilerplate reactive sandbox with automatic variable injection:
- **Named Loop Variable (e.g. `task`, `todo`, `item`)**: When inside `<for_each var="task">`, the loop variable (`task`) is directly accessible as a normal JS variable (`task.done = !task.done;`).
- `$item`: Current loop item object in `<for_each>` containers.
- `$ctx` / `$context`: Full execution context object (e.g. `$ctx.task`, `$ctx.todo`).
- `$index`: Current loop integer index (`0, 1, 2...`).
- `$data`: Reactive state data object (read/write access: `$data.counter = 5;`, `$data.tasks.push(...)`).
- `$el`: Current DOM element reference.
- `$engine`: `EUIXEngine` instance.
- `$evt`: Native browser DOM Event object.
- `$local`: Component-scoped isolated state store (for `isolated="true"` components).
- `$args`: Composed action workflow parameters (`<arg>`).
- `$result`: Return value of the previous step in action pipelines.
- `$date`: Intl/Date manipulation helper (when `EUIXDatePlugin` is loaded).

> [!TIP]
> **No XML Entity Escaping Required (`&&`, `<`, `>` Work Out of the Box)**:
> You do **NOT** need to write `&amp;&amp;`, `&lt;`, `&gt;` or manually wrap code in `<![CDATA[...]]>`. The EUIX Parser automatically pre-sanitizes raw logical operators (`&&`, `||`, `<`, `>`) in script blocks and XML attributes. Write standard JavaScript naturally:
> ```xml
> <on_click action="RUN_SCRIPT">
>   if ($data.newTask && $data.newTask.trim().length > 0) {
>     $data.tasks.push({ id: Date.now(), title: $data.newTask.trim(), done: false });
>     $data.newTask = "";
>   }
> </on_click>
> ```

---

## 🏷️ 8. Declarative XML Attributes & Directives Reference

### 1. Two-Way Data Binding (`bind="..."`)
Binds input controls reactively to a state variable key:
```xml
<!-- Text & Textarea -->
<input bind="user_name" placeholder="Enter name" />
<textarea bind="bio"></textarea>

<!-- Checkbox (Boolean - Use bind for void input elements) -->
<input type="checkbox" bind="is_terms_accepted" />
<input type="checkbox" bind="task.done" />

<!-- Select Options -->
<select bind="selected_role">
  <option value="admin">Admin</option>
  <option value="user">User</option>
</select>
```

### 2. Expression Interpolation (`{expression}`) & Property Access
Attributes and text nodes accept dynamic expressions. For property access (e.g. array length or object properties), prefix with **`data.`**:
```xml
<!-- Property & Length Access -->
<p>Total items: {data.items.length}</p>
<span>User role: {data.user.role}</span>

<!-- Dynamic Class & Style -->
<div class="card {data.is_active ? 'border-blue-500' : 'border-gray-200'}"></div>
<span style="color: {data.badge_color}; text-decoration: {task.done ? 'line-through' : 'none'};">Status</span>
```

### 3. Layout Tags (`<flex>`, `<container>`, `<collapse>`, `<dialog>`)
EUIX Engine includes built-in reactive layout components:
```xml
<!-- Flex Layout Container -->
<flex direction="column" gap="16" align="center" justify="between" class="w-full">
  <flex direction="row" gap="8">
    <span>Flex Child 1</span>
    <span>Flex Child 2</span>
  </flex>
</flex>

<!-- Accordion / Collapse Component -->
<collapse bind="data.section_open" title="Section Header" class="border rounded-xl">
  <p>Collapsible Body Content</p>
</collapse>

<!-- Modal Dialog -->
<dialog show="{data.is_modal_open}" title="Confirm Action">
  <p>Modal Body Text</p>
</dialog>
```

### 4. Declarative Style & Scoped CSS (`<style>`, `<style scoped="true">`)
EUIX Engine supports native `<style>` tags with scoped CSS isolation, reactive CSS interpolation, and automatic unmount cleanup:
```xml
<!-- 1. Global In-Template Styling with Reactive Variables -->
<style>
  :root {
    --accent-color: {data.theme_color};
  }
  .app-banner {
    background: var(--accent-color);
    padding: {data.padding_size}px;
  }
</style>

<!-- 2. Scoped Component Styling (Prefixes selectors with [data-euix-scope="..."]) -->
<component_def name="user-badge" isolated="true">
  <style scoped="true">
    :host {
      display: inline-flex;
    }
    .badge {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
    }
  </style>

  <div class="badge">
    <span>{data.user_name}</span>
  </div>
</component_def>

<!-- 3. External Stylesheet Alias -->
<style src="https://cdn.jsdelivr.net/npm/animate.css@4/animate.min.css" />
```

---

## 🛡️ 9. Security Best Practices & XSS Guards

### 1. API URL Scheme Guarding
EUIX Engine automatically blocks dangerous URI schemes (such as `javascript:`, `vbscript:`, and `data:`) in XHR endpoints and dynamic links to prevent XSS (Cross-Site Scripting) attacks.

### 2. Secure Token Injection via Request Interceptors
Never hardcode sensitive Auth tokens or credentials inside XML specifications. Use programmatic request interceptors:
```js
engine.api.onRequest((config) => {
  const token = sessionStorage.getItem('auth_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});
```

### 3. Sandboxed Script Execution (`action="RUN_SCRIPT"`)
Inline scripts inside `<on_mount>` or `action="RUN_SCRIPT"` execute inside an isolated `new Function()` closure rather than global `eval()`. Only `$el`, `$data`, `$engine`, and `$evt` context variables are injected.

---

## 👪 10. Parent-Child Component Architecture & Slot Projection

### 1. Dual-Mode State Scoping: Component Isolation vs Global Shared Stores

EUIX Engine supports both **Component-Scoped Isolation** (for multi-instance UI widgets like accordions, tabs, cards) and **Global Shared Stores** (for application-wide stores like `states.xml`):

```xml
<!-- 1. Component-Scoped Isolation (<component_def isolated="true">) -->
<component_def name="accordion-card" isolated="true">
  <data_model>
    <!-- Private to each rendered card instance; will not leak or collide -->
    <state id="isOpen" type="boolean">false</state>
    <state id="clicks" type="number">0</state>
  </data_model>

  <div class="card">
    <h4>{props.title}</h4>
    <span>Status: {local.isOpen ? 'OPEN' : 'CLOSED'}</span>
    <span>Clicks: {local.clicks}</span>

    <button>
      <on_click action="SET_STATE">
        <path>local.isOpen</path>
        <value>{local.isOpen ? 'false' : 'true'}</value>
      </on_click>
      Toggle Card
    </button>
  </div>
</component_def>
```

```xml
<!-- 2. Global Shared Store (<data_model scope="global"> or states.xml) -->
<component_def name="app-theme-store">
  <data_model scope="global">
    <state id="theme">dark</state>
    <state id="user_profile" type="object">{"name": "Ahmet"}</state>
  </data_model>
</component_def>
```

### 2. Prop Passing (Parent -> Child)
```xml
<!-- Parent Specification -->
<uid_spec>
  <data_model>
    <state id="active_user">Ahmet</state>
  </data_model>

  <component name="user-badge" src="./components/UserBadge.xml" user_name="{data.active_user}" role="Admin" />
</uid_spec>
```

```xml
<!-- Child Component Specification (UserBadge.xml) -->
<component_def name="user-badge">
  <data_model>
    <state id="user_name">Guest</state>
    <state id="role">User</state>
  </data_model>

  <div class="badge">
    <span>{data.user_name}</span>
    <small>({data.role})</small>
  </div>
</component_def>
```

### 3. Children / Slot Content Projection (`<children />` or `<slot />`)
```xml
<!-- Parent passing nested content -->
<component name="card-modal" src="./Modal.xml" title="Confirm Action">
  <p>Are you sure you want to delete this record?</p>
  <button>
    <on_click action="SET_STATE">
      <path>data.is_confirmed</path>
      <value>true</value>
    </on_click>
    Confirm
  </button>
</component>
```

```xml
<!-- Child Component Projection (Modal.xml) -->
<component_def name="card-modal">
  <div class="modal-box">
    <h2>{data.title}</h2>
    <!-- Projected Parent Content rendered here -->
    <children />
  </div>
</component_def>
```

---

## ⚠️ 11. Common Pitfalls & Anti-Patterns

### 1. Invalid `on_<event>` Action Names & Syntax
❌ **WRONG**: Writing custom JS function names or using `key="..."` instead of `id="..."` in `<state>`.
```xml
<!-- INVALID: 'key' instead of 'id', 'addTask' is not a recognized EUIX Engine action -->
<state key="tasks" value="[]" type="array" />
<button on_click="addTask">Add Task</button>
```

✅ **RIGHT**: Use `id="..."` for `<state>` and child `<on_click action="...">` elements.
```xml
<state id="newTask"></state>
<state id="tasks" type="array"></state>

<!-- Child <on_click action="RUN_SCRIPT"> tag -->
<button class="ai-btn">
  <on_click action="RUN_SCRIPT">
    if ($data.newTask &amp;&amp; $data.newTask.trim()) {
      $data.tasks.push({ id: Date.now(), title: $data.newTask.trim(), done: false });
      $data.newTask = "";
    }
  </on_click>
  Add Task
</button>
```

### 2. Correct State Declaration in `<data_model>`
❌ **WRONG**: Using `key="..."` attribute in `<state>`.
```xml
<state key="newTask" value="" type="string" />
```

✅ **RIGHT**: Use `id="..."` attribute in `<state>`.
```xml
<state id="newTask"></state>
<state id="tasks" type="array"></state>
<state id="counter">0</state>
```

### 3. List Item Deletion in `<for_each>`
❌ **WRONG**: Passing undefined functions or relying on attribute actions without child tags.
```xml
<button on_click="deleteTask" id="{task.id}">Delete</button>
```

✅ **RIGHT**: Use `<on_click action="MUTATE_STATE">` with `<where field="id" equals="{task.id}" />`.
```xml
<for_each items="{data.tasks}" var="task">
  <flex direction="row" align="center" justify="between">
    <span>{task.title}</span>
    <button class="ai-btn-secondary">
      <on_click action="MUTATE_STATE">
        <path>tasks</path>
        <operation>REMOVE</operation>
        <where field="id" equals="{task.id}" />
      </on_click>
      Delete
    </button>
  </flex>
</for_each>
```

### 4. Checkbox & Void Input Binding
❌ **WRONG**: Putting child elements inside void `<input>` tags.
```xml
<input type="checkbox" checked="{task.done}">
  <on_click action="RUN_SCRIPT">
    $data.tasks[{i}].done = !$data.tasks[{i}].done;
  </on_click>
</input>
```

✅ **RIGHT**: Use two-way data binding `bind="task.done"` on `<input type="checkbox" />`.
```xml
<for_each items="{data.tasks}" var="task">
  <input type="checkbox" bind="task.done" />
</for_each>
```

### 5. `<value>` in `MUTATE_STATE` Smart Parsing (JSON & Dynamic JS Expressions)
EUIX Engine includes a **Smart Object Evaluator** that seamlessly parses native JSON, dynamic JavaScript expressions, and template variables inside `<value>`:
```xml
<!-- 1. Dynamic ID with JavaScript Date.now() & state reference -->
<on_click action="MUTATE_STATE">
  <path>tasks</path>
  <operation>PUSH</operation>
  <value>{"id": "t_" + Date.now(), "title": data.newTask, "done": false}</value>
</on_click>

<!-- 2. Dynamic boolean negation in UPDATE -->
<on_click action="MUTATE_STATE">
  <path>tasks</path>
  <operation>UPDATE</operation>
  <where field="id" equals="{task.id}" />
  <value>{"done": !task.done}</value>
</on_click>

<!-- 3. Declarative <fields> attribute syntax (Alternative) -->
<on_click action="MUTATE_STATE">
  <path>tasks</path>
  <operation>UPDATE</operation>
  <where field="id" equals="{task.id}" />
  <fields done="{!task.done}" />
</on_click>
```
> [!TIP]
> Both `<value>{"done": !task.done}</value>` and `<fields done="{!task.done}" />` are fully supported and evaluated without runtime JSON parse errors.

### 6. Input Placeholders vs Initial State Value
❌ **WRONG**: Putting placeholder guide text into `<state>` for a two-way bound input.
```xml
<!-- INVALID: Input box will be pre-filled with the text "Enter task..." instead of showing placeholder -->
<state id="newTask">Enter task...</state>
<input bind="newTask" placeholder="Enter task..." />
```

✅ **RIGHT**: Keep input state empty `<state id="newTask"></state>` and declare placeholder in `<input placeholder="...">`:
```xml
<state id="newTask"></state>
<input bind="newTask" placeholder="Enter task..." />
```

### 7. Declarative List Filtering in `<for_each>` with `<if condition="...">`
❌ **WRONG**: Declaring a filter state (`<state id="filter">all</state>`) and filter buttons, but forgetting to filter items in `<for_each>`.
```xml
<!-- INVALID: Items never change when filter state is updated -->
<for_each items="{data.tasks}" var="task">
  <card>{task.title}</card>
</for_each>
```

✅ **RIGHT**: Wrap card elements with reactive `<if condition="...">` inside `<for_each>` (write raw `&&`, `||` without XML entities):
```xml
<for_each items="{data.tasks}" var="task" key="id">
  <if condition="{data.filter} == 'all' || ({data.filter} == 'active' && !{task.done}) || ({data.filter} == 'done' && {task.done})">
    <card>{task.title}</card>
  </if>
</for_each>
```

---

## 🛡️ 12. Declarative Try / Catch / Finally Error Handling

EUIX Engine supports declarative, structured error handling across synchronous and asynchronous actions (`XHR`, `RUN_SCRIPT`, `Action Composer` workflows):

```xml
<uid_spec>
  <flex direction="column">
    <button class="btn">
      <on_click action="TRY">
        <!-- Protected Actions -->
        <step action="XHR">
          <url>https://api.example.com/save</url>
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
      Submit Form
    </button>
  </flex>
</uid_spec>
```

### Structured Error Properties (`EUIXStructuredError`)
Inside `<catch var="err">`, the error object exposes structured properties:
- `{err.message}`: Human-readable error message
- `{err.code}`: Categorized error code (`ACTION_EXECUTION_ERROR`, `API_HTTP_ERROR`, `API_NETWORK_ERROR`, `VALIDATION_ERROR`, `TIMEOUT_ERROR`)
- `{err.status}`: HTTP response status code (e.g. 500, 404) for network errors
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
Register a global `onError` callback on the engine instance to capture all uncaught runtime errors, XML parsing failures, XHR errors, or component rendering exceptions for telemetry or error monitoring:
```js
const engine = EUIXEngine.mount(xmlString, '#app');

engine.onError = (error, contextInfo) => {
  console.error(`[EUIX Error Boundary] ${contextInfo}:`, error);
  // Send to error logging service
};
```

---

## ⚡ 13. Declarative Resilience Primitives & `EUIXResiliencePlugin`

EUIX Engine provides tree-shakeable resilience execution primitives (`<retry>`, `<timeout>`, `<delay>`, `EUIXCancellationController`) via `EUIXResiliencePlugin`:

```xml
<uid_spec>
  <flex direction="column" gap="12">
    <button class="btn">
      <on_click action="TRY">
        <!-- 1. Retry with Exponential Backoff -->
        <retry attempts="3" delay="500" backoff="exponential" max_delay="3000" on_error="API_HTTP_ERROR,API_NETWORK_ERROR,TIMEOUT_ERROR">
          <!-- 2. Timeout Scope (2000ms max per attempt) -->
          <timeout ms="2000" message="Request timed out after 2 seconds">
            <step action="XHR">
              <url>https://api.example.com/unstable-endpoint</url>
              <target>data.items</target>
            </step>
          </timeout>
        </retry>

        <!-- 3. Non-blocking Delay Primitive -->
        <delay ms="1000" />

        <catch var="err">
          <step action="SET_STATE">
            <path>data.error_log</path>
            <value>Exhausted attempts: [{err.code}] {err.message}</value>
          </step>
        </catch>
      </on_click>
      Resilient Action Sequence
    </button>
  </flex>
</uid_spec>
```

### Key Capabilities & Backoff Strategies:
- **`<retry attempts="..." delay="..." backoff="...">`**: Re-executes actions on failure. Supports `fixed`, `linear`, `exponential`, `jitter` backoff strategies, and `on_error` filtering.
- **`<timeout ms="...">`**: Bounds execution time. Cancels underlying fetch requests (`AbortSignal`) and blocks late state mutations (`setState`).
- **`<delay ms="...">`**: Non-blocking awaitable pause, responsive to cancellation signals.
- **`EUIXCancellationController`**: Token signal propagation preventing race conditions and late state pollution.

---

## ⚡ 14. Declarative Watch & Computed State (`EUIXReactivePlugin`)

EUIX Engine provides tree-shakeable derived state (`<computed>`) and reactive watchers (`<watch>`) via `EUIXReactivePlugin` (`euixjs/reactive`):

```xml
<uid_spec>
  <data_model>
    <state id="firstName">John</state>
    <state id="lastName">Doe</state>
    <state id="user_role">Admin</state>
    <state id="searchQuery"></state>
    <state id="audit_logs" type="array"></state>

    <!-- 1. Side-Effect Free Computed Property with Caching & Fine-Grained Dependencies -->
    <computed id="fullName" deps="firstName, lastName">
      return $data.firstName + " " + $data.lastName;
    </computed>

    <!-- 2. Watcher Declared Inside <data_model> for Live Reactive Side-Effects -->
    <watch path="searchQuery">
      <step action="REVALIDATE_API" tag="get_countries" />
    </watch>
  </data_model>

  <!-- 3. Reactive Watcher Executing EUIX Actions on Change -->
  <watch path="user_role">
    <step action="MUTATE_STATE">
      <path>audit_logs</path>
      <operation>UNSHIFT</operation>
      <value>User role changed from {prevValue} to {newValue}</value>
    </step>
  </watch>

  <!-- 4. Reactive Watcher on Computed Property -->
  <watch path="computed.fullName">
    <step action="RUN_SCRIPT">
      console.log("User full name changed to:", $newValue);
    </step>
  </watch>

  <flex direction="column" gap="12">
    <h1>Welcome, {data.fullName}!</h1>
  </flex>
</uid_spec>
```

### Key Capabilities & Safeguards:
- **Side-Effect Free Derived State (`<computed>`)**: Cached evaluations with fine-grained dependency tracking. Read-only (`COMPUTED_MUTATION_ERROR`).
- **Circular Dependency Guards (`COMPUTED_CYCLE_ERROR`)**: Detects static and runtime dependency loops (e.g. `A -> B -> C -> A`).
- **Reactive Side-Effects (`<watch>`)**: Triggers EUIX actions when watched state or computed paths change. Exposes `$newValue`, `$prevValue`, `$path`.
- **Infinite Reactive Loop Guards (`WATCHER_CYCLE_ERROR`)**: Protects against cascading watcher loops with depth limits and execution tracking.
- **Component Lifecycle Cleanup**: Component-scoped watchers and computed subscriptions are released on unmount (`disposeComponentReactive`).

---

## 🎭 15. Declarative Animation System (`EUIXAnimationPlugin`)

EUIX Engine provides a tree-shakeable declarative animation system (`<animations>`, `<animation_def>`, `<animate>`, `enter_animation`, `leave_animation`) via `EUIXAnimationPlugin` (`euixjs/animation`):

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
      <h1 class="text-2xl font-bold">Animated Component</h1>
    </div>

    <!-- 3. Event-Triggered Declarative Animation Action -->
    <button class="btn">
      <on_click action="ANIMATE" target="#hero" name="customPulse" duration="500" />
      Trigger Pulse
    </button>
  </flex>
</uid_spec>
```

### Key Capabilities & Animation Model:
- **Built-in Presets**: Standard keyframe presets (`fade-in`, `fade-out`, `slide-in-down`, `slide-out-up`, `slide-in-left`, `slide-out-right`, `scale-in`, `scale-out`, `spin`, `pulse`, `bounce`).
- **`<animation_def>` Declarations**: Reusable named keyframe animation definitions parsed directly from XML.
- **Lifecycle Enter & Deferred Leave**: Element enter (`enter_animation="..."`) and leave (`leave_animation="..."`) transitions. Deferred DOM detachment on conditional state branch changes until leave transition finishes.
- **Interruption & Cancellation Policies**: Supports `cancel` (aborts current target animation), `finish` (skips to end state), and `queue` policies. Integrates with `EUIXCancellationController`.
- **Reduced Motion Awareness**: Respects system `prefers-reduced-motion` settings by collapsing duration to 0ms.
- **Programmatic Control**: Programmatically trigger animations via `engine.animate(target, keyframesOrName, options)`.

---

## 🌐 16. Web Router & Client-Side Navigation (`EUIXRouterPlugin`)

EUIX Engine provides a complete, modern declarative Web Router (`<router>`, `<route>`, `<outlet>`, `<link>`, `$route`, `$router`, `loaders`, `actions`, `fetchers`, `guards`, `scroll restoration`) via `EUIXRouterPlugin` (`euixjs/router`):

```xml
<uid_spec>
  <!-- Declarative Router Tree -->
  <router mode="history" base="/">
    <!-- Root Layout Route with Navigation Bar and Nested Outlet -->
    <route id="root" path="/" layout="./layouts/RootLayout.xml">
      <!-- Index Route -->
      <route id="home" index="true" component="./pages/Home.xml" />

      <!-- Parameterized Route with Async Data Loader -->
      <route 
        id="user-profile" 
        path="/users/:id" 
        component="./pages/UserProfile.xml" 
        loader="loadUserData" 
        action="updateUserData" 
      />

      <!-- Wildcard / 404 Fallback Route -->
      <route id="not-found" path="*" component="./pages/NotFound.xml" />
    </route>
  </router>

  <flex direction="column" gap="16">
    <!-- Declarative Navigation Link with Active Class Styling -->
    <flex direction="row" gap="8">
      <link to="/" active_class="font-bold text-emerald-400">Home</link>
      <link to="/users/42" active_class="font-bold text-emerald-400">User Profile (42)</link>
    </flex>

    <!-- Main Viewport Router Outlet -->
    <outlet />
  </flex>
</uid_spec>
```

### Key Router Capabilities:
- **Router Modes**: `history` (HTML5 History API with pushState/popState) and `hash` (Single-Page Apps / static hosts).
- **Nested Routes & Outlets (`<outlet />`)**: Nested routing with hierarchical component projection and layout inheritance.
- **Async Loaders & Route Data (`$route.data`)**: Route data prefetching via registered async loader functions or XHR configurations.
- **Route Actions & Mutations**: Handle form actions, updates, and automatic loader revalidation.
- **Independent Fetchers (`$fetcher.<id>`)**: Perform background data mutations or optimistic loads without changing the current URL.
- **Route Guards & Middleware (`beforeEnter`, `canActivate`)**: Protect routes with declarative or programmatic authentication checks.
- **Scroll Restoration**: Automatic scroll position management across page navigation and popstate events.
- **Programmatic Router API**: `engine.$router.navigate(to, options)`, `engine.$router.back()`, `engine.$router.forward()`.

---

## 📅 17. Declarative Date & Time Localization (`EUIXDatePlugin`)

EUIX Engine provides native `Intl`-powered date/time formatting, relative times, date ranges, and Day.js-style calculations via `EUIXDatePlugin` (`euixjs/date`):

```xml
<uid_spec>
  <!-- 1. Global Date Configuration -->
  <date_config locale="tr-TR" timezone="Europe/Istanbul" />

  <data_model>
    <state id="sampleDate">2026-08-20T14:30:00Z</state>
    <state id="startDate">2026-08-01T09:00:00Z</state>
    <state id="endDate">2026-09-15T18:00:00Z</state>
    <state id="publishedAt">2026-08-20T12:00:00Z</state>
  </data_model>

  <flex direction="column" gap="16">
    <!-- 2. Declarative Formatted Date -->
    <date value="{data.sampleDate}" format="full" locale="en-US" />

    <!-- 3. Live Ticking Clock (updates automatically) -->
    <time value="now" format="time_medium" live="true" interval="1000" />

    <!-- 4. Date Range Formatting -->
    <date_range start="{data.startDate}" end="{data.endDate}" format="medium" />

    <!-- 5. Relative Time Formatting (e.g. "5 hours ago", "in 2 days") -->
    <relative_time value="{data.publishedAt}" live="true" interval="10000" />

    <!-- 6. Template Expression Calculations (Day.js-style APIs) -->
    <p>Days in Month: {$date.daysInMonth(data.sampleDate)}</p>
    <p>Is Leap Year: {$date.isLeapYear(data.sampleDate) ? 'Yes' : 'No'}</p>
    <p>Quarter: Q{$date.quarter(data.sampleDate)}</p>
    <p>Week of Year: Week {$date.weekOfYear(data.sampleDate)}</p>

    <!-- 7. Declarative Actions -->
    <button class="btn">
      <on_click action="SET_DATE_LOCALE" locale="de-DE" />
      Switch to German
    </button>
  </flex>
</uid_spec>
```

### Key Capabilities & Day.js Utilities:
- **Intl-Powered Memoization**: High-performance LRU caching over `Intl.DateTimeFormat` and `Intl.RelativeTimeFormat`.
- **Format Presets**: `date`, `short`, `medium`, `long`, `full`, `time`, `time_medium`, `datetime`, `datetime_long`, `year`, `month`, `weekday`, `iso`, `timestamp`.
- **Live Updating (`live="true"`, `interval="..."`)**: Real-time relative times and digital clocks without memory leaks.
- **Day.js-style Utility Methods**: `$date.daysInMonth()`, `$date.isLeapYear()`, `$date.add()`, `$date.subtract()`, `$date.diff()`, `$date.startOf()`, `$date.endOf()`, `$date.quarter()`, `$date.weekOfYear()`, `$date.isBefore()`, `$date.isAfter()`, `$date.isSame()`, `$date.isBetween()`, `$date.isToday()`.
- **Programmatic & Expression Access**: Accessible via `$date` in templates, inline scripts (`RUN_SCRIPT`), and `engine.$date`.

---

## 📊 18. Declarative SVG Charts & Visualizations (`EUIXChartPlugin`)

EUIX Engine provides zero-dependency declarative SVG charts via `EUIXChartPlugin` (`euixjs/chart`):

```xml
<uid_spec>
  <data_model>
    <state id="salesData" type="array">
      [
        {"month": "Jan", "revenue": 12000, "profit": 4000},
        {"month": "Feb", "revenue": 19000, "profit": 6500},
        {"month": "Mar", "revenue": 24000, "profit": 9200},
        {"month": "Apr", "revenue": 18000, "profit": 5800}
      ]
    </state>
  </data_model>

  <flex direction="column" gap="16">
    <!-- Bar / Line / Area Chart Specification -->
    <chart type="bar" data="{data.salesData}" width="100%" height="320" animated="true">
      <chart_axis x="month" y="revenue" grid="true" />
      <chart_series y="revenue" name="Revenue" color="#10b981" />
      <chart_series y="profit" name="Profit" color="#6366f1" />
      <chart_tooltip format="currency" />
      <chart_legend position="top" />
    </chart>
  </flex>
</uid_spec>
```

### Key Capabilities:
- **Supported Chart Types**: `bar`, `line`, `area`, `pie`, `doughnut`, `scatter`, `radar`.
- **Zero Heavy External Dependencies**: Lightweight SVG rendering pipeline with crisp vector rendering on any DPI.
- **Interactive Tooltips & Legends**: Hover markers, data point inspections, and series visibility toggles.
- **Reactive Data Binding**: Charts re-render and morph seamlessly when underlying array state updates.

---

## 🗺️ 19. Declarative Maps & GIS (`EUIXLeafletPlugin`)

EUIX Engine provides declarative interactive maps via `EUIXLeafletPlugin` (`euixjs/leaflet`):

```xml
<uid_spec>
  <data_model>
    <state id="markers" type="array">
      [
        {"id": 1, "lat": 41.0082, "lng": 28.9784, "title": "Istanbul Office"},
        {"id": 2, "lat": 39.9334, "lng": 32.8597, "title": "Ankara Hub"}
      ]
    </state>
  </data_model>

  <flex direction="column" gap="16">
    <map center="[41.0082, 28.9784]" zoom="12" height="400px" class="rounded-2xl border">
      <tile_layer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap contributors" />
      
      <for_each items="{data.markers}" var="m" key="id">
        <marker lat="{m.lat}" lng="{m.lng}" title="{m.title}">
          <popup>
            <h4>{m.title}</h4>
            <p>Coordinates: {m.lat}, {m.lng}</p>
          </popup>
        </marker>
      </for_each>

      <circle center="[41.0082, 28.9784]" radius="5000" color="#10b981" fill_color="#10b981" fill_opacity="0.2" />
    </map>
  </flex>
</uid_spec>
```

### Key Capabilities:
- **Declarative Map Primitives**: `<map>`, `<marker>`, `<popup>`, `<tile_layer>`, `<circle>`, `<polygon>`, `<polyline>`, `<geo_json>`.
- **Reactive Marker Lists**: Dynamically add, update, or filter markers using standard EUIX `<for_each>` bindings.
- **Interactive Event Actions**: Trigger EUIX actions on marker clicks, map moves, and popup actions.

---

## 🧭 20. App Navigation & Bottom Tabs (`EUIXNavigatorPlugin`)

EUIX Engine provides mobile and web bottom tab navigation and stack navigation via `EUIXNavigatorPlugin` (`euixjs/navigator`):

```xml
<uid_spec>
  <data_model>
    <state id="activeTab">home</state>
  </data_model>

  <navigator bind="activeTab" type="bottom-tabs" class="fixed bottom-0 left-0 right-0">
    <nav_item id="home" label="Home" icon="home" component="./tabs/HomeTab.xml" />
    <nav_item id="search" label="Search" icon="search" component="./tabs/SearchTab.xml" />
    <nav_item id="notifications" label="Alerts" icon="bell" badge="{data.unread_count}" component="./tabs/AlertsTab.xml" />
    <nav_item id="profile" label="Profile" icon="user" component="./tabs/ProfileTab.xml" />
  </navigator>
</uid_spec>
```

---

## 🔍 21. Runtime Inspector & Playwright E2E Integration (`@euix/inspector` / `euixjs/inspector`)

EUIX provides a lightweight runtime inspector and Playwright testing integration designed for **E2E test authoring, component debugging, DOM inspection, and stable selector generation**.

### 1. Registration & Zero-Cost Configuration
```js
import { EUIXEngineCore } from 'euixjs/core';
import inspector from 'euixjs/inspector';

// Register with Lite Core
EUIXEngineCore.use(
  inspector({
    enabled: import.meta.env.DEV, // Zero cost in production when false
    shortcut: 'Alt+Shift+X',       // Keyboard shortcut to toggle inspect mode
    testAttributes: true,          // Automatically inject data-euix-test and data-euix-action
    maxEvents: 100                 // Ring buffer action log capacity
  })
);
```

### 2. Inspect Mode & Selector Scoring Hierarchy
- **Shortcut**: `Alt+Shift+X` (or `Alt+Shift+I`), `Escape` to deactivate.
- **Visual Overlay**: Non-intrusive fixed highlight outline (`pointer-events: none`) with badge tooltip displaying component name, instance ID, props, test-id, action, route, and bindings.
- **Scored Stable Selectors**:
  1. `[data-euix-test="..."]` *(Score: 100%)*
  2. `page.getByRole('...', { name: '...' })` *(Score: 90%)*
  3. `[data-euix-action="..."]` *(Score: 85%)*
  4. `[data-euix-component="..."] button` *(Score: 75%)*
  5. `#id`, `input[name="..."]` *(Score: 60%)*
  6. CSS Path & `nth-child` fallback

### 3. Playwright E2E Integration Suite (`euix(page)`)
```js
import { test, expect } from '@playwright/test';
import { euix } from 'euixjs/inspector/playwright';

test('order submission flow', async ({ page }) => {
  await page.goto('/checkout');

  // Chainable component and test-id scoping
  await euix(page)
    .component('CheckoutForm')
    .getByTestId('submit-btn')
    .click();

  // Deterministic idle waiting (waits for pending actions, loaders, revalidations, route transitions)
  await euix(page).waitForIdle();

  // Failure debugging snapshot
  const snapshot = await euix(page).component('CheckoutForm').debug();
});
```

### 4. Console Debugging API (`$euix`)
```js
$euix.inspect($0);       // Inspect selected DOM element
$euix.componentOf($0);   // Get component name of element
$euix.snapshot($0);      // Get masked JSON debug snapshot
$euix.tree();            // View mounted component hierarchy tree
$euix.actions();         // View recent action execution logs
```

---

## 🤖 16. WebMCP Browser AI Agent Tools (`<webmcp>`, `document.modelContext`)

EUIX Engine provides first-class support for the **Model Context Protocol (WebMCP)** in the browser via `document.modelContext`.

### 1. Declarative WebMCP Tool Definition
Expose application actions directly to AI agents using structured `<webmcp>` blocks:

```xml
<uid_spec>
  <!-- Reusable Action Workflow -->
  <actions>
    <action_def name="task.create">
      <param name="title" required="true" />
      <param name="priority" default="Normal" />

      <step action="MUTATE_STATE">
        <path>data.tasks</path>
        <operation>PUSH</operation>
        <value>{"id": "t_" + Date.now(), "title": "{args.title}", "priority": "{args.priority}", "done": false}</value>
      </step>

      <return>{"success": true, "title": "{args.title}"}</return>
    </action_def>
  </actions>

  <!-- WebMCP Exposure -->
  <webmcp>
    <tool
      name="create_task"
      title="Create Task"
      description="Creates a new task in the project tracker"
      action="task.create">
      <param name="title" type="string" description="Task title" required="true" minlength="1" />
      <param name="priority" type="string" description="Priority level" default="Normal" enum="Low,Normal,High,Urgent" />
    </tool>

    <tool
      name="list_tasks"
      title="List Tasks"
      description="Returns all active and completed tasks"
      action="task.list"
      readonly="true"
    />
  </webmcp>
</uid_spec>
```

### 2. Imperative WebMCP API (`engine.webmcp`)
```js
// Register tool programmatically
engine.webmcp.register({
  name: 'search_items',
  title: 'Search Items',
  description: 'Searches catalog items',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string' }
    },
    required: ['query']
  },
  execute: async (args, context) => {
    return context.actions.run('items.search', args);
  }
});

// Check support & list tools
const isSupported = engine.webmcp.isSupported(); // document.modelContext present
const tools = engine.webmcp.list();
```

### 3. Advanced Lazy Loading & Predictive Preloading (`<import lazy="..." />`)
EUIX Engine provides comprehensive lazy loading and speculative preloading strategies via `EUIXLazyPlugin`:

```xml
<imports>
  <!-- 1. Viewport Lazy Loading (IntersectionObserver with 200px root margin) -->
  <import name="heavy-chart" src="components/HeavyChart.xml" lazy="true" viewport="true" root_margin="200px" />

  <!-- 2. Zero-CLS Layout Reservation & Custom Placeholder Skeleton -->
  <import 
    name="analytics-table" 
    src="components/AnalyticsTable.xml" 
    lazy="true" 
    viewport="true" 
    min_height="360px" 
    aspect_ratio="16/9" 
    placeholder_class="custom-skeleton" 
  />

  <!-- 3. Hover & Pointer Focus Preloading (fetches on mouseenter/focusin) -->
  <import name="checkout-modal" src="components/CheckoutModal.xml" lazy="true" preload="hover" />

  <!-- 4. Background Idle Preloading (requestIdleCallback with network awareness) -->
  <import name="help-center" src="components/HelpCenter.xml" lazy="true" preload="idle" />

  <!-- 5. Automatic Exponential Backoff Retries on Transient Failures -->
  <import name="weather-widget" src="components/WeatherWidget.xml" lazy="true" retries="3" retry_delay="500" />
</imports>
```

#### Programmatic Preload & Playwright E2E Helper:
```js
// Programmatic speculative preloading
await engine.preloadLazyComponent('checkout-modal');

// Playwright test assertion waiting for lazy component hydration
await euix(page).waitForLazy('heavy-chart');
```

---

## ⚡ 22. High-Performance Architecture & Rendering Pipeline

EUIX Engine is engineered with zero Virtual DOM overhead, achieving raw native performance through 6 core execution optimizations:

```
                  +-------------------------------------------------------------+
                  |               EUIX High-Performance Pipeline                |
                  +-------------------------------------------------------------+
                                                 |
         +--------------------+------------------+------------------+--------------------+
         |                    |                  |                  |                    |
         v                    v                  v                  v                    v
  +--------------+    +---------------+  +---------------+  +---------------+    +---------------+
  |  cloneNode   |    | JIT Direct    |  | Pre-Scoped    |  | Hybrid BigInt |    | LIS Keyed     |
  |  Fast-Path   |    | Property Reads|  | CSS Templates |  | Dynamic Mask  |    | List Diffing  |
  +--------------+    +---------------+  +---------------+  +---------------+    +---------------+
```

1. **Static Subtree Pre-Compilation & Native `cloneNode(true)` Fast-Path**:
   - Subtrees devoid of reactive bindings (`{data...}`) or dynamic event hooks are compiled once into a DOM prototype (`xmlNode._staticPrototype`).
   - Subsequent mounts, loops, and component instances instantiate subtrees in a single native C++ DOM clone operation.
2. **JIT Single-Pass Expression Inlining (`EUIXExpressionParser`)**:
   - Expressions like `{data.count + 1}` or `{item.price * item.qty}` are compiled directly into native JavaScript property accesses (`$data?.count`, `$ctx?.item?.price`) bypassing string-based variable resolution maps.
3. **Pre-Scoped CSS Templates & CSSOM Dirty-Checking (`processStyleTag`)**:
   - `<style scoped="true">` selector scoping (`scopeCSS`) runs once during template mounting.
   - Style updates evaluate reactive variables directly against the pre-scoped template and only write to `styleEl.textContent` when content genuinely changes (`styleEl.textContent !== newCss`).
4. **`<for_each>` JIT Loop Getters & LIS Algorithm (`ForEachRenderer`)**:
   - Loop row expressions (`{p.price * p.qty}`) compile into lightweight row getters.
   - Reordering and sorting uses the **Longest Increasing Subsequence (LIS)** algorithm to minimize DOM `insertBefore` calls.
5. **Hybrid 32-bit / BigInt Dynamic Bitmask Tracking (`BindingResolver`)**:
   - Standard apps (<32 variables) run on 32-bit integer bitmasks.
   - Large applications with 100+ variables automatically promote to `BigInt` bitmasks (`1n << BigInt(index)`) ensuring zero bitmask overflow collisions and zero redundant re-renders.
6. **LRU-Cached Dependency Key Analysis (`extractStateKeys`)**:
   - Key extraction parses template expressions once and caches dependencies in an LRU map (`EXTRACT_KEYS_CACHE`), eliminating RegExp compilation overhead on every reactive tick.

---

## 🛡️ 23. Real-World Patterns, Fixtures & Pitfalls Reference

Learned from real-world end-to-end fixture suites (`tests/scenarios/`):

### 1. Nested State Arrays & Deep Reactive Proxy
EUIX Engine includes full **Recursive Deep Reactive Proxy** interception. Mutating nested properties directly (in scripts, callbacks, or action steps) automatically updates the underlying store and triggers reactive DOM synchronization:
```js
// ✅ CORRECT: Direct deep property mutations trigger reactive UI updates automatically
$item.done = !$item.done;
$data.user.address.city = "Izmir";
$data.cart.items[0].qty += 1;
$data.cart.items.push({ id: 2, name: "Orange", qty: 1 });

// Programmatic state update:
engine.setState("cart", { ...engine.getState("cart") });
```
> [!NOTE]
> EUIX Engine's recursive proxy intercepts all sub-property sets and array mutating methods (`push`, `pop`, `splice`, etc.), bubbling the mutation up to the root state key and immediately updating bound template expressions and `<for_each>` lists.

### 2. Complex Boolean Logic & Unary Operators
In templates, write natural JavaScript logical expressions:
```xml
<!-- ✅ CORRECT: Evaluates cleanly in JIT compiled expressions -->
<div class="card" style="display: {!data.isPremium || data.notifications.length === 0 ? 'block' : 'none'};">
  <span>No unread notifications</span>
</div>
```

### 3. SWR API Endpoints & On-Demand Revalidation (`REVALIDATE_API`)
```xml
<api_config base_url="https://api.example.com">
  <api_endpoint
    id="search_repos"
    tag="search_repos"
    url="/search?q={data.searchQuery}"
    method="GET"
    bind_target="repositories"
    select="items"
    loading="isLoading"
    error="errorMessage"
    auto_fetch="false"
  />
</api_config>

<!-- Declarative Trigger Button -->
<button id="btn-search">
  <on_click action="REVALIDATE_API" tag="search_repos" />
  Search
</button>
```

### 4. Component Local State Isolation (`isolated="true"`)
For multi-instance UI widgets (accordions, tree nodes, tabs, dropdowns), always mark the definition as `isolated="true"`:
```xml
<component_def name="tree-branch" isolated="true">
  <data_model>
    <!-- Private to this branch instance -->
    <state id="isExpanded" type="boolean">false</state>
  </data_model>

  <div class="branch">
    <button>
      <on_click action="TOGGLE_STATE">
        <path>local.isExpanded</path>
      </on_click>
      {local.isExpanded ? '[-]' : '[+]'}
    </button>
    <div style="display: {local.isExpanded ? 'block' : 'none'};">
      <children />
    </div>
  </div>
</component_def>
```

### 5. Action Workflows with Typed Arguments (`<action_def>`)
```xml
<actions>
  <action_def name="UpdateItemQuantity">
    <param name="itemId" required="true" />
    <param name="delta" type="number" required="true" />

    <step action="RUN_SCRIPT">
      const item = $data.cart.items.find(i => i.id === $args.itemId);
      if (item) {
        item.qty = Math.max(1, item.qty + Number($args.delta));
        $data.cart = { ...$data.cart, items: [...$data.cart.items] };
      }
    </step>
  </action_def>
</actions>

<!-- Calling from a list row -->
<button>
  <on_click action="UpdateItemQuantity">
    <arg name="itemId">{item.id}</arg>
    <arg name="delta">1</arg>
  </on_click>
  +1
</button>
```

---

## 📋 24. Crucial XML Template Authoring Rules & Checklist

When building applications or generating `<uid_spec>` XML templates, always verify against this checklist:

| Rule Area | ❌ Anti-Pattern | ✅ Correct Practice |
| :--- | :--- | :--- |
| **`MUTATE_STATE` JSON** | `<value>{"id":"t"+Date.now()}</value>`<br>`<value>{"done":!{task.done}}</value>` | Use `action="RUN_SCRIPT"` for JS expressions/timestamps.<br>Or use `<fields done="{!task.done}" />` in `UPDATE`. |
| **Item Property Updates** | Modifying inner object properties in JS (`item.done = true`) | Use `<on_click action="MUTATE_STATE">` with `<fields done="{!task.done}" />`<br>or reassign array (`$data.tasks = [...$data.tasks]`). |
| **Input Binding vs Placeholder** | `<state id="task">Type task...</state>` | `<state id="task"></state>`<br>`<input bind="task" placeholder="Type task..." />` |
| **List Filtering** | Setting `<state id="filter">` without `<if>` in `<for_each>` | Wrap items with `<if condition="data.filter == 'all' || ...">` inside `<for_each>`. |
| **XML Entities** | Using raw `&&` inside XML attributes | Use `&amp;&amp;` in XML attributes and scripts. |
| **Numeric Variables** | `<state id="count">0</state>` | `<state id="count" type="number">0</state>` for math operations. |
| **Keyed Lists** | Omitting `key` attribute on large lists | Use `<for_each items="{data.items}" var="item" key="id">` for zero-allocation reconciliation. |

### Complete Reference Application Example
```xml
<uid_spec>
  <data_model>
    <state id="newTask"></state>
    <state id="tasks" type="array">[{"id":"t1","title":"Explore EUIX Engine","done":false}]</state>
    <state id="filter">all</state>
  </data_model>

  <flex direction="column" gap="16" class="p-6 max-w-xl mx-auto">
    <!-- Header -->
    <flex direction="row" justify="between" align="center">
      <h1>Task Manager</h1>
      <time value="now" format="time_medium" live="true" />
    </flex>

    <!-- Input Form -->
    <flex direction="row" gap="8">
      <input bind="newTask" placeholder="Add a new task..." flex="1" class="input" />
      <button class="btn btn-primary">
        <on_click action="RUN_SCRIPT">
          if ($data.newTask &amp;&amp; $data.newTask.trim()) {
            $data.tasks.push({
              id: "t_" + Date.now(),
              title: $data.newTask.trim(),
              done: false
            });
            $data.newTask = "";
          }
        </on_click>
        Add
      </button>
    </flex>

    <!-- Filter Buttons -->
    <flex direction="row" gap="8">
      <button class="btn btn-sm">
        <on_click action="SET_STATE"><path>data.filter</path><value>all</value></on_click>
        All
      </button>
      <button class="btn btn-sm">
        <on_click action="SET_STATE"><path>data.filter</path><value>active</value></on_click>
        Active
      </button>
      <button class="btn btn-sm">
        <on_click action="SET_STATE"><path>data.filter</path><value>done</value></on_click>
        Done
      </button>
    </flex>

    <!-- Filtered Reactive List -->
    <for_each items="{data.tasks}" var="task" key="id">
      <if condition="data.filter == 'all' || (data.filter == 'active' &amp;&amp; !task.done) || (data.filter == 'done' &amp;&amp; task.done)">
        <flex direction="row" justify="between" align="center" class="item-row">
          <flex direction="row" gap="8" align="center">
            <button class="btn btn-icon">
              <on_click action="MUTATE_STATE">
                <path>tasks</path>
                <operation>UPDATE</operation>
                <where field="id" equals="{task.id}" />
                <fields done="{!task.done}" />
              </on_click>
              {task.done ? "✅" : "⬜"}
            </button>
            <span style="text-decoration: {task.done ? 'line-through' : 'none'};">{task.title}</span>
          </flex>
          <button class="btn btn-danger">
            <on_click action="MUTATE_STATE">
              <path>tasks</path>
              <operation>REMOVE</operation>
              <where field="id" equals="{task.id}" />
            </on_click>
            🗑
          </button>
        </flex>
      </if>
    </for_each>
  </flex>
</uid_spec>
```

---

## ⚡ 24. Build-Time Pre-compilation & Zero-JSDOM Server-Side Rendering (SSR)

EUIX Engine provides dedicated subpath modules for zero-overhead build-time compilation and Node/Bun server-side rendering:

### 1. Zero-JSDOM SSR (`euixjs/server`)
Render declarative XML templates into static HTML strings on Node.js, Bun, Cloudflare Workers, or Deno with **zero DOM / JSDOM dependencies**:

```js
import { renderToString, compileXmlToHtml } from 'euixjs/server';

const xmlString = `
<uid_spec>
  <data_model>
    <state id="pageTitle">Storefront</state>
    <state id="items" type="array">[{"id": 1, "name": "Coffee", "price": 4.5}]</state>
  </data_model>
  <flex direction="column" gap="12">
    <h1>{data.pageTitle}</h1>
    <for_each items="{data.items}" var="it">
      <card><span>{it.name} - \${it.price}</span></card>
    </for_each>
  </flex>
</uid_spec>
`;

// Server-rendered HTML string
const html = renderToString(xmlString, {
  pageTitle: 'Custom Server Title' // Optional initialData override
});
```

### 2. Vite / Rollup Template Pre-compilation Plugin (`euixjs/compiler`)
Pre-compile `.xml` and `.euix` templates into lightweight JavaScript AST modules at build time:

```js
// vite.config.js
import { defineConfig } from 'vite';
import { euixVitePlugin } from 'euixjs/compiler';

export default defineConfig({
  plugins: [euixVitePlugin()]
});
```

```js
// In your application code
import AppTemplate, { ast } from './App.xml';
import { EUIXEngineCore } from 'euixjs/core';

// Mount directly without runtime DOMParser overhead
const engine = EUIXEngineCore.mount(AppTemplate, document.getElementById('app'));
```

---

## 📋 25. Declarative Form Validation Schema & Reactive Errors (`euixjs/validation`)

EUIX Engine includes built-in declarative schema validation and reactive error state management:

### 1. Declarative `<validation_rules>` Specification
```xml
<uid_spec>
  <data_model>
    <state id="email"></state>
    <state id="password"></state>
    <state id="confirm_password"></state>
    <state id="age" type="number">18</state>
  </data_model>

  <!-- Declarative Validation Rules -->
  <validation_rules>
    <field id="email" required="true" email="true" message="Valid email is required" />
    <field id="password" required="true" min_length="8" message="Password must be at least 8 chars" />
    <field id="confirm_password" match="password" message="Passwords do not match" />
    <field id="age" min="18" max="100" min_msg="Must be at least 18" max_msg="Must be under 100" />
  </validation_rules>

  <flex direction="column" gap="12" class="p-6 bg-white rounded-xl shadow-lg">
    <!-- Email Input & Reactive Error Display -->
    <flex direction="column" gap="4">
      <input bind="email" placeholder="Enter email" class="input {errors.email ? 'border-red-500' : ''}" />
      <span class="text-red-500 text-sm" if="{errors.email}">{errors.email}</span>
    </flex>

    <!-- Password Input -->
    <flex direction="column" gap="4">
      <input type="password" bind="password" placeholder="Enter password" class="input" />
      <span class="text-red-500 text-sm">{errors.password}</span>
    </flex>

    <!-- Confirm Password Input -->
    <flex direction="column" gap="4">
      <input type="password" bind="confirm_password" placeholder="Confirm password" class="input" />
      <span class="text-red-500 text-sm">{errors.confirm_password}</span>
    </flex>

    <!-- Submit Button with Declarative VALIDATE_FORM Action -->
    <button class="btn btn-primary">
      <on_click action="VALIDATE_FORM" on_success="SubmitFormWorkflow" />
      Create Account
    </button>
  </flex>
</uid_spec>
```

### 2. Supported Validation Rule Attributes on `<field>`
- **`required="true"`**: Field cannot be empty or whitespace.
- **`email="true"`**: Validates standard email address RFC regex format.
- **`url="true"`**: Validates `http://` / `https://` web URL format.
- **`min_length="8"` / `max_length="64"`**: Enforces string character length bounds.
- **`min="18"` / `max="100"`**: Enforces numeric value ranges.
- **`pattern="^[A-Z]{3}-\d{3}$"`**: Enforces custom regular expression pattern.
- **`match="password"`**: Enforces value equality with another state key (e.g. password confirmation).
- **`message="..."`**: Fallback custom error message for the field.

### 3. Programmatic API & Dynamic Validation
```js
import { EUIXEngineCore } from 'euixjs/core';
import { EUIXValidationPlugin } from 'euixjs/validation';

EUIXEngineCore.use(EUIXValidationPlugin);

// Validate entire form
const { isValid, errors } = engine.validateForm();

// Validate single field
const errorMsg = engine.validateField('email'); // returns null if valid

// Register custom validator function
engine.registerValidationRule('username', {
  custom: (val, state, engine) => {
    if (val === 'admin') return 'Username "admin" is reserved';
    return null;
  }
});

// Clear all validation errors
engine.resetValidation();
```

---

## ⚡ 26. Declarative WebSocket & SSE Live Streaming (`euixjs/stream`)

EUIX Engine provides full declarative and programmatic support for real-time WebSocket connections and Server-Sent Events (SSE) data streams:

### 1. Declarative `<api_stream>` / `<websocket>` / `<sse>` Specification
```xml
<uid_spec>
  <data_model>
    <state id="ticker" type="object">{"price": 0, "volume": 0}</state>
    <state id="feed" type="array">[]</state>
  </data_model>

  <api_config base_url="wss://stream.example.com">
    <!-- 1. Real-Time WebSocket Live Price Stream -->
    <api_stream 
      id="crypto_ticker" 
      type="websocket" 
      url="/prices/btc" 
      target="ticker" 
      auto_connect="true" 
      reconnect="true" 
      reconnect_interval="3000"
      reconnect_attempts="10" 
    />

    <!-- 2. Server-Sent Events (SSE) Notification Stream (Appends to Array) -->
    <api_stream 
      id="notifications" 
      type="sse" 
      url="https://api.example.com/live/notifications" 
      target="feed" 
      operation="PUSH" 
      auto_connect="true" 
    />
  </api_config>

  <flex direction="column" gap="16" class="p-6 bg-white rounded-xl shadow-lg">
    <!-- WebSocket Reactive Connection Status & Live Data -->
    <flex direction="row" justify="between" align="center">
      <h2>BTC/USDT Live: <strong>\${data.ticker.price}</strong></h2>
      <span class="badge {stream.crypto_ticker.connected ? 'bg-green-500' : 'bg-red-500'}">
        {stream.crypto_ticker.status}
      </span>
    </flex>

    <!-- Interactive Controls & Message Dispatch -->
    <flex direction="row" gap="8">
      <button class="btn">
        <on_click action="STREAM_SEND" stream="crypto_ticker">
          {"action": "subscribe", "symbol": "BTC"}
        </on_click>
        Subscribe BTC
      </button>

      <button class="btn">
        <on_click action="STREAM_DISCONNECT" stream="crypto_ticker" />
        Disconnect
      </button>

      <button class="btn btn-primary">
        <on_click action="STREAM_CONNECT" stream="crypto_ticker" />
        Reconnect
      </button>
    </flex>

    <!-- SSE Live Notifications Feed (<for_each>) -->
    <flex direction="column" gap="8">
      <for_each items="{data.feed}" var="item">
        <card class="p-3 bg-gray-50 border rounded">
          <span>{item.text}</span>
        </card>
      </for_each>
    </flex>
  </flex>
</uid_spec>
```

### 2. Supported Attributes on `<api_stream>`
- **`id="..."` / `name="..."`**: Unique stream identifier.
- **`type="websocket|sse"`**: Streaming protocol type (`websocket` or `sse`).
- **`url="..."` / `src="..."`**: Stream URL (supports `wss://`, `ws://`, `https://`, `http://`).
- **`target="..."` / `bind_target="..."`**: State key to auto-write incoming JSON data into.
- **`operation="REPLACE|PUSH|UNSHIFT"`**: Data mutation strategy for target arrays (default: `REPLACE`).
- **`event_name="..."`**: Custom SSE event name listener for `EventSource` (e.g. `event_name="ticker"`).
- **`auto_connect="true|false"`**: Whether to initiate connection on mount (default: `true`).
- **`reconnect="true|false"`**: Auto-reconnect on unexpected closure (default: `true`).
- **`reconnect_interval="3000"`**: Time in milliseconds between reconnection attempts.
- **`reconnect_attempts="10"`**: Maximum reconnection attempts before stopping.
- **`on_message="..."` / `on_open="..."` / `on_close="..."` / `on_error="..."`**: Composed action names to trigger on stream events.

### 3. Reactive Stream State (`{stream.<id>.<prop>}` / `{$stream.<id>.<prop>}`)
- **`{stream.<id>.status}`**: Current status string (`"connected" | "connecting" | "disconnected" | "error"`).
- **`{stream.<id>.connected}`**: Boolean indicating if the stream is currently open.
- **`{stream.<id>.lastMessage}`**: Raw or parsed JSON object of the last received message.
- **`{stream.<id>.error}`**: Error description string if connection failed.

### 4. Programmatic API
```js
import { EUIXEngineCore } from 'euixjs/core';
import { EUIXStreamPlugin } from 'euixjs/stream';

EUIXEngineCore.use(EUIXStreamPlugin);

// Connect / Disconnect
engine.connectStream('crypto_ticker');
engine.disconnectStream('crypto_ticker');

// Send message over WebSocket
engine.sendStreamMessage('crypto_ticker', { action: 'ping' });

// Get current reactive status
const status = engine.getStreamStatus('crypto_ticker');
console.log(status.status, status.connected, status.lastMessage);
```

---

## ⏱️ 27. DevTools Time-Travel Debugging, State Snapshots & Undo/Redo

EUIX Engine includes built-in Time-Travel Debugging and an interactive State Timeline subsystem within `@euix/devtools` (`EUIXDevTools` / `EUIXStateHistoryManager`):

### 1. Features
- **Immutable State Snapshots**: Automatically captures deep-cloned snapshots of state transitions on `setState`, `mutateState`, and composed actions.
- **Deep Diff Engine (`computeStateDiff`)**: Calculates property-level state diffs (`added`, `removed`, `changed`) between consecutive checkpoints.
- **Arbitrary Scrubbing & Time-Travel**: Jump to any past snapshot in history; automatically updates DOM bindings and re-synchronizes the UI.
- **Undo / Redo Support**: Declarative and programmatic undo/redo operations with boundary guards.
- **Timeline Tab in DevTools Drawer**: Scrub bar, milestone snapshot cards with colored Diffs (green `+`, red `-`, yellow `~`), Restore buttons, and state JSON export/import.

### 2. Declarative History Actions
```xml
<uid_spec>
  <data_model>
    <state id="step" type="number">1</state>
    <state id="formData" type="object">{}</state>
  </data_model>

  <flex direction="column" gap="12">
    <h1>Wizard Step: {data.step}</h1>

    <!-- Declarative History Buttons -->
    <flex direction="row" gap="8">
      <button class="btn">
        <on_click action="UNDO_STATE" />
        ⏮ Undo
      </button>

      <button class="btn">
        <on_click action="REDO_STATE" />
        ⏭ Redo
      </button>

      <button class="btn btn-primary">
        <on_click action="TAKE_SNAPSHOT" label="Step Completed" />
        📸 Save Milestone
      </button>
    </flex>
  </flex>
</uid_spec>
```

### 3. Programmatic API & DevTools Console
```js
import { EUIXEngineCore } from 'euixjs/core';
import { EUIXDevTools, EUIXStateHistoryManager, computeStateDiff } from 'euixjs/devtools';

// Mount Engine & Initialize DevTools Inspector
const engine = EUIXEngineCore.mount(xml, container);
const devtools = EUIXDevTools.init(engine);

// Programmatic Time-Travel & Undo/Redo
engine.undo();              // Reverts to previous snapshot
engine.redo();              // Advances to next snapshot
engine.canUndo();           // Boolean: true if history has previous states
engine.canRedo();           // Boolean: true if history has future states
engine.takeSnapshot('Form 1'); // Creates a named milestone snapshot
engine.timeTravelTo(2);     // Jumps directly to snapshot index 2

// Export / Import History for bug reproduction
const historyJson = engine.exportStateHistory();
engine.importStateHistory(historyJson);

// Browser DevTools Console Shortcuts ($euix)
window.$euix.undo();
window.$euix.redo();
window.$euix.timeTravel(0); // Jump to initial state
console.log(window.$euix.snapshots());
```

---

## ♿ 28. Accessibility (A11y), Focus Traps & ARIA Keyboard Navigation (`euixjs/a11y`)

EUIX Engine includes built-in WAI-ARIA compliance, automated modal focus trapping, accordion keyboard navigation, and screen reader live region announcers.

### 1. Accessible Modal Dialogs (`<dialog>`)
- **Automated Focus Trap**: Automatically traps `Tab` / `Shift+Tab` focus cycling within the open dialog modal.
- **Escape Key Handling**: Pressing `Escape` automatically dismisses the dialog and returns focus to the trigger button.
- **Body Scroll Lock**: Automatically locks background body scroll (`overflow: hidden`) when modal is open.
- **ARIA Semantics**: Auto-generates `id`, `aria-labelledby`, `aria-describedby`, `aria-modal="true"`, and `role="dialog|alertdialog"`.
- **Initial & Return Focus**: Supports `initial_focus="#selector"` and restores focus upon modal closure.

```xml
<uid_spec>
  <data_model>
    <state id="showModal" type="boolean">false</state>
  </data_model>

  <flex direction="column">
    <button>
      <on_click action="SET_STATE">
        <path>data.showModal</path>
        <value>true</value>
      </on_click>
      Open Profile
    </button>

    <dialog bind="showModal" title="Edit Profile" role="dialog" lock_scroll="true">
      <description>Update your public account information.</description>
      <input id="name_input" placeholder="Your name" />
      <actions>
        <button class="btn-primary">Save Changes</button>
      </actions>
    </dialog>
  </flex>
</uid_spec>
```

### 2. Accessible Collapsible & Accordions (`<collapse>`)
- **WAI-ARIA Accordion Semantics**: Auto-links `aria-controls` with `aria-labelledby` and `role="region"`, setting `aria-expanded="true|false"`.
- **Keyboard Arrow Navigation**: Supports `ArrowDown`, `ArrowUp`, `Home`, and `End` between accordion headers in the same container or `group="..."`.

```xml
<uid_spec>
  <div class="accordion-group">
    <collapse bind="data.tab1" title="Account Settings" group="settings">
      <p>Account configuration options</p>
    </collapse>
    <collapse bind="data.tab2" title="Privacy Settings" group="settings">
      <p>Privacy configuration options</p>
    </collapse>
  </div>
</uid_spec>
```

### 3. Screen Reader Live Announcements & `<live_region>`
- **`<live_region>`**: Renders dynamic ARIA live regions (`aria-live="polite|assertive"`).
- **`ANNOUNCE` Action**: Declarative `<on_click action="ANNOUNCE" message="..." priority="polite|assertive" />`.
- **Programmatic Announcer**: `engine.announce(message, priority)`.

```xml
<uid_spec>
  <data_model>
    <state id="syncStatus">Ready</state>
  </data_model>

  <flex direction="column">
    <!-- Live screen reader update container -->
    <live_region bind="syncStatus" priority="polite" />

    <button>
      <on_click action="ANNOUNCE" message="Changes saved successfully!" priority="assertive" />
      Save Record
    </button>
  </flex>
</uid_spec>
```

### 4. Modular A11y Utility Imports
```js
import { createFocusTrap, getFocusableElements, announce, setupRovingTabIndex, EUIXA11yPlugin } from 'euixjs/a11y';
import { EUIXEngineCore } from 'euixjs/core';

EUIXEngineCore.use(EUIXA11yPlugin);

// Standalone Focus Trap
const trap = createFocusTrap(modalElement, {
  initialFocus: '#first-input',
  onEscape: () => modalElement.remove()
});
trap.activate();
// ...
trap.deactivate();

// Screen Reader Announcement
announce('File uploaded successfully', 'polite');
```

---

## 📐 29. XSD/JSON Schema, TypeScript Type Generator & EUIX CLI (`euix`)

EUIX Engine includes built-in tooling for IDE auto-completion, XML linting, and compile-time TypeScript type safety.

### 1. EUIX CLI Commands (`npx euix`)
```bash
# 1. Generate official XML Schema Definition (XSD) for VS Code / IntelliJ autocompletion
npx euix schema:xsd -o ./schema/uid_spec.xsd

# 2. Generate JSON Schema validator
npx euix schema:json -o ./schema/uid_spec.schema.json

# 3. Generate strict TypeScript type declarations (.d.ts) from an XML template
npx euix typegen ./src/components/UserProfile.xml -o ./src/types/UserProfile.d.ts

# 4. Pre-compile XML template to JavaScript module
npx euix compile ./src/App.xml -o ./src/App.compiled.js
```

### 2. IDE XML Autocompletion Setup (VS Code / JetBrains)
Link `uid_spec.xsd` to your XML templates for instant IntelliSense, attribute completion, and type validation:

```xml
<uid_spec xmlns="http://euix.org/schema/uid_spec"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://euix.org/schema/uid_spec ./schema/uid_spec.xsd">
  
  <data_model>
    <state id="counter" type="number">0</state>
    <state id="userName" type="string">Guest</state>
  </data_model>

  <flex direction="column" gap="16">
    <h1>Hello, {data.userName}!</h1>
  </flex>
</uid_spec>
```

### 3. Programmatic TypeScript Generator API (`euixjs/compiler`)
```js
import { generateComponentTypes, generateXSDSchema, generateJsonSchema } from 'euixjs/compiler';

const xmlString = `
<component_def name="CounterCard">
  <data_model>
    <state id="count" type="number">0</state>
  </data_model>
  <actions>
    <action_def name="Increment">
      <param name="step" type="number" default="1" />
      <step action="SET_STATE">
        <path>data.count</path>
        <value>{data.count + args.step}</value>
      </step>
    </action_def>
  </actions>
</component_def>
`;

// Generates TypeScript interface declarations (.d.ts)
const tsCode = generateComponentTypes(xmlString, { componentName: 'CounterCard' });
console.log(tsCode);
```






