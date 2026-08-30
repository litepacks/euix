---
title: Slots & Children Projection
description: Projecting nested parent markup and template content into child component slots in EUIX Engine.
order: 3
group: Components
---

# Slots & Children Projection

Slots allow components to act as layout wrappers, projecting parent-provided markup directly into dedicated insertion points.

---

## 📦 Default Slot Projection (`<children />` or `<slot />`)

To insert nested content passed from a parent element, place `<children />` or `<slot />` inside your component definition:

```xml
<!-- 1. Component Definition (Modal Dialog Wrapper) -->
<component_def name="modal-box">
  <div class="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl p-6 shadow-2xl max-w-md w-full">
      <h3 class="text-lg font-bold text-slate-800 mb-2">{props.title}</h3>
      
      <!-- Content passed from parent is injected here -->
      <children />
    </div>
  </div>
</component_def>
```

```xml
<!-- 2. Usage in Parent Template -->
<component name="modal-box" title="Confirm Account Deletion">
  <p class="text-sm text-slate-600 mb-4">
    Are you sure you want to proceed? This action cannot be undone.
  </p>
  <flex direction="row" justify="end" gap="8">
    <button class="btn-cancel">Cancel</button>
    <button class="btn-danger">Delete Permanently</button>
  </flex>
</component>
```

---

## 🖼️ Component Structure Layout

```text
modal-box
├── Header Title ({props.title})
├── <children />  ──► [Injected Parent Markup: <p> + <flex>]
└── Footer Actions
```

---

## 🧭 Next Step

Learn how EUIX isolates state between component instances in **[Scoping & State Isolation](/components/scope)**.
