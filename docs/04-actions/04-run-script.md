---
title: RUN_SCRIPT & Sandboxing
description: Executing JavaScript as an escape hatch with injected contextual parameters and security isolation.
order: 4
group: Actions
---

# RUN_SCRIPT & Script Sandboxing

While EUIX prioritizes declarative XML actions, you sometimes need custom JavaScript for complex algorithms, canvas operations, or third-party library bridges.

`action="RUN_SCRIPT"` provides a sandboxed execution environment with automatic context injection.

---

## ⚡ Basic Script Execution

```xml
<button class="btn">
  <on_click action="RUN_SCRIPT">
    // Automatic reactive state access
    if ($data.counter > 10) {
      $data.counter = 0;
      alert("Counter reset!");
    } else {
      $data.counter += 1;
    }
  </on_click>
  Calculate
</button>
```

> [!TIP]
> **No XML Entity Escaping Required (`&&`, `<`, `>` Work Naturally)**:
> You do **not** need to write `&amp;&amp;`, `&lt;`, `&gt;` or wrap code in `<![CDATA[...]]>`. The EUIX Parser automatically pre-sanitizes raw JavaScript operators before execution.

---

## 💉 Injected Context Variables

| Context Variable | Type | Description |
| :--- | :--- | :--- |
| **`$data`** | `Proxy` | Direct read/write access to the application reactive state store. |
| **`$el`** | `HTMLElement` | The DOM element that triggered the event. |
| **`$evt`** | `Event` | The native browser DOM event object. |
| **`$engine`** | `EUIXEngine` | The current engine instance. |
| **`$item`** / named var | `Object` | The current loop item in `<for_each>` containers. |
| **`$index`** | `number` | The current zero-based loop index. |
| **`$local`** | `Proxy` | Private component-scoped local state (for `isolated="true"` components). |
| **`$args`** | `Object` | Named parameters passed into composed actions (`<arg>`). |
| **`$date`** | `Object` | Date formatting and Intl helper functions (via `euixjs/date`). |

---

## 🛡️ Security & Execution Context

- Scripts execute inside an isolated closure created with `new Function(...)` rather than global `eval()`.
- Global window pollution is prevented by passing only explicit context parameters into the function signature.
- Always sanitize any user-generated HTML before injecting it into DOM nodes.

---

## 🎯 When to Use RUN_SCRIPT

### ✅ Good Use Cases:
- Integrating with external Canvas, WebGL, or charting libraries.
- Executing non-trivial mathematical algorithms or parsing raw binary/CSV data.
- Triggering browser hardware APIs (vibration, audio playback, fullscreen).

### ⚠️ When NOT to Use:
- Simple state incrementing or array deletions (use declarative `SET_STATE` and `MUTATE_STATE`).
- Straightforward API calls (use declarative `XHR` or `<api_endpoint>`).

---

## 🧭 Next Section: Plugins

Discover how to extend EUIX with modular plugins in **[Plugin Architecture](/plugins/plugin-system)**.
