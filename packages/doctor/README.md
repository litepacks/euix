# @euix/doctor

EUIX Doctor statically analyzes EUIX applications in `.xml`, `.html`, and JavaScript/TypeScript files. Before you run the app, it discovers state/computed/watcher relationships, event → action flows, API calls, and potential reactive loops — then generates safe test scenarios.

> **Goal:** Answer “it looks like it works, but why?” in EUIX projects without entering the runtime.

---

## What it does

| Capability | Description |
|------------|-------------|
| **Semantic IR** | Extracts components, states, computed values, watchers, actions, events, bindings, routes, and API calls from XML/HTML/JS sources |
| **Dependency graph** | Builds read/write/dependency edges; detects computed and watcher cycles |
| **Diagnostics** | Reports unused state, missing handlers, missing API error paths, and more |
| **Behavior graph** | Models event → action → state → computed → binding flows as visualizable paths |
| **Safe test generation** | Produces dry-run simulation scenarios without touching the real DOM or network |
| **Health score** | Computes a project health score from diagnostic count, behavior coverage, and risk metrics |

Doctor is a **linter + static analyzer + lightweight simulator**. It does not replace Playwright or Vitest; it provides a fast safety net before them.

---

## Architecture

The analysis pipeline runs as a one-way flow:

```mermaid
flowchart LR
    A[Scanner] --> B[Parsers]
    B --> C[Collector]
    C --> D[Semantic IR]
    D --> E[Dependency Analysis]
    E --> F[Diagnostics]
    E --> G[Behavior Graph]
    G --> H[Scenario Generator]
    H --> I[Dry-run Simulator]
    I --> J[Reporters]
```

### 1. Scanner (`src/scanner/`)

Discovers source files from the project root or a target path:

- `.xml`, `.html`, `.htm`
- `.js`, `.mjs`, `.cjs`, `.ts`, `.tsx`, `.jsx`

Directories such as `node_modules`, `dist`, and `build` are skipped automatically.

### 2. Parsers (`src/parser/`)

| Parser | Library | Role |
|--------|---------|------|
| `xml.ts` | htmlparser2 | Parses the EUIX XML/HTML tree |
| `oxc.ts` | oxc-parser | Finds template literals in JS/TS files |
| `expressions.ts` | — | `{data.x}`, event attributes, action body analysis |

`euix\`...\`` blocks and `<uid_spec>` sections inside HTML are processed as separate XML documents.

### 3. Collector (`src/euix/collector.ts`)

Extracts **Semantic IR** entities from the parsed tree:

- `<state>`, `<computed>`, `<watch>`
- `<action>`, `<action_def>` (step/param/return)
- Event handlers such as `<on_click>`, `on_click:set`, `@click`
- `bind` and `{data.x}` text bindings
- `<route>`, `<component_def>`, `<slot>`, `<param>`
- `<api_endpoint>`, `<api_stream>` (REST + WebSocket/SSE)

### 4. IR & Project (`src/ir/`)

All entities live in typed Maps inside `EuixProject`:

```
EuixProject
├── components, states, computed, watchers
├── actions, events, bindings
├── props, slots, routes, apiCalls
├── dependencies[]   ← edges after analysis
└── diagnostics[]    ← rule violations
```

### 5. Analysis (`src/analysis/`)

- **dependencies.ts** — state read/write edges, computed/watcher cycle detection
- **risk.ts** — component/action complexity, health score

### 6. Diagnostics (`src/diagnostics/`)

Static rules are evaluated. Key rules:

| Rule | Level | Meaning |
|------|-------|---------|
| `EUIX0001` | error | XML-unsafe JS in `<computed>` / `<step>` / script body (e.g. `<=` without CDATA) *(auto-fixable)* |
| `EUIX0101` | error | Island architecture template `#id` or remote file path missing / 404 |
| `EUIX0102` | error | Invalid JSON syntax in island `data-props` or `data-state` attribute |
| `EUIX0103` | error | Island missing required prop declared on `<param required="true">` |
| `EUIX1001` | error | Action or event writes to an unknown state *(auto-fixable)* |
| `EUIX1002` | warning | State is never used |
| `EUIX1101` | error | Computed dependency cycle |
| `EUIX1102` | error | Computed references an unknown state/computed dependency *(auto-fixable)* |
| `EUIX1110` | error | Template binding, watcher, or action references an unknown variable *(auto-fixable)* |
| `EUIX1201` | warning | Watcher writes its own path (reactive loop) |
| `EUIX1301` | error | Custom action not defined (built-ins, shorthands, imported `<action_def>` recognized) |
| `EUIX1302` | error | Plugin action used without matching plugin markup/import |
| `EUIX1310` | error | `on_*:toggle` shorthand targets non-boolean state |
| `EUIX1311` | warning | Arithmetic on string-typed state in `on_*:set` shorthand (evaluates as string concatenation) |
| `EUIX1401` | error | Component reference could not be resolved |
| `EUIX1402` | error | Missing required prop on child component |
| `EUIX1403` | error | Prop `type` or `enum` mismatch (inferred) |
| `EUIX1501` | warning | Missing API error path (loading state may stay stuck) *(auto-fixable)* |
| `EUIX1702` | error | `on_*:revalidate` references unknown API endpoint tag/id |
| `EUIX3001` | warning | `<for_each>` is missing `key` attribute for keyed reconciliation *(auto-fixable)* |
| `EUIX3002` | warning | Un-debounced watcher triggers API requests on rapid input keystrokes |
| `EUIX3003` | info | State embeds large static payload (>2000 chars); recommend `<state src="...">` |
| `EUIX4001` | warning | Button missing accessible label (aria-label, title, or visible text) |
| `EUIX4002` | warning | Non-interactive element (div/span) has click handler without role or tabindex |
| `EUIX4003` | warning | Form `<input>` missing accessible label (label, aria-label, or title) |

### Auto-Fix Subsystem (`--fix`)

The `--fix` command supports safe, deterministic auto-repairs:

```bash
# Apply all supported auto-fixes
npx euix doctor path/to/App.xml --fix

# Preview fixes without modifying files
npx euix doctor path/to/App.xml --fix --dry-run

# Target specific rule auto-fixes
npx euix doctor path/to/App.xml --fix=EUIX0001   # Wrap scripts in CDATA
npx euix doctor path/to/App.xml --fix=EUIX1001   # Auto-declare missing states in <data_model>
npx euix doctor path/to/App.xml --fix=EUIX3001   # Add key="id" to <for_each>
npx euix doctor path/to/App.xml --fix=EUIX1501   # Add error="..._error" to <api_endpoint>
```

### 7. Behavior Graph (`src/graph/`)

Starting from event triggers, extracts action → state write → computed recompute → binding update chains as `BehaviorPath` objects. The `--graph` and `--flows` flags print this data to the terminal.

### 8. Scenarios & Simulator (`src/scenarios/`, `src/runner/`)

Uses a **dry-run simulator** instead of the real runtime:

- **smoke** — can the component be parsed, are entity counts consistent
- **flow** — event → action → state change simulation (e.g. `count 0 → 1`)
- **api** — 200/404/500/network failure scenarios (no real fetch)

Use `--fuzz` to add semantic fuzz scenarios.

### 9. Reporters (`src/reporters/`)

- **terminal.ts** — human-readable summary
- **json.ts** — machine-readable output for CI

---

## Source tree

```
packages/doctor/
├── src/
│   ├── scanner/          # File discovery
│   ├── parser/           # XML, JS, expression parsing
│   ├── euix/collector.ts # IR collection
│   ├── ir/               # Type definitions and project builder
│   ├── analysis/         # Dependency and risk analysis
│   ├── diagnostics/      # Static rules
│   ├── graph/            # Behavior graph & paths
│   ├── scenarios/        # Test scenario generation
│   ├── runner/           # Dry-run simulator
│   ├── fuzz/             # Semantic fuzz
│   ├── memory/           # Memory signals (--memory)
│   ├── coverage/         # Behavior coverage metrics
│   ├── reporters/        # Terminal & JSON output
│   ├── cli/main.ts       # CLI entry point
│   └── doctor.ts         # Orchestrator
├── fixtures/             # Test and demo scenarios
│   ├── native/           # Core EUIX features
│   ├── plugins/          # Plugin tags (chart, map, stream, etc.)
│   ├── runtime/          # JS template literal scenarios
│   ├── broken/           # Intentionally broken examples
│   ├── multi-component/  # Composition scenarios
│   └── apps/             # Full HTML applications
└── tests/
```

---

## VS Code / Cursor Extension

The `euix-doctor` extension (`packages/vscode-euix-doctor`) integrates Doctor into the editor:

| Feature | Description |
|---------|-------------|
| Problems panel | `EUIX1001`–`EUIX1501` diagnostics inline in XML/HTML files (incl. composition `EUIX1401`–`EUIX1403`) |
| Analyze on save | Debounced workspace re-scan |
| Status bar | Error/warning count |
| Commands | Analyze workspace, analyze file, run safe tests |

```bash
npm run vscode-doctor:build    # build doctor + extension
npm run vscode-doctor:package  # produce .vsix
```

Press **F5** in `packages/vscode-euix-doctor` to debug locally.

---

## Usage

Doctor can be run standalone or via the `euix` CLI.

### Standalone CLI (`@euix/doctor`)

```bash
# After npm publish (or locally via npm exec)
npx @euix/doctor
npx @euix/doctor apps/playground/components --test
npx euix-doctor inspect path/to/Component.xml

# Monorepo local
npm exec -w @euix/doctor -- euix-doctor --help
```

### Via `euix` CLI (`euixjs`)

```bash
# From monorepo root
npm run doctor

# Specific directory or file
npx euix doctor apps/playground/components
npx euix doctor packages/doctor/fixtures

### Run generated test scenarios

```bash
npx euix doctor packages/doctor/fixtures --test
```

### Behavior graph and flows

```bash
npx euix doctor apps/playground --flows --graph
```

### Inspect a single file

```bash
npx euix doctor inspect packages/doctor/fixtures/simple-component.xml
```

### JSON output (CI)

```bash
npx euix doctor . --json > doctor-report.json
```

### Config (`euix.doctor.json`)

```json
{
  "rules": { "EUIX1002": "warning", "EUIX1701": "off" },
  "ignore": ["**/legacy/**"]
}
```

Inline suppressions in XML:

```xml
<!-- euix-ignore-next-line EUIX1701 -->
<watch path="api.legacy.status" />
```

### Watch mode

```bash
node packages/doctor/bin/euix-doctor-watch.js .
euix doctor . --watch
```

### Pre-commit

```bash
node packages/doctor/bin/euix-doctor-pre-commit.js
```

### Auto-Fix Subsystem (`--fix`)

The `--fix` command supports safe, deterministic auto-repairs for common errors and warnings:

```bash
# Preview fixes without modifying files
npx euix doctor path/to/App.xml --fix --dry-run

# Apply all supported auto-fixes
npx euix doctor path/to/App.xml --fix

# Target specific rule auto-fixes
npx euix doctor path/to/App.xml --fix=EUIX0001   # Wrap inline JS in CDATA
npx euix doctor path/to/App.xml --fix=EUIX1001   # Auto-declare missing states in <data_model>
npx euix doctor path/to/App.xml --fix=EUIX1501   # Add error fallback to <api_endpoint>
npx euix doctor path/to/App.xml --fix=EUIX3001   # Add key="id" attribute to <for_each>
```

#### Step-by-Step Supported Auto-Fixes:

1. **`EUIX0001` (Script CDATA Wrap):**
   Wraps inline JS expressions containing XML-sensitive operators (`<=`, `>=`, `&&`, `<`) inside `<![CDATA[ ... ]]>`.
   ```xml
   <!-- Before -->
   <computed id="is_valid">data.count <= 10 && data.ready</computed>

   <!-- After --fix=EUIX0001 -->
   <computed id="is_valid"><![CDATA[data.count <= 10 && data.ready]]></computed>
   ```

2. **`EUIX1001` (Undeclared State Auto-Declaration):**
   When an action or shorthand writes to an undeclared state (`on_click:set="counter=0"`), Doctor infers the data type from the assignment (`number`, `boolean`, `string`) and inserts the declaration into `<data_model>`.
   ```xml
   <!-- Before: counter is written via shorthand but not declared in <data_model> -->
   <button on_click:set="counter=0">Reset</button>

   <!-- After --fix=EUIX1001: automatically inserted into <data_model> -->
   <data_model>
     <state id="counter" type="number">0</state>
   </data_model>
   ```

3. **`EUIX1501` (API Error Fallback Channel):**
   When an `<api_endpoint>` lacks an `error="..."` channel, network failures leave loading spinners stuck indefinitely. Doctor adds an explicit `error="<id>_error"` attribute.
   ```xml
   <!-- Before -->
   <api_endpoint id="fetch_users" url="/api/users" bind_target="users" />

   <!-- After --fix=EUIX1501 -->
   <api_endpoint id="fetch_users" url="/api/users" bind_target="users" error="fetch_users_error" />
   ```

4. **`EUIX3001` (Keyed Reconciliation on Loops):**
   `<for_each>` containers without a `key` attribute cause full DOM re-renders instead of minimal keyed reconciliation. Doctor adds `key="id"`.
   ```xml
   <!-- Before -->
   <for_each items="{data.items}" var="item">

   <!-- After --fix=EUIX3001 -->
   <for_each items="{data.items}" var="item" key="id">
   ```

### All flags

```
--test           Run generated safe test scenarios
--flows          Show behavior paths
--graph          Show behavior graph summary
--memory         Collect memory signals during tests
--fuzz           Add semantic fuzz scenarios (requires --test)
--json           JSON output
--sarif          SARIF 2.1.0 output (includes fix metadata when available)
--github         GitHub Actions annotations format (::error, ::warning)
--format=FORMAT  Output format: terminal | json | sarif | html | github
--html[=FILE]    Generate standalone interactive HTML report
--open           Open generated HTML report in browser
--watch          Continuous analysis mode with debounced file watcher
--baseline=FILE  Suppress known diagnostics
--update-baseline  Refresh baseline file
--fix            Apply auto-fixes for supported rules
--fix=RULE       Apply a single rule (e.g. EUIX1001)
--dry-run        Preview --fix without writing files
--seed=<n>       Fuzz seed
--repeat=<n>     Memory repeat count
```

---

## Programmatic API

The `@euix/doctor` package exposes both a high-level one-step analysis runner and a granular step-by-step pipeline for custom tooling, language servers, and AI agents.

### Option 1: One-Step Analysis (`runDoctor`)

Runs the entire static analysis, test simulation, and scoring pipeline in a single call:

```typescript
import { runDoctor } from "@euix/doctor";

const result = await runDoctor({
  root: process.cwd(),
  target: "apps/playground/components",
  test: true,     // Run safe dry-run test scenarios
  memory: true,   // Collect memory & reactive leak signals
  flows: true,    // Generate behavior graph paths
});

console.log(`Health Score: ${result.health.score}%`);
console.log(`Diagnostics: ${result.diagnostics.length} issues found`);
console.log(`Failed Tests:`, result.testResults.filter((r) => !r.passed));
```

### Option 2: Step-by-Step Low-Level Pipeline

For granular control, IDE extensions, or custom agent workflows, run each step sequentially:

```typescript
import {
  buildProject,
  buildDependencyEdges,
  runDiagnostics,
  validateHtmlIslands,
  validateActionShorthands,
  validatePerformanceAndMemory,
  validateAccessibility,
  applyFixes,
  doctorResultToGithub,
  generateHtmlReport,
} from "@euix/doctor";

// Step 1: Scan files and build the Semantic IR project
const project = await buildProject(process.cwd(), "apps/playground/components");
console.log(`Discovered ${project.components.size} components, ${project.states.size} states`);

// Step 2: Build dependency edges (state read/write, computed dependencies, cycle detection)
buildDependencyEdges(project);

// Step 3: Run core diagnostics (cycles, unknown variables, unused state, broken handlers)
runDiagnostics(project);

// Step 4: Run specialized validation modules
validateHtmlIslands(project);          // EUIX0101, EUIX0102, EUIX0103
validateActionShorthands(project);     // EUIX1001, EUIX1310, EUIX1311, EUIX1702
validatePerformanceAndMemory(project); // EUIX3001, EUIX3002, EUIX3003
validateAccessibility(project);        // EUIX4001, EUIX4002, EUIX4003

// Step 5: Inspect diagnostics
for (const diag of project.diagnostics) {
  console.log(`[${diag.severity.toUpperCase()}] ${diag.code}: ${diag.message} at ${diag.location.file}:${diag.location.line}`);
}

// Step 6: Apply auto-fixes step-by-step or all at once
// Option 6A: Apply individual rule fixes step-by-step
applyFixes(project, { rules: ["EUIX0001"] }); // Wrap scripts in CDATA
applyFixes(project, { rules: ["EUIX1001"] }); // Declare missing states
applyFixes(project, { rules: ["EUIX1501"] }); // Add API error channels
applyFixes(project, { rules: ["EUIX3001"] }); // Add loop keys

// Option 6B: Apply all available auto-fixes at once
applyFixes(project);

// Step 7: Export reports in various formats
const githubAnnotations = doctorResultToGithub(project); // GitHub Actions ::error/::warning format
const htmlReport = generateHtmlReport(project, { title: "EUIX Doctor Audit" }); // Interactive HTML
```

---

## Fixtures

The `fixtures/` directory is a scenario library that validates Doctor coverage:

| Group | Covered features |
|-------|------------------|
| `native/` | uid_spec, data_model, computed, watcher, router, action_def, validation, slots |
| `plugins/` | api_stream, chart, map, date, navigator, webmcp, dialog, collapse, storage, animation, retry, head |
| `runtime/` | WebSocket, EventSource, setInterval, fetch, template literal |
| `broken/` | Missing handler, watcher loop, computed cycle, prop type mismatch |
| `multi-component/` | App + Header + Dashboard composition, typed props, invalid prop scenario |

Run fixture tests:

```bash
npm run doctor:test
```

---

## Development

```bash
# Build
npm run doctor:build

# Test
npm run doctor:test

# Typecheck
npm run typecheck -w @euix/doctor
```

Typical workflow when adding a new EUIX tag or plugin support:

1. `src/euix/collector.ts` — extract IR entities from the new tag
2. `src/parser/expressions.ts` — extend action/event parsing if needed
3. `src/diagnostics/` — add a new rule
4. `fixtures/` — write an example scenario
5. `tests/` — assert expectations

---

## Nested components & imports

Doctor resolves composition **without breaking single-file analysis**:

| Feature | Support |
|---------|---------|
| `<component name="X" src="./X.xml">` | Resolves file path, auto-imports missing files |
| Custom tags (`<Header />`, `<Dashboard />`) | Matched to `component_def` / sibling `.xml` files |
| `<import src="...">`, `<route component="...">`, `<nav_item component="...">` | Recorded and linked |
| Single-file scan | Auto-discovers sibling components (e.g. scan `App.xml` → loads `Header.xml`) |
| Required props | `EUIX1402` when parent omits required child props |
| Prop types & enum | `EUIX1403` when passed value does not match `<param type="...">` or `enum` |
| Unresolved refs | `EUIX1401` when component cannot be resolved |

Prop type inference uses literal attributes (`count="42"` → `number`) and parent state bindings (`user="{data.user}"` → state's `type`). Complex expressions are skipped to avoid false positives.

Composition edges appear in the dependency graph as `composes` (parent → child).

---

## Limitations (intentional design choices)

Doctor performs **static analysis**; it does not run the real browser runtime:

- Built-in actions (`SET_STATE`, `RUN_SCRIPT`, `REVALIDATE_API`, …) and attribute shorthands (`on_click:set`, `on_click:mutate`, …) do **not** require `<action_def>` — Doctor resolves them directly
- Does not fully simulate plugin hook runtime behavior
- Data-flow inference in complex JS action bodies is limited (watch for `confidence: inferred`)
- Dynamic URLs inside template literals may be marked `unresolved`
- Does not replace E2E tests; it complements them

These limits are intentional: the goal is a fast, safe, CI-friendly first line of defense.

---

## Relationship: Doctor ↔ euixjs

```
euix-monorepo
├── packages/core (euixjs)     ← runtime engine, plugins, CLI
└── packages/doctor            ← static analysis (this package)
```

`@euix/doctor` does not depend on the `euixjs` package; it only parses EUIX markup and conventions. CLI integration is provided by the `doctor` command in `packages/core/bin/euix.js`.

---

## License

MIT — [euix monorepo](https://github.com/litepacks/euix)
