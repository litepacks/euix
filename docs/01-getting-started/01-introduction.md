---
title: Introduction
description: Discover what EUIX Engine is, why it was created, and its core architectural philosophy.
order: 1
group: Getting Started
---

# Introduction to EUIX Engine

**EUIX Engine** (`euixjs`) is an ultra-lightweight, zero-dependency declarative UI runtime for building reactive web applications and interactive components directly from XML/HTML markup.

Instead of introducing a virtual DOM (VDOM) abstraction or requiring complex Webpack/Babel toolchains, EUIX parses declarative markup into an optimized in-memory AST and binds state directly to target DOM nodes.

---

## 🎯 What Problem Does EUIX Solve?

Modern frontend frameworks have become increasingly complex. Building an interactive dashboard or a dynamic form often requires:
- Complex bundlers (Vite, Webpack, Rollup) and build configurations.
- Virtual DOM diffing overhead for every state update across large component trees.
- Inconsistent state management patterns spread across dozens of libraries.
- High memory footprints and large JavaScript bundle payloads.

EUIX takes a different approach:
1. **Markup as the Source of Truth**: UI layout, state definitions, event listeners, and data-fetching endpoints are declared together in readable, structured XML.
2. **Fine-Grained Direct DOM Updates**: When state changes, EUIX updates only the exact text node or DOM attribute that depends on that state key. No full-tree re-rendering occurs.
3. **Zero Mandatory Build Step**: You can run EUIX directly in any modern web browser via a `<script>` tag or import it as a lightweight ES module in your existing web app.
4. **Modular Plugin Architecture**: Keep your production bundle minimal (`euixjs/core` is ~34 kB UMD) and only import what you need—like SWR REST API, Dialogs, Storage persistence, Maps, or WebMCP browser AI tools.

---

## 💡 Core Philosophy

### 1. Declarative Over Imperative
You describe *what* the interface should look like and *how* it should react to data changes. EUIX handles DOM creation, event binding, list reconciliation, and cleanup automatically.

### 2. Native Web Standards
EUIX embraces standard DOM APIs, CSS Flexbox/Grid, standard events, and standard browser primitives. There are no proprietary template languages to compile—just standard XML/HTML.

### 3. Progressive Enhancement & Coexistence
EUIX does not require you to rewrite your entire backend or frontend stack. You can mount an EUIX application inside a single `<div>` within an existing Ruby, Django, Laravel, PHP, or ASP.NET page, or build a complete standalone client-side application.

### 4. Deterministic for AI Agents & Developers
Because EUIX specifications are structured XML with clear schema definitions (`<data_model>`, `<flex>`, `<on_click>`, `<component_def>`), LLMs and AI coding assistants can generate, inspect, and refactor EUIX templates deterministically without syntax ambiguities.

---

## 🧭 Next Steps

Ready to get hands-on?
- Check out the **[Installation Guide](/getting-started/installation)** to set up EUIX via CDN or npm.
- Follow the **[Quick Start](/getting-started/quickstart)** to build your first interactive widget.
- Read the **[Mental Model](/getting-started/mental-model)** to understand how EUIX handles reactivity under the hood.
