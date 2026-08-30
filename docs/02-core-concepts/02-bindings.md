---
title: Data Bindings
description: Complete reference for text interpolation, attribute bindings, class/style toggles, and two-way form bindings in EUIX.
order: 2
group: Core Concepts
---

# Data Bindings

Bindings connect reactive data in your `<data_model>` to the DOM. EUIX supports fine-grained one-way interpolation, dynamic attributes, and two-way form bindings.

---

## 1. Text Interpolation (`{expression}`)

Wrap any JavaScript expression in curly braces `{...}` to insert dynamic values into text content:

```xml
<!-- Simple state value -->
<p>Welcome, {data.username}!</p>

<!-- Arithmetic & expressions -->
<span>Next count: {data.counter + 1}</span>

<!-- Array length & properties -->
<span>Total items: {data.items.length}</span>

<!-- Ternary / conditional text -->
<span>Status: {data.isOnline ? 'Active' : 'Offline'}</span>
```

---

## 2. Dynamic Attribute Binding

Place expressions inside any standard HTML attribute:

```xml
<!-- Dynamic href & src -->
<a href="https://example.com/users/{data.userId}">User Profile</a>
<img src="{data.avatarUrl}" alt="{data.username}" />

<!-- Boolean / Conditional attributes (disabled, readonly, checked) -->
<button disabled="{data.isSubmitting}">Submit Form</button>
<input type="text" readonly="{data.isLocked}" />
```

---

## 3. Dynamic Class & Style Bindings

EUIX evaluates dynamic expressions directly within `class` and `style` attributes:

```xml
<!-- Dynamic Class Concatenation -->
<div class="card {data.isActive ? 'border-blue-500 shadow-lg' : 'border-slate-200'}">
  <h3>Card Title</h3>
</div>

<!-- Dynamic Inline Styles -->
<div style="background-color: {data.themeColor}; opacity: {data.isLoading ? 0.5 : 1};">
  <p>Themed Container</p>
</div>
```

---

## 4. Two-Way Data Binding (`bind="..."`)

The `bind` attribute synchronizes form inputs bidirectionally with a state variable:

```xml
<!-- 1. Text Inputs & Textareas -->
<input bind="username" placeholder="Enter username" />
<textarea bind="biography"></textarea>

<!-- 2. Checkboxes (Boolean binding) -->
<input type="checkbox" bind="isTermsAccepted" />

<!-- 3. Nested Object Property Binding -->
<input bind="user.email" placeholder="user@example.com" />

<!-- 4. Select Dropdowns -->
<select bind="selectedRole">
  <option value="viewer">Viewer</option>
  <option value="editor">Editor</option>
  <option value="admin">Admin</option>
</select>
```

When the user types in the input or selects an option:
1. The corresponding state variable updates immediately in the reactive store.
2. Any other DOM node displaying that variable updates in real-time.

---

## 5. Scope Prefix Reference

When writing expressions inside `{...}`, prefix the variable with its scope:

| Prefix | Scope Target | Example Expression |
| :--- | :--- | :--- |
| **`data.`** | Root reactive state store | `{data.counter}`, `{data.items.length}` |
| **`props.`** | Component input properties | `{props.title}`, `{props.disabled}` |
| **`local.`** | Isolated component local state (`isolated="true"`) | `{local.isOpen}`, `{local.step}` |
| **`const.`** | Defined design token constants (`<constants>`) | `class="{const.btn_primary}"` |
| **`api.`** | Reactive SWR API endpoint status | `{api.get_users.loading}`, `{api.get_users.data}` |
| **`<var>`** | Current item in `<for_each var="task">` | `{task.title}`, `{task.id}` |
| **`$index`** | Current zero-based loop index in `<for_each>` | `Item #{ $index + 1 }` |

---

## 🧭 Next Step

Explore how to respond to user interactions in **[Events](/core-concepts/events)**.
