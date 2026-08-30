---
title: Built-in Actions Reference
description: Comprehensive reference for all built-in EUIX declarative actions and mutation operations.
order: 3
group: Reference
---

# Built-in Actions Reference

EUIX provides declarative action types that execute without writing custom imperative JavaScript.

---

## 📋 Action Types

### 1. `SET_STATE`
Assigns a new value or expression evaluation to a target state path.
```xml
<on_click action="SET_STATE">
  <path>data.counter</path>
  <value>{data.counter + 1}</value>
</on_click>
```

### 2. `MUTATE_STATE`
Performs granular array mutations on collections.
```xml
<on_click action="MUTATE_STATE">
  <path>todos</path>
  <operation>REMOVE</operation>
  <where field="id" equals="{todo.id}" />
</on_click>
```

#### Supported Operations:
- `PUSH` / `APPEND`: Appends item to array.
- `UNSHIFT` / `PREPEND`: Prepends item to array.
- `REMOVE` / `DELETE`: Removes matching item(s).
- `POP`: Removes the last array element.
- `SHIFT`: Removes the first array element.
- `UPDATE`: Modifies fields of items matching `<where>`.
- `SWAP`: Swaps positions by indices.
- `CLEAR`: Empties the array.
- `REVERSE`: Inverts element order.

### 3. `TOGGLE_STATE`
Inverts a boolean state value.
```xml
<on_click action="TOGGLE_STATE">
  <path>data.isMenuOpen</path>
</on_click>
```

### 4. `XHR` / `FETCH`
Dispatches an asynchronous HTTP REST request.
```xml
<on_click action="XHR">
  <method>POST</method>
  <url>https://api.example.com/items</url>
  <body>{"name": "{data.newItemName}"}</body>
  <target>data.items</target>
</on_click>
```

### 5. `REVALIDATE_API`
Triggers immediate re-execution and cache revalidation of a registered SWR endpoint.
```xml
<on_click action="REVALIDATE_API" tag="get_posts" />
```

### 6. `NAVIGATE`
Navigates the SPA router to a specified target URL.
```xml
<on_click action="NAVIGATE" to="/dashboard/settings" replace="false" />
```

### 7. `RUN_SCRIPT`
Executes sandboxed JavaScript with injected context (`$data`, `$el`, `$evt`, `$engine`, `$item`, `$index`, `$args`).
```xml
<on_click action="RUN_SCRIPT">
  console.log("Clicked:", $el, $data.counter);
</on_click>
```

---

## 🧭 Next Reference

Explore component grammar in **[Component Specification Reference](/reference/components)**.
