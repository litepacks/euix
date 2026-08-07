# AGENTS.md

This guide explains the **Core Architecture** of **EUIX Engine** (`euixjs`) and how to build declarative reactive UIs, manage state, handle API data fetching, and mount components.

---

## 🧠 1. Core Architecture & Concepts

EUIX Engine is built on 5 fundamental architectural pillars:

```
                  +-----------------------------------+
                  |  <uid_spec> XML Specification     |
                  +-----------------------------------+
                                    |
            +-----------------------+-----------------------+
            |                       |                       |
            v                       v                       v
    +---------------+       +---------------+       +---------------+
    | Data Model    |       | Declarative   |       | SWR API       |
    | Store (State) |       | Event Actions |       | Client Engine |
    +---------------+       +---------------+       +---------------+
            |                       |                       |
            +-----------------------+-----------------------+
                                    |
                                    v
                  +-----------------------------------+
                  | Fine-Grained Reactive DOM Sync    |
                  +-----------------------------------+
```

1. **XML UI Specification Parser (`<uid_spec>`)**: Parses XML templates into an in-memory specification tree with zero Virtual DOM overhead, converting XML elements directly into optimized DOM nodes.
2. **Reactive Data Model (`<data_model>`)**: Centralized reactive state store supporting primitives (`string`, `number`, `boolean`) and complex types (`array`, `object`). Text nodes and attributes bound via `{expression}` or `bind="..."` update reactively when targeted keys change.
3. **Declarative Event Action Dispatcher**: Evaluates actions (`SET_STATE`, `MUTATE_STATE`, `REVALIDATE_API`, `RUN_SCRIPT`) declaratively without imperative DOM event listeners.
4. **SWR Data Fetching Engine (`<api_config>` & `<api_endpoint>`)**: Built-in Stale-While-Revalidate HTTP engine handling async REST calls, automatic focus/online revalidation, and component-scoped request interceptors.
5. **Component Registry & Async Loader**: Loads modular XML components dynamically via `fetch()`, executing scoped state models and prop passing.

---

## 🚀 2. Import & Mounting

### ESM (Bundlers / Node)
```js
import { EUIXEngine } from 'euixjs';
import { EUIXDevTools } from 'euixjs/devtools';

// Mount XML specification to a DOM container
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

## 📜 2. XML UI Specification Syntax

Every UI is defined using a declarative `<uid_spec>` XML template:

```xml
<uid_spec>
  <!-- 1. State Data Model -->
  <data_model>
    <state key="counter" value="0" type="number" />
    <state key="user_name" value="Guest" type="string" />
    <state key="items" value='["Apple", "Banana"]' type="array" />
  </data_model>

  <!-- 2. Declarative Layout & Bindings -->
  <container class="card">
    <h1>Hello, {user_name}!</h1>
    <p>Counter value: <strong>{counter}</strong></p>

    <!-- State Mutation Actions -->
    <button on_click="SET_STATE" target="counter" value="{counter + 1}">+1</button>
    <button on_click="SET_STATE" target="counter" value="{counter - 1}">-1</button>

    <!-- Form Inputs with Two-Way Binding -->
    <input bind="user_name" placeholder="Enter your name" />

    <!-- Array Rendering & State Mutations -->
    <list>
      <for_each items="items" var="item" index="i">
        <item_row>
          <span>{i + 1}. {item}</span>
          <button on_click="MUTATE_STATE" action="REMOVE" target="items" index="{i}">Delete</button>
        </item_row>
      </for_each>
    </list>
  </container>
</uid_spec>
```

### Supported State Data Types (`type="..."`)
EUIX Engine supports 5 core state data types inside `<data_model>`:

| Data Type (`type`) | Example Specification | Parsing Behavior & Supported Actions |
| :--- | :--- | :--- |
| **`string`** | `<state key="user_name" value="Guest" type="string" />` | Default type. String interpolation `{user_name}`, text bindings `<input bind="user_name">`. |
| **`number`** | `<state key="counter" value="0" type="number" />` | Parsed into JS numeric value. Evaluates math expressions (`{counter + 1}`). |
| **`boolean`** | `<state key="is_active" value="true" type="boolean" />` | Parsed into JS boolean (`true`/`false`). Toggleable via `action="TOGGLE_STATE"`. |
| **`array`** | `<state key="items" value='["Apple", "Banana"]' type="array" />` | Parsed into JS Array. Loopable via `<for_each>`, supports `MUTATE_STATE` (`PUSH`, `REMOVE`, `SWAP`, `CLEAR`). |
| **`object`** | `<state key="user" value='{"name": "Ahmet", "role": "Admin"}' type="object" />` | Parsed into JS Object. Property access via dot notation (`{user.name}`, `{user.role}`). |

---

## 📡 3. REST API & SWR Data Fetching

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
    <button on_click="REVALIDATE_API" tag="get_posts">Refresh Posts</button>

    <for_each items="posts_list" var="post">
      <card>
        <h3>{post.title}</h3>
        <p>{post.body}</p>
      </card>
    </for_each>
  </container>
</uid_spec>
```

---

## 🧩 4. Components & Dynamic Loading

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

## 🛠️ 5. State API (Programmatic Control)

```js
// Read state
const currentCount = engine.getState('counter');

// Update state reactively
engine.setState('counter', 42);

// Mutate array state
engine.mutateState('items', 'PUSH', 'Orange');

// Programmatically revalidate SWR API endpoints
engine.revalidateApi('get_posts');
```

---

## 🪝 6. Lifecycle Hooks & Event Interceptors

### XML Lifecycle Hooks
EUIX Engine provides declarative lifecycle hooks embedded directly inside XML specifications:

```xml
<uid_spec>
  <!-- Mount Hook: Runs when component/view is mounted -->
  <on_mount action="SET_STATE" target="is_loaded" value="true" />
  
  <!-- Inline Script Mount Hook -->
  <on_mount action="RUN_SCRIPT">
    console.log("Component mounted!", $data.user_name);
  </on_mount>

  <!-- State Change Hook: Triggers whenever 'counter' state changes -->
  <on_state_change key="counter" action="RUN_SCRIPT">
    console.log("Counter updated to:", $data.counter);
  </on_state_change>

  <!-- Timer Hook: Runs every 1000ms -->
  <on_interval ms="1000" action="SET_STATE" target="seconds" value="{seconds + 1}" />

  <!-- Unmount Hook: Runs when DOM element/component is removed -->
  <on_unmount action="RUN_SCRIPT">
    console.log("Cleanup on unmount");
  </on_unmount>
</uid_spec>
```

### Script Execution Context (`action="RUN_SCRIPT"`)
Inside `<on_mount>`, `<on_state_change>`, or `<button on_click="RUN_SCRIPT">`, the following sandbox context variables are injected automatically:
- `$el`: Current DOM element reference
- `$data`: Reactive state data object (read/write access)
- `$engine`: `EUIXEngine` instance
- `$evt`: Native browser DOM Event object

### Programmatic API Interceptors & Error Hooks
```js
// Request Interceptor (Add Auth Headers dynamically)
engine.api.onRequest((config) => {
  config.headers['Authorization'] = 'Bearer ' + localStorage.getItem('token');
  return config;
});

// Response Interceptor (Global status handling)
engine.api.onResponse((response) => {
  if (response.status === 401) {
    engine.setState('user_name', 'Guest');
  }
  return response;
});

// Global Error Hook
engine.onError((err) => {
  console.error('[EUIX Engine Error]:', err.message);
});
```

---

## 🏷️ 7. Declarative XML Attributes & Directives Reference

### 1. Two-Way Data Binding (`bind="..."`)
Binds input controls reactively to a state variable key:
```xml
<!-- Text & Textarea -->
<input bind="user_name" placeholder="Enter name" />
<textarea bind="bio"></textarea>

<!-- Checkbox (Boolean) -->
<input type="checkbox" bind="is_terms_accepted" />

<!-- Select Options -->
<select bind="selected_role">
  <option value="admin">Admin</option>
  <option value="user">User</option>
</select>

<!-- Radio Buttons -->
<input type="radio" bind="gender" value="male" /> Male
<input type="radio" bind="gender" value="female" /> Female
```

### 2. Expression Interpolation (`{expression}`)
Attributes accept dynamic expressions and ternary logic:
```xml
<!-- Class & Style -->
<div class="card {is_active ? 'border-blue-500' : 'border-gray-200'}"></div>
<span style="color: {badge_color}; opacity: {is_loading ? '0.5' : '1'};">Status</span>

<!-- Dynamic Standard Attributes -->
<button disabled="{is_submitting || !user_name}">Submit</button>
<img src="{avatar_url}" alt="{user_name}'s Profile" />
<a href="/user/{user_id}">View Profile</a>
```

### 3. Conditional Directives (`if="..."` & `show="..."`)
```xml
<!-- 'if': Element is created/destroyed in DOM based on condition -->
<container if="{user_role === 'admin'}">
  <admin_panel>Admin Controls</admin_panel>
</container>

<!-- 'show': Toggles CSS display (none vs original) -->
<spinner show="{is_loading}">Loading...</spinner>
```

### 4. Event Action Attributes (`on_<event>="..."`)
Supported events: `on_click`, `on_input`, `on_change`, `on_submit`, `on_mouseenter`, `on_mouseleave`, `on_dragstart`, `on_drop`.

```xml
<!-- SET_STATE: Sets target key to calculated value -->
<button on_click="SET_STATE" target="counter" value="{counter + 1}">+1</button>

<!-- TOGGLE_STATE: Inverts boolean state key -->
<button on_click="TOGGLE_STATE" target="is_modal_open">Toggle Modal</button>

<!-- MUTATE_STATE: Array operations (PUSH, REMOVE, UPDATE, SWAP, MOVE_UP, MOVE_DOWN, CLEAR) -->
<button on_click="MUTATE_STATE" action="PUSH" target="items" value="New Item">Add</button>
<button on_click="MUTATE_STATE" action="REMOVE" target="items" index="{i}">Delete</button>

<!-- REVALIDATE_API: Refetches SWR endpoint by tag or id -->
<button on_click="REVALIDATE_API" tag="get_users">Refresh List</button>

<!-- RUN_SCRIPT: Inlines custom JS sandbox logic -->
<button on_click="RUN_SCRIPT">
  alert("Current counter is: " + $data.counter);
</button>
```

### 5. Component Props & Configuration Attributes
```xml
<!-- External JSON State Hydration -->
<data_model src="./initial_state.json" />
<constants src="./design_tokens.json" />

<!-- Component Props Passing -->
<component name="user-card" src="./UserCard.xml" user_id="{id}" role="Admin" />
```

---

## 🎨 8. Styling & CSS Class Best Practices

### 1. Static CSS Classes & Utility Frameworks
EUIX Engine supports standard CSS utility classes (Tailwind CSS, Bootstrap, or custom CSS):
```xml
<container class="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
  <h2 class="text-xl font-bold text-slate-800 mb-2">Card Title</h2>
</container>
```

### 2. Dynamic & Reactive CSS Classes
Combine static classes with reactive expression interpolations `{expression}`:
```xml
<!-- Toggle class based on boolean state -->
<button class="px-4 py-2 rounded-lg transition-colors {is_active ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}">
  Toggle State
</button>

<!-- Tab switching dynamic border and font weight -->
<button class="py-2 px-4 {active_tab === 'docs' ? 'border-b-2 border-blue-500 font-bold text-blue-600' : 'text-gray-500'}">
  Documentation
</button>
```

### 3. Dynamic Inline Styles
Attributes support dynamic HSL colors, pixel bounds, and conditional display properties:
```xml
<!-- Reactive style properties -->
<div style="background-color: {theme_color}; opacity: {is_loading ? '0.5' : '1'};"></div>

<!-- Computed position or width -->
<div style="width: {progress_percent}%; transition: width 0.3s ease;"></div>
```

### 4. Design Tokens via `<constants>`
Define reusable class constants or design tokens at template root:
```xml
<uid_spec>
  <constants>
    <const key="BTN_PRIMARY" value="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg shadow-sm" />
    <const key="CARD_BOX" value="bg-white p-5 rounded-2xl border border-slate-100 shadow-md" />
  </constants>

  <container class="{const.CARD_BOX}">
    <button class="{const.BTN_PRIMARY}">Click Me</button>
  </container>
</uid_spec>
```

### 5. External Stylesheet Injection (`<use_style>`)
Declaratively load external CSS stylesheets directly within XML templates:
```xml
<uid_spec>
  <use_style href="https://cdnjs.cloudflare.com/ajax/libs/animate.css/4.1.1/animate.min.css" />
  <use_style href="./css/custom_theme.css" />

  <container class="animate__animated animate__fadeIn">
    <p>Animated Container</p>
  </container>
</uid_spec>
```

---

## 🛡️ 9. Security Best Practices & XSS Guards

### 1. API URL Scheme Guarding
EUIX Engine automatically blocks dangerous URI schemes (such as `javascript:`, `vbscript:`, and `data:`) in XHR endpoints and dynamic links to prevent XSS (Cross-Site Scripting) attacks:
```xml
<!-- Safe REST Endpoint -->
<api_endpoint id="get_data" url="/api/v1/data" method="GET" />

<!-- Dangerous schemes like url="javascript:alert(1)" are blocked automatically with error events -->
```

### 2. Secure Token Injection via Request Interceptors
Never hardcode sensitive Auth tokens or credentials inside XML specifications. Use programmatic request interceptors:
```js
// Inject Bearer tokens dynamically from secure storage
engine.api.onRequest((config) => {
  const token = sessionStorage.getItem('auth_token');
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});
```

### 3. Sandboxed Script Execution (`action="RUN_SCRIPT"`)
Inline scripts inside `<on_mount>` or `action="RUN_SCRIPT"` execute inside a isolated `new Function()` closure rather than global `eval()`. Only `$el`, `$data`, `$engine`, and `$evt` context variables are injected.

### 4. Infinite Loop & Crash Protection
- **Reactivity Cascade Limit**: Maximum 50 nested state updates allowed before an infinite reactivity error is raised.
- **Component Recursion Limit**: Maximum 20 nested component recursion depth allowed to prevent call stack overflows.

### 5. Input & Text Node Sanitization
State interpolation `{user_input}` automatically converts values to safe text node content. Avoid injecting unescaped raw HTML strings directly into attributes or DOM nodes.

---

## 👪 10. Parent-Child Component Architecture & Slot Projection

### 1. Prop Passing (Parent -> Child)
Parent components pass data to children via XML attributes:

```xml
<!-- Parent Specification -->
<uid_spec>
  <data_model>
    <state key="active_user" value="Ahmet" type="string" />
  </data_model>

  <!-- Pass 'active_user' state as 'user_name' prop to child -->
  <component name="user-badge" src="./components/UserBadge.xml" user_name="{active_user}" role="Admin" />
</uid_spec>
```

```xml
<!-- Child Component Specification (UserBadge.xml) -->
<component_def name="user-badge">
  <data_model>
    <!-- Default fallback props -->
    <state key="user_name" value="Guest" type="string" />
    <state key="role" value="User" type="string" />
  </data_model>

  <div class="badge">
    <span>{user_name}</span>
    <small>({role})</small>
  </div>
</component_def>
```

### 2. Children / Slot Content Projection (`<children />` or `<slot />`)
Parents can pass arbitrary XML children nodes inside component tags:

```xml
<!-- Parent passing nested content -->
<component name="card-modal" src="./Modal.xml" title="Confirm Action">
  <p>Are you sure you want to delete this record?</p>
  <button on_click="SET_STATE" target="is_confirmed" value="true">Confirm</button>
</component>
```

```xml
<!-- Child Component Projection (Modal.xml) -->
<component_def name="card-modal">
  <div class="modal-box">
    <h2>{title}</h2>

    <!-- Projected Parent Content rendered here -->
    <children />
  </div>
</component_def>
```

### 3. State Scoping & Isolation
- **Scoped Data Store**: Each child component instance manages its own isolated state store.
- **Parent State Fallback**: If a state key is not found in the child scope, expression resolution falls back to the parent state store.
- **Zero Pollution**: Child local state mutations do not pollute the parent state unless explicitly bound to a shared target key.

### 4. Architectural Isolation Mechanisms
1. **Component State Store Isolation**: Each mounted component creates a standalone, encapsulated `<data_model>` instance. Parallel sibling components (e.g. 5 `<user-card>` elements) maintain isolated counters or inputs without cross-contamination.
2. **API Client Scoping (`<api_config>`)**: API headers, base URL prefixes, and request interceptors defined within a component `<api_config>` are strictly scoped to that component tree and do not leak into global or sibling API configurations.
3. **Sandbox Script Execution (`action="RUN_SCRIPT"`)**: Custom scripts execute inside isolated `new Function('$el', '$data', '$engine', '$evt')` scopes, preventing global window scope leakage or closure context pollution.
4. **DevTools & Multi-Engine Instance Isolation**: Multiple active `EUIXEngine` instances on the same page are tracked independently by DevTools without shared state collision.

### 5. Component Isolation & Scoping Matrix

| Tag / Feature | Scope Level | Leakage Risk | Scoping Behavior & Precedence |
| :--- | :--- | :--- | :--- |
| **`<api_config>`** | Component & Global | 🟢 **Zero Leakage** | Component-level `<api_config>` overrides global config for all XHR calls within that component tree. |
| **`<constants>` / `<vars>`** | Component & Global | 🟢 **Zero Leakage** | Component design tokens inherit from parent components and override parent/global constants locally. |
| **`<on_mount>`, `<on_interval>`** | Component & Element | 🟢 **Zero Leakage** | Timers and lifecycle hooks are tied strictly to the lifecycle of the mounting component instance. |
| **`<state>` / `<data_model>`** | Scoped Reactive Store | 🟢 **Zero Leakage** | States reside in isolated component stores. Component props (`{user_name}`) allow passing parent values. |

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
<for_each items="{tasks}" var="task">
  <item_row>
    <span>{task.title}</span>
    <button class="ai-btn-secondary">
      <on_click action="MUTATE_STATE">
        <path>tasks</path>
        <operation>REMOVE</operation>
        <where field="field:id" equals="{task.id}" />
      </on_click>
      Delete
    </button>
  </item_row>
</for_each>
```

### 4. Checkbox & Nested Object Property Toggling
❌ **WRONG**: Expecting automatic method invocation on checkbox click.
```xml
<input type="checkbox" checked="{task.done}" on_click="toggleTask" />
```

✅ **RIGHT**: Toggle nested item property using `<on_click action="RUN_SCRIPT">`.
```xml
<for_each items="{tasks}" var="task">
  <input type="checkbox" checked="{task.done}">
    <on_click action="RUN_SCRIPT">
      const item = $data.tasks.find(t => String(t.id) === "{task.id}");
      if (item) item.done = !item.done;
    </on_click>
  </input>
</for_each>
```
