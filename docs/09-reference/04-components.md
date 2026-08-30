---
title: Component Specification Reference
description: Syntax and attribute specification for component definitions, imports, prop contracts, and slot projection.
order: 4
group: Reference
---

# Component Specification Reference

This page defines the formal grammar and attributes for creating, importing, and rendering EUIX components.

---

## 🏗️ `<component_def>` Tag

Defines an inline or modular component template:

```xml
<component_def name="user-badge" isolated="true">
  <data_model>
    <state id="active" type="boolean">false</state>
  </data_model>

  <style scoped="true">
    .badge { padding: 4px 8px; border-radius: 6px; }
  </style>

  <div class="badge">
    <span>{props.username}</span>
    <children />
  </div>
</component_def>
```

### Attributes:
- **`name`** *(required)*: Unique hyphenated or camelCase component name.
- **`isolated`**: `true` | `false` (defaults to `false`). When `true`, creates an independent reactive local state store (`local.*`) unique to each rendered instance.

---

## 🧩 `<component>` Tag

Renders an instance of a registered component:

```xml
<component 
  name="user-badge" 
  username="Morgan" 
  role="Engineer"
>
  <!-- Slot Content injected into <children /> -->
  <span class="badge-tag">Staff</span>
</component>
```

### Attributes:
- **`name`** *(required)*: The registered component definition name.
- **`src`**: Relative or absolute path to an external XML component file (e.g. `src="./components/UserBadge.xml"`).
- **Custom Attributes**: Any custom attributes are passed as reactive props accessible inside the component via `{props.attrName}`.

---

## 📦 Slot Projection Tags

- **`<children />`** or **`<slot />`**: Injects nested elements passed from the parent `<component>` element.

---

## 🧭 Next Reference

View all official plugins in **[Plugin Registry Reference](/reference/plugins)**.
