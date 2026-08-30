---
title: State Management
description: Defining, reading, and mutating reactive state with explicit types in EUIX Engine.
order: 1
group: Core Concepts
---

# State Management

In EUIX, reactive state is declared inside the `<data_model>` block using `<state>` elements.

---

## 📋 Declaring State

State elements require an `id` attribute and can specify an optional `type` attribute:

```xml
<uid_spec>
  <data_model>
    <!-- Primitives -->
    <state id="username" type="string">Guest</state>
    <state id="counter" type="number">0</state>
    <state id="isActive" type="boolean">true</state>

    <!-- Complex Collections -->
    <state id="items" type="array">[{"id": 1, "title": "Buy milk"}]</state>
    <state id="settings" type="object">{"theme": "dark", "notifications": true}</state>
  </data_model>

  <!-- Markup using state -->
  <p>User: {data.username}</p>
  <p>Count: {data.counter}</p>
</uid_spec>
```

---

## 🏷️ Supported State Data Types

| Data Type | Example Declaration | Runtime Parsing & Behavior |
| :--- | :--- | :--- |
| **`number`** | `<state id="count" type="number">0</state>` | Parsed into a native JavaScript `number`. Math expressions (`{data.count + 1}`) evaluate numerically without string concatenation. |
| **`string`** | `<state id="name" type="string">Alex</state>` | Default type if omitted. Supports string interpolation (`{data.name}`). |
| **`boolean`** | `<state id="isOpen" type="boolean">false</state>` | Parsed into native boolean `true` or `false`. Toggleable via boolean actions and expressions. |
| **`array`** | `<state id="todos" type="array">[]</state>` | Parsed into a JavaScript Array. Renders via `<for_each>` and supports array mutation operations (`PUSH`, `REMOVE`, `SWAP`, etc.). |
| **`object`** | `<state id="user" type="object">{"role": "admin"}</state>` | Parsed into a JavaScript Object. Property access via dot notation (`{data.user.role}`). |

> [!IMPORTANT]
> **Numeric State Best Practice**:
> Always specify `type="number"` for numeric variables. This guarantees that actions like `SET_STATE` evaluate mathematical expressions (e.g. `{data.counter + 1}`) numerically rather than performing string concatenation (`"01"`).

---

## ✏️ Mutating State Declaratively

### 1. Simple Assignment (`SET_STATE`)

Use `SET_STATE` to assign a new value or evaluate an expression against existing state:

```xml
<button class="btn">
  <on_click action="SET_STATE">
    <path>data.counter</path>
    <value>{data.counter + 1}</value>
  </on_click>
  Increment
</button>
```

### 2. Array Operations (`MUTATE_STATE`)

For arrays, EUIX provides dedicated array operations that avoid full-array replacement:

```xml
<!-- 1. PUSH / ADD -->
<button class="btn">
  <on_click action="MUTATE_STATE">
    <path>items</path>
    <operation>PUSH</operation>
    <value>{"id": 3, "title": "New Item"}</value>
  </on_click>
  Add Item
</button>

<!-- 2. REMOVE with Condition -->
<button class="btn-danger">
  <on_click action="MUTATE_STATE">
    <path>items</path>
    <operation>REMOVE</operation>
    <where field="id" equals="{item.id}" />
  </on_click>
  Delete Item
</button>

<!-- 3. CLEAR -->
<button class="btn-secondary">
  <on_click action="MUTATE_STATE">
    <path>items</path>
    <operation>CLEAR</operation>
  </on_click>
  Clear All
</button>
```

Supported `MUTATE_STATE` operations include:
- `PUSH` / `APPEND`: Append an item to the end of the array.
- `UNSHIFT` / `PREPEND`: Add an item to the beginning of the array.
- `REMOVE` / `DELETE`: Remove items matching a `<where>` condition or index.
- `POP`: Remove the last item.
- `SHIFT`: Remove the first item.
- `UPDATE`: Update properties of items matching a condition.
- `SWAP`: Swap positions of two items by index.
- `REVERSE`: Reverse array order.
- `CLEAR`: Empty the entire array.

---

## 💻 Programmatic State API (JavaScript)

You can also read, update, and observe state programmatically from JavaScript:

```javascript
// Read state
const count = engine.getState('counter');
console.log('Current count:', count);

// Set state
engine.setState('counter', 10);

// Mutate array
engine.mutateState('items', 'PUSH', { id: Date.now(), title: 'Task' });

// Global state mutation listener
const unsubscribe = engine.onStateChange((key, newValue, oldValue) => {
  console.log(`State "${key}" changed from`, oldValue, 'to', newValue);
});
```

---

## ⚡ State Mutation Batching

EUIX batches rapid synchronous state updates using microtasks (`queueMicrotask`).

```javascript
// These 3 updates execute in the same synchronous frame:
engine.setState('counter', 1);
engine.setState('counter', 2);
engine.setState('counter', 3);

// The DOM will update only ONCE to "3" on the next microtask tick.
```

---

## 🧭 Next Step

Learn how to connect state to HTML elements with **[Bindings](/core-concepts/bindings)**.
