---
title: Directives & Bindings Reference
description: Complete reference for expression interpolation, scope prefixes, and two-way form directives.
order: 2
group: Reference
---

# Directives & Bindings Reference

This page provides an exhaustive syntax specification for all data bindings and template expressions supported in EUIX Engine.

---

## 🏷️ Expression Syntax (`{...}`)

Expressions enclosed in `{...}` are evaluated dynamically against reactive state and execution scope:

```xml
<!-- 1. State Value Access -->
<span>{data.username}</span>

<!-- 2. Mathematical Operations (Preserves numeric types) -->
<span>{data.counter + 1}</span>
<span>{data.price * (1 + data.taxRate)}</span>

<!-- 3. Array & Object Properties -->
<span>Total: {data.items.length}</span>
<span>Role: {data.user.role}</span>

<!-- 4. Ternary & Boolean Expressions -->
<span>Status: {data.isActive ? 'Online' : 'Offline'}</span>
<div class="card {data.isHighlighted ? 'active' : ''}"></div>
```

---

## 🎯 Scope Prefixes

| Scope Prefix | Target Data Store | Example |
| :--- | :--- | :--- |
| `data.` | Root reactive application state (`<data_model>`) | `{data.count}`, `{data.user.email}` |
| `props.` | Input props passed into a `<component_def>` | `{props.title}`, `{props.theme}` |
| `local.` | Isolated component-private state store (`isolated="true"`) | `{local.isOpen}`, `{local.step}` |
| `const.` / `vars.` | Static design tokens declared in `<constants>` | `class="{const.btn_primary}"` |
| `api.` | Reactive SWR request status and data payload | `{api.get_posts.loading}`, `{api.get_posts.data}` |
| `<var>` | Iteration item in `<for_each var="item">` | `{item.title}`, `{item.id}` |
| `$index` | Current integer index in `<for_each>` loop | `Row #{ $index + 1 }` |

---

## 📝 Two-Way Form Directives (`bind="..."`)

| HTML Input Element | Bound State Type | Behavior |
| :--- | :--- | :--- |
| `<input type="text" bind="name">` | `string` | Updates on every input/keystroke. |
| `<input type="number" bind="age">` | `number` | Coerced to native JS number. |
| `<input type="checkbox" bind="done">` | `boolean` | Synchronized to checkbox `checked` boolean. |
| `<textarea bind="bio">` | `string` | Updates on text input. |
| `<select bind="role">` | `string` | Synchronized to selected `<option value="...">`. |
| `<input bind="user.address.city">` | `string` (nested) | Modifies nested object property reactively. |

---

## 🧭 Next Reference

Explore action specifications in **[Built-in Actions Reference](/reference/actions)**.
