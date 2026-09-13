---
title: CLI & Compiler Tooling Reference
description: Command-line interface reference for schema generation, TypeScript type generation, and AST pre-compilation.
order: 7
group: Reference
---

# CLI & Compiler Tooling Reference

EUIX includes a built-in Command Line Interface (`bin/euix.js`) for schema generation, TypeScript declaration generation, and Ahead-of-Time (AOT) template compilation.

---

## 🛠️ CLI Commands

```bash
# Run CLI via npx
npx euix <command> [options]
```

### 1. `schema:xsd`
Generates the official XML Schema Definition (`uid_spec.xsd`) for IDE autocomplete and validation in VS Code, IntelliJ, and XML editors.

```bash
npx euix schema:xsd -o ./schema/uid_spec.xsd
```

### 2. `schema:json`
Generates a JSON Schema validator (`uid_spec.schema.json`) for JSON-based tools and AST validation.

```bash
npx euix schema:json -o ./schema/uid_spec.schema.json
```

### 3. `typegen <file.xml>`
Extracts `<data_model>` states, props, and actions from an XML template and generates matching TypeScript declarations (`.d.ts`).

```bash
npx euix typegen ./src/components/Dashboard.xml -o ./src/types/Dashboard.d.ts
```

### 4. `compile <file.xml>`
Pre-compiles an XML template into an optimized JavaScript module for zero-parser runtime overhead and strict Content Security Policy (CSP) environments.

```bash
npx euix compile ./src/App.xml -o ./src/App.compiled.js
```

### 5. `doctor [path]`
Runs **EUIX Doctor** static analysis on a directory or file. Validates state, computed/watcher graphs, events, API paths, multi-file composition, and prop contracts.

```bash
# Scan directory or file
npx euix doctor apps/playground/components
npx euix doctor ./src/App.xml

# Single-file entity breakdown
npx euix doctor inspect ./src/App.xml

# Dry-run test scenarios + JSON for CI
npx euix doctor . --test --json > doctor-report.json
```

**Common flags:** `--test`, `--flows`, `--graph`, `--json`, `--fuzz` (with `--test`).

**Composition diagnostics:**

| Rule | Meaning |
|------|---------|
| `EUIX1401` | Component reference could not be resolved |
| `EUIX1402` | Missing required prop on child component |
| `EUIX1403` | Prop `type` or `enum` mismatch |

See **[EUIX Doctor — Static Analysis](/guides/doctor-static-analysis)** for the full diagnostic reference.

---

## 🏁 Documentation Complete

Congratulations! You now have a complete understanding of EUIX Engine. Return to the **[Documentation Homepage](/)** or start building with the **[Quick Start](/getting-started/quickstart)**.
