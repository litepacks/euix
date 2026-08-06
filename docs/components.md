# EUIX Engine - Component Reference Guide (`docs/components.md`)

This document provides a comprehensive guide to layout containers, UI elements, control flow tags, constants, actions, event listeners (`<event>`), and the custom component registry in **EUIX Engine**.

---

## 📌 Table of Contents
- [1. Layout & Container Components](#1-layout--container-components)
- [2. Constants & Design Tokens (`<constants>`, `<vars>`)](#2-constants--design-tokens-constants-vars)
- [3. Primitive & Native UI Elements](#3-primitive--native-ui-elements)
- [4. Logic & Control Flow Tags](#4-logic--control-flow-tags)
- [5. Universal Event Listeners & Actions](#5-universal-event-listeners--actions)
- [6. Custom Component & Action Registry API](#6-custom-component--action-registry-api)

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
<flex direction="row" align="center" justify="between" gap="16" class="{const.card_box}">
    <h2>Header Title</h2>
    <button class="{const.btn_primary}">Click Me</button>
</flex>
```

---

### `<grid>`
CSS Grid layout container using `display: grid`.

**Attributes:**
- `cols` / `columns`: Number of columns (e.g., `cols="3"`) or explicit template string (`cols="1fr 2fr 1fr"`).
- `rows`: Number of rows or explicit template string.
- `gap`: Grid gap in pixels.

```xml
<grid cols="3" gap="12">
    <div class="col-span-2 bg-blue-50">Main Content</div>
    <div class="bg-slate-50">Sidebar</div>
</grid>
```

---

### `<collapse>`
Interactive accordion / collapsible container with reactive state binding.

**Attributes:**
- `bind`: Reactive state key (e.g., `data.todos_open`).
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
- `bind`: Reactive state key for modal visibility (e.g., `data.confirm_modal_open`).
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

## 2. 🎨 Constants & Design Tokens (`<constants>`, `<vars>`)

Define reusable CSS utility class tokens or variables at root or component level:

```xml
<constants>
    <const id="card_box">w-full bg-white p-6 rounded-2xl shadow-xl border border-slate-100</const>
    <const id="btn_primary">px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm</const>
</constants>

<vars>
    <var id="app_title">EUIX Engine Admin Portal</var>
</vars>
```

### Template & Class Usage:
- `class="{const.card_box}"`
- `class="{const.btn_primary}"`
- `<span>{var.app_title}</span>`

---

## 3. 🧩 Primitive & Native UI Elements

EUIX Engine supports standard native HTML elements (`<span>`, `<h2>`, `<button>`, `<input>`, `<img>`, `<textarea>`, `<select>`, `<option>`) as first-class citizens:

```xml
<input type="text" bind="data.username" placeholder="Enter username..." />
<img src="{props.avatar}" width="32" height="32" class="w-8 h-8 rounded-full object-cover" alt="Avatar" />
<button class="{const.btn_primary}">
    Submit
    <on_click action="SET_STATE">
        <path>data.submitted</path>
        <value>true</value>
    </on_click>
</button>
```

---

## 4. 🔀 Logic & Control Flow Tags

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

## 5. ⚡ Universal Event Listeners & Actions

### Action Types:
- `SET_STATE`: Updates state value (`<path>`, `<value>`).
- `MUTATE_STATE`: Performs array operations:
  - `PUSH` / `UNSHIFT`: Inserts item to array.
  - `UPDATE`: Updates item matching `<where>` query (`<where equals="..." />`).
  - `REMOVE`: Removes item by `<index>` or `<where>` query.
  - `SWAP`: Swaps positions and status between 2 items (`<where equals="..." />`, `<target_where equals="..." />`).
  - `MOVE_UP` / `MOVE_DOWN`: Moves item index up or down in array.
  - `CLEAR` / `RESET`: Empties array list.
- `XHR`: Performs declarative async HTTP requests with loading/error handling.
- `REVALIDATE_API`: Triggers SWR (Stale-While-Revalidate) background data refetching (`<revalidate target="data.key" />`).

---

### 🗂️ Drag & Drop Event Listeners (`<on_dragstart>`, `<on_drop>`)

EUIX Engine supports native HTML5 and touch/pointer Drag & Drop with zero-lag custom floating preview (`#euix-drag-ghost`):

```xml
<for_each items="{data.kanban_tasks}" var="task">
    <div draggable="true" data-id="{task.id}">
        <on_dragstart action="SET_STATE">
            <path>data.dragged_id</path>
            <value>{task.id}</value>
        </on_dragstart>
        <on_drop action="MUTATE_STATE" operation="SWAP">
            <path>data.kanban_tasks</path>
            <where equals="{data.dragged_id}" />
            <target_where equals="{task.id}" />
        </on_drop>
        <span>{task.title}</span>
    </div>
</for_each>

<!-- Drop Target Column -->
<flex direction="column">
    <on_drop action="MUTATE_STATE" operation="UPDATE">
        <path>data.kanban_tasks</path>
        <where equals="{data.dragged_id}" />
        <value status="in_progress" />
    </on_drop>
    <!-- Column Items -->
</flex>
```

---

### `<api_config>` (API Client Configuration & Scoping)
Configures relative BaseURL, default HTTP headers, credentials, and request timeouts.

**Scoping & BaseURL Rules:**
- **Component-Scoped Isolation:** When declared inside a `<component_def>`, `<api_config>` applies strictly to XHR actions executed within that component instance without leaking to sibling components.
- **Local Path Bypass (`./` and `../`):** Any XHR `<url>` starting with `./` or `../` (e.g. `<url>./components/MySection.xml</url>`), or actions with `ignore_base_url="true"` / `base_url=""`, **automatically bypass external `base_url` prepending**.

```xml
<component_def name="my-section">
    <api_config base_url="https://api.example.com" timeout="5000">
        <headers>
            <header name="Authorization">Bearer {data.token}</header>
        </headers>
    </api_config>
    <flex direction="column">
        <!-- Component UI & XHR Actions -->
    </flex>
</component_def>
```
