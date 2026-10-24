# Vanilla .EUIX Engine (`euixjs`)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Build Tool: Vite](https://img.shields.io/badge/Build%20Tool-Vite-646CFF.svg)](https://vitejs.dev/)
[![Test Suite: Vitest](https://img.shields.io/badge/Vitest-100%25%20Passed-brightgreen.svg)]()
[![E2E Suite: Playwright](https://img.shields.io/badge/Playwright-100%25%20Passed-brightgreen.svg)]()

> **Minimal by default, powerful by opt-in.**  
> An ultra-lightweight, zero Virtual DOM declarative UI engine that turns markup, reactive state, and declarative actions directly into fast DOM updates without requiring a build step or bundler.

---

## 💡 What is EUIX?

EUIX brings modern declarative reactivity to any HTML page—including server-rendered applications (Laravel Blade, WordPress, Django, Rails, Go templates) and static sites:

- ⚡ **Zero Virtual DOM Overhead**: Direct fine-grained DOM node mutations batched automatically via `queueMicrotask`.
- 🏝️ **Declarative Island Architecture**: Drop reactive components anywhere in your HTML with `<script euix>` and `data-euix`.
- 📦 **Single Script, No Build Required**: Works out of the box via UMD/CDN script tag or modular ESM imports.
- 🎯 **Action Shorthands**: Perform math, toggles, array mutations, and function calls declaratively (`on_click:set`, `on_click:toggle`, `on_click:mutate`).
- 🩺 **Static Validation with EUIX Doctor**: Catch state mismatches, unclosed bindings, and syntax errors statically before runtime.
- 🤖 **AI-Agent Native**: Structured XML specifications that LLMs can deterministically generate, inspect, and modify.

---

## 🚀 Quick Start: Declarative Island Mount (`data-euix`)

Add a single script tag with the `euix` attribute to your HTML document. EUIX automatically discovers all `data-euix` elements, mounts their reactive specifications, and monitors the DOM for new elements via `MutationObserver`.

### 1. `index.html`

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>EUIX Island Demo</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <!-- Single script tag with euix attribute enables auto-scanning & DOM observation -->
  <script src="https://unpkg.com/euixjs@latest/dist/EUIXEngine.umd.js" euix></script>
</head>
<body class="bg-slate-900 text-slate-100 min-h-screen p-8 space-y-6">

  <!-- Example 1: Remote XML component with prop & initial state overrides -->
  <div data-euix="/counter.xml" data-prop-title="Live Counter" data-state-count="10"></div>

  <!-- Example 2: Second isolated counter island on the same page -->
  <div data-euix="/counter.xml" data-prop-title="Secondary Counter" data-state-count="100"></div>

  <!-- Example 3: Reference an inline <template id="..."> -->
  <div data-euix="#quick-card" data-prop-author="Ahmet"></div>

  <!-- Inline template definition -->
  <template id="quick-card">
    <uid_spec>
      <data_model>
        <state id="liked" type="boolean">false</state>
      </data_model>
      <div class="p-5 bg-slate-800/80 rounded-xl border border-slate-700 flex items-center justify-between">
        <h4 class="font-bold text-white">Author: {props.author}</h4>
        <button class="px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer"
                on_click:toggle="liked">
          {data.liked ? '❤️ Liked' : '🤍 Like'}
        </button>
      </div>
    </uid_spec>
  </template>

</body>
</html>
```

### 2. `counter.xml` (Component Specification)

Here is the `/counter.xml` component file referenced in Example 1 above:

```xml
<uid_spec>
  <!-- Typed Reactive State Model -->
  <data_model>
    <state id="count" type="number">0</state>
  </data_model>

  <!-- Component Layout & Direct DOM Bindings -->
  <div class="p-6 bg-slate-800 border border-slate-700 rounded-2xl shadow-xl flex flex-col items-center gap-4 text-white max-w-sm">
    <h3 class="text-lg font-bold tracking-wide text-slate-200">{props.title || "Interactive Counter"}</h3>
    
    <div class="text-5xl font-black font-mono text-emerald-400 py-2">
      {data.count}
    </div>

    <!-- Declarative Event Actions (Zero boilerplate JS needed) -->
    <div class="flex items-center gap-3">
      <button class="w-12 h-12 bg-rose-600 hover:bg-rose-500 rounded-xl font-bold text-xl transition"
              on_click:set="count={data.count - 1}">
        -
      </button>
      <button class="px-4 h-12 bg-slate-700 hover:bg-slate-600 rounded-xl text-sm font-semibold transition"
              on_click:set="count=0">
        Reset
      </button>
      <button class="w-12 h-12 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-xl transition"
              on_click:set="count={data.count + 1}">
        +
      </button>
    </div>
  </div>
</uid_spec>
```

---

## 🎛️ Programmatic Global API (`window.euix`)

For dynamic applications or integration into existing JavaScript controllers:

```javascript
// Scan any DOM container for newly added [data-euix] elements
await window.euix.scan(document.body);

// Mount a specific element imperatively
const engine = await window.euix.mountElement(document.querySelector('#my-island'));

// Dynamically update component props without re-mounting
engine.setProps({ title: 'New Title', step: 5 });

// Retrieve the engine instance by selector or DOM element
const inst = window.euix.get('#my-island');

// Cleanly unmount element and clear all listeners
window.euix.unmount(document.querySelector('#my-island'));
```

---

## ⚡ Action Shorthands Reference

Perform common state operations directly inside XML attributes:

| Shorthand | Example | Description |
| :--- | :--- | :--- |
| **`on_click:set`** | `on_click:set="count={data.count + 1}"` | Sets state with numeric expressions, strings, or ternaries |
| **`on_click:toggle`** | `on_click:toggle="is_open"` | Toggles a boolean state between `true` and `false` |
| **`on_click:mutate`** | `on_click:mutate="items.PUSH({id: 1, text: 'Task'})"` | Mutates arrays (`PUSH`, `REMOVE where id={item.id}`, `CLEAR`) |
| **`on_click:revalidate`** | `on_click:revalidate="get_users"` | Revalidates an SWR REST API endpoint |
| **`on_click:call`** | `on_click:call="saveUser"` | Calls a registered JavaScript business logic handler |

---

## 🩺 EUIX Doctor (Static Verification)

EUIX includes `@euix/doctor` to statically analyze your markup, state flow, and components without needing a browser:

```bash
# Analyze all EUIX components in your project
npx euix doctor

# Scan a specific file or directory
npx euix doctor apps/playground

# Automatically wrap JS scripts in CDATA (EUIX0001)
npx euix doctor path/to/App.xml --fix
```

---

## 🧩 Modular Plugin Ecosystem

Extend EUIX dynamically with tree-shakeable plugins:

- **`euixjs/api`**: SWR data fetching, offline queuing, focus revalidation
- **`euixjs/router`**: Single-Page App (SPA) hash/path router with nested outlets
- **`euixjs/composer`**: Multi-step transactional client workflows & sagas
- **`euixjs/storage`**: LocalStorage & SessionStorage state persistence
- **`euixjs/dialog`**: Declarative modal dialogs and overlays
- **`euixjs/webmcp`**: Zero-dependency browser-native agent tool integration

---

## 📄 License

MIT © [litepacks](https://github.com/litepacks)
