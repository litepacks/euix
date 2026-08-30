---
title: Collapse & Accordion Plugin
description: Reactive collapsible sections and accordion containers for FAQs, drawers, and compact UI panels.
order: 5
group: Plugins
---

# Collapse Plugin (`euixjs/collapse`)

The **Collapse Plugin** provides reactive collapsible sections and accordion widgets bound to boolean state keys.

---

## 📂 Basic Collapsible Section (`<collapse>`)

```xml
<uid_spec>
  <data_model>
    <state id="faqOpen" type="boolean">false</state>
  </data_model>

  <flex direction="column" gap="12">
    <collapse bind="data.faqOpen" title="What is the EUIX Virtual DOM policy?">
      <p class="text-sm text-slate-600 p-4 bg-slate-50 border-t">
        EUIX does not use a Virtual DOM. It uses fine-grained direct DOM node updates, eliminating full-tree diff and patch overhead.
      </p>
    </collapse>
  </flex>
</uid_spec>
```

---

## 🏷️ Custom Header Summary

You can replace the standard header title text with rich custom HTML using a `<summary>` element:

```xml
<collapse bind="data.sectionOpen" class="border rounded-xl">
  <summary class="flex items-center justify-between p-4 cursor-pointer">
    <span class="font-bold text-slate-800">Advanced Settings</span>
    <span class="text-xs px-2 py-0.5 bg-amber-50 text-amber-600 font-bold rounded">PRO</span>
  </summary>

  <div class="p-4 border-t">
    <label class="flex items-center gap-2">
      <input type="checkbox" bind="enableTelemetry" />
      <span>Enable Telemetry Logs</span>
    </label>
  </div>
</collapse>
```

---

## 🧭 Next Step

Learn about CSS transitions in **[Animation Plugin](/plugins/animation)**.
