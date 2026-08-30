---
title: Events & Event Listeners
description: Declarative event handling, supported browser events, event delegation, and event context in EUIX Engine.
order: 3
group: Core Concepts
---

# Events & Event Listeners

EUIX handles DOM events declaratively using child `<on_<event>>` tags placed inside target elements.

---

## 👂 Declarative Event Syntax

Instead of inline JavaScript strings (e.g. `onclick="..."`), event listeners are structured XML tags:

```xml
<button class="btn">
  <on_click action="SET_STATE">
    <path>data.count</path>
    <value>{data.count + 1}</value>
  </on_click>
  Increment
</button>
```

---

## 📋 Supported Event Types

Any standard DOM event name can be prefixed with `on_`:

| Event Tag | Native DOM Event | Common Use Case |
| :--- | :--- | :--- |
| `<on_click>` | `click` | Button clicks, card selections |
| `<on_input>` | `input` | Real-time text filter inputs |
| `<on_change>` | `change` | Select dropdown or checkbox changes |
| `<on_submit>` | `submit` | Form submission handling (auto-prevents default) |
| `<on_keydown>` | `keydown` | Enter key shortcuts, escape handlers |
| `<on_keyup>` | `keyup` | Live search triggering |
| `<on_mouseenter>` | `mouseenter` | Tooltips, hover states |
| `<on_mouseleave>` | `mouseleave` | Hover dismiss |
| `<on_focus>` / `<on_blur>` | `focus` / `blur` | Field validation and focus indicators |

---

## ⚡ Context Variables in Script Actions (`action="RUN_SCRIPT"`)

When executing JavaScript inside `<on_<event> action="RUN_SCRIPT">`, EUIX automatically injects several context variables into the execution scope:

```xml
<button class="btn">
  <on_click action="RUN_SCRIPT">
    console.log("Clicked element:", $el);
    console.log("Native Event:", $evt);
    console.log("Current State:", $data.count);
    
    // Direct mutation
    $data.count += 5;
  </on_click>
  Add 5 (via Script)
</button>
```

### Injected Context Variables:
- **`$evt`**: The native browser `Event` object.
- **`$el`**: The target DOM element firing the event.
- **`$data`**: Direct read/write access to the reactive state proxy.
- **`$engine`**: The current `EUIXEngine` runtime instance.
- **`$item`**: The current iteration item object (when inside `<for_each>`).
- **`$index`**: The current iteration numeric index (`0, 1, 2...`).
- **`$local`**: Isolated component state (for `isolated="true"` components).
- **`$args`**: Parameters passed to an Action Composer subroutine.

---

## 🚀 Event Delegation in `<for_each>` Lists

When rendering repeated lists using `<for_each>`, EUIX automatically attaches a **single delegated listener** at the container level rather than creating individual event listeners for every row:

```xml
<flex direction="column" gap="8">
  <for_each items="{data.todos}" var="todo" key="id">
    <div class="todo-row">
      <span>{todo.title}</span>
      <!-- Delegated click handler -->
      <button class="btn-delete">
        <on_click action="MUTATE_STATE">
          <path>todos</path>
          <operation>REMOVE</operation>
          <where field="id" equals="{todo.id}" />
        </on_click>
        ✕
      </button>
    </div>
  </for_each>
</flex>
```

Even with 10,000 items, only 1 DOM event listener is registered on the parent container, maintaining high memory efficiency and fast rendering speeds.

---

## 🧭 Next Step

Learn about deriving reactive values with **[Computed Values](/core-concepts/computed)**.
