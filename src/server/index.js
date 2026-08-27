/**
 * src/server/index.js
 * Zero-JSDOM Server-Side Rendering (SSR) engine for EUIX Engine.
 */

import { compileXmlToAst } from "../compiler/index.js";

/**
 * Renders an EUIX XML string or AST tree into a static HTML string on the server without DOM/JSDOM.
 * @param {string|object} xmlOrAst
 * @param {object} initialData
 * @param {object} options
 * @returns {string} Server-rendered HTML string
 */
export function renderToString(xmlOrAst, initialData = {}, options = {}) {
    const ast = typeof xmlOrAst === "string" ? compileXmlToAst(xmlOrAst) : xmlOrAst;
    if (!ast) return "";

    // 1. Build server state store
    const state = { ...initialData };
    _extractDataModel(ast, state);

    // 2. Render AST nodes to HTML string
    const html = _renderNode(ast, state, {});
    return html;
}

/**
 * Extracts initial state values from <data_model> AST node.
 */
function _extractDataModel(node, state) {
    if (!node || typeof node !== "object") return;
    if (node.tag === "data_model" && Array.isArray(node.children)) {
        for (const child of node.children) {
            if (typeof child === "object" && (child.tag === "state" || child.tag === "computed")) {
                const key = child.attrs.id || child.attrs.key || child.attrs.name;
                const type = (child.attrs.type || "").toLowerCase();
                const rawContent = (child.children || []).filter(c => typeof c === "string").join("").trim();
                if (key && state[key] === undefined) {
                    if (type === "number") {
                        state[key] = parseFloat(rawContent) || 0;
                    } else if (type === "boolean") {
                        state[key] = rawContent === "true";
                    } else if (type === "array") {
                        try {
                            state[key] = JSON.parse(rawContent || "[]");
                        } catch (_) {
                            state[key] = [];
                        }
                    } else if (type === "object") {
                        try {
                            state[key] = JSON.parse(rawContent || "{}");
                        } catch (_) {
                            state[key] = {};
                        }
                    } else {
                        state[key] = rawContent;
                    }
                }
            }
        }
    }
    if (Array.isArray(node.children)) {
        for (const child of node.children) {
            if (typeof child === "object") {
                _extractDataModel(child, state);
            }
        }
    }
}

/**
 * Recursively renders an AST node into HTML.
 */
function _renderNode(node, state, context = {}) {
    if (!node) return "";
    if (typeof node === "string") {
        return _interpolateString(node, state, context);
    }

    const tag = node.tag ? node.tag.toLowerCase() : "";

    // Ignore non-visual tags during SSR
    if (
        tag === "data_model" ||
        tag === "api_config" ||
        tag === "api_endpoint" ||
        tag === "actions" ||
        tag === "action_def" ||
        tag.startsWith("on_") ||
        tag === "event" ||
        tag === "step" ||
        tag === "catch" ||
        tag === "finally"
    ) {
        return "";
    }

    // <for_each items="{data.items}" var="item">
    if (tag === "for_each") {
        const itemsExpr = node.attrs.items || node.attrs.from || "";
        const varName = node.attrs.var || node.attrs.as || "item";
        const cleanPath = itemsExpr.replace(/^\{|\}$/g, "").replace(/^(data|state)\./, "");
        const list = _resolvePath(state, cleanPath) || [];
        if (!Array.isArray(list)) return "";

        let output = "";
        for (let idx = 0; idx < list.length; idx++) {
            const item = list[idx];
            const childContext = {
                ...context,
                [varName]: item,
                item,
                _index: idx,
                index: idx
            };
            for (const child of node.children) {
                output += _renderNode(child, state, childContext);
            }
        }
        return output;
    }

    // <if condition="...">
    if (tag === "if") {
        const condition = node.attrs.condition || node.attrs.test || "true";
        const isTrue = _evaluateCondition(condition, state, context);
        if (!isTrue) return "";

        let output = "";
        for (const child of node.children) {
            output += _renderNode(child, state, context);
        }
        return output;
    }

    // Map custom EUIX tags to semantic HTML tags
    let htmlTag = tag;
    const attrs = { ...node.attrs };

    if (tag === "uid_spec" || tag === "root") {
        htmlTag = "div";
        attrs["class"] = attrs["class"] ? `euix-app ${attrs["class"]}` : "euix-app";
    } else if (tag === "flex") {
        htmlTag = "div";
        const dir = attrs.direction || "row";
        const gap = attrs.gap ? `gap: ${attrs.gap}px;` : "";
        const align = attrs.align ? `align-items: ${attrs.align};` : "";
        const justify = attrs.justify ? `justify-content: ${attrs.justify};` : "";
        const flexStyle = `display: flex; flex-direction: ${dir}; ${gap} ${align} ${justify}`.trim();
        attrs["style"] = attrs["style"] ? `${flexStyle}; ${attrs["style"]}` : flexStyle;
        delete attrs.direction;
        delete attrs.gap;
        delete attrs.align;
        delete attrs.justify;
    } else if (tag === "card") {
        htmlTag = "div";
        const pad = attrs.padding ? `padding: ${attrs.padding}px;` : "padding: 16px;";
        const rad = attrs.radius ? `border-radius: ${attrs.radius}px;` : "border-radius: 12px;";
        const cardStyle = `${pad} ${rad}`.trim();
        attrs["style"] = attrs["style"] ? `${cardStyle}; ${attrs["style"]}` : cardStyle;
        attrs["class"] = attrs["class"] ? `euix-card ${attrs["class"]}` : "euix-card";
        delete attrs.padding;
        delete attrs.radius;
    } else if (tag === "container") {
        htmlTag = "div";
        attrs["class"] = attrs["class"] ? `euix-container ${attrs["class"]}` : "euix-container";
    } else if (tag === "text") {
        htmlTag = "span";
        const color = attrs.color ? `color: ${attrs.color};` : "";
        const size = attrs.size ? `font-size: ${attrs.size}px;` : "";
        const weight = attrs.weight ? `font-weight: ${attrs.weight};` : "";
        const textStyle = `${color} ${size} ${weight}`.trim();
        if (textStyle) {
            attrs["style"] = attrs["style"] ? `${textStyle}; ${attrs["style"]}` : textStyle;
        }
        delete attrs.color;
        delete attrs.size;
        delete attrs.weight;
    }

    // Process attributes and bindings
    if (attrs.bind) {
        const bindKey = attrs.bind.replace(/^(data|state)\./, "");
        const boundVal = _resolvePath(state, bindKey, context);
        if (htmlTag === "input" && (attrs.type === "checkbox" || attrs.type === "radio")) {
            if (boundVal) attrs["checked"] = "checked";
        } else if (htmlTag === "input" || htmlTag === "textarea") {
            attrs["value"] = boundVal !== undefined ? String(boundVal) : "";
        }
        delete attrs.bind;
    }

    // Build attribute string with interpolation
    let attrsHtml = "";
    for (const [k, v] of Object.entries(attrs)) {
        if (k.startsWith("on_") || k === "key") continue;
        const interpolatedVal = _interpolateString(v, state, context);
        attrsHtml += ` ${k}="${_escapeHtml(interpolatedVal)}"`;
    }

    if (node.isSelfClosing) {
        return `<${htmlTag}${attrsHtml} />`;
    }

    let childrenHtml = "";
    if (Array.isArray(node.children)) {
        for (const child of node.children) {
            childrenHtml += _renderNode(child, state, context);
        }
    }

    return `<${htmlTag}${attrsHtml}>${childrenHtml}</${htmlTag}>`;
}

function _interpolateString(str, state, context = {}) {
    if (!str || typeof str !== "string") return str;
    return str.replace(/\{([^{}]+)\}/g, (match, expr) => {
        const cleanExpr = expr.trim();
        const pathVal = _resolvePath(state, cleanExpr.replace(/^(data|state)\./, ""), context);
        if (pathVal !== undefined && pathVal !== null) {
            return String(pathVal);
        }
        try {
            const contextKeys = Object.keys(context || {}).filter(k => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k));
            const contextVals = contextKeys.map(k => context[k]);
            const jsExpr = cleanExpr.replace(/(?:^|[^a-zA-Z0-9_])(data|state)\.([a-zA-Z0-9_]+)/g, "$data.$2");
            const fn = new Function("$data", "data", "$ctx", "context", ...contextKeys, `return (${jsExpr});`);
            const res = fn(state, state, context, context, ...contextVals);
            return res !== undefined && res !== null ? String(res) : "";
        } catch (_) {
            return match;
        }
    });
}

function _evaluateCondition(condition, state, context = {}) {
    try {
        const clean = condition.replace(/&amp;&amp;/g, "&&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
        const contextKeys = Object.keys(context || {}).filter(k => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k));
        const contextVals = contextKeys.map(k => context[k]);
        const jsExpr = clean.replace(/(?:^|[^a-zA-Z0-9_])(data|state)\.([a-zA-Z0-9_]+)/g, "$data.$2");
        const fn = new Function("$data", "data", "$ctx", "context", ...contextKeys, `return Boolean(${jsExpr});`);
        return fn(state, state, context, context, ...contextVals);
    } catch (_) {
        return true;
    }
}

function _resolvePath(obj, path, context = {}) {
    if (!path) return undefined;
    if (context && context[path] !== undefined) return context[path];
    if (context) {
        const firstDot = path.indexOf(".");
        if (firstDot !== -1) {
            const root = path.slice(0, firstDot);
            const rest = path.slice(firstDot + 1);
            if (context[root] !== undefined) {
                return _resolvePath(context[root], rest);
            }
        }
    }
    const parts = path.split(".");
    let curr = obj;
    for (const p of parts) {
        if (curr === undefined || curr === null) return undefined;
        curr = curr[p];
    }
    return curr;
}

function _escapeHtml(str) {
    if (!str || typeof str !== "string") return str;
    return str
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

export const compileXmlToHtml = renderToString;

