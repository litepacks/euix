---
title: Coming from React or Vue
description: Conceptual mental mapping for developers transitioning from React, Vue, or Svelte to EUIX Engine.
order: 5
group: Advanced
---

# Coming from React or Vue

If you have experience with React, Vue, or Svelte, this guide maps familiar patterns to their EUIX equivalents.

---

## 🗺️ Conceptual Mapping

| React Concept | Vue 3 Concept | Svelte Concept | EUIX Engine Equivalent |
| :--- | :--- | :--- | :--- |
| `useState(0)` | `ref(0)` | `let count = 0` | `<state id="count" type="number">0</state>` |
| `useMemo(...)` | `computed(...)` | `$: double = count * 2` | `<computed id="double">{data.count * 2}</computed>` |
| `useEffect(...)` | `watch(...)` | `$: { ... }` | `<watch target="data.count" action="...">` |
| `props` | `defineProps(...)` | `export let title` | `{props.title}` inside `<component_def>` |
| `{children}` | `<slot />` | `<slot />` | `<children />` or `<slot />` |
| `onClick={...}` | `@click="..."` | `on:click={...}` | `<on_click action="...">` |
| `useRef` | `ref="el"` | `bind:this` | `$el` in script context or direct ID access |
| `useEffect(() => { return () => {} }, [])` | `onMounted / onUnmounted` | `onMount / onDestroy` | `<on_mount>` and `<on_unmount>` |

---

## 🧠 Key Differences to Keep in Mind

### 1. No Virtual DOM or Re-render Loop
In React, when state updates, the entire component function re-executes to create a new Virtual DOM tree. In EUIX:
- Components are instantiated once upon mounting.
- State changes update only the exact target DOM text nodes or attributes.
- Your template is never re-parsed or re-executed in its entirety during a state change.

### 2. Markup as the Source of Truth
Instead of writing JavaScript functions that return JSX, in EUIX you write structured XML templates that describe layout, state, and actions declaratively together.

---

## 🧭 Next Section: API Reference

Browse the exhaustive API specifications in **[Markup Elements Reference](/reference/markup)**.
