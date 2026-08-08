# AGENTS.md

This guide explains the **Core Architecture** of **EUIX Engine** (`euixjs`) and how to build declarative reactive UIs, manage state, handle API data fetching, load modular plugins, and mount components.

---

## 🧠 1. Core Architecture & Concepts

EUIX Engine is built on a **Modular Plugin Architecture**:

```
                                  +---------------------------------------+
                                  |         EUIXEngine (Full Bundle)      |
                                  +---------------------------------------+
                                                      |
         +--------------------+-----------------------+-----------------------+--------------------+
         |                    |                       |                       |                    |
         v                    v                       v                       v                    v
  +--------------+    +---------------+       +---------------+       +---------------+    +---------------+
  |EUIXEngineCore|    | EUIXApiPlugin |       |EUIXComposerPlg|       | EUIXStoragePlg|    | EUIXDialogPlg |
  | (Lite Core)  |    | (SWR Client)  |       | (Workflows)   |       | (Persistence) |    |   (Modals)    |
  +--------------+    +---------------+       +---------------+       +---------------+    +---------------+
         |
         +--------------------------------------------+
         |                                            |
         v                                            v
  +--------------+                            +---------------+
  | EUIXDragDrop |                            |EUIXCollapsePlg|
  |  (Pointer)   |                            |  (Accordions) |
  +--------------+                            +---------------+
```

1. **XML UI Specification Parser (`<uid_spec>`)**: Parses XML templates into an in-memory specification tree with zero Virtual DOM overhead, converting XML elements directly into optimized DOM nodes.
2. **Reactive Data Model (`<data_model>`)**: Centralized reactive state store supporting primitives (`string`, `number`, `boolean`) and complex types (`array`, `object`). State declarations MUST use `id="..."`.
3. **Declarative Event Action Dispatcher**: Evaluates actions (`SET_STATE`, `MUTATE_STATE`, `REVALIDATE_API`, `RUN_SCRIPT`) declaratively via child action tags (`<on_click action="...">`) without imperative DOM event listeners.
4. **Modular Plugin System (`.use(plugin)`)**: Extend Lite Core (`EUIXEngineCore`) dynamically with tree-shakeable plugins (`euixjs/api`, `euixjs/composer`, `euixjs/dnd`, `euixjs/storage`, `euixjs/collapse`, `euixjs/dialog`).
5. **Component Registry & Async Loader**: Loads modular XML components dynamically via `fetch()`, executing scoped state models and prop passing.

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
  <!-- 1. State Data Model (Always use id="..." for state declarations) -->
  <data_model>
    <state id="counter">0</state>
    <state id="user_name">Guest</state>
    <state id="items" type="array"></state>
  </data_model>

  <!-- 2. Declarative Layout & Bindings -->
  <flex direction="column" gap="16" class="p-6 bg-white rounded-2xl shadow-xl">
    <h1>Hello, {data.user_name}!</h1>
    <p>Counter value: <strong>{data.counter}</strong></p>

    <!-- State Mutation Actions -->
    <flex direction="row" gap="8">
      <button class="btn">
        <on_click action="SET_STATE">
          <path>data.counter</path>
          <value>{data.counter} + 1</value>
        </on_click>
        +1
      </button>
      <button class="btn">
        <on_click action="SET_STATE">
          <path>data.counter</path>
          <value>{data.counter} - 1</value>
        </on_click>
        -1
      </button>
    </flex>

    <!-- Form Inputs with Two-Way Binding -->
    <input bind="user_name" placeholder="Enter your name" class="input" />

    <!-- Array Rendering & State Mutations -->
    <flex direction="column" gap="8">
      <for_each items="{data.items}" var="item">
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
EUIX Engine supports core state data types inside `<data_model>` using `id="..."`:

| Data Type (`type`) | Example Specification | Parsing Behavior & Supported Actions |
| :--- | :--- | :--- |
| **`string`** | `<state id="user_name">Guest</state>` | Default type. String interpolation `{data.user_name}`, text bindings `<input bind="user_name">`. |
| **`number`** | `<state id="counter">0</state>` | Parsed into JS numeric value. Evaluates math expressions (`{data.counter + 1}`). |
| **`boolean`** | `<state id="is_active">true</state>` | Parsed into JS boolean (`true`/`false`). Toggleable via `<on_click action="TOGGLE_STATE">`. |
| **`array`** | `<state id="items" type="array"></state>` | Parsed into JS Array. Loopable via `<for_each items="{data.items}">`, supports `MUTATE_STATE` (`PUSH`, `REMOVE`, `SWAP`, `CLEAR`). |
| **`object`** | `<state id="user" type="object">{"name": "Ahmet"}</state>` | Parsed into JS Object. Property access via dot notation (`{data.user.name}`). |

---

## 📡 4. REST API & SWR Data Fetching

Use `<api_config>` to manage HTTP endpoints with reactive binding:

```xml
<uid_spec>
  <api_config base_url="https://api.example.com" />

  <!-- Declarative Data Fetching -->
  <api_endpoint 
    id="get_posts" 
    url="/posts" 
    method="GET" 
    bind_target="posts_list" 
    auto_fetch="true" 
    revalidate_focus="true" 
  />

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

### Script Execution Context (`action="RUN_SCRIPT"`)
Inside `<on_mount>`, `<on_state_change>`, or `<on_click action="RUN_SCRIPT">`, the following sandbox context variables are injected automatically:
- `$el`: Current DOM element reference
- `$data`: Reactive state data object (read/write access)
- `$engine`: `EUIXEngine` instance
- `$evt`: Native browser DOM Event object

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

### 1. Prop Passing (Parent -> Child)
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

### 2. Children / Slot Content Projection (`<children />` or `<slot />`)
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
