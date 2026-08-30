---
title: Lifecycle Hooks
description: Declarative component and element lifecycle hooks including mount, unmount, timer intervals, and visibility triggers.
order: 5
group: Components
---

# Lifecycle Hooks

EUIX provides declarative lifecycle tags embedded directly in XML specifications to manage component initialization, recurring timers, state watchers, and DOM cleanup.

---

## 📋 Lifecycle Hook Reference

### 1. `<on_mount>`
Executes actions immediately when the component or element is inserted into the DOM:

```xml
<component_def name="user-profile">
  <!-- Fetch data on mount -->
  <on_mount action="XHR">
    <method>GET</method>
    <url>https://api.example.com/user/profile</url>
    <target>data.profile</target>
  </on_mount>

  <div>
    <h2>{data.profile.name}</h2>
  </div>
</component_def>
```

### 2. `<on_unmount>`
Executes cleanup logic when the component or DOM element is removed:

```xml
<on_unmount action="RUN_SCRIPT">
  console.log("Cleaning up resources for component unmount.");
</on_unmount>
```

### 3. `<on_interval ms="...">`
Executes recurring actions on a timer interval. Intervals are **automatically cleared** when the parent component unmounts:

```xml
<!-- Poll server status every 5 seconds -->
<on_interval ms="5000" action="XHR">
  <method>GET</method>
  <url>https://api.example.com/health</url>
  <target>data.serverHealth</target>
</on_interval>
```

### 4. `<on_visible>` (Lazy Viewport Intersection)
Triggers actions only when the element scrolls into view via browser `IntersectionObserver`:

```xml
<!-- Lazy load comments only when user scrolls down to them -->
<on_visible action="XHR">
  <url>https://api.example.com/comments?post_id={props.postId}</url>
  <target>data.comments</target>
</on_visible>
```

---

## 🧭 Next Section: Actions & Workflows

Learn how to create structured subroutines and workflows in **[The Action System](/actions/actions)**.
