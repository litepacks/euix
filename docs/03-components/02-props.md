---
title: Props & Data Passing
description: Passing static values and reactive state down from parent templates into child components in EUIX.
order: 2
group: Components
---

# Props & Data Passing

Props are attributes passed from a parent template or component into a child component.

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

## 🧭 Next Step

Learn how to project parent markup into child components in **[Slots & Children Projection](/components/slots)**.
