---
title: Plugin System Architecture
description: Extend EUIX without bloating core runtime responsibilities using the modular plugin architecture.
order: 1
group: Plugins
---

# Plugin System Architecture

EUIX is built around a **micro-kernel architecture**. The Lite Core runtime (`euixjs/core`) contains only the foundational XML parser, reactive state proxy, and DOM reconciler.

All additional capabilities—including REST data fetching, modal dialogs, animations, charts, maps, and WebMCP AI agents—are implemented as modular, tree-shakeable plugins.

---

## 🔌 Registering Plugins (`.use()`)

Plugins are registered using the `.use()` method before mounting:

```javascript
import { EUIXEngineCore } from 'euixjs/core';
import { EUIXApiPlugin } from 'euixjs/api';
import { EUIXStoragePlugin } from 'euixjs/storage';
import { EUIXDialogPlugin } from 'euixjs/dialog';

// Register plugins on Lite Core
EUIXEngineCore
  .use(EUIXApiPlugin)
  .use(EUIXStoragePlugin)
  .use(EUIXDialogPlugin);

// Mount your application
const engine = EUIXEngineCore.mount(xmlString, '#app');
```

---

## 🛠️ How EUIX Plugins Work

An EUIX Plugin is an object implementing the plugin contract:

```javascript
export const MyCustomPlugin = {
  name: 'my-custom-plugin',
  
  install(engine, options) {
    // 1. Register custom declarative actions
    engine.registerAction('NOTIFY', async (step, ctx) => {
      alert(step.message || 'Notification');
    });

    // 2. Intercept lifecycle hooks
    engine.on('mount', (instance) => {
      console.log('Component mounted:', instance);
    });

    // 3. Register custom tag renderers
    engine.registerTag('banner', (node, renderer) => {
      const el = document.createElement('div');
      el.className = 'app-banner';
      el.textContent = node.text;
      return el;
    });
  }
};
```

---

## 📦 Available Official Plugins

| Plugin | Subpath Import | Description |
| :--- | :--- | :--- |
| **SWR REST API** | `euixjs/api` | Declarative HTTP client with caching and reactive status. |
| **Storage** | `euixjs/storage` | LocalStorage and SessionStorage state persistence. |
| **Dialog** | `euixjs/dialog` | Accessible modal dialog overlays with focus management. |
| **Collapse** | `euixjs/collapse` | Accordion and collapsible body sections. |
| **Animation** | `euixjs/animation` | CSS keyframe transitions with reduced-motion support. |
| **Chart** | `euixjs/chart` | Declarative Chart.js charts with reactive dataset syncing. |
| **Leaflet Maps** | `euixjs/leaflet` | Interactive GIS maps, markers, and polygon rendering. |
| **Date & Intl** | `euixjs/date` | Internationalization and date formatting helpers. |
| **WebMCP** | `euixjs/webmcp` | Exposes actions as tools to browser AI agents. |
| **Navigator** | `euixjs/navigator`| Hardware capabilities (battery, online status, geolocation). |

---

## 🧭 Next Step

Explore declarative HTTP endpoints in **[SWR REST API Plugin](/plugins/api)**.
