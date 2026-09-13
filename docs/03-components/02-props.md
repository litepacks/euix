---
title: Props & Data Passing
description: Passing static values and reactive state down from parent templates into child components in EUIX.
order: 2
group: Components
---

# Props & Data Passing

Props are attributes passed from a parent template or component into a child component.

---

## 📋 Declaring Prop Contracts (`<param>`)

Inside `<component_def>`, declare prop names, types, defaults, and validation with `<param>`:

```xml
<component_def name="user-badge">
  <param name="username" type="string" required="true" />
  <param name="role" type="string" default="Member" />
  <param name="themeColor" type="string" default="#3b82f6" />
  <param name="priority" type="string" enum="Low,Normal,High" />

  <span style="color: {props.themeColor}">{props.username} ({props.role})</span>
</component_def>
```

| Attribute | Purpose |
|-----------|---------|
| `name` | Prop identifier (accessed as `{props.name}`) |
| `type` | `string`, `number`, `boolean`, `object`, or `array` — runtime coercion + static checks |
| `required` | Parent must pass this prop |
| `default` | Fallback when parent omits the prop |
| `enum` | Comma-separated allowed literal values |

At runtime, EUIX coerces passed values to the declared `type`. **EUIX Doctor** validates prop contracts statically (`EUIX1402` missing required, `EUIX1403` type/enum mismatch).

---

## 📥 Static vs Dynamic Props

Props can receive either static string literals or dynamic reactive expressions:

```xml
<!-- Parent Specification -->
<uid_spec>
  <data_model>
    <state id="activeUser">Alex</state>
    <state id="userRole">Administrator</state>
  </data_model>

  <!-- Static prop ('color') and dynamic props ('username', 'role') -->
  <component 
    name="user-badge" 
    username="{data.activeUser}" 
    role="{data.userRole}" 
    themeColor="#3b82f6" 
  />
</uid_spec>
```

---

## 🏷️ Accessing Props Inside Components (`{props.key}`)

Inside the `<component_def>`, reference input props using the `props.` prefix:

```xml
<component_def name="user-badge">
  <div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200">
    <span class="w-2.5 h-2.5 rounded-full" style="background-color: {props.themeColor};"></span>
    <span class="font-bold text-sm text-slate-800">{props.username}</span>
    <span class="text-xs text-slate-400">({props.role})</span>
  </div>
</component_def>
```

---

## 🔄 Reactive Prop Propagation

When a parent's reactive state changes (e.g. `data.activeUser` changes from `"Alex"` to `"Morgan"`):
1. The prop binding `{data.activeUser}` automatically triggers an update.
2. The child component's `{props.username}` text node updates in place immediately.
3. No child component unmounting or DOM node recreation is required.

---

## 🩺 Validating Props with EUIX Doctor

Doctor cross-checks parent bindings against child `<param>` declarations across files:

```bash
npx euix doctor ./src/App.xml
```

Example — type mismatch Doctor catches before runtime:

```xml
<!-- Parent -->
<state id="user" type="string">Guest</state>
<Header user="{data.user}" />

<!-- Child Header.xml -->
<param name="user" type="object" required="true" />
```

Doctor reports **`EUIX1403`**: prop `user` expects `object`, inferred `string`.

See **[EUIX Doctor — Static Analysis](/guides/doctor-static-analysis)**.

---

## 🧭 Next Step

Learn how to project parent markup into child components in **[Slots & Children Projection](/components/slots)**.
