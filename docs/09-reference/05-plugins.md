---
title: Plugin Registry Reference
description: Registry of all official plugins, subpath package exports, and plugin capabilities in EUIX Engine.
order: 5
group: Reference
---

# Plugin Registry Reference

This table provides a complete index of all official EUIX plugins, their import paths, and core capabilities.

---

## 📦 Official Plugin Matrix

| Plugin Name | NPM Subpath | Description | Key XML Tags |
| :--- | :--- | :--- | :--- |
| **API Client** | `euixjs/api` | Declarative SWR REST API client with offline queuing. | `<api_config>`, `<api_endpoint>` |
| **Composer** | `euixjs/composer` | Multi-step action workflow engine with parameters. | `<actions>`, `<action_def>`, `<step>` |
| **Storage** | `euixjs/storage` | LocalStorage & SessionStorage state persistence. | `<state persist="local">` |
| **Dialog** | `euixjs/dialog` | Accessible modal dialog with focus trapping and ESC key. | `<dialog>` |
| **Collapse** | `euixjs/collapse` | Reactive collapsible accordion sections. | `<collapse>` |
| **Animation** | `euixjs/animation` | CSS keyframe transitions with reduced-motion support. | `<animate>`, `<on_enter>`, `<on_leave>` |
| **Chart** | `euixjs/chart` | Chart.js visual charting integration with reactive data. | `<chart>` |
| **Leaflet** | `euixjs/leaflet` | Leaflet GIS interactive maps, markers, and layers. | `<leaflet_map>`, `<marker>` |
| **Date & Intl**| `euixjs/date` | Localized date formatting and relative time calculations. | `$date.format()`, `$date.fromNow()` |
| **WebMCP** | `euixjs/webmcp` | Exposes actions as tools to browser AI agents via MCP. | `<webmcp>`, `<tool>` |
| **Navigator** | `euixjs/navigator` | Hardware capabilities (battery, online status, geo). | `<navigator_config>` |
| **Drag & Drop**| `euixjs/dnd` | HTML5 & Pointer Drag and Drop engine. | `<draggable>`, `<dropzone>` |
| **Head / Helmet**| `euixjs/head` | Document title, meta tags, and Open Graph manager. | `<head>`, `<title>`, `<meta>` |
| **Router** | `euixjs/router` | Declarative client-side SPA routing and nested outlets. | `<router>`, `<route>`, `<outlet>` |
| **Inspector** | `euixjs/inspector` | Stable test ID generator, component visualizer, logs. | `euixjs/inspector` |
| **DevTools** | `euixjs/devtools` | Floating visual state tree and action timeline inspector. | `EUIXDevTools.init(engine)` |

---

## 🧭 Next Reference

Explore the JavaScript API in **[Runtime JavaScript API Reference](/reference/runtime-api)**.
