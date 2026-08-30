---
title: Web Router & Navigation
description: Declarative client-side routing, route loaders, nested outlets, and history management in EUIX.
order: 3
group: Guides
---

# Web Router & Navigation (`euixjs/router`)

The **Router Plugin** brings declarative client-side SPA routing, nested outlets, history stack synchronization, and parameter extraction to EUIX.

---

## 🗺️ Route Definitions (`<router>`)

```xml
<uid_spec>
  <!-- Define Routes -->
  <router base="/">
    <route path="/" component="home-page" />
    <route path="/dashboard" component="dashboard-page" />
    <route path="/projects/:id" component="project-details-page" />
    <route path="*" component="not-found-page" />
  </router>

  <!-- Navigation Bar -->
  <flex direction="row" gap="12" class="p-4 bg-slate-900 text-white">
    <button class="nav-link">
      <on_click action="NAVIGATE" to="/" />
      Home
    </button>
    <button class="nav-link">
      <on_click action="NAVIGATE" to="/dashboard" />
      Dashboard
    </button>
  </flex>

  <!-- Route Outlet (Active Component Renders Here) -->
  <main class="p-6">
    <outlet />
  </main>
</uid_spec>
```

---

## 🧭 Next Step

Learn about web accessibility standards in **[Accessibility Best Practices](/guides/accessibility)**.
