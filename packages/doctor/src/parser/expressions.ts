const IDENT = /[A-Za-z_$][\w$.]*/g;
const EUIX_EXPR = /\{\{?\s*([^}]+?)\s*\}?\}/g;
const EVENT_ATTR = /^@|^on_/i;

export function extractExpressionRefs(expression: string): string[] {
    const refs = new Set<string>();
    const cleaned = expression
        .replace(/\$data\./g, "data.")
        .replace(/\?\./g, ".")
        .replace(/\[['"]([^'"]+)['"]\]/g, ".$1");

    for (const token of cleaned.match(IDENT) ?? []) {
        if (isKeyword(token)) continue;
        if (token.startsWith("data.")) {
            const stateRoot = token.slice(5).split(".")[0];
            if (stateRoot && !isKeyword(stateRoot)) refs.add(stateRoot);
            continue;
        }
        if (token.startsWith("props.")) {
            const propRoot = token.slice(6).split(".")[0];
            if (propRoot && !isKeyword(propRoot)) refs.add(propRoot);
            continue;
        }
        if (token.startsWith("api.")) continue;
        const root = token.split(".")[0];
        if (root && !isKeyword(root)) refs.add(root);
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

function isKeyword(token: string): boolean {
    return new Set([
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
        "this",
        "data",
        "props",
        "local",
        "item",
        "args",
        "api",
        "engine",
        "newValue",
        "$newValue",
        "$data",
        "$engine",
        "Number",
        "String",
        "Boolean",
        "Array",
        "Object",
        "JSON",
        "Math",
        "Date",
        "fetch",
        "Response",
        "console",
    ]).has(token);
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

export function isEventAttribute(name: string, elementTag?: string): boolean {
    const lower = name.toLowerCase();
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
    }

    if (
        lower === "confirm" ||
        lower === "prevent" ||
        lower === "prevent_default" ||
        lower === "stop" ||
        lower === "stop_propagation" ||
        lower === "debounce" ||
        lower === "throttle"
    ) {
        return false;
    }

    return (
        EVENT_ATTR.test(name) ||
        name.startsWith("on_click") ||
        name.startsWith("on_change") ||
        name.startsWith("on_submit") ||
        name.startsWith("on_key") ||
        name.startsWith("on_mount") ||
        name.startsWith("on_interval") ||
        /^on_[a-z_]+(?::|$)/.test(name)
    );
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
    for (const m of body.matchAll(/\b(?:\$engine\.)?setState\s*\(\s*['"]([\w.]+)['"]/g)) {
        if (m[1]) writes.add(m[1]!.replace(/^data\./, ""));
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

    const declared = new Set<string>();
    for (const m of body.matchAll(/\b(?:const|let|var)\s+(\w+)/g)) if (m[1]) declared.add(m[1]);
    for (const m of body.matchAll(/(\w+)\s*(?:\+\+|--)/g)) writes.add(m[1]!);
    for (const m of body.matchAll(/(\w+)\s*=\s*[^=]/g)) {
        const lhs = m[1];
        if (lhs && !["if", "for", "while"].includes(lhs) && !declared.has(lhs)) writes.add(lhs);
    }
    for (const m of body.matchAll(/\b(\w+)\s*\(/g)) {
        const fn = m[1];
        if (fn && !isKeyword(fn)) calls.add(fn);
    }
    for (const m of body.matchAll(/\b(\w+)\b/g)) {
        const id = m[1];
        if (id && !writes.has(id) && !isKeyword(id)) reads.add(id);
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

    for (const name of extractEngineSetStateWrites(body)) writes.add(name);

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
