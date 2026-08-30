---
title: The Action System
description: Declarative action dispatching, built-in actions, async requests, and state mutation workflows in EUIX.
order: 1
group: Actions
---

# The Action System

Actions in EUIX represent discrete, declarative state transformations or external operations triggered by user events, lifecycle hooks, or timers.

---

## ⚡ Built-in Action Types

| Action Name | Description | Key Child Tags / Attributes |
| :--- | :--- | :--- |
| **`SET_STATE`** | Updates a state path with a given value or expression. | `<path>`, `<value>` |
| **`MUTATE_STATE`**| Performs granular array operations (`PUSH`, `REMOVE`, `SWAP`, etc.). | `<path>`, `<operation>`, `<value>`, `<where>` |
| **`TOGGLE_STATE`**| Inverts a boolean state value. | `<path>` |
| **`XHR`** / **`FETCH`** | Performs an asynchronous HTTP REST request. | `<url>`, `<method>`, `<target>`, `<body>`, `<headers>` |
| **`REVALIDATE_API`** | Re-executes a registered SWR endpoint by ID or tag. | `tag="..."` |
| **`NAVIGATE`** | Navigates client-side router to a new URL path. | `to="..."`, `replace="true"` |
| **`RUN_SCRIPT`** | Executes sandboxed JavaScript with injected context. | Script body text |

---

## 🛠️ Real-World Multi-Step Action Example

Here is a practical example showing state setting, conditional mutation, and network fetching combined:

```xml
<uid_spec>
  <data_model>
    <state id="isLoading" type="boolean">false</state>
    <state id="errorMessage"></state>
    <state id="articles" type="array">[]</state>
  </data_model>

  <flex direction="column" gap="12">
    <!-- Refresh Button -->
    <button class="btn" disabled="{data.isLoading}">
      <!-- 1. Set loading indicator -->
      <on_click action="SET_STATE">
        <path>data.isLoading</path>
        <value>true</value>
      </on_click>
      
      <!-- 2. Fetch remote articles -->
      <on_click action="XHR">
        <method>GET</method>
        <url>https://api.example.com/articles</url>
        <target>data.articles</target>
      </on_click>
      
      <!-- 3. Reset loading indicator -->
      <on_click action="SET_STATE">
        <path>data.isLoading</path>
        <value>false</value>
      </on_click>

      {data.isLoading ? 'Fetching...' : 'Reload Articles'}
    </button>
  </flex>
</uid_spec>
```

---

## 🧭 Next Step

Learn how to bundle multi-step sequences into reusable named subroutines in **[Action Composer](/actions/composer)**.
