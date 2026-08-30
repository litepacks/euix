---
title: Dialog Plugin
description: Declarative modal dialog overlays with focus management, backdrop dismiss, and Escape key handling.
order: 4
group: Plugins
---

# Dialog Plugin (`euixjs/dialog`)

The **Dialog Plugin** provides accessible modal dialog overlays managed by reactive boolean state.

---

## 🪟 Declarative Modal Usage (`<dialog>`)

```xml
<uid_spec>
  <data_model>
    <state id="isConfirmOpen" type="boolean">false</state>
  </data_model>

  <flex direction="column" gap="12">
    <button class="btn">
      <on_click action="SET_STATE">
        <path>data.isConfirmOpen</path>
        <value>true</value>
      </on_click>
      Open Confirmation Modal
    </button>

    <!-- Modal Dialog Definition -->
    <dialog bind="data.isConfirmOpen" title="Confirm Delete">
      <p class="text-sm text-slate-600 mb-4">
        Are you sure you want to delete this project? This action cannot be reversed.
      </p>

      <flex direction="row" justify="end" gap="8">
        <button class="btn-cancel">
          <on_click action="SET_STATE">
            <path>data.isConfirmOpen</path>
            <value>false</value>
          </on_click>
          Cancel
        </button>

        <button class="btn-danger">
          <on_click action="SET_STATE">
            <path>data.isConfirmOpen</path>
            <value>false</value>
          </on_click>
          Confirm Delete
        </button>
      </flex>
    </dialog>
  </flex>
</uid_spec>
```

---

## ♿ Accessibility & Interaction Features

- **Keyboard Escape Key**: Pressing `Escape` automatically sets the bound state to `false` and dismisses the dialog.
- **Backdrop Click**: Clicking outside the modal content on the backdrop overlay dismisses the dialog (can be disabled via `close_on_backdrop="false"`).
- **Focus Management & Trapping**: Focus is shifted to the modal upon opening and restored to the trigger element upon closing.
- **Screen Reader Semantics**: Renders with `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` linked to the modal title.

---

## 🧭 Next Step

Learn about collapsible sections in **[Collapse Plugin](/plugins/collapse)**.
