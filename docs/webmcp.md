# WebMCP Plugin for EUIX Engine

The **EUIX WebMCP Plugin** (`euixjs/webmcp`) brings first-class [WebMCP](https://modelcontextprotocol.io/) (Model Context Protocol in the browser via `document.modelContext`) support to EUIX Engine.

It allows declarative and imperative exposure of application actions and state as structured tools to browser AI agents **without adding external dependencies**, without coupling EUIX core to WebMCP, and with zero overhead when WebMCP is unavailable.

---

## 🎯 Key Architectural Highlights

- **Progressive Enhancement**: Seamlessly degrades on browsers without `document.modelContext`. Applications continue running normally with zero errors.
- **Zero Additional Dependencies**: No MCP SDK, no Ajv, no React. Pure vanilla JavaScript leveraging native browser primitives.
- **Unified Action Layer**: Human UI and AI Agents converge on the **exact same EUIX actions and workflows**. No duplicated business logic.
- **Restricted Sandbox**: Exposes a strict, safe execution context (`state`, `actions`, `router`, `params`, `query`, `signal`) without leaking internal engine state.
- **Safe Serialization**: Automatic circular reference protection and stripping of host/DOM objects.
- **Declarative XML Syntax**: Express tools natively in XML specifications with `<webmcp>` and `<tool>` tags.

---

## 📦 Installation & Setup

### Modular ESM (Tree-shakeable)

```js
import { EUIXEngineCore } from 'euixjs/core';
import { EUIXComposerPlugin } from 'euixjs/composer';
import { EUIXWebMCPPlugin } from 'euixjs/webmcp';

EUIXEngineCore
  .use(EUIXComposerPlugin)
  .use(EUIXWebMCPPlugin);

const engine = EUIXEngineCore.mount(xmlString, document.getElementById('app'));
```

### Full Bundle

```js
import { EUIXEngine, WebMCPPlugin } from 'euixjs';

// WebMCP plugin is pre-registered in the full bundle
const engine = EUIXEngine.mount(xmlString, document.getElementById('app'));
```

### Plugin Configuration Options

```js
import { WebMCPPlugin } from 'euixjs/webmcp';

app.use(WebMCPPlugin({
  enabled: true, // or ({ state }) => state.get('settings.enableAiTools')
  debug: false,  // enables diagnostic console logs
  strict: true,  // throws on duplicate tool names or validation errors
  defaults: {
    annotations: {
      readOnlyHint: false
    },
    exposedTo: ['https://example.com'] // or undefined
  }
}));
```

---

## 🌐 1. Browser Support & Feature Detection

WebMCP is supported through the standard `document.modelContext` API.

```js
const webmcp = engine.webmcp;

if (webmcp.isSupported()) {
  console.log("WebMCP is natively supported by this browser!");
} else {
  console.log("WebMCP is not supported; standard UI functions normally.");
}
```

You can access the native context directly as an escape hatch:
```js
const nativeContext = engine.webmcp.getNativeContext(); // document.modelContext or null
```

---

## ⚡ 2. Declarative Tool Syntax (`<webmcp>`)

Tools can be declared directly in your XML UI specification:

```xml
<uid_spec>
  <!-- 1. Shared EUIX Action Workflow -->
  <actions>
    <action_def name="task.create">
      <param name="title" required="true" />
      <param name="priority" default="normal" />

      <step action="MUTATE_STATE">
        <path>data.tasks</path>
        <operation>PUSH</operation>
        <value>{"id": "t_" + Date.now(), "title": "{args.title}", "priority": "{args.priority}", "completed": false}</value>
      </step>

      <return>{"success": true, "title": "{args.title}"}</return>
    </action_def>
  </actions>

  <!-- 2. Declarative WebMCP Exposure -->
  <webmcp>
    <tool
      name="create_task"
      title="Create Task"
      description="Creates a new task in the application"
      action="task.create">

      <param
        name="title"
        type="string"
        description="Task title"
        required="true"
        minlength="1"
      />

      <param
        name="priority"
        type="string"
        description="Task priority level"
        default="normal"
        enum="low,normal,high,urgent"
      />
    </tool>
  </webmcp>

  <!-- 3. Human UI Component (Calling the SAME action) -->
  <flex direction="row" gap="8">
    <input bind="newTaskTitle" placeholder="Task title..." />
    <button>
      <on_click action="task.create">
        <arg name="title">{data.newTaskTitle}</arg>
      </on_click>
      Add Task
    </button>
  </flex>
</uid_spec>
```

---

## 🛠️ 3. Imperative API (`engine.webmcp`)

You can also manage tools dynamically in JavaScript:

```js
const webmcp = engine.webmcp;

// Register a tool
webmcp.register({
  name: 'search_products',
  title: 'Search Products',
  description: 'Searches products currently available in inventory',
  inputSchema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search term' },
      limit: { type: 'number', default: 10 }
    },
    required: ['query']
  },
  annotations: {
    readOnlyHint: true
  },
  execute: async ({ query, limit }, context) => {
    return context.actions.run('products.search', { query, limit });
  }
});

// Check if tool exists
webmcp.has('search_products'); // true

// List registered tools
console.log(webmcp.list());

// Unregister a tool
webmcp.unregister('search_products');

// Clear all tools
webmcp.clear();
```

---

## 📋 4. Parameter Types & Schema Compilation

EUIX parameter definitions (`<param>`) compile automatically into standard JSON Schema:

| Attribute | Supported Values | Description |
| :--- | :--- | :--- |
| `name` | `string` | Unique parameter key (required). |
| `type` | `string`, `number`, `integer`, `boolean`, `array`, `object` | Data type (default: `string`). |
| `required` | `true`, `false` | Marks parameter as required. |
| `default` | Any primitive | Fallback default value if not provided. |
| `enum` | Comma-separated or array | Permitted values (e.g. `enum="todo,doing,done"`). |
| `minimum`, `maximum` | `number` | Numeric range boundaries. |
| `minlength`, `maxlength` | `number` | String length bounds. |
| `format` | `string` | String format hint (e.g. `email`, `uri`, `date-time`). |

### Custom JSON Schema Escape Hatch
If you have complex schemas, you can embed raw JSON schema inside a `<schema>` tag:
```xml
<tool name="complex_search" action="search.execute">
  <schema>
    {
      "type": "object",
      "properties": {
        "filters": {
          "type": "array",
          "items": { "type": "string" }
        }
      },
      "required": ["filters"]
    }
  </schema>
</tool>
```

---

## 🔒 5. Sandboxed Context & Security Best Practices

### Restricted Execution Context
When a WebMCP tool executes, it receives a sandboxed context object:
```js
{
  state: {
    get: (path) => engine.getState(path),
    set: (path, value) => engine.setState(path, value)
  },
  actions: {
    run: (actionName, payload) => runAction(actionName, payload)
  },
  router: { ... }, // EUIX router instance (if installed)
  params: { ... }, // Validated input parameters
  query: { ... },  // URL search params
  signal: AbortSignal // WebMCP cancellation signal
}
```

### Opt-in Exposure
EUIX **never automatically exposes internal actions**. Only actions explicitly declared via `<tool>` or `webmcp.register()` become accessible to browser AI agents.

### Cross-Origin Isolation (`exposedTo`)
You can restrict which origins can invoke specific tools:
```xml
<tool
  name="admin_export"
  action="admin.export"
  expose-to="https://trusted-dashboard.com"
/>
```

---

## 🔄 6. Reactive Lifecycle & Dynamic Tools

### Route & Component Local Tools
Tools declared within components automatically clean up when that component instance is unmounted.

### Dynamic Tools (`if="..."`)
Tools can dynamically register and unregister based on reactive state changes:
```xml
<webmcp>
  <!-- Only available when the user is logged in -->
  <tool
    name="create_order"
    action="orders.create"
    if="{data.isAuthenticated}"
  />
</webmcp>
```

---

## 📡 7. Tool Execution State (`$webmcp`)

EUIX maintains a reactive state store `$webmcp` for observing tool execution:

- `data.$webmcp.executing` (`boolean`): Indicates whether an agent tool is currently running.
- `data.$webmcp.currentTool` (`string | null`): Name of the active tool.
- `data.$webmcp.lastResult` (`any`): Sanitized return value of the last completed tool.
- `data.$webmcp.lastError` (`EUIXWebMCPError | null`): Error object if the last tool failed.

```xml
<flex direction="row" align="center" gap="8">
  <span class="{data.$webmcp.executing ? 'animate-pulse text-indigo-400' : 'text-slate-400'}">
    {data.$webmcp.executing ? 'AI Agent is working (' + data.$webmcp.currentTool + ')...' : 'AI Ready'}
  </span>
</flex>
```

---

## 🛑 8. Cancellation with AbortSignal

WebMCP requests propagate an `AbortSignal` into the execution context. EUIX actions and API requests automatically check `signal.aborted` to abort ongoing network requests or asynchronous workflows.

---

## 🧪 9. Testing & Mocking

You can mock `document.modelContext` easily in unit tests or test environments:

```js
import { beforeEach, afterEach, vi } from 'vitest';

beforeEach(() => {
  document.modelContext = {
    registerTool: vi.fn(),
    unregisterTool: vi.fn(),
    getTools: vi.fn(() => []),
    executeTool: vi.fn()
  };
});

afterEach(() => {
  delete document.modelContext;
});
```
