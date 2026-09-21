/**
 * packages/core/src/prepare/runtime/ssr.js
 * Zero-DOM Server-Side Rendering (SSR) engine for EUIX Runtime IR & Prepared Applications.
 * Renders prepared applications or canonical source JSON directly into HTML strings
 * on Node.js without requiring JSDOM, browser globals, or a virtual DOM.
 */

import { renderToString as renderXmlToString } from "../../server/index.js";

const VOID_ELEMENTS = new Set([
    "area",
    "base",
    "br",
    "col",
    "embed",
    "hr",
    "img",
    "input",
    "link",
    "meta",
    "param",
    "source",
    "track",
    "wbr",
]);

/**
 * Escapes HTML characters for safe template interpolation.
 *
 * @param {string} str
 * @returns {string}
 */
function escapeHtml(str) {
    if (str === null || str === undefined) return "";
    const s = String(str);
    return s
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/**
 * Resolves a property path from state or context.
 *
 * @param {object} state
 * @param {string} path
 * @param {object} context
 * @returns {any}
 */
function resolvePath(state, path, context = {}) {
    if (!path) return undefined;
    if (context && context[path] !== undefined) return context[path];

    if (context) {
        const firstDot = path.indexOf(".");
        if (firstDot !== -1) {
            const root = path.slice(0, firstDot);
            const rest = path.slice(firstDot + 1);
            if (context[root] !== undefined) {
                return resolvePath(context[root], rest, {});
            }
        }
    }

    const cleanPath = path.replace(/^(data|state)\./, "");
    const parts = cleanPath.split(".");
    let curr = state;
    for (const p of parts) {
        if (curr === undefined || curr === null) return undefined;
        curr = curr[p];
    }
    return curr;
}

/**
 * Interpolates string expressions like "Hello, {data.user_name}!"
 *
 * @param {string} str
 * @param {object} state
 * @param {object} context
 * @returns {string}
 */
function interpolateString(str, state, context = {}) {
    if (!str || typeof str !== "string") return str;
    return str.replace(/\{([^{}]+)\}/g, (match, expr) => {
        const cleanExpr = expr.trim();
        const pathVal = resolvePath(state, cleanExpr, context);
        if (pathVal !== undefined && pathVal !== null) {
            return String(pathVal);
        }

        try {
            const contextKeys = Object.keys(context || {}).filter((k) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k));
            const contextVals = contextKeys.map((k) => context[k]);
            const jsExpr = cleanExpr.replace(/(?:^|[^a-zA-Z0-9_])(data|state)\.([a-zA-Z0-9_]+)/g, "$data.$2");
            const fn = new Function("$data", "data", "$ctx", "context", ...contextKeys, `return (${jsExpr});`);
            const res = fn(state, state, context, context, ...contextVals);
            return res !== undefined && res !== null ? String(res) : "";
        } catch (_) {
            return match;
        }
    });
}

/**
 * Evaluates a condition against state and context.
 *
 * @param {any} cond
 * @param {object} state
 * @param {object} context
 * @returns {boolean}
 */
function evaluateCondition(cond, state, context = {}) {
    if (cond === null || cond === undefined) return true;
    if (typeof cond === "boolean") return cond;

    if (typeof cond === "object") {
        if (cond.type === "state" && cond.path) {
            return Boolean(resolvePath(state, cond.path, context));
        }
        if (cond.type === "prop" && cond.propName) {
            return Boolean(context[cond.propName]);
        }
    }

    if (typeof cond === "string") {
        const val = resolvePath(state, cond, context);
        if (val !== undefined) return Boolean(val);

        try {
            const contextKeys = Object.keys(context || {}).filter((k) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k));
            const contextVals = contextKeys.map((k) => context[k]);
            const jsExpr = cond.replace(/(?:^|[^a-zA-Z0-9_])(data|state)\.([a-zA-Z0-9_]+)/g, "$data.$2");
            const fn = new Function("$data", "data", "$ctx", "context", ...contextKeys, `return Boolean(${jsExpr});`);
            return fn(state, state, context, context, ...contextVals);
        } catch (_) {
            return Boolean(cond);
        }
    }

    return Boolean(cond);
}

/**
 * Resolves a prop or attribute value from node/state/context.
 *
 * @param {any} propVal
 * @param {object} state
 * @param {object} context
 * @returns {any}
 */
function resolveAttrValue(propVal, state, context) {
    if (propVal === null || propVal === undefined) return "";
    if (typeof propVal === "object") {
        if (propVal.type === "state" && propVal.path) {
            const v = resolvePath(state, propVal.path, context);
            return v !== undefined ? v : "";
        }
        if (propVal.type === "prop" && propVal.propName) {
            const v = context[propVal.propName];
            return v !== undefined ? v : "";
        }
        if (propVal.$bind !== undefined) {
            const v = resolvePath(state, propVal.$bind, context);
            return v !== undefined ? v : "";
        }
        if (propVal.$prop !== undefined) {
            const v = context[propVal.$prop];
            return v !== undefined ? v : "";
        }
        return JSON.stringify(propVal);
    }
    if (typeof propVal === "string") {
        return interpolateString(propVal, state, context);
    }
    return propVal;
}

/**
 * Recursively renders a Runtime IR view node to HTML string.
 *
 * @param {any} node
 * @param {object} state
 * @param {object} context
 * @param {Map<string, any>} compRegistry
 * @param {object} options
 * @returns {string}
 */
function renderIrNode(node, state, context, compRegistry, options) {
    if (node === null || node === undefined) return "";

    // Primitive text or numbers
    if (typeof node !== "object") {
        return escapeHtml(interpolateString(String(node), state, context));
    }

    // Array of nodes
    if (Array.isArray(node)) {
        return node.map((child) => renderIrNode(child, state, context, compRegistry, options)).join("");
    }

    // State Descriptor: { type: "state", path: "counter" } or { "$bind": "counter" }
    if ((node.type === "state" && node.path) || node.$bind !== undefined) {
        const bPath = node.path || node.$bind;
        const val = resolvePath(state, bPath, context);
        return escapeHtml(val !== undefined && val !== null ? String(val) : "");
    }

    // Prop Descriptor: { type: "prop", propName: "title" } or { "$prop": "title" }
    if ((node.type === "prop" && node.propName) || node.$prop !== undefined) {
        const pName = node.propName || node.$prop;
        const val = context[pName] !== undefined ? context[pName] : context.props?.[pName];
        return escapeHtml(val !== undefined && val !== null ? String(val) : "");
    }

    // Route Descriptor: { type: "route", param: "id" } or { "$route": "id" }
    if ((node.type === "route" && node.param) || node.$route !== undefined) {
        const rParam = node.param || node.$route;
        const val = context[rParam] !== undefined ? context[rParam] : (options.route?.params?.[rParam]);
        return escapeHtml(val !== undefined && val !== null ? String(val) : "");
    }

    // Conditional: { condition: ... }
    if (node.condition !== undefined && !evaluateCondition(node.condition, state, context)) {
        if (node.else) {
            return renderIrNode(node.else, state, context, compRegistry, options);
        }
        return "";
    }

    // Loop: { items: ..., var: "item" }
    if (node.items !== undefined) {
        let itemsList = [];
        if (typeof node.items === "object" && node.items.type === "state") {
            itemsList = resolvePath(state, node.items.path, context);
        } else if (typeof node.items === "string") {
            itemsList = resolvePath(state, node.items, context);
        } else if (Array.isArray(node.items)) {
            itemsList = node.items;
        }

        if (!Array.isArray(itemsList)) return "";

        const varName = node.var || "item";
        let loopHtml = "";
        itemsList.forEach((item, idx) => {
            const itemContext = {
                ...context,
                [varName]: item,
                index: idx,
                $index: idx,
            };
            if (node.children) {
                loopHtml += renderIrNode(node.children, state, itemContext, compRegistry, options);
            }
        });
        return loopHtml;
    }

    // Component invocation: { componentName: "UserCard", props: ... }
    if (node.componentName) {
        const comp = compRegistry.get(node.componentName.toLowerCase());
        const resolvedProps = {};
        if (node.props && typeof node.props === "object") {
            for (const [k, v] of Object.entries(node.props)) {
                resolvedProps[k] = resolveAttrValue(v, state, context);
            }
        }

        if (comp) {
            const compView = comp.view || comp;
            const compContext = { ...context, ...resolvedProps, props: resolvedProps };
            return renderIrNode(compView, state, compContext, compRegistry, options);
        }

        // Custom component container tag fallback
        const compTag = node.componentName.toLowerCase();
        let attrsStr = "";
        for (const [k, v] of Object.entries(resolvedProps)) {
            attrsStr += ` ${escapeHtml(k)}="${escapeHtml(String(v))}"`;
        }
        const inner = node.children ? renderIrNode(node.children, state, context, compRegistry, options) : "";
        return `<${compTag}${attrsStr}>${inner}</${compTag}>`;
    }

    // Tag identification
    let tag = (node.tag || "div").toLowerCase();
    const attrs = {};

    // Layout Tag transformations
    if (tag === "flex") {
        tag = "div";
        const dir = node.props?.direction || "row";
        const gap = node.props?.gap ? `gap: ${node.props.gap}px;` : "";
        const alignVal = node.props?.align
            ? node.props.align === "start"
                ? "flex-start"
                : node.props.align === "end"
                  ? "flex-end"
                  : node.props.align
            : "";
        const align = alignVal ? `align-items: ${alignVal};` : "";
        const justifyVal = node.props?.justify
            ? node.props.justify === "between"
                ? "space-between"
                : node.props.justify === "around"
                  ? "space-around"
                  : node.props.justify === "evenly"
                    ? "space-evenly"
                    : node.props.justify === "start"
                      ? "flex-start"
                      : node.props.justify === "end"
                        ? "flex-end"
                        : node.props.justify
            : "";
        const justify = justifyVal ? `justify-content: ${justifyVal};` : "";
        const flexStyle = `display: flex; flex-direction: ${dir}; ${gap} ${align} ${justify}`
            .replace(/\s+/g, " ")
            .trim();
        attrs["style"] = flexStyle;
    } else if (tag === "card") {
        tag = "div";
        attrs["class"] = "euix-card";
        const pad = node.props?.padding ? `padding: ${node.props.padding}px;` : "padding: 16px;";
        const rad = node.props?.radius ? `border-radius: ${node.props.radius}px;` : "border-radius: 12px;";
        attrs["style"] = `${pad} ${rad}`.trim();
    } else if (tag === "container") {
        tag = "div";
        attrs["class"] = "euix-container";
    }

    // Process Props & Attributes
    if (node.props && typeof node.props === "object") {
        for (const [k, v] of Object.entries(node.props)) {
            if (["direction", "gap", "align", "justify", "padding", "radius"].includes(k) && (node.tag === "flex" || node.tag === "card")) {
                continue;
            }
            const val = resolveAttrValue(v, state, context);
            if (k === "class" && attrs["class"]) {
                attrs["class"] = `${attrs["class"]} ${val}`.trim();
            } else if (k === "style" && attrs["style"]) {
                attrs["style"] = `${attrs["style"]}; ${val}`.trim();
            } else if (val !== null && val !== undefined) {
                attrs[k] = val;
            }
        }
    }

    // Two-way binding attribute support for inputs
    if (node.props?.bind) {
        const bindKey = typeof node.props.bind === "object"
            ? node.props.bind.path || node.props.bind.$bind
            : node.props.bind;
        if (bindKey) {
            const val = resolvePath(state, bindKey, context);
            if (val !== undefined && attrs["value"] === undefined) {
                attrs["value"] = val;
            }
        }
    }

    // Build attribute string
    let attrsHtml = "";
    for (const [attrName, attrVal] of Object.entries(attrs)) {
        if (attrVal === true) {
            attrsHtml += ` ${escapeHtml(attrName)}`;
        } else if (attrVal !== false && attrVal !== null && attrVal !== undefined) {
            attrsHtml += ` ${escapeHtml(attrName)}="${escapeHtml(String(attrVal))}"`;
        }
    }

    // Void Elements
    if (VOID_ELEMENTS.has(tag)) {
        return `<${tag}${attrsHtml} />`;
    }

    // Normal elements with children
    const childrenHtml = node.children
        ? renderIrNode(node.children, state, context, compRegistry, options)
        : "";

    return `<${tag}${attrsHtml}>${childrenHtml}</${tag}>`;
}

/**
 * Server-Side Render (SSR) an EUIX application, Runtime IR, or Source JSON to an HTML string.
 * Completely Zero-DOM: works on Node.js without JSDOM or browser APIs.
 *
 * @param {any} appOrIrOrSource - PreparedApp, Runtime IR object, JSON Source object, or XML/JSON string
 * @param {object} [initialData={}] - Initial state data overrides
 * @param {object} [options={}] - Render options (components, route, etc.)
 * @returns {string} Rendered HTML string
 */
export function renderToString(appOrIrOrSource, initialData = {}, options = {}) {
    if (!appOrIrOrSource) return "";

    // 1. XML String delegation to XML server renderer
    if (typeof appOrIrOrSource === "string") {
        const trimmed = appOrIrOrSource.trim();
        if (trimmed.startsWith("<")) {
            return renderXmlToString(appOrIrOrSource, initialData, options);
        }
        try {
            appOrIrOrSource = JSON.parse(appOrIrOrSource);
        } catch (_) {
            return "";
        }
    }

    // 2. Extract IR from PreparedApp or directly
    const ir = appOrIrOrSource.ir || (appOrIrOrSource.irVersion ? appOrIrOrSource : null);

    // 3. Build component registry
    const compRegistry = new Map();
    if (options.components && typeof options.components === "object") {
        for (const [name, compDef] of Object.entries(options.components)) {
            compRegistry.set(name.toLowerCase(), compDef);
        }
    }

    const sourceComponents = appOrIrOrSource.source?.components || appOrIrOrSource.components;
    if (sourceComponents && typeof sourceComponents === "object") {
        for (const [name, compDef] of Object.entries(sourceComponents)) {
            compRegistry.set(name.toLowerCase(), compDef);
        }
    }

    // If we have a normalized Runtime IR
    if (ir && ir.irVersion) {
        const state = {};
        if (Array.isArray(ir.states)) {
            for (const s of ir.states) {
                state[s.name] = s.initial;
            }
        }
        Object.assign(state, initialData);

        // Populate inline components
        if (Array.isArray(ir.components)) {
            for (const c of ir.components) {
                if (c.name && !compRegistry.has(c.name.toLowerCase())) {
                    compRegistry.set(c.name.toLowerCase(), c);
                }
            }
        }

        return renderIrNode(ir.view, state, {}, compRegistry, options);
    }

    // Fallback: If it's a raw canonical Source JSON object { version: 1, state: ..., view: ... }
    if (appOrIrOrSource.view) {
        const state = { ...(appOrIrOrSource.state || {}), ...initialData };
        if (appOrIrOrSource.components && typeof appOrIrOrSource.components === "object") {
            for (const [name, compDef] of Object.entries(appOrIrOrSource.components)) {
                compRegistry.set(name.toLowerCase(), compDef);
            }
        }
        return renderIrNode(appOrIrOrSource.view, state, {}, compRegistry, options);
    }

    return "";
}
