---
title: WebMCP Browser AI Agent Plugin
description: Expose UI actions and reactive state directly to AI agents via browser WebMCP (document.modelContext).
order: 10
group: Plugins
---

# WebMCP Plugin (`euixjs/webmcp`)

The **WebMCP Plugin** brings first-class Model Context Protocol (MCP) in the browser via `document.modelContext` to EUIX applications.

It allows declarative and imperative exposure of application actions and state as structured tools to browser AI agents without adding external dependencies and with zero overhead when WebMCP is unsupported.

---

## 🎯 Key Architectural Highlights

- **Progressive Enhancement**: Seamlessly degrades on browsers without `document.modelContext`. Applications continue running normally with zero errors.
- **Zero Additional Dependencies**: No heavy MCP SDKs or schemas needed; runs on pure vanilla JavaScript primitives.
- **Unified Action Layer**: Human UI and AI Agents converge on the **exact same EUIX actions and workflows**. No duplicated business logic.
- **Restricted Sandbox**: Exposes a strict, safe execution context without leaking internal engine state.

---

## 🤖 Declarative XML Tool Definitions (`<webmcp>`)

Declare agent tools directly in your XML template:

```xml
<uid_spec>
  <data_model>
    <state id="tasks" type="array">[{"id": 1, "title": "Review PR", "done": false}]</state>
  </data_model>

  <!-- 1. Expose MCP Tools to Browser AI Agents -->
  <webmcp>
    <tool name="add_task" description="Adds a new task to the user task list">
      <param name="title" type="string" description="Task title" required="true" />
      <step action="MUTATE_STATE">
        <path>tasks</path>
        <operation>PUSH</operation>
        <value>{"id": Date.now(), "title": "{args.title}", "done": false}</value>
      </step>
      <return>{"success": true, "message": "Task added successfully"}</return>
    </tool>

    <tool name="toggle_task" description="Toggles task completion status">
      <param name="taskId" type="number" description="Task ID" required="true" />
      <step action="RUN_SCRIPT">
        const task = $data.tasks.find(t => t.id === $args.taskId);
        if (task) task.done = !task.done;
      </step>
    </tool>
  </webmcp>

  <!-- 2. Human UI (uses same tasks array) -->
  <flex direction="column" gap="8" class="p-6">
    <for_each items="{data.tasks}" var="task" key="id">
      <div class="p-2 border rounded flex justify-between">
        <span style="text-decoration: {task.done ? 'line-through' : 'none'}">{task.title}</span>
      </div>
    </for_each>
  </flex>
</uid_spec>
```

---

## 🧭 Next Step

Learn how to interact with device hardware in **[Navigator Plugin](/plugins/navigator)**.
