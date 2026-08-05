# EUIX Engine - Component Reference Guide (`components.md`)

This document provides a comprehensive guide to all layout containers, UI components, control flow tags, actions, universal event listeners (`<event>`), and the custom component registry in **EUIX Engine**.

---

## 📌 Table of Contents
- [1. Layout & Container Components](#1-layout--container-components)
- [2. Primitive & Native UI Elements](#2-primitive--native-ui-elements)
- [3. Logic & Control Flow Tags](#3-logic--control-flow-tags)
- [4. Universal Event Listeners (`<event>`) & Actions](#4-universal-event-listeners-event--actions)
- [5. Custom Component & Action Registry API](#5-custom-component--action-registry-api)

---

## 1. 📐 Layout & Container Components

### `<flex>`
Flexible Flexbox container using standard `display: flex`.

**Attributes:**
- `direction` / `dir`: `row` | `column` | `row-reverse` | `column-reverse`
- `align`: `start` (`flex-start`) | `center` | `end` (`flex-end`) | `stretch` | `baseline`
- `justify`: `start` | `center` | `end` | `between` (`space-between`) | `around` | `evenly`
- `gap`: Gap in pixels (e.g., `gap="16"`)
- `wrap`: `true` (`wrap`) | `false` (`nowrap`) | `wrap-reverse`

```xml
<flex direction="row" align="center" justify="between" gap="16" class="p-4 bg-white">
    <h2>Header Title</h2>
    <button class="btn border p-2">Click Me</button>
</flex>
```

---

### `<grid>`
CSS Grid layout container using `display: grid`.

**Attributes:**
- `cols` / `columns`: Number of columns (e.g., `cols="3"`) or explicit template string (`cols="1fr 2fr 1fr"`).
- `rows`: Number of rows or explicit template string.
- `gap`: Grid gap in pixels.
- `gap_x` / `col_gap`: Horizontal column gap.
- `gap_y` / `row_gap`: Vertical row gap.

```xml
<grid cols="3" gap="12">
    <div class="col-span-2 bg-blue-50">Main Grid Content</div>
    <div class="bg-slate-50">Sidebar</div>
</grid>
```

---

### `<collapse>`
Interactive accordion / collapsible container with reactive state binding.

**Attributes:**
- `bind`: Reaktif state key (e.g., `data.todos_open`).
- `title`: Summary header title text.
- `header_class`: CSS classes for header button.
- `body_class`: CSS classes for collapsible body.

```xml
<collapse bind="data.todos_open" title="Todo List" class="border rounded-xl">
    <summary>Custom Title HTML</summary>
    <flex direction="column">
        <!-- Collapsible Content -->
    </flex>
</collapse>
```

---

### `<dialog>`
Modal dialog backdrop overlay with focus management and ESC key support.

**Attributes:**
- `bind`: Reaktif state key for modal visibility (e.g., `data.confirm_modal_open`).
- `title`: Modal header title.
- `close_on_backdrop`: `true` (default) | `false`.

```xml
<dialog bind="data.modal_open" title="Confirm Action">
    <span>Are you sure you want to proceed?</span>
    <actions>
        <button>Cancel</button>
        <button class="bg-rose-600 text-white">Confirm</button>
    </actions>
</dialog>
```

---

## 2. 🧩 Primitive & Native UI Elements

EUIX Engine supports standard native HTML elements (`<span>`, `<h2>`, `<button>`, `<input>`, `<img>`, `<textarea>`, `<select>`, `<option>`) as first-class citizens:

```xml
<input type="text" bind="data.username" placeholder="Enter username..." />
<button class="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg">
    Submit
    <on_click action="SET_STATE">
        <path>data.submitted</path>
        <value>true</value>
    </on_click>
</button>
```

---

## 3. 🔀 Logic & Control Flow Tags

### `<if>`, `<else_if>`, `<else>`
Conditional rendering based on reactive state expressions.

```xml
<if condition="{data.user.role} == admin">
    <span>Admin Dashboard</span>
    <else_if condition="{data.user.role} == editor">
        <span>Editor View</span>
    </else_if>
    <else>
        <span>Guest View</span>
    </else>
</if>
```

---

### `<for_each>`
Fine-grained dynamic list rendering.

```xml
<for_each items="{data.todos}" var="todo">
    <flex direction="row" justify="between">
        <span>{todo.text}</span>
    </flex>
</for_each>
```

---

## 4. ⚡ Universal Event Listeners & Actions

### Action Types:
- `SET_STATE`: Updates state value (`<path>`, `<value>`).
- `MUTATE_STATE`: Performs array operations (`PUSH`, `UNSHIFT`, `UPDATE`, `REMOVE`, `CLEAR`).
- `XHR`: Performs declarative async HTTP requests.
- `FOCUS`: Focuses DOM element (`<target>`).
- `RUN_BENCHMARK`: Executes live performance benchmark (`count`, `target`).

```xml
<button>
    Clear All
    <on_click action="MUTATE_STATE">
        <path>data.todos</path>
        <operation>CLEAR</operation>
    </on_click>
</button>
```

---

## 5. 🛠️ Custom Component & Action Registry API

```javascript
import { EUIXEngine } from 'euix';

// Register custom component
EUIXEngine.registerComponentSpec('custom-badge', `
    <component_def name="custom-badge">
        <span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-md text-xs">{props.label}</span>
    </component_def>
`);

// Register custom action
const engine = EUIXEngine.mount(xml, '#app');
engine.registerAction('LOG_STATE', (actionNode, context, engineInstance) => {
    console.log('Current state:', engineInstance.getState('todos'));
});
```
