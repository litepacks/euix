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

### 1. Declarative XML `<api_config>`
```xml
<uid_spec>
    <api_config base_url="https://api.example.com/v1" credentials="include" timeout="5000">
        <headers>
            <header name="Authorization">Bearer {data.user_token}</header>
            <header name="X-App-Version">1.2.0</header>
            <header name="Accept">application/json</header>
        </headers>
    </api_config>
</uid_spec>
```

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

## 🔒 Element & Component Isolation Matrix

Below is a reference of how various EUIX Engine metadata & configuration tags behave regarding component scoping vs global state:

| Tag / Feature | Scope Level | Leakage Risk | Scoping Behavior & Precedence |
| :--- | :--- | :--- | :--- |
| **`<api_config>`** | Component & Global | 🟢 **Zero Leakage** | Component-level `<api_config>` overrides global config for all XHR calls within that component tree. |
| **`<constants>` / `<vars>`** | Component & Global | 🟢 **Zero Leakage** | Component design tokens inherit from parent components and override parent/global constants locally. |
| **`<on_mount>`, `<on_interval>`, `<on_unmount>`** | Component & Element | 🟢 **Zero Leakage** | Timers and lifecycle hooks are tied strictly to the lifecycle of the mounting component instance. |
| **`<state>` / `<data_model>`** | Global Reactive Store | 🟡 **Shared State** | States reside in the global reactive `_rawState`. Component props (`{props.key}`) allow passing isolated values. |
| **`<persistence>`** | State ID Level | 🟢 **Zero Leakage** | Explicitly targets designated state keys for LocalStorage / SessionStorage persistence. |

---

## 🧪 Running Test Suites

EUIX Engine includes comprehensive unit, component, contract, and browser E2E test suites:

```bash
# Run Vitest Unit, Component, Contract, Persistence & External Resource Tests (83 Tests)
npm run test

# Run Playwright Real Browser E2E Tests (9 Tests)
npm run test:e2e
```
