---
title: CLI & Compiler Tooling Reference
description: Command-line interface reference for schema generation, validation, conversion, snapshot testing, SSR, and LLM context generation.
order: 7
group: Reference
---

# CLI & Compiler Tooling Reference

EUIX includes a built-in Command Line Interface (`bin/euix.js`) for schema generation, static analysis, bi-directional format conversion, intelligent auto-fixing, zero-DOM server-side rendering, regression snapshot testing, and LLM context generation.

---

## 🛠️ CLI Commands Overview

```bash
# Run CLI via npx
npx euix <command> [options]
```

| Command | Description |
| :--- | :--- |
| **`check <path> [--fix]`** | Validates EUIX source files. Use `--fix` to auto-resolve typos and diagnostics. |
| **`fix <path> [--dry-run]`** | Auto-fixes typos, invalid routes, and diagnostics directly in `.xml` and `.euix.json` files. |
| **`context <path> [opts]`** | Generates compact project summary context for LLM prompt injection (`--json`, `-o`). |
| **`convert <file> [opts]`** | Converts bidirectionally between EUIX XML (`<uid_spec>`) and Canonical JSON (`.euix.json`). |
| **`schema [opts]`** | Generates IDE Draft-07 JSON Schema for `.euix.json` (use `--vscode` to auto-configure settings). |
| **`render <file> [opts]`** | Server-Side Renders (SSR) template/IR to HTML string without JSDOM or browser globals. |
| **`snapshot <file> [opts]`** | Verifies or updates Runtime IR regression snapshots (`-u` to update, default checks diffs). |
| **`doctor [path] [opts]`** | Analyzes EUIX project semantics, flow graphs, and executes generated safe test scenarios. |
| **`prepare <file> [opts]`** | Prepares EUIX source and emits normalized, deterministic Runtime IR JSON. |
| **`inspect <file>`** | Inspects resolved imports, states, actions, routes, components, and bindings. |
| **`schema:xsd`** | Generates official XML Schema Definition (`uid_spec.xsd`). |
| **`schema:json`** | Generates JSON Schema validator for AST specification (`uid_spec.schema.json`). |
| **`typegen <file.xml>`** | Generates TypeScript declaration (`.d.ts`) from XML template. |
| **`compile <file.xml>`** | Pre-compiles XML template to standalone JavaScript module. |

---

## 📖 Command Details

### 1. `check <path> [--fix]` & `fix <path>`
Validates EUIX source files for unknown state references, unhandled actions, and lifecycle loops. When run with `--fix` (or using the `fix` alias), it uses Levenshtein distance matching to automatically correct typos and invalid routes directly in the source file.

```bash
# Validate directory or file
npx euix check src/

# Preview auto-fixes without modifying files
npx euix check src/ --fix --dry-run
npx euix fix src/ --dry-run

# Apply auto-fixes in place
npx euix check src/ --fix
npx euix fix src/components/
```

### 2. `context <path>` (LLM Context Generator)
Extracts a token-efficient, compact project blueprint (components, declared props, routes, actions, external services, states) formatted specifically for injection into LLM system prompts or agent context windows.

```bash
# Output markdown summary to stdout
npx euix context ./src

# Output structured JSON for agent consumption
npx euix context ./src --json

# Write to file
npx euix context ./src -o .agents/euix-context.md
```

### 3. `convert <file>` (Bi-directional Converter)
Losslessly converts between declarative EUIX XML (`<uid_spec>`) and Canonical Source JSON (`.euix.json`).

```bash
# Convert XML to JSON
npx euix convert src/App.xml -o src/App.euix.json

# Convert JSON to XML
npx euix convert src/App.euix.json -o src/App.xml
```

### 4. `schema` (IDE JSON Schema Generator)
Generates the official Draft-07 JSON Schema validator for EUIX Canonical JSON (`.euix.json`). When passed `--vscode`, it automatically updates `.vscode/settings.json` to configure full property autocomplete, hover tooltips, and real-time schema validation in VS Code and Cursor.

```bash
# Generate schema to stdout
npx euix schema

# Generate schema file and configure VS Code / Cursor automatically
npx euix schema --vscode
```

### 5. `render <file>` (Zero-DOM SSR)
Server-Side Renders a template (`.xml`), canonical JSON (`.euix.json`), or Runtime IR into a static HTML string. Does not require JSDOM, browser window, or virtual DOM.

```bash
# Render to stdout
npx euix render src/App.xml

# Render with initial state overrides
npx euix render src/App.euix.json --data '{"user":"Alice","theme":"dark"}'

# Output to static HTML file
npx euix render src/App.xml -o dist/index.html
```

### 6. `snapshot <file>` (Deterministic IR Regression Testing)
Creates and verifies deterministic snapshots of the normalized Runtime IR. Pinpoints exact structural differences (`states[0].type`, `view.props`, etc.) between commits to prevent accidental template regressions in CI and local testing.

```bash
# Create or update snapshot (.snapshots/<name>.snap.json)
npx euix snapshot src/components/Dashboard.xml --update

# Verify source matches existing snapshot (default check mode)
npx euix snapshot src/components/Dashboard.xml

# Output result summary as JSON
npx euix snapshot src/components/Dashboard.xml --json
```

### 7. `doctor [path]` (Static Semantic Analysis)
Runs **EUIX Doctor** static analysis. Validates state, computed/watcher graphs, events, API paths, multi-file composition, and prop contracts.

```bash
# Scan directory or file
npx euix doctor apps/playground/components
npx euix doctor ./src/App.xml

# Single-file entity breakdown
npx euix doctor inspect ./src/App.xml

# Dry-run test scenarios + JSON for CI
npx euix doctor . --test --json > doctor-report.json
```

### 8. `schema:xsd` & `schema:json`
Generates XML Schema Definition (`uid_spec.xsd`) and JSON Schema (`uid_spec.schema.json`) for raw XML AST tools.

```bash
npx euix schema:xsd -o ./schema/uid_spec.xsd
npx euix schema:json -o ./schema/uid_spec.schema.json
```

### 9. `typegen <file.xml>`
Extracts `<data_model>` states, props, and actions from an XML template and generates matching TypeScript declarations (`.d.ts`).

```bash
npx euix typegen ./src/components/Dashboard.xml -o ./src/types/Dashboard.d.ts
```

### 10. `compile <file.xml>`
Pre-compiles an XML template into an optimized JavaScript module for zero-parser runtime overhead and strict Content Security Policy (CSP) environments.

```bash
npx euix compile ./src/App.xml -o ./src/App.compiled.js
```

---

## 💻 Programmatic Node.js Subpath (`euixjs/prepare`)

All prepare, inspection, and tooling functions can also be imported programmatically in Node.js or build scripts via `euixjs/prepare`:

```javascript
import {
  prepare,
  inspect,
  validateSource,
  generateLlmContext,
  convert,
  fixSource,
  generateSourceSchema,
  renderToString,
  createSnapshot,
  verifySnapshot
} from 'euixjs/prepare';

// Prepare source into deterministic IR
const app = await prepare(xmlOrJsonSource);

// Render to static HTML
const html = app.renderToString({ user: 'Alice' });

// Create snapshot
const snapshot = await app.createSnapshot();

// Verify snapshot
const verifyResult = await app.verifySnapshot(snapshot);
```
