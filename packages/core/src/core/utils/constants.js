/**
 * src/core/utils/constants.js
 * Core constants, shared sets, and optimized primitives for EUIX Engine.
 */

// Pure internal helpers for tree-shaking and minification optimization
export const EMPTY_ARR = Object.freeze([]);
export const EMPTY_OBJ = Object.freeze({});
export const noop = () => {};

export const isObj = (v) => v !== null && typeof v === "object";
export const isFn = (v) => typeof v === "function";
export const isStr = (v) => typeof v === "string";
export const isBool = (v) => typeof v === "boolean";
export const isNum = (v) => typeof v === "number" && !Number.isNaN(v);
export const isElem = (n) => n && n.nodeType === 1;
export const isTxtNode = (n) => n && (n.nodeType === 3 || n.nodeType === 4);

export const hasWindow = () => typeof window !== "undefined";
export const hasDoc = () => typeof document !== "undefined";
export const isBrowser = () => typeof window !== "undefined" && typeof document !== "undefined";
export const HAS_WINDOW = typeof window !== "undefined";
export const HAS_DOCUMENT = typeof document !== "undefined";
export const IS_BROWSER = typeof window !== "undefined" && typeof document !== "undefined";

export function safeStringify(val, space) {
    if (val === undefined) return "";
    if (val === null) return "null";
    if (typeof val === "string") return val;
    if (typeof val === "number" || typeof val === "boolean") return String(val);
    try {
        return JSON.stringify(val, null, space);
    } catch (_) {
        try {
            const seen = new WeakSet();
            return JSON.stringify(
                val,
                (key, value) => {
                    if (typeof value === "object" && value !== null) {
                        if (value.nodeType !== undefined) return "[DOM Node]";
                        if (seen.has(value)) return "[Circular]";
                        seen.add(value);
                    }
                    return value;
                },
                space,
            );
        } catch (__) {
            return String(val);
        }
    }
}
export function safeParse(str, fallback = null) {
    if (str === null || str === undefined || str === "") return fallback;
    if (typeof str !== "string") return isObj(str) ? str : fallback;
    try {
        return JSON.parse(str);
    } catch (_) {
        return fallback;
    }
}
export const trimStr = (s) => (typeof s === "string" ? s.trim() : s?.textContent ? s.textContent.trim() : "");
export const splitPath = (p) =>
    p
        ? String(p)
              .replace(/\[(\w+)\]/g, ".$1")
              .split(".")
              .filter(Boolean)
        : EMPTY_ARR;
export const getRootKey = (p) => String(p || "").split(/[.[]/)[0];
export const getTagName = (n) => (n?.tagName ? n.tagName.toLowerCase() : "");
export const genId = (p = "id_") => p + Math.random().toString(36).substring(2, 9);
export const getNow = () =>
    typeof performance !== "undefined" && isFn(performance.now) ? performance.now() : Date.now();
export const getAttr = (n, ...names) => {
    if (!n?.getAttribute) return "";
    for (const name of names) {
        const val = n.getAttribute(name);
        if (val !== null && val !== undefined && val !== "") return val;
    }
    return "";
};
export const getChildNodes = (n) => (n?.childNodes && n.childNodes.length > 0 ? Array.from(n.childNodes) : EMPTY_ARR);
export const getChildrenList = (n) => (n?.children && n.children.length > 0 ? Array.from(n.children) : EMPTY_ARR);
export const queryAll = (n, selector) => {
    if (!n) return EMPTY_ARR;
    if (isFn(n.querySelectorAll)) {
        const res = n.querySelectorAll(selector);
        return res && res.length > 0 ? Array.from(res) : EMPTY_ARR;
    }
    if (isFn(n.getElementsByTagName) && !selector.includes(" ") && !selector.includes(">") && !selector.includes(",")) {
        const res = n.getElementsByTagName(selector);
        return res && res.length > 0 ? Array.from(res) : EMPTY_ARR;
    }
    return EMPTY_ARR;
};
export const isScoped = (n) => {
    if (!n?.getAttribute) return false;
    const s = n.getAttribute("scope");
    return (
        n.getAttribute("isolated") === "true" ||
        n.getAttribute("scoped") === "true" ||
        s === "local" ||
        s === "isolated" ||
        s === "scoped"
    );
};
export const toNum = (val, defaultVal = 0) => {
    const n = Number(val);
    return Number.isNaN(n) ? defaultVal : n;
};
export const toInt = (val, defaultVal = 0) => {
    const n = parseInt(val, 10);
    return Number.isNaN(n) ? defaultVal : n;
};

export const isCycleError = (err) => {
    const msg = err?.message ? err.message : "";
    const code = err?.code ? err.code : "";
    return (
        code === "WATCHER_CYCLE_ERROR" ||
        code === "COMPUTED_CYCLE_ERROR" ||
        code === "CIRCULAR_LAZY_DEPENDENCY" ||
        msg.includes("CIRCULAR_LAZY_DEPENDENCY") ||
        msg.includes("Infinite Loop Guard") ||
        msg.includes("Maximum watcher reaction depth") ||
        msg.includes("Cascade limit exceeded")
    );
};

export const getForEachItemHash = (item) => {
    if (item === null || typeof item !== "object") {
        return item;
    }
    if (item.__v !== undefined) return item.__v;
    if (item._hash !== undefined) return item._hash;
    let h = "";
    for (const k in item) {
        if (k !== "_index" && k !== "index") {
            const v = item[k];
            h += `${k}:${v !== null && typeof v === "object" ? (v.id ?? v.key ?? "") : v};`;
        }
    }
    return h;
};

export const ALLOWED_HTML_TAGS = new Set([
    "button",
    "input",
    "textarea",
    "select",
    "form",
    "a",
    "img",
    "option",
    "table",
    "tr",
    "td",
    "th",
    "div",
    "span",
    "strong",
    "em",
    "label",
    "p",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "section",
    "article",
    "header",
    "footer",
    "nav",
    "aside",
    "main",
    "figure",
    "figcaption",
    "mark",
    "small",
    "sub",
    "sup",
    "code",
    "pre",
    "blockquote",
    "br",
    "hr",
    "b",
    "i",
    "u",
    "s",
    "ul",
    "ol",
    "li",
    "kbd",
    "details",
    "summary",
    "svg",
    "path",
    "circle",
    "rect",
    "line",
    "polyline",
    "polygon",
    "ellipse",
    "g",
    "defs",
    "use",
    "clippath",
    "mask",
    "pattern",
    "lineargradient",
    "radialgradient",
    "stop",
    "symbol",
    "marker",
    "tspan",
]);

export const _templateTokensCache = new Map();

export function getCompiledTemplate(text) {
    let compiled = _templateTokensCache.get(text);
    if (compiled !== undefined) return compiled;

    if (/[?!=><+*/(),&|%-]/.test(text)) {
        if (_templateTokensCache.size > 1000) _templateTokensCache.clear();
        _templateTokensCache.set(text, null);
        return null;
    }

    const chunks = [];
    let lastIdx = 0;
    const len = text.length;
    let isPureSimple = true;

    for (let i = 0; i < len; i++) {
        if (text.charCodeAt(i) === 123) {
            // '{'
            const closeIdx = text.indexOf("}", i + 1);
            if (closeIdx === -1) {
                isPureSimple = false;
                break;
            }
            if (i > lastIdx) {
                chunks.push({ type: "static", val: text.slice(lastIdx, i) });
            }
            const rawInner = text.slice(i + 1, closeIdx).trim();
            if (!rawInner || /[?!=><+*/(),[\]&|%-]/.test(rawInner)) {
                isPureSimple = false;
                break;
            }

            const dotIdx = rawInner.indexOf(".");
            if (dotIdx === -1) {
                chunks.push({ type: "token", isSimple: true, scope: rawInner, prop: "" });
            } else {
                const scope = rawInner.slice(0, dotIdx);
                const prop = rawInner.slice(dotIdx + 1);
                chunks.push({
                    type: "token",
                    isSimple: false,
                    scope,
                    prop,
                    parts: prop.includes(".") ? prop.split(".") : [prop],
                });
            }
            i = closeIdx;
            lastIdx = closeIdx + 1;
        }
    }

    if (!isPureSimple) {
        compiled = null;
    } else {
        if (lastIdx < len) {
            chunks.push({ type: "static", val: text.slice(lastIdx) });
        }
        compiled = chunks;
    }

    if (_templateTokensCache.size > 1000) _templateTokensCache.clear();
    _templateTokensCache.set(text, compiled);
    return compiled;
}

export const EVENT_TAGS = new Set([
    "event",
    "on",
    "on_click",
    "on_change",
    "on_submit",
    "on_keyup",
    "on_keydown",
    "on_mouseenter",
    "on_mouseleave",
]);

export const METADATA_AND_EVENT_TAGS = new Set([
    "event",
    "on",
    "on_click",
    "on_change",
    "on_submit",
    "on_keyup",
    "on_keydown",
    "on_mouseenter",
    "on_mouseleave",
    "on_interval",
    "on_timer",
    "on_mount",
    "on_state_change",
    "on_visible",
    "on_update",
    "watch",
    "api_config",
    "api_endpoint",
    "endpoint",
    "api",
    "persistence",
    "data_model",
    "imports",
    "constants",
    "vars",
    "variables",
    "navigator_config",
    "device_config",
    "date_config",
    "date-config",
    "date_settings",
    "date-settings",
    "use_script",
    "script_loader",
    "load_script",
    "use_style",
    "style_loader",
    "load_style",
    "style",
    "actions",
    "action_def",
    "workflow_def",
    "animations",
    "animation_def",
    "keyframe_def",
    "keyframe",
    "animate",
    "transition",
]);

export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export const SVG_TAGS = new Set([
    "svg",
    "path",
    "g",
    "circle",
    "rect",
    "line",
    "polyline",
    "polygon",
    "ellipse",
    "text",
    "tspan",
    "use",
    "defs",
    "clippath",
    "clipPath",
    "mask",
    "pattern",
    "image",
    "foreignobject",
    "foreignObject",
    "lineargradient",
    "linearGradient",
    "radialgradient",
    "radialGradient",
    "stop",
    "symbol",
    "marker",
]);

export const BOOLEAN_ATTRS = new Set([
    "disabled",
    "checked",
    "readonly",
    "required",
    "autofocus",
    "hidden",
    "selected",
    "multiple",
    "open",
    "novalidate",
    "reversed",
    "inert",
    "allowfullscreen",
    "playsinline",
    "async",
    "defer",
    "loop",
    "muted",
    "autoplay",
    "controls",
    "default",
    "ismap",
]);

export const ACTION_DISPATCH_TABLE = {
    SET_STATE: "_handleSetStateAction",
    TOGGLE_STATE: "_handleToggleStateAction",
    TOGGLE: "_handleToggleStateAction",
    MUTATE_STATE: "_handleMutateStateAction",
    FOCUS: "_handleFocusAction",
    REVALIDATE_API: "_handleRevalidateAction",
    REVALIDATE: "_handleRevalidateAction",
    RUN_SCRIPT: "_handleRunScriptAction",
    EVAL_JS: "_handleRunScriptAction",
    EXEC_JS: "_handleRunScriptAction",
    SCRIPT: "_handleRunScriptAction",
    TRY: "_handleTryCatchFinally",
    RETHROW: "_handleRethrowAction",
    THROW: "_handleThrowAction",
    SET_TITLE: "_handleSetTitleAction",
    ANIMATE: "_handleAnimateAction",
    TRANSITION: "_handleAnimateAction",
    UNDO_STATE: "_handleUndoStateAction",
    HISTORY_UNDO: "_handleUndoStateAction",
    REDO_STATE: "_handleRedoStateAction",
    HISTORY_REDO: "_handleRedoStateAction",
    TAKE_SNAPSHOT: "_handleTakeSnapshotAction",
    RESET_ERROR_BOUNDARY: "_handleResetErrorBoundaryAction",
    RETRY_ERROR_BOUNDARY: "_handleResetErrorBoundaryAction",
    RESET_BOUNDARY: "_handleResetErrorBoundaryAction",
    RETRY_BOUNDARY: "_handleResetErrorBoundaryAction",
    EMIT: "_handleEmitAction",
};

export function registerMetadataTag(tag) {
    if (tag) METADATA_AND_EVENT_TAGS.add(String(tag).toLowerCase());
}

export function registerActionDispatch(actionType, methodNameOrFn) {
    if (actionType) {
        ACTION_DISPATCH_TABLE[String(actionType).toUpperCase()] = methodNameOrFn;
    }
}

export const _resolveRoot = (r) => r;
export const _resolveChild0 = (r) => (r?.childNodes ? r.childNodes[0] : null);
export const _resolveChild1 = (r) => (r?.childNodes ? r.childNodes[1] : null);
export const _resolveChild2 = (r) => (r?.childNodes ? r.childNodes[2] : null);
export const _resolveChild3 = (r) => (r?.childNodes ? r.childNodes[3] : null);
export const _resolveChild0_0 = (r) => (r?.childNodes?.[0] ? r.childNodes[0].childNodes[0] : null);
export const _resolveChild0_1 = (r) => (r?.childNodes?.[0] ? r.childNodes[0].childNodes[1] : null);
export const _resolveChild1_0 = (r) => (r?.childNodes?.[1] ? r.childNodes[1].childNodes[0] : null);
export const _resolveChild1_1 = (r) => (r?.childNodes?.[1] ? r.childNodes[1].childNodes[1] : null);
export const _resolveChild2_0 = (r) => (r?.childNodes?.[2] ? r.childNodes[2].childNodes[0] : null);
export const _resolveChild2_1 = (r) => (r?.childNodes?.[2] ? r.childNodes[2].childNodes[1] : null);

export function _getNodeAtPath(root, path) {
    let curr = root;
    for (let i = 0; i < path.length; i++) {
        if (!curr?.childNodes) return null;
        curr = curr.childNodes[path[i]];
    }
    return curr;
}

export function _getStaticNodeResolver(path) {
    const len = path.length;
    if (len === 0) return _resolveRoot;
    if (len === 1) {
        if (path[0] === 0) return _resolveChild0;
        if (path[0] === 1) return _resolveChild1;
        if (path[0] === 2) return _resolveChild2;
        if (path[0] === 3) return _resolveChild3;
        const p0 = path[0];
        return (r) => (r?.childNodes ? r.childNodes[p0] : null);
    }
    if (len === 2) {
        if (path[0] === 0 && path[1] === 0) return _resolveChild0_0;
        if (path[0] === 0 && path[1] === 1) return _resolveChild0_1;
        if (path[0] === 1 && path[1] === 0) return _resolveChild1_0;
        if (path[0] === 1 && path[1] === 1) return _resolveChild1_1;
        if (path[0] === 2 && path[1] === 0) return _resolveChild2_0;
        if (path[0] === 2 && path[1] === 1) return _resolveChild2_1;
        const p0 = path[0],
            p1 = path[1];
        return (r) => (r?.childNodes?.[p0]?.childNodes ? r.childNodes[p0].childNodes[p1] : null);
    }
    return (r) => _getNodeAtPath(r, path);
}

export const MUTATION_OPS = Object.freeze({
    CLEAR: "CLEAR",
    EMPTY: "EMPTY",
    RESET: "RESET",
    INCREMENT: "INCREMENT",
    DECREMENT: "DECREMENT",
    PUSH: "PUSH",
    APPEND: "APPEND",
    UNSHIFT: "UNSHIFT",
    PREPEND: "PREPEND",
    POP: "POP",
    SHIFT: "SHIFT",
    REMOVE: "REMOVE",
    DELETE: "DELETE",
    INSERT: "INSERT",
    UPDATE: "UPDATE",
    SWAP: "SWAP",
    MOVE_UP: "MOVE_UP",
    MOVE_DOWN: "MOVE_DOWN",
    REVERSE: "REVERSE",
    SORT: "SORT",
});

/**
 * Standardized default timeout durations across EUIX Engine (in milliseconds).
 */
export const DEFAULT_TIMEOUTS = Object.freeze({
    API_REQUEST: 12000,       // Default XHR / API endpoint request timeout
    COMPONENT_LOAD: 10000,    // Remote XML component load (ComponentLoader & DeclarativeLoader)
    RESOURCE_LOAD: 10000,     // Remote data model & constants load (<data_model src="...">, <constants src="...">)
    SCRIPT_LOAD: 8000,        // Remote external script load (<use_script src="...">)
    ROUTER_LOADER: 10000,     // Router declarative / programmatic loader fetch
    STREAM_CONNECT: 10000,    // Stream connection timeout (WebSocket, SSE handshake)
    ACTION_EXECUTION: 30000,  // Resilience timeout guard for actions (<timeout ms="...">)
    PLAYWRIGHT_IDLE: 15000,   // Playwright waitForIdle
    PLAYWRIGHT_LAZY: 10000,   // Playwright waitForLazy
    PLAYWRIGHT_READY: 5000,   // Playwright waitForReady
});

/**
 * Creates an AbortSignal that automatically aborts after timeoutMs milliseconds.
 * If a parentSignal is provided, aborts whenever either fires.
 * Returns { signal, cleanup }.
 */
export function createTimeoutSignal(timeoutMs, parentSignal = null) {
    if (!timeoutMs || timeoutMs <= 0) {
        return { signal: parentSignal, cleanup: noop };
    }
    const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
    if (!controller) {
        return { signal: parentSignal, cleanup: noop };
    }

    let timerId = setTimeout(() => {
        try {
            controller.abort(new Error(`Operation timed out after ${timeoutMs}ms`));
        } catch (_) {
            controller.abort();
        }
    }, timeoutMs);

    let onParentAbort = null;
    if (parentSignal) {
        if (parentSignal.aborted) {
            clearTimeout(timerId);
            try {
                controller.abort(parentSignal.reason);
            } catch (_) {
                controller.abort();
            }
        } else {
            onParentAbort = () => {
                clearTimeout(timerId);
                try {
                    controller.abort(parentSignal.reason);
                } catch (_) {
                    controller.abort();
                }
            };
            if (isFn(parentSignal.addEventListener)) {
                parentSignal.addEventListener("abort", onParentAbort, { once: true });
            }
        }
    }

    const cleanup = () => {
        if (timerId) {
            clearTimeout(timerId);
            timerId = null;
        }
        if (parentSignal && onParentAbort && isFn(parentSignal.removeEventListener)) {
            parentSignal.removeEventListener("abort", onParentAbort);
        }
    };

    return { signal: controller.signal, cleanup };
}

/**
 * Executes a fetch request with an automatic timeout signal and cleanup.
 *
 * @param {string|Request} url
 * @param {RequestInit} [options={}]
 * @param {number} [timeoutMs=DEFAULT_TIMEOUTS.API_REQUEST]
 * @returns {Promise<Response>}
 */
export async function safeFetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUTS.API_REQUEST) {
    const fetchFn = typeof fetch !== "undefined" ? fetch : null;
    if (!fetchFn) {
        throw new Error("[EUIX] fetch is not available in current environment");
    }
    const effectiveTimeout = timeoutMs !== undefined && timeoutMs !== null ? timeoutMs : DEFAULT_TIMEOUTS.API_REQUEST;
    const { signal, cleanup } = createTimeoutSignal(effectiveTimeout, options?.signal);
    try {
        const fetchOptions = options ? { ...options, signal } : { signal };
        return await fetchFn(url, fetchOptions);
    } finally {
        cleanup();
    }
}

