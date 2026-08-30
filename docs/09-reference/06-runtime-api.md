---
title: Runtime JavaScript API Reference
description: Imperative JavaScript methods, mounting controls, state readers, and event listeners on the EUIX engine instance.
order: 6
group: Reference
---

# Runtime JavaScript API Reference

This page documents the programmatic JavaScript methods available on `EUIXEngineCore`, `EUIXEngine`, and active engine instances.

---

## 🚀 Static Methods

### `EUIXEngine.mount(xmlString, targetElement, options)`
Parses the XML specification and mounts the application into the target DOM element.
- **Returns**: `EngineInstance`

### `EUIXEngineCore.use(plugin, options)`
Registers an official or custom plugin onto the Lite Core engine.
- **Returns**: `EUIXEngineCore` (chainable)

---

## 💻 Instance Methods

### State Management
- **`engine.getState(path)`**: Retrieves the current value of a state key (e.g. `engine.getState('counter')`).
- **`engine.setState(path, value)`**: Updates a reactive state value and triggers batched DOM reconciliation.
- **`engine.mutateState(path, operation, value, whereCondition)`**: Granularly mutates an array state variable.

### Action Execution
- **`engine.executeAction(actionName, args)`**: Asynchronously executes a composed action workflow or built-in action.

### Observability & Watchers
- **`engine.watch(path, callback)`**: Registers a change listener for a specific state key. Returns an `unwatch()` function.
- **`engine.onStateChange(callback)`**: Registers a global listener for all state mutations.

### API & Cache Control
- **`engine.revalidateApi(tagOrId)`**: Immediately re-executes an SWR endpoint and refreshes dependent bindings.
- **`engine.getApiStatus(endpointId)`**: Returns `{ loading, error, status, data, timestamp }`.
- **`engine.clearApiCache(tagOrUrl)`**: Invalidates cached SWR response payloads.

### Lifecycle & Cleanup
- **`engine.unmount()`**: Removes the application from the DOM, clears all timers, unregisters observers, and dispatches `<on_unmount>` hooks.

---

## 🧭 Next Reference

Explore CLI commands in **[CLI & Compiler Tooling Reference](/reference/cli-tooling)**.
