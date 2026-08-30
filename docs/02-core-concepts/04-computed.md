---
title: Computed Values
description: Deriving reactive values automatically from state using the EUIX Reactive Plugin.
order: 4
group: Core Concepts
---

# Computed Values

Computed values allow you to declare derived state properties that automatically recalculate whenever their dependent state variables change.

Computed values are powered by the **Reactive Plugin** (`euixjs/reactive`).

---

## ⚡ Declaring Computed Values (`<computed>`)

Declare computed properties inside your `<data_model>` or at the root of your specification:

```xml
<uid_spec>
  <data_model>
    <state id="firstName">Ada</state>
    <state id="lastName">Lovelace</state>
    <state id="price" type="number">120</state>
    <state id="taxRate" type="number">0.2</state>

    <!-- Computed: Full Name -->
    <computed id="fullName">{data.firstName} + ' ' + {data.lastName}</computed>

    <!-- Computed: Total with Tax -->
    <computed id="totalPrice">{data.price * (1 + data.taxRate)}</computed>
  </data_model>

  <flex direction="column" gap="8">
    <h2>User: {data.fullName}</h2>
    <p>Total Price: ${data.totalPrice}</p>
  </flex>
</uid_spec>
```

When either `firstName` or `lastName` changes, `fullName` recalculates automatically and updates all subscribed DOM nodes.

---

## 📊 State vs Computed vs Watchers

Understanding the distinction between these three primitives is critical for clean application architecture:

| Primitive | Purpose | Can Directly Mutate State? | Triggers Side Effects? |
| :--- | :--- | :--- | :--- |
| **`state`** | Stores the primary mutable source of truth. | Yes (`SET_STATE`, `MUTATE_STATE`) | No |
| **`computed`** | Purely derives a value based on other state values. | No (Read-only derived value) | No (Pure calculation) |
| **`watch`** | Observes state changes and runs side-effect logic. | Yes (Can trigger actions or APIs) | **Yes** (I/O, APIs, storage, logging) |

---

## 💡 When to Use Computed Values

### ✅ Good Use Cases:
- Concatenating user names or formatting labels.
- Calculating cart sub-totals, discounts, and tax values.
- Filtering or sorting lists based on search query state.
- Combining multiple boolean flags (e.g. `isSubmitDisabled = !data.isValid || data.isSubmitting`).

### ❌ Anti-Patterns:
- **Do not make API requests inside computed values.** Use `<watch>` or declarative actions instead.
- **Do not mutate other state variables inside computed expressions.** Computed expressions must be pure.

---

## 🧭 Next Step

Learn how to react to state changes with side effects in **[Watchers](/core-concepts/watchers)**.
