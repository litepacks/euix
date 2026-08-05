# Vanilla .EUIX Engine

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Build Tool: Vite](https://img.shields.io/badge/Build%20Tool-Vite-646CFF.svg)](https://vitejs.dev/)
[![Minifier: Terser](https://img.shields.io/badge/Minifier-Terser-FF6B6B.svg)]()
[![Dependencies: Zero](https://img.shields.io/badge/Dependencies-Zero-brightgreen.svg)]()

**Vanilla .EUIX Engine** is an ultra-lightweight, zero-dependency, high-performance JavaScript framework that parses declarative XML/HTML templates and reactive state models directly into fine-grained native DOM elements in web browsers.

---

## 📦 Bundle Sizes & Optimization

Thanks to Terser 3-pass AST minification and Rollup tree-shaking optimizations, EUIX Engine delivers an extremely small footprint:

| Dist File | Format / Description | Raw Size | Compressed (Gzip) |
| :--- | :--- | :--- | :--- |
| **`EUIXEngine.min.js`** | **Standalone Minified (Recommended)** | **28.0 KB** | **8.3 KB** |
| **`dist/EUIXEngine.umd.js`** | **Rollup UMD Bundle** | **28.1 KB** | **8.4 KB** |
| **`dist/EUIXEngine.es.js`** | **Vite ES Module** | **58.5 KB** | **11.7 KB** |

> 🌳 **Tree-Shaking:** In ESM environments, importing only needed sub-modules reduces the footprint to **~1.8 KB Gzip**.

---

## ⚡ Performance & Fine-Grained Reactivity

EUIX Engine bypasses Virtual DOM overhead by manipulating native browser DOM elements directly. Proxy-based **Fine-Grained Reactivity** ensures that state changes update only the exact target DOM node in-place.

```javascript
// Run live performance benchmark for 1,000 DOM elements
const report = EUIXEngine.runBenchmark(1000);
console.log(report.durationMs, report.opsPerSec);
```

| Benchmark Operation | Scale | Duration (ms) | Description |
| :--- | :--- | :--- | :--- |
| **Initial XML Mount** | Full App Spec | **< 2.5 ms** | XML parsing, Data Model & DOM tree creation |
| **Bulk Item Push (`PUSH`)** | **1,000 Items** | **~ 130 ms** | In-place DOM node creation (batch render) |
| **Single State Mutation** | 1 Item Field | **0.11 ms** | Direct fine-grained node mutation |

---

## ⚖️ Architecture Comparison: EUIX Engine vs React.js vs htmx

| Feature / Metric | ⚡ EUIX Engine | ⚛️ React.js | 🚀 htmx |
| :--- | :--- | :--- | :--- |
| **Architecture** | Client-Side Reactive XML/HTML Engine | Virtual DOM & JSX Component Framework | Server-Driven HTML Swap (Hypermedia App) |
| **State Location** | Client Reactive Model (`<data_model>`) | Client Component State (`useState`) | Server-Side State |
| **Network Dependency** | **100% Offline / Serverless Ready** | **Offline / Serverless Ready** | **HTTP Request per Interaction** (`hx-get`) |
| **Client Logic** | Built-in Loops (`<for_each>`), Conditions (`<if>`), Mutations | JavaScript / JSX Code Blocks | Requires Extra JS Library (Alpine.js) |
| **Build Step** | **Zero Build Required (No-Build)** | **Mandatory** (Babel/Vite for JSX) | **Zero Build Required (No-Build)** |
| **Bundle Size (Gzip)** | **~8 KB** (Standalone Minified) | **~45 - 140 KB** (react + react-dom) | **~14 KB** |
| **DOM Strategy** | **Fine-Grained** In-place Node Mutation | Virtual DOM Diffing & Re-render | HTML Fragment Swap |

---

## 💻 Quick Start

### 1. HTML Auto-Init

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body>
    <div id="app"></div>

    <script type="application/euix" target="#app">
    <uid_spec>
        <data_model>
            <state id="message" type="string">Hello EUIX Engine!</state>
        </data_model>
        <flex direction="column" gap="12">
            <h2>{data.message}</h2>
        </flex>
    </uid_spec>
    </script>

    <script src="EUIXEngine.js"></script>
</body>
</html>
```

---

## 📖 Documentation

For detailed component specs and API references, check the **`docs/`** directory:

- 📚 **[docs/components.md](docs/components.md)**: Full Layout, Primitive UI Components & Actions Reference.
- 🛠️ **[docs/guide.md](docs/guide.md)**: Architecture, State Reactivity Model & Lifecycle Hooks.

---

## 📄 License

This project is licensed under the **MIT License**.
