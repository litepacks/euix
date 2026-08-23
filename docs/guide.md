# EUIX Engine - Architecture & Developer Guide (`docs/guide.md`)

Welcome to the **EUIX Engine** developer guide. This guide explains core architectural principles, state reactivity, design token constants, declarative lifecycle hooks, DevTools inspection, and testing practices.

---

## 🚀 Architectural Principles

1. **Zero Dependencies (0-Dep):** No third-party dependencies or heavy runtime frameworks.
2. **Zero Build Step Required (No-Build):** Runs directly in modern web browsers via standard DOM APIs.
3. **Fine-Grained In-Place Reactivity:** Uses Proxy-based state observers to update only affected DOM nodes without Virtual DOM diffing overhead.
4. **Declarative Component Model:** HTML/XML templates with custom component imports (`<import src="..." />`) and definitions (`<component_def>`).
5. **Design Tokens & Constants (`<constants>` / `<vars>`):** Scoped and inherited CSS class and variable tokens.
6. **Declarative Lifecycle Hooks:** Full suite of hooks including `<on_mount>`, `<on_unmount>`, `<on_change>`, `<on_interval>`, and `<on_visible>`.

---

## ⚓ Declarative Lifecycle Hooks Reference

EUIX Engine provides declarative XML tags for managing element & component lifecycles:

### 1. `<on_mount>`
Executes actions immediately when the component or element is mounted into the DOM:
```xml
<on_mount action="XHR">
    <method>GET</method>
    <url>https://pokeapi.co/api/v2/pokemon?limit=12</url>
    <target>data.pokemons</target>
</on_mount>
```

### 2. `<on_unmount>` / `<on_destroy>`
Executes cleanup actions automatically when the DOM element is removed from the document:
```xml
<on_unmount action="SET_STATE">
    <path>data.active_tab</path>
    <value>default</value>
</on_unmount>
```

### 3. `<on_state_change watch="data.key">` / `<on_change watch="...">`
Executes side-effect actions whenever the watched state value changes (declaratively in XML or programmatically in JS):

**Declarative XML:**
```xml
<on_state_change watch="data.search_query" action="XHR">
    <url>https://api.example.com/search?q={data.search_query}</url>
    <target>data.search_results</target>
</on_state_change>
```

**Programmatic JS API:**
```javascript
// Watch a specific state key with (newValue, oldValue)
const unwatch = engine.watch('search_query', (newValue, oldValue) => {
    console.log(`Query changed from "${oldValue}" to "${newValue}"`);
});

// Watch ALL state changes globally
const unwatchGlobal = engine.onStateChange((key, newValue, oldValue) => {
    console.log(`State "${key}" mutated:`, newValue);
});

// Stop watching anytime
unwatch();
```

### 4. `<on_interval ms="5000">` / `<on_timer ms="...">`
Executes recurring actions on a timer interval (automatically cleared on unmount):
```xml
<on_interval ms="10000" action="XHR">
    <method>GET</method>
    <url>https://api.example.com/status</url>
    <target>data.server_status</target>
</on_interval>
```

### 5. `<on_visible>` (Lazy Viewport Intersection)
Executes actions when the element enters the browser viewport via `IntersectionObserver`:
```xml
<on_visible action="XHR">
    <url>https://jsonplaceholder.typicode.com/posts?_limit=10</url>
    <target>data.posts</target>
</on_visible>
```

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

---

## ⚡ High-Performance Rendering & Virtual Scrolling

EUIX Engine includes built-in viewport virtualization (`virtual="true"`) for smoothly rendering massive datasets (1,000 to 100,000+ items) at a constant 60 FPS:

```xml
<for_each items="{data.telemetry_packets}" var="packet" key="id" virtual="true" item_height="44" height="400px" buffer="4">
    <flex direction="row" align="center" justify="between" class="p-2 border-b">
        <span>#{packet.id} {packet.title}</span>
        <span>{packet.latency}</span>
    </flex>
</for_each>
```

### Performance Primitives:
1. **Viewport Windowing:** Only the ~12–15 currently visible DOM items are mounted into the DOM tree, keeping memory consumption flat regardless of list size.
2. **Container Event Delegation:** Child events are captured at the list container level, avoiding thousands of individual `addEventListener` allocations.
3. **Static Layout Pre-calculation (`_staticLayoutStyle`):** Non-interpolated CSS and Flex/Grid rules are computed once per template node and cached for all list instances.
4. **Single-Pass JIT Transpiler:** Expression evaluations (`{data.counter + 1}`) compile directly to safe, zero-allocation JavaScript functions.

---

## 🔗 Parent State Access & Reactive Props

Child components in EUIX Engine have fine-grained reactive access to parent states and props passed from parent components:

1. **Passing State as Props:**
   `<my-card count="{data.counter_value}" />`
   When `data.counter_value` updates in the parent component, `{props.count}` in the child component automatically updates in-place.

2. **Direct Parent State Access:**
   Child component templates can directly read reactive parent states via `{parent.data.counter_value}` or `{data.counter_value}`:
   ```xml
   <component_def name="state-bridge-badge">
       <flex direction="row" align="center" justify="between">
           <span>Prop Value: {props.count}</span>
           <span>Direct Parent State: {parent.data.counter_value}</span>
       </flex>
   </component_def>
   ```

---

## 📝 Native HTML5 Form Validation Support

EUIX Engine supports native browser HTML5 form validations out of the box:

1. **Validation Attribute Pass-Through:**
   Attributes like `required`, `pattern`, `minlength`, `maxlength`, `min`, `max`, `step`, `title`, `disabled`, and `readonly` declared on `<input>`, `<textarea>`, or `<select>` are directly passed to the DOM element.

2. **Automatic Submit Interception (`checkValidity` & `reportValidity`):**
   When submitting a `<form>` or clicking a `<button type="submit">`, EUIX Engine automatically calls `form.checkValidity()`. If validation fails, the native browser popup (`reportValidity()`) triggers, and form submission actions (`<on_submit>` / `<on_click>`) are aborted.

```xml
<form class="space-y-3">
    <input bind="data.user_email" type="email" required="true" pattern=".*@.*" class="border p-2 rounded invalid:border-rose-500" />
    <button type="submit" class="btn-primary">
        Submit
        <on_click action="SET_STATE">
            <path>data.form_submitted</path>
            <value>true</value>
        </on_click>
    </button>
</form>
```

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

### Declarative & Programmatic External JSON Resource Loading (`src="..."`)
EUIX Engine supports fetching initial `<data_model>` states, `<constants>` tokens, or individual `<state>` values directly from external JSON configuration files:

#### Declarative XML:
```xml
<uid_spec>
    <!-- Load design tokens from JSON file -->
    <constants src="/tokens/theme-tokens.json" />

    <!-- Load initial data model states from JSON file -->
    <data_model src="/config/app-initial-state.json">
        <!-- Local fallback states -->
        <state id="local_counter">0</state>
        <!-- Single state from JSON file -->
        <state id="user_profile" src="/api/profile.json" />
    </data_model>
</uid_spec>
```

#### Programmatic JS API:
```javascript
// Programmatically fetch & merge data model or constants from JSON files
await engine.loadDataModel('/config/app-initial-state.json');
await engine.loadConstants('/tokens/theme-tokens.json');

// Flicker-free async mount (awaits all external JSON resources before rendering)
const engine = await EUIXEngine.mountAsync(xml, '#app');
```

---

## 🛠️ EUIX DevTools Inspector

EUIX DevTools provides a live inspector overlay, State Tree drawer, and Action log stream:

- **Shortcut:** Press **`Alt + Shift + I`** or **`Escape`** to toggle.
- **State Drawer:** View all reactive states in real time (`$state`).
- **Action Log Stream:** Streams every `SET_STATE`, `MUTATE_STATE`, and `XHR` execution.
- **Console API:** Access `window.$state` and `window.$engine` directly in browser dev tools.

---

## 💾 State Persistence (LocalStorage & SessionStorage)

EUIX Engine supports automatic state persistence across page reloads and browser tabs using `localStorage` and `sessionStorage`.

### 1. Declarative XML Persistence
Mark any `<state>` element with `persist="local"` or `persist="session"`:

```xml
<uid_spec>
    <persistence storage="local">
        <persisted_key key="app_lang" storage_key="pref_lang" />
    </persistence>

    <data_model>
        <state id="user_notes" persist="local">Persistent Notes</state>
        <state id="session_token" persist="session">abc123token</state>
    </data_model>
</uid_spec>
```

### 2. Programmatic JS API
```javascript
// Register state key for LocalStorage or SessionStorage persistence
engine.persist('user_theme', { storage: 'local', key: 'app_theme_v1' });

// Clear persisted state from storage
engine.clearPersistedState('user_theme');
```

### 3. Multi-Tab Synchronization
Persisted `localStorage` state keys automatically sync across open browser tabs via native `window.onstorage` reactivity.

---

## 🌐 API Client Configuration (BaseURL, Headers & Credentials)

EUIX Engine supports centralized API Client configuration for relative HTTP endpoints, common authorization headers, CORS credentials, request timeouts, and interceptors.

### 1. Declarative XML `<api_config>` & `<api_endpoint>`
```xml
<uid_spec>
    <api_config base_url="https://api.example.com/v1" credentials="include" timeout="5000">
        <headers>
            <header name="Authorization">Bearer {data.user_token}</header>
            <header name="X-App-Version">1.2.0</header>
            <header name="Accept">application/json</header>
        </headers>

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
</uid_spec>
```

#### `<api_endpoint>` Capabilities & Attributes:
- **`auto_fetch="true"`** *(default)*: Fetches automatically upon component or document mount.
- **`auto_fetch="false"`**: Pre-registers the endpoint in `_registeredXhrs` without making an initial HTTP call, allowing on-demand execution via `<on_click action="REVALIDATE_API" tag="...">` or `<watch>`.
- **`loading="state_key"`**: Automatically binds request in-flight status (`true`/`false`) to the specified `<data_model>` state key.
- **`error="state_key"`**: Automatically binds request failure error message to the specified `<data_model>` state key (cleared upon new request).
- **Automatic ID-based Reactive Status (`{api.<id>.<prop>}` / `{$api.<id>.<prop>}`):** 
  Every `<api_endpoint id="...">` or `tag="..."` exposes automatic reactive tracking properties accessible directly in templates and expressions without requiring explicit state bindings:
  - `{api.<id>.loading}`: Boolean `true` while request is active, `false` when finished.
  - `{api.<id>.error}`: Error string if request failed, `null` on success.
  - `{api.<id>.status}`: HTTP status code integer (e.g. `200`, `404`, `500`).
  - `{api.<id>.data}`: The latest parsed JSON response data.
  - `{api.<id>.timestamp}`: Epoch timestamp of the last request completion.
- **Programmatic Endpoint Status (`engine.getApiStatus(id)`):**
  ```javascript
  const status = engine.getApiStatus('get_posts');
  console.log(status.loading, status.error, status.status, status.data);
  ```
- **Attribute & Child Node Support**: Endpoint parameters (`url`, `method`, `target`/`bind_target`, `tag`, `select`, `auto_fetch`, `revalidate_focus`, `revalidate_online`, `loading`, `error`) can be specified directly as XML attributes or nested child elements.
- **Reentrancy Guard**: `revalidateApi` includes a reentrancy guard (`_isRevalidating`) preventing infinite loops when mutation `POST` endpoints trigger group revalidations.

### 2. Programmatic JS API
```javascript
// Configure API Client options globally or on engine instance
engine.configureApi({
    baseUrl: 'https://api.example.com/v1',
    credentials: 'include', // 'omit' | 'same-origin' | 'include'
    headers: {
        'Authorization': 'Bearer {data.user_token}',
        'X-App-Client': 'EUIX-Engine'
    },
    timeout: 8000,
    onRequest: ({ url, options }) => console.log('Sending XHR to:', url),
    onResponse: (response) => console.log('Received Status:', response.status)
});

// Dynamic header management
engine.setApiHeader('Authorization', 'Bearer new_secret_token');
engine.removeApiHeader('Authorization');
```

### 3. Component-Level Isolation & Scoping (`<api_config>`)
`<api_config>` can be declared at the global level OR inside individual component definitions (`<component_def>`). 

When declared inside a `<component_def>`, `<api_config>` is **component-scoped** and applies only to XHR actions executed within that specific component without leaking or overriding other components.

```xml
<component_def name="crypto-portfolio-section">
    <!-- Component-scoped API Config (Isolated to crypto-portfolio-section) -->
    <api_config base_url="https://api.coingecko.com/api/v3" timeout="8000" />
    <flex direction="column">
        <on_interval ms="30000" action="XHR">
            <url>/simple/price?ids=bitcoin&amp;vs_currencies=usd</url>
        </on_interval>
    </flex>
</component_def>
```

### 4. BaseURL Precedence & Local Resource Bypassing (`./` and `../`)

When an XHR action is executed, EUIX Engine calculates `finalUrl` using strict precedence and local bypass rules:

1. **Explicit Action `base_url` Override:** If `<on_click action="XHR" base_url="...">` is set on the action node, it takes top precedence over component and global configs.
2. **Local Relative Path Bypass (`./` and `../`):** Any XHR `<url>` starting with `./` or `../` (e.g. `<url>./components/MySection.xml</url>`), or any action with `ignore_base_url="true"` or `base_url=""`, **automatically bypasses external `base_url` prepending**. This guarantees that local template, XML source, or asset fetches are served directly from the local host without being prepended by third-party API base URLs.
3. **Absolute Protocol URLs (`http://` / `https://`):** Always bypass `base_url`.
4. **Relative API Endpoints (`/data` or `users/list`):** Combine seamlessly with component `<api_config base_url="...">` or global `baseUrl`.
            <target>data.btc_price</target>
        </on_interval>
    </flex>
</component_def>
```

#### Precedence & Resolution Order:
When an `XHR` action is triggered, options are resolved in the following priority order:
1. **Action Node Attributes** (`<on_click action="XHR" base_url="...">`) *(Highest Priority)*
2. **Component-Scoped `<api_config>`** (Declared in parent `<component_def>`)
3. **Global `<api_config>` / `engine.configureApi()`** *(Lowest Priority)*

---

## 🧩 Dual-Mode State Architecture: Component-Scoped State Isolation & Global Stores

EUIX Engine features an advanced **Dual-Mode State System** that balances application-wide state sharing with instance-level component encapsulation.

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

### 1. Global / Shared State Stores (`states.xml`, `<data_model scope="global">`)
When states are defined in an external headless component (e.g. `states.xml`), or marked explicitly with `<data_model scope="global">`, they are registered directly into the root reactive state store (`_rawState` / `state` Proxy). Any component across the entire DOM tree can read and mutate these states using `{data.key}` or `{global.key}`:

```xml
<!-- components/states.xml -->
<component_def name="app-state-store">
    <data_model scope="global">
        <state id="theme">dark</state>
        <state id="current_user" type="object">{"name": "Ahmet", "role": "Admin"}</state>
        <state id="notifications" type="array"></state>
    </data_model>
</component_def>
```

### 2. Component-Scoped Instance Isolation (`isolated="true"` / `scope="local"`)
When building reusable multi-instance components (such as dropdowns, accordion cards, or modal dialogs), state collision must be prevented. By marking a component definition with `isolated="true"` (or specifying `<data_model scope="local">` or `<state scope="local">`), EUIX Engine instantiates a dedicated private reactive state object (`localRawState`) for each rendered DOM instance:

```xml
<!-- components/AccordionCard.xml -->
<component_def name="accordion-card" isolated="true">
    <data_model>
        <state id="isOpen" type="boolean">false</state>
        <state id="clicks" type="number">0</state>
    </data_model>

    <div class="card-box">
        <h4>{props.title}</h4>
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
Inside an isolated component, expressions can seamlessly read and mutate both instance-private state (`local.*` or `$local.*`) and application-wide global state (`global.*` or `data.*`):

```xml
<component_def name="user-profile-panel" isolated="true">
    <data_model>
        <state id="panel_expanded" type="boolean">false</state>
    </data_model>

    <div class="profile-panel {data.theme}">
        <span>User: {data.current_user.name}</span>
        <span>Panel: {local.panel_expanded ? 'Expanded' : 'Collapsed'}</span>

        <!-- Local Instance Mutation -->
        <button>
            <on_click action="SET_STATE">
                <path>local.panel_expanded</path>
                <value>{local.panel_expanded ? 'false' : 'true'}</value>
            </on_click>
            Toggle Panel
        </button>

        <!-- Global State Mutation -->
        <button>
            <on_click action="SET_STATE">
                <path>global.theme</path>
                <value>{data.theme == 'dark' ? 'light' : 'dark'}</value>
            </on_click>
            Switch Global Theme
        </button>
    </div>
</component_def>
```

---

## 🔒 Element & Component Isolation Matrix

Below is a reference of how various EUIX Engine metadata & configuration tags behave regarding component scoping vs global state:

| Tag / Feature | Scope Level | Leakage Risk | Scoping Behavior & Precedence |
| :--- | :--- | :--- | :--- |
| **`isolated="true"` / `scope="local"`** | Component Instance | 🟢 **Zero Leakage** | Local state (`local.*`) is instantiated per rendered component instance. Multiple copies maintain completely separate state. |
| **`states.xml` / `scope="global"`** | Global Reactive Store | 🟢 **By Design** | Shared stores merge their `<data_model>` into the global `data.*` pool, accessible by root and all components. |
| **`<api_config>`** | Component & Global | 🟢 **Zero Leakage** | Component-level `<api_config>` overrides global config for all XHR calls within that component tree. |
| **`<constants>` / `<vars>`** | Component & Global | 🟢 **Zero Leakage** | Component design tokens inherit from parent components and override parent/global constants locally. |
| **`<on_mount>`, `<on_interval>`, `<on_unmount>`** | Component & Element | 🟢 **Zero Leakage** | Timers and lifecycle hooks are tied strictly to the lifecycle of the mounting component instance. |
| **`<persistence>`** | State ID Level | 🟢 **Zero Leakage** | Explicitly targets designated state keys for LocalStorage / SessionStorage persistence. |
| **`<action_def>`** | Component & Global | 🟢 **Zero Leakage** | Composed workflows registered in component specs override global action definitions locally. |

---

## 🧩 Action Composer Architecture (`<action_def>`)

The Action Composer Architecture in EUIX Engine consists of 4 main subsystems:

```
+---------------------------+       +---------------------------+
| XML <action_def> Nodes    | ----> | EUIXActionRegistry        |
+---------------------------+       +---------------------------+
                                                  |
                                                  v
+---------------------------+       +---------------------------+
| EUIXActionValidator       | <---- | EUIXActionComposer        |
+---------------------------+       +---------------------------+
  - Required Params Guard                 - Sequential Step Loop
  - Circular Recursion Chain              - Async/Promise Await
  - Max Depth Guard (>25)                 - DevTools Trace Logger
```

1. **`EUIXActionContext`**: Holds invocation parameters (`args`), engine reference, target DOM element (`_targetEl`), triggering DOM event (`_evt`), parent context, and call depth (`depth`).
2. **`EUIXActionValidator`**: Validates workflow execution parameters, enforces `required="true"` validation (`EUIXActionValidationError`), tracks the call chain (`callChain` Set) to prevent circular loop recursions (`ActionA -> ActionB -> ActionA`), and enforces max depth limit guards (`depth > 25`).
3. **`EUIXActionComposer`**: Executes workflow steps sequentially, evaluating conditional `<if condition="...">` branching, awaiting async HTTP (`XHR`) and script promises, updating `{result}` interpolation variables, and logging execution metrics (`durationMs`, `args`, `result`, `error`) to DevTools.
4. **`EUIXActionRegistry`**: Pre-indexes `<action_def>` nodes during `mount()` and component spec registration (`registerComponentSpec`), supporting both instance-level and static global workflows.

---

## ⚡ Watch & Computed State System (`EUIXReactivePlugin`)

The `EUIXReactivePlugin` (`euixjs/reactive`) adds derived computed properties and reactive side-effect watchers without modifying the core Proxy store architecture:

### 1. Computed Derived State (`<computed>`)
- Define derived state calculated from existing state paths: `<computed id="fullName" deps="firstName, lastName">return $data.firstName + ' ' + $data.lastName;</computed>`
- Results are memoized and re-evaluated only when specified dependencies mutate.
- Exposed directly via standard bindings (`{data.fullName}`) and state accessors (`engine.getState('fullName')`).
- Mutating a computed property throws a `COMPUTED_MUTATION_ERROR`.
- Static and dynamic circular dependencies trigger a `COMPUTED_CYCLE_ERROR`.

### 2. Reactive Watchers (`<watch>`)
- Observe state or computed path mutations declaratively (`<watch path="user_role">`) or programmatically (`engine.watch(path, handler)`).
- Can be declared directly inside `<data_model>` or at the root level of `<uid_spec>`.
- Automatically injects `$newValue`, `$prevValue`, and `$path` into execution context.
- Cascading watcher loops are capped with a max recursion depth guard (`WATCHER_CYCLE_ERROR`).

```xml
<uid_spec>
    <data_model>
        <state id="searchQuery"></state>
        
        <!-- Live watcher inside <data_model> triggering API revalidation on input change -->
        <watch path="searchQuery">
            <step action="REVALIDATE_API" tag="get_countries" />
        </watch>
    </data_model>
</uid_spec>
```

---

## 🎭 Declarative Animation System (`EUIXAnimationPlugin`)

The `EUIXAnimationPlugin` (`euixjs/animation`) provides keyframe animations, enter/leave lifecycle transitions, and declarative action execution using native Web Animations API (WAAPI):

### 1. Custom Animation Definitions (`<animation_def>`)
- Define reusable keyframes: `<animation_def name="customPulse" duration="400" easing="ease-in-out">`
- Supports `<keyframe offset="0" transform="scale(1)" opacity="1" />` declarations.

### 2. Built-in Keyframe Presets
- Pre-installed presets: `fade-in`, `fade-out`, `slide-in-down`, `slide-out-up`, `slide-in-left`, `slide-out-right`, `scale-in`, `scale-out`, `spin`, `pulse`, `bounce`.

### 3. Lifecycle Enter & Deferred Leave Transitions
- `enter_animation="fade-in"`: Runs automatically upon mounting.
- `leave_animation="fade-out"`: Defers DOM detachment on state/conditional branch updates until the leave animation completes cleanly.

### 4. Interruption & Reduced Motion
- Supports `cancel`, `finish`, and `queue` interruption policies for target element animations.
- Integrates with `EUIXCancellationController` to abort active play states cleanly.
- Respects `prefers-reduced-motion` media queries by collapsing duration to 0ms.

---

## 🧪 Battle-Testing & Reliability Architecture

EUIX Engine features an extensive, multi-tier battle-testing framework designed to stress the parser, runtime, state system, reactive graph, action executor, async workflows, lifecycle management, DOM renderer, plugins, and browser behavior under malformed input, concurrency, cancellation, long-running workloads, and unexpected execution combinations.

### 1. Test Suite Categories & Organization

```
tests/
├── unit/                       # Core correctness unit specs
├── integration/                # Plugin & component integration specs
├── property/                   # fast-check property-based test suites
├── fuzz/                       # Malformed & hostile XML fuzzing
├── roundtrip/                  # AST <-> JSON <-> XML semantic equivalence
├── permutations/               # Action Composer workflow graph permutation engine
├── chaos/                      # Seedable deterministic async chaos & late mutation protection
├── torture/                    # High-load stress (reactive storm, watch/computed, lifecycle, soak)
├── fixtures/                   # Stress application & release compatibility fixtures
├── browser/                    # Playwright cross-browser matrix (Chromium, Firefox, WebKit)
├── package/                    # Package tarball smoke test runner
└── helpers/invariants.js       # Shared invariant assertion library
```

### 2. Critical Runtime Invariants
- **Hostile Input Safety:** Malformed XML, unclosed tags, duplicate state IDs, or extreme nesting (150-depth) MUST NEVER crash the process with unhandled JS exceptions or stack overflows (`RangeError`).
- **AST Round-Trip Equivalence:** `XML -> Spec AST -> JSON -> Spec AST -> XML` must yield semantically identical state models, component specs, and action trees.
- **Try/Catch/Finally Guarantee:** `<finally>` executes EXACTLY ONCE; `<catch>` executes ONLY on errors.
- **Visual Component Error Isolation:** Render-time failures inside components or XML elements are isolated using internal try/catch boundaries, rendering an inline fallback element (`.euix-error-fallback`) without crashing the application tree.
- **Global Error Handler Hook:** Engine instances expose an `onError(error, contextInfo)` callback to intercept and report unhandled parsing, rendering, action, or XHR exceptions to monitoring services.
- **Resilience & Cancellation Invariant:** Timed-out or cancelled execution scopes IMMEDIATELY abort child processes (`AbortSignal`) and PERMANENTLY BLOCK any subsequent state mutations (`setState`, `mutateState`).
- **Reactive Cycle Protection:** Static and dynamic circular dependencies in `<computed>` (`A -> B -> C -> A`) predictably throw `COMPUTED_CYCLE_ERROR` without call stack overflow.
- **Lifecycle & Memory Invariant:** Unmounting a component releases all active timers, watchers, subscriptions, animations, event listeners, and external resource references without leaks (`dispose()`).

### 3. Execution Commands
```bash
# 1. Unit & Integration Suite (185 tests)
npm test

# 2. Battle-Testing Suite (Property, Fuzz, Chaos, Permutations, Torture)
npm run test:battle

# 3. Playwright Cross-Browser Matrix (Chromium, Firefox, WebKit)
npm run test:browser

# 4. Configurable Duration Soak Load Test
npm run test:soak

# 5. StrykerJS Mutation Testing
npm run test:mutation

# 6. Package Tarball Distribution Smoke Test
npm run test:package

# 7. Full Release Verification Gate (Build, Unit, Battle, Package Smoke Dashboard)
npm run verify:release
```

---

## XI. Runtime Inspector & E2E Testing Guide (`@euix/inspector` / `euixjs/inspector`)

### 1. Integration into Lite Core
```javascript
import { EUIXEngineCore } from 'euixjs/core';
import inspector from 'euixjs/inspector';

EUIXEngineCore.use(
  inspector({
    enabled: process.env.NODE_ENV === 'development',
    shortcut: 'Alt+Shift+X',
    testAttributes: true,
    maxEvents: 100
  })
);
```

### 2. Playwright E2E Integration
```javascript
import { test, expect } from '@playwright/test';
import { euix } from 'euixjs/inspector/playwright';

test('interactive todo flow', async ({ page }) => {
  await page.goto('/playground.html');

  // Scoped component locator with test-id
  await euix(page)
    .component('TodoApp')
    .getByTestId('new-task-input')
    .fill('Write E2E test with Playwright');

  await euix(page)
    .component('TodoApp')
    .getByTestId('add-task-btn')
    .click();

  // Wait for all engine background tasks to settle
  await euix(page).waitForIdle();

  // Inspect debug snapshot if needed
  const snapshot = await euix(page).component('TodoApp').debug();
});
```

---

## XII. WebMCP Browser AI Agent Protocol (`euixjs/webmcp`)

EUIX Engine provides first-class support for **WebMCP (`document.modelContext`)**, allowing browser AI agents to discover, inspect, and execute application actions as structured tools.

### 1. Declarative XML Tools (`<webmcp>`)
```xml
<uid_spec>
  <actions>
    <action_def name="ticket.create">
      <param name="title" required="true" />
      <param name="priority" default="Normal" />
      <step action="MUTATE_STATE">
        <path>data.tickets</path>
        <operation>PUSH</operation>
        <value>{"id": "t_" + Date.now(), "title": "{args.title}", "priority": "{args.priority}"}</value>
      </step>
      <return>{"success": true, "title": "{args.title}"}</return>
    </action_def>
  </actions>

  <webmcp>
    <tool
      name="create_ticket"
      title="Create Ticket"
      description="Creates a new support or development ticket"
      action="ticket.create">
      <param name="title" type="string" description="Ticket summary title" required="true" />
      <param name="priority" type="string" default="Normal" enum="Low,Normal,High,Urgent" />
    </tool>
  </webmcp>
</uid_spec>
```

### 2. Viewport Lazy Loading with IntersectionObserver (`<import lazy="true" viewport="true" />`)
```xml
<imports>
  <!-- Defer loading until user scrolls near the component (200px prefetch margin) -->
  <import name="analytics-dashboard" src="components/AnalyticsDashboard.xml" lazy="true" viewport="true" root_margin="200px" />
</imports>
```


