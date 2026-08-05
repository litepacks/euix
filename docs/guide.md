# EUIX Engine - Architecture & Developer Guide (`docs.md`)

Welcome to the **EUIX Engine** developer guide. This guide explains the core architectural principles, state reactivity model, expression parser, and lifecycle hooks.

---

## 🚀 Architectural Principles

1. **Zero Dependencies (0-Dep):** No third-party dependencies or heavy runtime frameworks.
2. **Zero Build Step Required (No-Build):** Runs directly in all modern web browsers via standard DOM APIs.
3. **Fine-Grained In-Place Reactivity:** Uses Proxy-based state observers to update only affected DOM nodes without Virtual DOM diffing overhead.
4. **Declarative Component Model:** HTML/XML templates with custom component imports (`<import src="..." />`) and definitions (`<component_def>`).

---

## 📊 State Management (`<data_model>`)

State is declared inside `<data_model>` using `<state>` nodes:

```xml
<data_model>
    <state id="user_name" type="string">John Doe</state>
    <state id="todos" type="array">
        <item id="1" text="Task 1" completed="false" />
    </state>
</data_model>
```

---

## 🔄 State Operations (`MUTATE_STATE`)

| Operation | Description | Example Tag |
| :--- | :--- | :--- |
| `PUSH` | Appends item to array end | `<operation>PUSH</operation>` |
| `UNSHIFT` / `PREPEND` | Prepends item to array start | `<operation>UNSHIFT</operation>` |
| `UPDATE` | Updates fields matching `<where>` | `<operation>UPDATE</operation>` |
| `REMOVE` | Removes item matching `<where>` | `<operation>REMOVE</operation>` |
| `CLEAR` / `RESET` | Clears all array items | `<operation>CLEAR</operation>` |

---

## 🌐 Declarative Async XHR (`<on_mount>`, `<on_click>`)

```xml
<on_mount action="XHR">
    <method>GET</method>
    <url>https://pokeapi.co/api/v2/pokemon?limit=12</url>
    <select>results</select>
    <target>data.pokemons</target>
    <loading>data.pokemon_loading</loading>
    <error>data.pokemon_error</error>
</on_mount>
```

---

## ⚡ Performance Benchmarks

EUIX Engine provides built-in benchmarking APIs for testing high-throughput DOM operations:

```javascript
// Benchmark 1,000 item render
const report = EUIXEngine.runBenchmark(1000);
console.log(report.durationMs, report.opsPerSec);
```

| Scale | Duration (ms) | Ops/sec |
| :--- | :--- | :--- |
| **1,000 Bulk Render** | ~ 130 ms | ~ 7,600 ops/sec |
| **3,000 Bulk Render** | ~ 240 ms | ~ 12,500 ops/sec |
| **In-place Single State Update** | **0.11 ms** | Instant |
