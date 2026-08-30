---
title: Component Basics
description: Reusable UI component definitions, imports, and composition in EUIX Engine.
order: 1
group: Components
---

# Component Basics

Components in EUIX allow you to encapsulate layout, styles, scoped state, and behavior into reusable modular units.

---

## 🏗️ Defining a Component (`<component_def>`)

Components are declared using `<component_def>` tags with a required `name` attribute:

```xml
<!-- Define the UserCard Component -->
<component_def name="user-card">
  <data_model>
    <state id="isExpanded" type="boolean">false</state>
  </data_model>

  <flex direction="column" class="p-4 bg-white rounded-xl shadow border border-slate-100">
    <flex direction="row" justify="between" align="center">
      <h3 class="font-bold text-slate-800">{props.title}</h3>
      <span class="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded font-semibold">{props.role}</span>
    </flex>

    <button class="mt-2 text-xs text-blue-600 font-semibold text-left cursor-pointer">
      <on_click action="SET_STATE">
        <path>local.isExpanded</path>
        <value>{!local.isExpanded}</value>
      </on_click>
      {local.isExpanded ? 'Hide Bio' : 'Show Bio'}
    </button>

    <if condition="{local.isExpanded}">
      <p class="mt-2 text-xs text-slate-500">{props.bio}</p>
    </if>
  </flex>
</component_def>
```

---

## 🧩 Using a Component (`<component>`)

Once defined, invoke the component anywhere in your template using `<component name="...">`:

```xml
<uid_spec>
  <!-- Render multiple UserCard instances -->
  <grid cols="2" gap="16">
    <component 
      name="user-card" 
      title="Ada Lovelace" 
      role="Mathematician" 
      bio="Pioneer of computer algorithms." 
    />
    <component 
      name="user-card" 
      title="Alan Turing" 
      role="Cryptanalyst" 
      bio="Father of modern theoretical computer science." 
    />
  </grid>
</uid_spec>
```

---

## 📂 Loading External Component Files (`src="..."`)

You can keep components in separate `.xml` or `.euix` files and import them dynamically:

```xml
<uid_spec>
  <!-- Load component asynchronously from local file or URL -->
  <component 
    name="dashboard-header" 
    src="./components/DashboardHeader.xml" 
    brand="EUIX Portal" 
  />
</uid_spec>
```

---

## 🧭 Next Step

Learn how to pass and bind dynamic data to components in **[Props & Prop Scoping](/components/props)**.
