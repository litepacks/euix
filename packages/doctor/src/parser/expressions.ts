const IDENT = /[A-Za-z_$][\w$.]*/g;
const EUIX_EXPR = /\{\{?\s*([^}]+?)\s*\}?\}/g;

export function extractExpressionRefs(expression: string): string[] {
    const refs = new Set<string>();
    const cleaned = expression
        .replace(/\$data\./g, "data.")
        .replace(/\$props\./g, "props.")
        .replace(/\$webmcp\./g, "webmcp.")
        .replace(/\$device\./g, "device.")
        .replace(/\$date\./g, "date.")
        .replace(/\?\./g, ".")
        .replace(/\[['"]([^'"]+)['"]\]/g, ".$1")
        .replace(/'(?:[^'\\]|\\.)*'/g, " '' ")
        .replace(/"(?:[^"\\]|\\.)*"/g, ' "" ')
        .replace(/`([\s\S]*?)`/g, (_m, inner) => {
            const expressions: string[] = [];
            for (const sub of inner.matchAll(/\$\{([^}]+)\}/g)) {
                if (sub[1]) expressions.push(sub[1]);
            }
            return " " + expressions.join(" ") + " ";
        })
        .replace(/'(?:[^'\\]|\\.)*'/g, " '' ")
        .replace(/"(?:[^"\\]|\\.)*"/g, ' "" ')
        .replace(/(?:[{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, " ");

    const tokenRegex = /(?:^|[^.\w$])([A-Za-z_$][\w$]*)/g;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(cleaned)) !== null) {
        const root = match[1];
        if (!root) continue;

        const restIndex = match.index + match[0].length;
        const remainder = cleaned.slice(restIndex);
        if (root === "data") {
            const propMatch = remainder.match(/^\.([A-Za-z_$][\w$]*)/);
            if (propMatch && propMatch[1]) {
                const propName = propMatch[1];
                if (
                    propName.startsWith("$") ||
                    propName === "webmcp" ||
                    propName === "date" ||
                    propName === "storage" ||
                    propName === "router" ||
                    propName === "chart" ||
                    propName === "device" ||
                    propName === "api"
                ) {
                    continue;
                }
                if (!isKeyword(propName)) {
                    refs.add(propName);
                }
            }
            continue;
        }
        if (
            root === "props" ||
            root === "$props" ||
            root === "api" ||
            root === "webmcp" ||
            root === "ctx" ||
            root === "local" ||
            root === "device" ||
            root === "date" ||
            root === "storage" ||
            root === "router" ||
            root === "chart"
        ) continue;

        if (isKeyword(root)) continue;

        refs.add(root);
    }
    return [...refs];
}

/** api_endpoint tag/id references such as api.overview.loading */
export function extractApiTagRefs(expression: string): string[] {
    const tags = new Set<string>();
    const cleaned = expression.replace(/\?\./g, ".");
    for (const token of cleaned.match(IDENT) ?? []) {
        if (!token.startsWith("api.")) continue;
        const tag = token.slice(4).split(".")[0];
        if (tag) tags.add(tag);
    }
    return [...tags];
}

const JS_KEYWORDS = new Set([
    "true",
    "false",
    "null",
    "undefined",
    "if",
    "else",
    "return",
    "await",
    "async",
    "function",
    "const",
    "let",
    "var",
    "new",
    "typeof",
    "instanceof",
    "void",
    "delete",
    "in",
    "of",
    "this",
    "data",
    "props",
    "local",
    "item",
    "args",
    "api",
    "engine",
    "newValue",
    "oldValue",
    "prevValue",
    "value",
    "$newValue",
    "$oldValue",
    "$prevValue",
    "$data",
    "$props",
    "$engine",
    "$item",
    "$index",
    "$ctx",
    "$local",
    "$evt",
    "$event",
    "$api",
    "$error",
    "$loading",
    "$device",
    "$date",
    "$storage",
    "$router",
    "$chart",
    "device",
    "date",
    "storage",
    "router",
    "chart",
    "event",
    "evt",
    "err",
    "e",
    "res",
    "result",
    "pos",
    "position",
    "payload",
    "confetti",
    "index",
    "slotProps",
    "Number",
    "String",
    "Boolean",
    "Array",
    "Object",
    "JSON",
    "Math",
    "Date",
    "Promise",
    "RegExp",
    "Error",
    "Map",
    "Set",
    "Symbol",
    "BigInt",
    "Intl",
    "parseInt",
    "parseFloat",
    "isNaN",
    "isFinite",
    "encodeURIComponent",
    "decodeURIComponent",
    "setTimeout",
    "setInterval",
    "clearTimeout",
    "clearInterval",
    "window",
    "document",
    "location",
    "navigator",
    "localStorage",
    "sessionStorage",
    "performance",
    "globalThis",
    "fetch",
    "Response",
    "console",
]);

function isKeyword(token: string): boolean {
    return JS_KEYWORDS.has(token);
}

export function extractBindingsFromText(text: string): string[] {
    const exprs: string[] = [];
    for (const match of text.matchAll(EUIX_EXPR)) {
        if (match[1]) exprs.push(match[1].trim());
    }
    for (const match of text.matchAll(/\{([^{}]+)\}/g)) {
        const expr = match[1]?.trim();
        if (expr && !expr.startsWith("/") && !expr.includes("<")) exprs.push(expr);
    }
    return exprs;
}

const DECLARATIVE_EVENT_TAGS = new Set([
    "on_click",
    "on_change",
    "on_submit",
    "on_mount",
    "on_unmount",
    "on_interval",
    "on_state_change",
    "on_keyup",
    "on_keydown",
]);

const EVENT_MODIFIER_ATTRS = new Set([
    "ms",
    "key",
    "duration",
    "name",
    "operation",
    "target",
    "chart",
    "data_index",
    "confirm",
    "prevent",
    "prevent_default",
    "stop",
    "stop_propagation",
    "debounce",
    "throttle",
    "if",
    "unless",
    "condition",
    "tag",
    "path",
    "value",
    "fields",
    "where",
    "equals",
    "status",
    "type",
    "message",
    "interval",
    "delay",
    "timeout",
    "retries",
    "retry_delay",
    "user_id",
    "id",
    "class",
    "style",
]);

export function isEventAttribute(name: string, elementTag?: string): boolean {
    const lower = name.toLowerCase();
    if (EVENT_MODIFIER_ATTRS.has(lower)) return false;
    const tag = elementTag?.toLowerCase();
    if (tag && DECLARATIVE_EVENT_TAGS.has(tag)) {
        if (
            lower === "on_success" ||
            lower === "on_error" ||
            lower === "on_fail" ||
            lower === "on_complete" ||
            lower === "on_cancel" ||
            lower === "on_finish" ||
            lower === "on_reject" ||
            lower === "on_settled"
        ) {
            return false;
        }
        return (
            lower === "action" ||
            lower === "handler" ||
            lower === "set" ||
            lower === "toggle" ||
            lower === "call" ||
            lower === "emit" ||
            lower === "run" ||
            lower === "revalidate" ||
            lower === "mutate" ||
            lower === "focus"
        );
    }
    if (lower.startsWith("@")) return true;
    if (lower.startsWith("on_")) return true;
    return false;
}

export function normalizeEventName(name: string): string {
    if (name.startsWith("@")) return name.slice(1);
    if (name.startsWith("on_")) return name.slice(3).replace(/_/g, ":");
    if (name.startsWith("on")) return name.slice(2).toLowerCase();
    return name;
}

/** $engine.setState('field', ...) / setState("field", ...) in RUN_SCRIPT bodies. */
export function extractEngineSetStateWrites(body: string): string[] {
    const writes = new Set<string>();
    for (const match of body.matchAll(/(?:\$engine\.|engine\.|this\.)?setState\(\s*['"](?:data\.)?([^'"]+)['"]/g)) {
        if (match[1]) writes.add(match[1]);
    }
    for (const match of body.matchAll(/(?:\$engine\.|engine\.|this\.)?mutateState\(\s*['"](?:data\.)?([^'"]+)['"]/g)) {
        if (match[1]) writes.add(match[1]);
    }
    for (const match of body.matchAll(/(?:\$data|data)\.([A-Za-z_$][\w$]*)\s*(?:=|\+\+|--|\+=|-=)/g)) {
        if (match[1]) writes.add(match[1]);
    }
    return [...writes];
}

export function analyzeActionBody(body: string): {
    reads: string[];
    writes: string[];
    calls: string[];
    branches: number;
    loops: number;
    awaits: number;
    returns: boolean;
    throws: boolean;
    fetchUrls: { url: string; confidence: "confirmed" | "inferred" | "unresolved" }[];
    storageEffects: string[];
    runtimeEffects: string[];
} {
    const reads = new Set<string>();
    const writes = new Set<string>();
    const calls = new Set<string>();

    // Top-level engine state writes: $data.foo = ..., data.foo = ..., $engine.setState('foo', ...)
    for (const name of extractEngineSetStateWrites(body)) writes.add(name);

    // Track bare variable writes (e.g. count++, user = ..., loading = true)
    const declared = new Set<string>();
    for (const m of body.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) if (m[1]) declared.add(m[1]);
    for (const m of body.matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*(?:\+\+|--)/g)) {
        if (!declared.has(m[1]) && !isKeyword(m[1])) writes.add(m[1]);
    }
    for (const m of body.matchAll(/(?:^|[^.\w$])([A-Za-z_$][\w$]*)\s*=(?![=>])/g)) {
        const lhs = m[1];
        if (lhs && !["if", "for", "while", "return", "const", "let", "var"].includes(lhs) && !declared.has(lhs) && !isKeyword(lhs)) writes.add(lhs);
    }

    // Declarative XML path writes: <path>data.foo</path> or <path>foo</path>
    for (const m of body.matchAll(/<path>(?:data\.)?([A-Za-z_$][\w$]*)<\/path>/g)) {
        if (m[1]) writes.add(m[1].trim());
    }

    // Explicit state reads: $data.foo or data.foo
    for (const m of body.matchAll(/(?:\$data|data)\.([A-Za-z_$][\w$]*)/g)) {
        if (m[1] && !writes.has(m[1])) reads.add(m[1]);
    }

    for (const m of body.matchAll(/\b(\w+)\s*\(/g)) {
        const fn = m[1];
        if (fn && !isKeyword(fn)) calls.add(fn);
    }

    for (const m of body.matchAll(/\b(\w+)\b/g)) {
        const id = m[1];
        if (id && !writes.has(id) && !declared.has(id) && !isKeyword(id)) reads.add(id);
    }

    const fetchUrls: { url: string; confidence: "confirmed" | "inferred" | "unresolved" }[] = [];
    for (const m of body.matchAll(/fetch\s*\(\s*([`'"])(.*?)\1/g)) {
        fetchUrls.push({ url: m[2]!, confidence: "confirmed" });
    }
    for (const m of body.matchAll(/fetch\s*\(\s*([^)'"`]+)\)/g)) {
        const arg = m[1]?.trim();
        if (arg && !fetchUrls.some((u) => u.url === arg)) {
            fetchUrls.push({ url: arg, confidence: arg.includes("+") ? "inferred" : "unresolved" });
        }
    }

    const storageEffects: string[] = [];
    if (/localStorage/.test(body)) storageEffects.push("localStorage");
    if (/sessionStorage/.test(body)) storageEffects.push("sessionStorage");

    const runtimeEffects: string[] = [];
    for (const kind of ["setTimeout", "setInterval", "setImmediate", "queueMicrotask", "WebSocket", "EventSource", "Worker"] as const) {
        if (body.includes(kind)) runtimeEffects.push(kind);
    }

    return {
        reads: [...reads],
        writes: [...writes],
        calls: [...calls],
        branches: (body.match(/\bif\b|\?\s*[^:]+:/g) ?? []).length,
        loops: (body.match(/\b(for|while|do)\b/g) ?? []).length,
        awaits: (body.match(/\bawait\b/g) ?? []).length,
        returns: /\breturn\b/.test(body),
        throws: /\bthrow\b/.test(body),
        fetchUrls,
        storageEffects,
        runtimeEffects,
    };
}

export function looksLikeEuixTemplateLiteral(source: string): boolean {
    const markers = [
        "<component",
        "<state",
        "<computed",
        "<watch",
        "<action",
        "@click",
        "{{",
        "<uid_spec",
        "<data_model",
        "<component_def",
    ];
    const lower = source.toLowerCase();
    return markers.some((m) => lower.includes(m.toLowerCase()));
}
