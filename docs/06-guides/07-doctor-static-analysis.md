---
title: EUIX Doctor — Static Analysis
description: Validate state, composition, prop contracts, and reactive flows with @euix/doctor before runtime testing.
order: 7
group: Guides
---

# EUIX Doctor — Static Analysis

**EUIX Doctor** (`@euix/doctor`) statically analyzes `.xml`, `.html`, and JavaScript/TypeScript EUIX templates **without mounting the app**. Use it to catch broken bindings, missing handlers, composition errors, and prop contract violations before browser or E2E tests.

Doctor is a **linter + semantic analyzer + lightweight dry-run simulator**. It complements Vitest and Playwright; it does not replace them.

---

## 🚀 Quick Start

```bash
# Monorepo root
npm run doctor

# Scan a directory or single file
npx euix doctor apps/playground/components
npx euix doctor path/to/Component.xml

# Fail CI on errors
npx euix doctor . --json > doctor-report.json

# Inspect one file (entity breakdown + diagnostics)
npx euix doctor inspect path/to/Component.xml

# Run safe dry-run flow scenarios
npx euix doctor path/to/components --test
```

Standalone package (after publish):

```bash
npx @euix/doctor
npx euix-doctor inspect path/to/Component.xml
```

---

## ✅ What Doctor Validates

| Area | Rules | Examples |
|------|-------|----------|
| **State model** | `EUIX1001`, `EUIX1002` | Action writes unknown state; unused state |
| **Computed** | `EUIX1101`, `EUIX1102` | Computed dependency cycles; unknown deps |
| **Watchers** | `EUIX1201` | Watcher writes the path it watches |
| **Events & actions** | `EUIX1301` | Event handler action not found |
| **Composition** | `EUIX1401`, `EUIX1402`, `EUIX1403` | Unresolved component; missing required prop; prop type mismatch |
| **API & streams** | `EUIX1501` | Missing error path on fetch/stream |

Doctor also builds a **behavior graph** (event → action → state → computed → binding) and generates **safe test scenarios** with `--test`.

---

## 🧩 Composition & Multi-File Analysis

Doctor resolves component composition **without requiring a full app mount**:

| Feature | Support |
|---------|---------|
| `<component name="X" src="./X.xml">` | Resolves path; auto-imports missing files |
| Custom tags (`<Header />`, `<Dashboard />`) | Matched to `component_def` or sibling `.xml` files |
| `<import src="...">`, `<route component="...">` | Recorded and linked in the dependency graph |
| Single-file scan | Scanning `App.xml` auto-discovers sibling `Header.xml`, `Dashboard.xml`, etc. |

Composition edges appear in the dependency graph as `composes` (parent → child).

### Example: multi-file app

**`App.xml`**

```xml
<uid_spec>
  <data_model>
    <state id="user" type="object">{"name": "Guest"}</state>
  </data_model>

  <Header user="{data.user}" />
</uid_spec>
```

**`Header.xml`**

```xml
<component_def name="Header">
  <param name="user" type="object" required="true" />
  <span>{props.user.name}</span>
</component_def>
```

Running `npx euix doctor App.xml` loads both files, links `App → Header`, and validates that `user` is passed and matches `type="object"`.

---

## 🏷️ Prop Contracts (`<param>`)

Declare prop types inside `<component_def>`:

```xml
<component_def name="CounterBadge">
  <param name="count" type="number" required="true" />
  <param name="label" type="string" default="Count" />
  <param name="priority" type="string" enum="Low,Normal,High" />
  <span>{props.label}: {props.count}</span>
</component_def>
```

Supported `type` values (aligned with EUIX runtime coercion): `string`, `number`, `boolean`, `object`, `array`.

Doctor checks:

| Rule | When it fires |
|------|----------------|
| **`EUIX1402`** | Required prop omitted by parent |
| **`EUIX1403`** | Passed value type does not match declared `type`, or literal outside `enum` |

**Type inference (static):**

- Literal attributes: `count="42"` → `number`, `active="true"` → `boolean`
- State bindings: `user="{data.user}"` → uses parent `<state type="...">`
- Complex expressions like `{user.name}` are skipped (confidence: `inferred`) to avoid false positives

**Example mismatch** — Doctor reports `EUIX1403`:

```xml
<!-- Parent: user state is string -->
<state id="user" type="string">Guest</state>
<Header user="{data.user}" />

<!-- Child expects object -->
<param name="user" type="object" required="true" />
```

---

## 🩺 Diagnostic Reference

| Rule | Severity | Meaning |
|------|----------|---------|
| `EUIX1001` | error | Action writes to unknown state |
| `EUIX1002` | warning | State never read or written |
| `EUIX1101` | error | Computed dependency cycle |
| `EUIX1102` | error | Computed depends on unknown symbol |
| `EUIX1201` | warning | Watcher reactive loop |
| `EUIX1301` | error | Event handler not found |
| `EUIX1401` | error | Component reference could not be resolved |
| `EUIX1402` | error | Missing required prop on child component |
| `EUIX1403` | error | Prop type or enum mismatch (inferred) |
| `EUIX1501` | warning | API call may leave loading state stuck |

Treat all **`error`** diagnostics as blocking before merge or release.

---

## 🖥️ VS Code / Cursor Extension

The **EUIX Doctor** extension (`euix-doctor`) surfaces the same rules in the **Problems** panel:

- Analyze on save (debounced)
- Status bar error/warning count
- Commands: *Analyze Workspace*, *Analyze Current File*, *Run Safe Test Scenarios*

```bash
npm run vscode-doctor:build
npm run vscode-doctor:package   # produces .vsix
```

Open `packages/vscode-euix-doctor` and press **F5** for Extension Development Host debugging.

---

## 🔄 Recommended Workflow

1. **Edit** EUIX XML/HTML/JS templates.
2. **Run Doctor** on changed paths: `npx euix doctor <path>`.
3. **Fix errors** — especially `EUIX1001`, `EUIX1101`, `EUIX1301`, `EUIX1401`–`EUIX1403`.
4. **Review warnings** — watcher loops, API error paths, unused state.
5. **Optional:** `npx euix doctor <path> --test` for dry-run flow scenarios.
6. **Runtime tests** — Vitest unit tests and Playwright E2E *after* Doctor passes.

---

## ⚠️ Limitations

Doctor performs **static analysis only**:

- Does not execute real plugin runtime hooks or network calls
- Complex JS in action bodies may be partially inferred
- Dynamic component URLs in template literals may be unresolved
- Prop type checks on complex expressions are intentionally conservative

These limits keep Doctor fast and CI-friendly as a first line of defense.

---

## 🧭 Next Step

Continue with runtime debugging in **[Debugging & DevTools](/guides/debugging)**, or add automated tests in **[Testing & Playwright](/guides/testing)**.
