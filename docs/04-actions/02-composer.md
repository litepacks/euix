---
title: Action Composer Workflows
description: Define reusable named action subroutines with parameters, steps, and return values using Action Composer.
order: 2
group: Actions
---

# Action Composer Workflows

The **Action Composer Plugin** (`euixjs/composer`) enables you to define reusable, named multi-step action subroutines with parameter validation, sequential step execution, and return values.

---

## 🛠️ Defining a Workflow (`<action_def>`)

Workflows are declared inside an `<actions>` block:

```xml
<uid_spec>
  <actions>
    <action_def name="CreateTaskWorkflow">
      <!-- 1. Parameter Declarations & Validation -->
      <param name="taskTitle" required="true" />
      <param name="priority" default="medium" />

      <!-- 2. Sequential Steps -->
      <step action="SET_STATE">
        <path>data.isSaving</path>
        <value>true</value>
      </step>

      <step action="MUTATE_STATE">
        <path>tasks</path>
        <operation>PUSH</operation>
        <value>{"id": Date.now(), "title": "{args.taskTitle}", "priority": "{args.priority}", "done": false}</value>
      </step>

      <step action="SET_STATE">
        <path>data.isSaving</path>
        <value>false</value>
      </step>

      <!-- 3. Return Expression -->
      <return>{args.taskTitle}</return>
    </action_def>
  </actions>

  <!-- UI Triggering the Workflow -->
  <flex direction="column" gap="8">
    <button class="btn">
      <on_click action="CreateTaskWorkflow">
        <arg name="taskTitle">Write EUIX Documentation</arg>
        <arg name="priority">high</arg>
      </on_click>
      Add High Priority Task
    </button>
  </flex>
</uid_spec>
```

---

## 💻 Programmatic Workflow Execution

Composed actions can also be executed directly from JavaScript:

```javascript
// Execute named action workflow with parameters
const result = await engine.executeAction('CreateTaskWorkflow', {
  taskTitle: 'Review Pull Request',
  priority: 'urgent'
});

console.log('Task created:', result);
```

---

## 🧭 Next Step

Learn how to handle network errors and retries in **[Error Handling & Resilience](/actions/error-handling)**.
