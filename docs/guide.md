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

### 3. `<on_change watch="data.key">` / `<on_update watch="...">`
Executes side-effect actions whenever the watched state value changes:
```xml
<on_change watch="data.search_query" action="XHR">
    <url>https://api.example.com/search?q={data.search_query}</url>
    <target>data.search_results</target>
</on_change>
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

---

## 🛠️ EUIX DevTools Inspector

EUIX DevTools provides a live inspector overlay, State Tree drawer, and Action log stream:

- **Shortcut:** Press **`Alt + Shift + I`** or **`Escape`** to toggle.
- **State Drawer:** View all reactive states in real time (`$state`).
- **Action Log Stream:** Streams every `SET_STATE`, `MUTATE_STATE`, and `XHR` execution.
- **Console API:** Access `window.$state` and `window.$engine` directly in browser dev tools.

---

## 🧪 Testing & Verification

EUIX Engine includes comprehensive unit, component, contract, and browser E2E test suites:

```bash
# Run Vitest Unit, Component & Contract Tests (48 Tests)
npm run test

# Run Playwright Real Browser E2E Tests (9 Tests)
npm run test:e2e
```
