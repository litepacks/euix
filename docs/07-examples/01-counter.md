---
title: Interactive Counter Example
description: A clean, step-by-step counter example demonstrating numeric state, expressions, and event actions.
order: 1
group: Examples
---

# Interactive Counter Example

This example demonstrates the core building blocks of EUIX: **numeric state initialization**, **arithmetic expressions**, and **state mutation actions**.

---

## ⚡ Complete Application Code

```xml
<uid_spec>
  <!-- 1. Define reactive numeric state -->
  <data_model>
    <state id="count" type="number">0</state>
    <state id="step" type="number">1</state>
  </data_model>

  <!-- 2. Interactive Widget Layout -->
  <flex direction="column" gap="16" class="p-6 bg-white rounded-2xl shadow-xl border border-slate-100 max-w-sm">
    <div class="text-center">
      <span class="text-xs font-bold text-slate-400 uppercase tracking-wider">Current Count</span>
      <h1 class="text-4xl font-extrabold text-slate-800 my-1">{data.count}</h1>
      <span class="text-xs text-slate-500">Step size: {data.step}</span>
    </div>

    <!-- Step Selector Controls -->
    <flex direction="row" justify="center" gap="8">
      <button class="px-3 py-1 text-xs rounded font-bold {data.step === 1 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}">
        <on_click action="SET_STATE"><path>data.step</path><value>1</value></on_click>
        Step 1
      </button>
      <button class="px-3 py-1 text-xs rounded font-bold {data.step === 5 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}">
        <on_click action="SET_STATE"><path>data.step</path><value>5</value></on_click>
        Step 5
      </button>
      <button class="px-3 py-1 text-xs rounded font-bold {data.step === 10 ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}">
        <on_click action="SET_STATE"><path>data.step</path><value>10</value></on_click>
        Step 10
      </button>
    </flex>

    <!-- Increment & Decrement Buttons -->
    <flex direction="row" gap="8">
      <button class="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-sm transition-colors cursor-pointer">
        <on_click action="SET_STATE">
          <path>data.count</path>
          <value>{data.count - data.step}</value>
        </on_click>
        - Decrement
      </button>
      
      <button class="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer shadow-lg shadow-blue-500/20">
        <on_click action="SET_STATE">
          <path>data.count</path>
          <value>{data.count + data.step}</value>
        </on_click>
        + Increment
      </button>
    </flex>
  </flex>
</uid_spec>
```

---

## 🔍 How It Works

1. **Explicit Numeric Typing**: `<state id="count" type="number">0</state>` guarantees that expressions like `{data.count + data.step}` evaluate arithmetically rather than as strings.
2. **Targeted DOM Patching**: Only the text node rendering `{data.count}` updates on click.

---

## 🧭 Next Example

Check out the full CRUD workflow in **[Task Dashboard Example](/examples/task-dashboard)**.
