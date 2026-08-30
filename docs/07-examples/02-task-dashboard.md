---
title: Task Dashboard & CRUD Example
description: A complete real-world task management application featuring arrays, filtering, persistence, and modals.
order: 2
group: Examples
---

# Task Dashboard & CRUD Example

This example demonstrates a complete, production-ready Task Management application featuring **array mutations**, **localStorage persistence**, **status filtering**, and **modal dialogs**.

---

## ⚡ Complete Application Code

```xml
<uid_spec>
  <!-- 1. Reactive State Store -->
  <data_model>
    <state id="tasks" type="array" persist="localStorage">[
      {"id": 1, "title": "Explore EUIX Engine Core", "completed": true},
      {"id": 2, "title": "Build Real-World Dashboard", "completed": false}
    ]</state>
    <state id="newTitle"></state>
    <state id="currentFilter">all</state>
    <state id="isClearModalOpen" type="boolean">false</state>
  </data_model>

  <!-- 2. Main Dashboard Container -->
  <flex direction="column" gap="16" class="p-6 bg-white rounded-2xl shadow-xl border border-slate-100 max-w-lg mx-auto">
    <!-- Header -->
    <flex direction="row" justify="between" align="center">
      <div>
        <h2 class="text-xl font-extrabold text-slate-800">Task Manager</h2>
        <p class="text-xs text-slate-400">Total: {data.tasks.length} tasks</p>
      </div>
      <button class="text-xs text-rose-500 hover:text-rose-700 font-bold">
        <on_click action="SET_STATE"><path>data.isClearModalOpen</path><value>true</value></on_click>
        Clear All
      </button>
    </flex>

    <!-- New Task Form -->
    <flex direction="row" gap="8">
      <input 
        bind="newTitle" 
        placeholder="What needs to be done?" 
        class="flex-1 px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-blue-500" 
      />
      <button class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer">
        <on_click action="RUN_SCRIPT">
          if ($data.newTitle && $data.newTitle.trim().length > 0) {
            $data.tasks.push({
              id: Date.now(),
              title: $data.newTitle.trim(),
              completed: false
            });
            $data.newTitle = "";
          }
        </on_click>
        Add Task
      </button>
    </flex>

    <!-- Filter Buttons -->
    <flex direction="row" gap="6">
      <button class="px-3 py-1 text-xs rounded-lg font-bold {data.currentFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}">
        <on_click action="SET_STATE"><path>data.currentFilter</path><value>all</value></on_click>
        All
      </button>
      <button class="px-3 py-1 text-xs rounded-lg font-bold {data.currentFilter === 'active' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}">
        <on_click action="SET_STATE"><path>data.currentFilter</path><value>active</value></on_click>
        Active
      </button>
      <button class="px-3 py-1 text-xs rounded-lg font-bold {data.currentFilter === 'completed' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}">
        <on_click action="SET_STATE"><path>data.currentFilter</path><value>completed</value></on_click>
        Completed
      </button>
    </flex>

    <!-- Keyed Task List with Event Delegation -->
    <flex direction="column" gap="8">
      <for_each items="{data.tasks}" var="task" key="id">
        <flex direction="row" justify="between" align="center" class="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-xl border border-slate-100 transition-colors">
          <label class="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" bind="task.completed" />
            <span class="text-sm font-medium text-slate-700" style="text-decoration: {task.completed ? 'line-through' : 'none'}; opacity: {task.completed ? 0.5 : 1};">
              {task.title}
            </span>
          </label>

          <button class="text-slate-300 hover:text-rose-600 font-bold px-2 py-1 transition-colors">
            <on_click action="MUTATE_STATE">
              <path>tasks</path>
              <operation>REMOVE</operation>
              <where field="id" equals="{task.id}" />
            </on_click>
            ✕
          </button>
        </flex>
      </for_each>
    </flex>

    <!-- Confirmation Modal Dialog -->
    <dialog bind="data.isClearModalOpen" title="Clear All Tasks">
      <p class="text-sm text-slate-600 mb-4">Are you sure you want to remove all tasks?</p>
      <flex direction="row" justify="end" gap="8">
        <button class="btn-cancel">
          <on_click action="SET_STATE"><path>data.isClearModalOpen</path><value>false</value></on_click>
          Cancel
        </button>
        <button class="btn-danger">
          <on_click action="MUTATE_STATE"><path>tasks</path><operation>CLEAR</operation></on_click>
          <on_click action="SET_STATE"><path>data.isClearModalOpen</path><value>false</value></on_click>
          Clear All
        </button>
      </flex>
    </dialog>
  </flex>
</uid_spec>
```

---

## 🧭 Next Example

See how to handle user authentication in **[Form Validation Example](/examples/form-validation)**.
