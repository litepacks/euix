---
title: Watchers
description: Executing side effects, API revalidations, and external library sync when state mutations occur.
order: 5
group: Core Concepts
---

# Watchers & Side Effects

Watchers allow you to execute side effects—such as triggering API requests, persisting settings, or logging telemetry—whenever specific state variables change.

---

## 1. Declarative XML Watchers

You can declare watchers inside your XML template using `<watch>` (via `euixjs/reactive`) or `<on_state_change>`:

```xml
<uid_spec>
  <data_model>
    <state id="search_query">reactivity</state>
    <state id="search_results" type="array">[]</state>
  </data_model>

  <!-- 1. Trigger an API Revalidation or XHR on State Change -->
  <watch target="data.search_query" action="XHR">
    <url>https://api.example.com/search?q={data.search_query}</url>
    <target>data.search_results</target>
  </watch>

  <!-- 2. Execute a Sandboxed Script on State Change -->
  <on_state_change key="search_query" action="RUN_SCRIPT">
    console.log("Search query updated to:", $data.search_query);
  </on_state_change>

  <flex direction="column" gap="12">
    <input bind="search_query" placeholder="Type to search..." class="input" />
    <for_each items="{data.search_results}" var="res">
      <div>{res.title}</div>
    </for_each>
  </flex>
</uid_spec>
```

---

## 2. Programmatic JavaScript Watchers

You can also register watchers imperatively from JavaScript using `engine.watch()` or `engine.onStateChange()`:

```javascript
// 1. Watch a specific state key
const unwatch = engine.watch('search_query', (newValue, oldValue) => {
  console.log(`Query changed from "${oldValue}" to "${newValue}"`);
  
  // Example: Track search event in analytics
  analytics.track('Search', { query: newValue });
});

// 2. Watch ALL state mutations across the application
const unwatchGlobal = engine.onStateChange((key, newValue, oldValue) => {
  console.log(`[State Audit] ${key}:`, { from: oldValue, to: newValue });
});

// Cleanup when no longer needed
unwatch();
unwatchGlobal();
```

---

## 🎯 Best Practices for Watchers

### ✅ Recommended Patterns:
- **Debounced / Live Search**: Trigger backend search queries when a search input state changes.
- **External Library Synchronization**: Update a third-party Map (Leaflet) or Chart (Chart.js) instance when underlying coordinate or series state changes.
- **Analytics & Telemetry**: Send page interaction logs when specific critical state variables mutate.

### ⚠️ When NOT to Use Watchers:
If your goal is simply to format a string or calculate a total from other variables, use **`<computed>`** instead of manually mutating state inside a watcher.

---

## 🧭 Next Step

Explore input forms and two-way binding in **[Forms & Two-Way Binding](/core-concepts/forms)**.
