---
title: Markup Elements Reference
description: Exhaustive reference for all EUIX declarative XML tags, attributes, and structural nodes.
order: 1
group: Reference
---

# Markup Elements Reference

This reference documents all declarative XML tags supported by EUIX Engine Core and standard plugins.

---

## 🏷️ Root & Structure Tags

### `<uid_spec>`
Root wrapper for all EUIX templates.
- **Children**: `<data_model>`, `<constants>`, `<actions>`, `<api_config>`, `<style>`, layout containers (`<flex>`, `<grid>`, `<div>`).

### `<data_model>`
Declares reactive state variables for the application or component.
- **Attributes**: `scope="global|local"`
- **Children**: `<state>`, `<computed>`

### `<state>`
Defines a single reactive state variable.
- **Attributes**: 
  - `id` *(required)*: Unique state variable name.
  - `type`: `string` | `number` | `boolean` | `array` | `object` (default: `string`).
  - `persist`: `localStorage` | `sessionStorage` (requires Storage plugin).
- **Body**: Initial state value (e.g. `0`, `Alex`, `[1, 2, 3]`).

---

## 📐 Layout Containers

### `<flex>`
Flexbox container (`display: flex`).
- **Attributes**:
  - `direction` / `dir`: `row` | `column` | `row-reverse` | `column-reverse`
  - `align`: `start` | `center` | `end` | `stretch` | `baseline`
  - `justify`: `start` | `center` | `end` | `between` | `around` | `evenly`
  - `gap`: Gap in pixels (e.g. `gap="16"`)
  - `wrap`: `true` | `false`

### `<grid>`
CSS Grid container (`display: grid`).
- **Attributes**:
  - `cols` / `columns`: Number of columns (e.g. `cols="3"`) or explicit template string (`cols="1fr 2fr"`).
  - `rows`: Grid rows template.
  - `gap`: Grid gap in pixels.

---

## 🔀 Control Flow & Iteration

### `<for_each>`
Iterates over array state and performs keyed reconciliation.
- **Attributes**:
  - `items` *(required)*: Array state binding (e.g. `items="{data.todos}"`).
  - `var`: Iteration item variable name (e.g. `var="todo"`).
  - `key`: Unique property name for keyed DOM reconciliation (e.g. `key="id"`).
  - `virtual`: `true` | `false` (enables virtual scrolling).
  - `item_height`: Height in pixels per row (required if `virtual="true"`).
  - `viewport_height`: Viewport scroll container height in pixels.

### `<if>` / `<else>`
Conditional DOM rendering.
- **Attributes**:
  - `condition` *(required)*: Boolean expression (e.g. `condition="{data.isLoggedIn}"`).
- **Children**: Template content and optional `<else>` block.

### `<show>` / `<hide>`
Toggles element CSS display visibility without removing it from the DOM tree.
- **Attributes**:
  - `when` *(required)*: Boolean expression (e.g. `when="{data.isVisible}"`).

---

## 🎨 Styling & Design Tokens

### `<constants>` / `<vars>`
Defines reusable CSS class token constants.
- **Children**: `<const id="...">class string</const>`
- **Access Syntax**: `class="{const.card_box}"`

### `<style>`
Embedded CSS stylesheet with automatic unmount cleanup and scoped isolation.
- **Attributes**: `scoped="true"`, `src="..."`

---

## 🧭 Next Reference

Exhaustive binding reference in **[Directives & Bindings Reference](/reference/bindings)**.
