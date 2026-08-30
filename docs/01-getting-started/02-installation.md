---
title: Installation
description: Supported installation methods for EUIX Engine including CDN, NPM, and modular ESM subpath imports.
order: 2
group: Getting Started
---

# Installation

EUIX Engine supports multiple integration paths:
1. **Direct Browser Script (CDN / UMD)** — Zero build tool required.
2. **NPM Package (ESM / Bundlers)** — For modern Vite, Rollup, or Webpack projects.
3. **Modular Subpaths** — Tree-shakeable imports for ultra-lightweight bundles.

---

## 1. Direct Browser Script (No Build Step)

The fastest way to use EUIX is by including the UMD bundle from a CDN directly in your HTML page:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>EUIX App</title>
  <!-- Load EUIX Engine UMD Bundle -->
  <script src="https://unpkg.com/euixjs/dist/EUIXEngine.umd.js"></script>
</head>
<body>
  <div id="app"></div>

  <script>
    const xml = `
      <uid_spec>
        <data_model>
          <state id="message">Hello EUIX!</state>
        </data_model>
        <flex direction="column" class="p-4">
          <h1>{data.message}</h1>
        </flex>
      </uid_spec>
    `;

    // Mount to the #app container
    EUIXEngine.mount(xml, '#app');
  </script>
</body>
</html>
```

### Optional: Standalone DevTools Inspector
For visual state debugging and action inspection during development, include the DevTools script:

```html
<script src="https://unpkg.com/euixjs/dist/EUIXDevTools.umd.js" data-euix-devtools="open"></script>
```

---

## 2. NPM Package Installation

Install `euixjs` via your preferred package manager:

```bash
npm install euixjs
# or
yarn add euixjs
# or
pnpm add euixjs
```

---

## 3. Import Strategies

EUIX offers two primary import approaches depending on your bundle size goals:

### Option A: Modular Subpath Imports (Recommended for Minimal Bundles)

Load **Lite Core** (`euixjs/core`) and explicitly register only the plugins your application uses:

```javascript
import { EUIXEngineCore } from 'euixjs/core';
import { EUIXApiPlugin } from 'euixjs/api';
import { EUIXComposerPlugin } from 'euixjs/composer';
import { EUIXStoragePlugin } from 'euixjs/storage';
import { EUIXDevTools } from 'euixjs/devtools';

// Register plugins onto Lite Core
EUIXEngineCore
  .use(EUIXApiPlugin)
  .use(EUIXComposerPlugin)
  .use(EUIXStoragePlugin);

// Mount to DOM
const engine = EUIXEngineCore.mount(xmlString, document.getElementById('app'));

// Initialize DevTools in development
if (process.env.NODE_ENV === 'development') {
  EUIXDevTools.init(engine);
}
```

### Option B: Full Bundle (Turnkey / Backwards Compatible)

Import the standard `EUIXEngine` instance with all core plugins pre-registered:

```javascript
import { EUIXEngine } from 'euixjs';

const engine = EUIXEngine.mount(xmlString, '#app');
```

---

## 📦 Package Subpath Exports Reference

| Subpath Import | Description | Bundle Profile |
| :--- | :--- | :--- |
| `euixjs` | Full bundle with pre-registered standard plugins | Turnkey full runtime |
| `euixjs/core` | **Lite Core**: parser, reactive store, DOM reconciler | Ultra-compact core (~34 kB UMD) |
| `euixjs/api` | SWR REST API client (`<api_config>`, `<api_endpoint>`) | Tree-shakeable plugin |
| `euixjs/composer`| Action Composer workflow engine (`<action_def>`) | Tree-shakeable plugin |
| `euixjs/storage` | LocalStorage / SessionStorage persistence (`<state persist>`) | Tree-shakeable plugin |
| `euixjs/dialog` | Accessible modal dialog container (`<dialog>`) | Tree-shakeable plugin |
| `euixjs/collapse`| Collapsible accordion section (`<collapse>`) | Tree-shakeable plugin |
| `euixjs/dnd` | Pointer & HTML5 Drag and Drop engine | Tree-shakeable plugin |
| `euixjs/animation`| CSS keyframe transition coordinator (`<animate>`) | Tree-shakeable plugin |
| `euixjs/reactive`| Advanced reactive triggers (`<watch>`, `<computed>`) | Tree-shakeable plugin |
| `euixjs/router` | Declarative client-side router (`<router>`, `<route>`) | Tree-shakeable plugin |
| `euixjs/chart` | Chart.js visual charts integration (`<chart>`) | Tree-shakeable plugin |
| `euixjs/leaflet` | Leaflet GIS interactive maps (`<leaflet_map>`) | Tree-shakeable plugin |
| `euixjs/date` | Intl & date formatting helpers (`$date`) | Tree-shakeable plugin |
| `euixjs/webmcp` | Browser WebMCP AI agent tool exposed via `document.modelContext` | Tree-shakeable plugin |
| `euixjs/devtools`| Floating visual state & action inspector | Development tool |
| `euixjs/compiler`| Ahead-of-Time (AOT) AST compiler and CLI generator | Build-time tool |

---

## 🧭 Next Step

Proceed to the **[Quick Start Guide](/getting-started/quickstart)** to build your first interactive application.
