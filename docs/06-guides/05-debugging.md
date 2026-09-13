---
title: Debugging & DevTools
description: Inspecting state trees, tracing action dispatches, and utilizing the floating DevTools Inspector.
order: 5
group: Guides
---

# Debugging & DevTools

EUIX includes development tooling to inspect reactive state, trace action executions, and diagnose performance bottlenecks.

---

## 🩺 Static Analysis First — EUIX Doctor

Before opening the browser, run **EUIX Doctor** on changed markup. It catches missing handlers, reactive loops, broken composition, and prop type mismatches without mounting the app:

```bash
npx euix doctor path/to/components
npx euix doctor inspect path/to/Component.xml
```

Key composition rules: `EUIX1401` (unresolved component), `EUIX1402` (missing required prop), `EUIX1403` (prop type mismatch).

See the full guide: **[EUIX Doctor — Static Analysis](/guides/doctor-static-analysis)**.

---

## 🛠️ Floating DevTools Inspector (`euixjs/devtools`)

Add the DevTools bundle to your page during development:

```html
<!-- HTML UMD Script Tag -->
<script src="https://unpkg.com/euixjs/dist/EUIXDevTools.umd.js" data-euix-devtools="open"></script>
```

```javascript
// Or initialize programmatically in ESM
import { EUIXDevTools } from 'euixjs/devtools';

const engine = EUIXEngine.mount(xmlString, '#app');
EUIXDevTools.init(engine);
```

### DevTools Capabilities:
- **Live State Tree**: View and mutate reactive state values in real-time.
- **Action Dispatch Timeline**: Track chronological logs of all `SET_STATE`, `MUTATE_STATE`, `XHR`, and custom workflow executions.
- **Component Inspector**: Inspect isolated component instances (`isolated="true"`) and their private local state stores.

---

## 🔍 In-Browser Console Debugging

You can inspect and mutate the engine directly from the browser Developer Tools console:

```javascript
// Access state
window.__EUIX_ENGINE__.getState('user');

// Mutate state interactively
window.__EUIX_ENGINE__.setState('counter', 42);

// Revalidate SWR endpoints
window.__EUIX_ENGINE__.revalidateApi('get_posts');
```

---

## 🧭 Next Step

Learn how to write automated tests in **[Testing & Playwright](/guides/testing)**.
