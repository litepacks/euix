/**
 * src/core/renderer/DOMRenderer.js
 * High-performance DOM node instantiation, layout styling, dynamic attribute binding, and template interpolation for EUIX Engine.
 */

import { EUIXExpressionParser } from "../parser/ExpressionParser.js";
import {
    ALLOWED_HTML_TAGS,
    BOOLEAN_ATTRS,
    EVENT_TAGS,
    getChildNodes,
    getCompiledTemplate,
    getRootKey,
    getTagName,
    isElem,
    isFn,
    isTxtNode,
    METADATA_AND_EVENT_TAGS,
    SVG_NAMESPACE,
    SVG_TAGS,
    safeStringify,
} from "../utils/constants.js";
import { renderForEach } from "./ForEachRenderer.js";

export function applyLayoutStyles(engine, el, xmlNode, context = {}) {
    if (!el || !isElem(xmlNode)) return;

    if (xmlNode._staticLayoutStyle) {
        const s = xmlNode._staticLayoutStyle;
        if (s.flexDirection) el.style.flexDirection = s.flexDirection;
        if (s.alignItems) el.style.alignItems = s.alignItems;
        if (s.justifyContent) el.style.justifyContent = s.justifyContent;
        if (s.gap) el.style.gap = s.gap;
        if (s.columnGap) el.style.columnGap = s.columnGap;
        if (s.rowGap) el.style.rowGap = s.rowGap;
        if (s.flexWrap) el.style.flexWrap = s.flexWrap;
        if (s.gridTemplateColumns) el.style.gridTemplateColumns = s.gridTemplateColumns;
        if (s.gridTemplateRows) el.style.gridTemplateRows = s.gridTemplateRows;
        if (s.cssText) el.style.cssText += `;${s.cssText}`;
        return;
    }

    const tagName = xmlNode.tagName.toLowerCase();
    const typeAttr = (xmlNode.getAttribute("type") || "").toLowerCase();
    const isFlex = tagName === "flex" || typeAttr === "flex";

    const staticStyle = {};
    let isDynamic = false;

    const direction =
        xmlNode.getAttribute("direction") || xmlNode.getAttribute("flex_direction") || xmlNode.getAttribute("dir");
    if (direction) {
        if (direction.includes("{")) {
            isDynamic = true;
            el.style.flexDirection = engine.interpolate(direction, context).trim();
        } else {
            el.style.flexDirection = direction;
            staticStyle.flexDirection = direction;
        }
    }

    const align = xmlNode.getAttribute("align") || xmlNode.getAttribute("align_items");
    if (align) {
        if (align.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(align, context).trim();
            el.style.alignItems = val === "start" ? "flex-start" : val === "end" ? "flex-end" : val;
        } else {
            const v = align === "start" ? "flex-start" : align === "end" ? "flex-end" : align;
            el.style.alignItems = v;
            staticStyle.alignItems = v;
        }
    }

    const justify = xmlNode.getAttribute("justify") || xmlNode.getAttribute("justify_content");
    if (justify) {
        if (justify.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(justify, context).trim();
            el.style.justifyContent =
                val === "start"
                    ? "flex-start"
                    : val === "end"
                      ? "flex-end"
                      : val === "between"
                        ? "space-between"
                        : val === "around"
                          ? "space-around"
                          : val === "evenly"
                            ? "space-evenly"
                            : val;
        } else {
            const v =
                justify === "start"
                    ? "flex-start"
                    : justify === "end"
                      ? "flex-end"
                      : justify === "between"
                        ? "space-between"
                        : justify === "around"
                          ? "space-around"
                          : justify === "evenly"
                            ? "space-evenly"
                            : justify;
            el.style.justifyContent = v;
            staticStyle.justifyContent = v;
        }
    }

    const gap = xmlNode.getAttribute("gap");
    if (gap) {
        if (gap.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(gap, context).trim();
            el.style.gap = /^\d+$/.test(val) ? `${val}px` : val;
        } else {
            const v = /^\d+$/.test(gap) ? `${gap}px` : gap;
            el.style.gap = v;
            staticStyle.gap = v;
        }
    }

    const gapX = xmlNode.getAttribute("gap_x") || xmlNode.getAttribute("col_gap");
    if (gapX) {
        if (gapX.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(gapX, context).trim();
            el.style.columnGap = /^\d+$/.test(val) ? `${val}px` : val;
        } else {
            const v = /^\d+$/.test(gapX) ? `${gapX}px` : gapX;
            el.style.columnGap = v;
            staticStyle.columnGap = v;
        }
    }

    const gapY = xmlNode.getAttribute("gap_y") || xmlNode.getAttribute("row_gap");
    if (gapY) {
        if (gapY.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(gapY, context).trim();
            el.style.rowGap = /^\d+$/.test(val) ? `${val}px` : val;
        } else {
            const v = /^\d+$/.test(gapY) ? `${gapY}px` : gapY;
            el.style.rowGap = v;
            staticStyle.rowGap = v;
        }
    }

    const wrap = xmlNode.getAttribute("wrap");
    if (wrap) {
        if (wrap.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(wrap, context).trim();
            if (isFlex) {
                el.style.flexWrap = val === "true" || val === "wrap" ? "wrap" : "nowrap";
            }
        } else {
            if (isFlex) {
                const v = wrap === "true" || wrap === "wrap" ? "wrap" : "nowrap";
                el.style.flexWrap = v;
                staticStyle.flexWrap = v;
            }
        }
    }

    const cols = xmlNode.getAttribute("cols") || xmlNode.getAttribute("columns");
    if (cols) {
        if (cols.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(cols, context).trim();
            el.style.gridTemplateColumns = /^\d+$/.test(val) ? `repeat(${val}, minmax(0, 1fr))` : val;
        } else {
            const v = /^\d+$/.test(cols) ? `repeat(${cols}, minmax(0, 1fr))` : cols;
            el.style.gridTemplateColumns = v;
            staticStyle.gridTemplateColumns = v;
        }
    }

    const rows = xmlNode.getAttribute("rows");
    if (rows) {
        if (rows.includes("{")) {
            isDynamic = true;
            const val = engine.interpolate(rows, context).trim();
            el.style.gridTemplateRows = /^\d+$/.test(val) ? `repeat(${val}, minmax(0, 1fr))` : val;
        } else {
            const v = /^\d+$/.test(rows) ? `repeat(${rows}, minmax(0, 1fr))` : rows;
            el.style.gridTemplateRows = v;
            staticStyle.gridTemplateRows = v;
        }
    }

    const customStyle = xmlNode.getAttribute("style");
    if (customStyle) {
        if (customStyle.includes("{")) {
            isDynamic = true;
            const styleStr = engine.interpolate(customStyle, context).trim();
            if (styleStr) el.style.cssText += `;${styleStr}`;
        } else {
            el.style.cssText += `;${customStyle}`;
            staticStyle.cssText = customStyle;
        }
    }

    if (!isDynamic) {
        xmlNode._staticLayoutStyle = staticStyle;
    }
}

export function applyItemChildStyles(engine, childEl, childXmlNode, context) {
    if (!childEl || !isElem(childXmlNode)) return;

    const flex = childXmlNode.getAttribute("flex");
    if (flex) {
        childEl.style.flex = engine.interpolate(flex, context).trim();
    }

    const colSpan = childXmlNode.getAttribute("col_span");
    if (colSpan) {
        const val = engine.interpolate(colSpan, context).trim();
        childEl.style.gridColumn = val.startsWith("span") ? val : `span ${val} / span ${val}`;
    }

    const rowSpan = childXmlNode.getAttribute("row_span");
    if (rowSpan) {
        const val = engine.interpolate(rowSpan, context).trim();
        childEl.style.gridRow = val.startsWith("span") ? val : `span ${val} / span ${val}`;
    }
}

export function extractStateKeys(expr) {
    if (!expr) return [];
    const keys = new Set();
    const matches = expr.match(/(?:data|local|\$local)\.(\w+)/g) || [];
    matches.forEach((m) => keys.add(m.replace(/^(?:data|local|\$local)\./, "")));
    const plainMatches = expr.match(/\{(\w+)\}/g) || [];
    plainMatches.forEach((m) => keys.add(m.replace(/^\{|\}$/g, "")));
    return Array.from(keys);
}

export function interpolate(engine, text, context = {}) {
    if (!text || typeof text !== "string" || !text.includes("{")) return text || "";

    // Fast-path: single simple token e.g. "{item.text}" or "{todo.completed}" or "{data.count}"
    if (text.charCodeAt(0) === 123 && text.charCodeAt(text.length - 1) === 125) {
        const inner = text.slice(1, -1).trim();
        if (inner.startsWith("JSON.stringify($route") || inner === "$route") {
            const root = engine.getState("$route") || context?.$route;
            return root !== undefined && root !== null ? safeStringify(root, 2) : "{}";
        }
        if (inner.startsWith("JSON.stringify($router") || inner === "$router") {
            const root = engine.getState("$router") || context?.$router;
            return root !== undefined && root !== null ? safeStringify(root, 2) : "{}";
        }
        if (!/[?!=><+*/(),&|%-]/.test(inner) && !inner.includes("{")) {
            const dotIdx = inner.indexOf(".");
            if (dotIdx === -1) {
                if (context && context[inner] !== undefined) {
                    const v = context[inner];
                    return typeof v === "string"
                        ? v
                        : typeof v === "number"
                          ? String(v)
                          : typeof v === "object" && v !== null
                            ? safeStringify(v)
                            : String(v ?? "");
                }
                const v = engine.getState(inner);
                if (v !== undefined) {
                    return typeof v === "string"
                        ? v
                        : typeof v === "number"
                          ? String(v)
                          : typeof v === "object" && v !== null
                            ? safeStringify(v)
                            : String(v ?? "");
                }
            } else {
                const scope = inner.slice(0, dotIdx);
                const prop = inner.slice(dotIdx + 1);
                if (scope === "data" || scope === "state" || scope === "global" || scope === "$global") {
                    if (!prop.includes("[")) {
                        const v = engine.getState(prop);
                        if (v !== undefined) {
                            return typeof v === "string"
                                ? v
                                : typeof v === "number"
                                  ? String(v)
                                  : typeof v === "object" && v !== null
                                    ? safeStringify(v)
                                    : String(v ?? "");
                        }
                    }
                } else if (scope === "$route" || scope === "$router" || scope === "$fetcher") {
                    const root = engine.getState(scope) || context?.[scope];
                    if (root !== undefined && root !== null) {
                        const parts = prop.split(".");
                        let curr = root;
                        for (let pIdx = 0; pIdx < parts.length; pIdx++) {
                            if (curr === undefined || curr === null) break;
                            curr = curr[parts[pIdx]];
                        }
                        if (curr !== undefined)
                            return typeof curr === "string"
                                ? curr
                                : typeof curr === "object" && curr !== null
                                  ? safeStringify(curr)
                                  : String(curr ?? "");
                    }
                } else if (context && context[scope] !== undefined && context[scope] !== null) {
                    let curr = context[scope];
                    const parts = prop.split(".");
                    for (let pIdx = 0; pIdx < parts.length; pIdx++) {
                        if (curr === undefined || curr === null) break;
                        curr = curr[parts[pIdx]];
                    }
                    if (curr !== undefined)
                        return typeof curr === "string"
                            ? curr
                            : typeof curr === "object" && curr !== null
                              ? safeStringify(curr)
                              : String(curr ?? "");
                }
            }
        }
    }

    // Fast-path 2: compiled tokenized template chunks (Multi-token without regex overhead)
    const compiled = getCompiledTemplate(text);
    if (compiled) {
        let out = "";
        const cLen = compiled.length;
        for (let i = 0; i < cLen; i++) {
            const c = compiled[i];
            if (c.type === "static") {
                out += c.val;
            } else if (c.isSimple) {
                if (context && context[c.scope] !== undefined) {
                    const v = context[c.scope];
                    out +=
                        typeof v === "string" || typeof v === "number"
                            ? v
                            : typeof v === "object" && v !== null
                              ? safeStringify(v)
                              : (v ?? "");
                } else if (engine.constants?.has(c.scope)) {
                    out += engine.constants.get(c.scope);
                } else if (engine.constructor._globalConstants?.has(c.scope)) {
                    out += engine.constructor._globalConstants.get(c.scope);
                } else {
                    const v = engine.getState(c.scope);
                    out +=
                        v !== undefined
                            ? typeof v === "string" || typeof v === "number"
                                ? v
                                : typeof v === "object" && v !== null
                                  ? safeStringify(v)
                                  : (v ?? "")
                            : "";
                }
            } else if (
                c.scope === "const" ||
                c.scope === "constants" ||
                c.scope === "var" ||
                c.scope === "vars" ||
                c.scope === "constant" ||
                c.scope === "variable"
            ) {
                if (context && context.constants && context.constants[c.prop] !== undefined) {
                    out += context.constants[c.prop];
                } else if (engine.constants?.has(c.prop)) {
                    out += engine.constants.get(c.prop);
                } else if (engine.constructor._globalConstants?.has(c.prop)) {
                    out += engine.constructor._globalConstants.get(c.prop);
                }
            } else if (c.scope === "$route" || c.scope === "$router" || c.scope === "$fetcher") {
                const root = engine.getState(c.scope) || context?.[c.scope];
                if (root !== undefined && root !== null) {
                    const parts = c.parts || [c.prop];
                    let curr = root;
                    for (let pIdx = 0; pIdx < parts.length; pIdx++) {
                        if (curr === undefined || curr === null) break;
                        curr = curr[parts[pIdx]];
                    }
                    out +=
                        curr !== undefined && curr !== null
                            ? typeof curr === "object"
                                ? safeStringify(curr)
                                : curr
                            : "";
                }
            } else if (c.scope === "$device" || c.scope === "device") {
                const dev =
                    engine.$device ||
                    engine.device ||
                    (isFn(engine.getState) ? engine.getState("$device") || engine.getState("device") : null) ||
                    (context && (context.$device || context.device));
                if (dev && c.prop) {
                    const parts = c.parts || [c.prop];
                    let curr = dev;
                    for (let pIdx = 0; pIdx < parts.length; pIdx++) {
                        if (curr === undefined || curr === null) break;
                        curr = curr[parts[pIdx]];
                    }
                    out +=
                        curr !== undefined && curr !== null
                            ? typeof curr === "object"
                                ? safeStringify(curr)
                                : curr
                            : "";
                } else if (dev && !c.prop) {
                    out += typeof dev === "object" ? safeStringify(dev) : String(dev);
                }
            } else if (c.scope === "data" || c.scope === "state" || c.scope === "global" || c.scope === "$global") {
                const v = engine.getState(c.prop);
                out +=
                    v !== undefined
                        ? typeof v === "string" || typeof v === "number"
                            ? v
                            : typeof v === "object" && v !== null
                              ? safeStringify(v)
                              : (v ?? "")
                        : "";
            } else if (c.scope === "parent") {
                const clean = c.prop.replace(/^data\./, "");
                const v = engine.getState(clean);
                out += v !== undefined ? (typeof v === "object" && v !== null ? safeStringify(v) : (v ?? "")) : "";
            } else if (c.scope === "props") {
                const propsObj = context ? context.props || context : null;
                if (propsObj && propsObj[c.prop] !== undefined) {
                    const v = propsObj[c.prop];
                    out += typeof v === "object" && v !== null ? safeStringify(v) : (v ?? "");
                }
            } else if (c.scope === "local" || c.scope === "$local") {
                if (context && context._localState && context._localState[c.prop] !== undefined) {
                    const v = context._localState[c.prop];
                    out += typeof v === "object" && v !== null ? safeStringify(v) : (v ?? "");
                } else if (context && context.local && context.local[c.prop] !== undefined) {
                    const v = context.local[c.prop];
                    out += typeof v === "object" && v !== null ? safeStringify(v) : (v ?? "");
                }
            } else if (c.scope === "api" || c.scope === "$api") {
                if (c.prop) {
                    const parts = c.parts;
                    const endpointId = parts[0];
                    const epProp = parts.slice(1).join(".");
                    const status = isFn(engine.getApiStatus)
                        ? engine.getApiStatus(endpointId)
                        : engine._apiStatus?.[endpointId];
                    if (status) {
                        if (!epProp) {
                            out += typeof status === "object" ? JSON.stringify(status) : String(status);
                        } else {
                            const val = epProp.split(".").reduce((acc, p) => (acc ? acc[p] : undefined), status);
                            if (val !== undefined && val !== null) out += String(val);
                        }
                    }
                }
            } else if (c.scope === "result") {
                if (!c.prop) {
                    if (context && context.result !== undefined && context.result !== null) {
                        out +=
                            typeof context.result === "object"
                                ? JSON.stringify(context.result)
                                : String(context.result);
                    }
                } else if (context?.result && typeof context.result === "object") {
                    let curr = context.result;
                    for (let p = 0; p < c.parts.length && curr !== undefined && curr !== null; p++) {
                        curr = curr[c.parts[p]];
                    }
                    if (curr !== undefined && curr !== null) out += String(curr);
                }
            } else if (c.scope === "err" || c.scope === "error") {
                const errObj = context ? context[c.scope] || context.err || context.error : null;
                if (errObj) {
                    if (!c.prop) {
                        out += typeof errObj === "object" ? errObj.message || JSON.stringify(errObj) : String(errObj);
                    } else {
                        let curr = errObj;
                        for (let p = 0; p < c.parts.length && curr !== undefined && curr !== null; p++) {
                            curr = curr[c.parts[p]];
                        }
                        if (curr !== undefined && curr !== null) out += String(curr);
                    }
                }
            } else if (c.scope === "args" || c.scope === "params") {
                const argsObj = context ? context.args || context.params : null;
                if (argsObj && typeof argsObj === "object") {
                    let curr = argsObj;
                    for (let p = 0; p < c.parts.length && curr !== undefined && curr !== null; p++) {
                        curr = curr[c.parts[p]];
                    }
                    if (curr !== undefined) {
                        out += typeof curr === "object" && curr !== null ? JSON.stringify(curr) : (curr ?? "");
                    }
                }
            } else if (context && context[c.scope] !== undefined && context[c.scope] !== null) {
                let curr = context[c.scope];
                const parts = c.parts;
                for (let p = 0; p < parts.length && curr !== undefined && curr !== null; p++) {
                    curr = curr[parts[p]];
                }
                if (curr !== undefined) {
                    out += typeof curr === "object" && curr !== null ? JSON.stringify(curr) : (curr ?? "");
                }
            }
        }
        return out;
    }

    // Fast-path 3: JIT compiled template function for complex expressions/ternaries/math
    const jitFn = EUIXExpressionParser.compileTemplateFunction(text);
    if (jitFn) {
        const dataScope = engine._state;
        const localScope = context._localState || context.local;
        const res = jitFn(dataScope, localScope, context, engine, (p) => engine.resolveValueFromPath(p, context));
        if (res !== undefined && res !== null && res !== "") return res;
    }

    let result = text;

    // 1. Resolve {const.name}, {var.name}, {constants.name}, {vars.name}
    result = result.replace(/\{(?:const|var|constant|variable|constants|vars)\.(\w+)\}/g, (match, name) => {
        if (context && context.constants && context.constants[name] !== undefined) {
            return context.constants[name];
        }
        if (engine.constants?.has(name)) {
            return engine.constants.get(name);
        }
        if (engine.constructor._globalConstants?.has(name)) {
            return engine.constructor._globalConstants.get(name);
        }
        return match;
    });

    // 1.5. Resolve {args.name}, {params.name}, {result.name}, {result}, {err.name}, {error.name}, {local.name}, {$local.name}, {global.name}, {api.name}, {$api.name}, {$route.name}, {$router.name}, {$fetcher.name}
    result = result.replace(
        /\{(args|params|result|err|error|local|\$local|global|api|\$api|\$route|\$router|\$fetcher)(?:\.([a-zA-Z0-9_.]+))?\}/g,
        (match, scope, prop) => {
            if (scope === "$route" || scope === "$router" || scope === "$fetcher") {
                const rootState = engine.getState(scope);
                if (rootState === undefined || rootState === null) return "";
                if (!prop) return typeof rootState === "object" ? JSON.stringify(rootState) : String(rootState);
                const val = prop
                    .split(".")
                    .reduce((acc, p) => (acc !== undefined && acc !== null ? acc[p] : undefined), rootState);
                return val !== undefined && val !== null
                    ? typeof val === "object"
                        ? JSON.stringify(val)
                        : String(val)
                    : "";
            }
            if (scope === "api" || scope === "$api") {
                if (prop) {
                    const parts = prop.split(".");
                    const endpointId = parts[0];
                    const epProp = parts.slice(1).join(".");
                    const status = isFn(engine.getApiStatus)
                        ? engine.getApiStatus(endpointId)
                        : engine._apiStatus?.[endpointId];
                    if (!status) return "";
                    if (!epProp) return typeof status === "object" ? JSON.stringify(status) : String(status);
                    const val = epProp.split(".").reduce((acc, p) => (acc ? acc[p] : undefined), status);
                    return val !== undefined && val !== null ? String(val) : "";
                }
                return match;
            }
            if (scope === "local" || scope === "$local") {
                if (context._localState && prop) {
                    return context._localState[prop] !== undefined ? String(context._localState[prop]) : "";
                }
                if (context.local && prop && context.local[prop] !== undefined) {
                    return String(context.local[prop]);
                }
                return match;
            }
            if (scope === "global") {
                if (prop) {
                    const clean = prop.replace(/^data\./, "");
                    const val = engine.getState(clean);
                    return val !== undefined && val !== null ? String(val) : "";
                }
                return match;
            }
            if (scope === "args" || scope === "params") {
                const argsObj = context.args || context.params;
                if (argsObj && typeof argsObj === "object") {
                    if (!prop) return typeof argsObj === "object" ? JSON.stringify(argsObj) : String(argsObj);
                    const parts = prop.split(".");
                    let curr = argsObj;
                    for (let i = 0; i < parts.length && curr !== undefined && curr !== null; i++) {
                        curr = curr[parts[i]];
                    }
                    return curr !== undefined && curr !== null ? String(curr) : "";
                }
            }
            if (scope === "result") {
                if (!prop)
                    return context.result !== undefined && context.result !== null
                        ? typeof context.result === "object"
                            ? JSON.stringify(context.result)
                            : String(context.result)
                        : "";
                if (context.result && typeof context.result === "object") {
                    const parts = prop.split(".");
                    let curr = context.result;
                    for (let i = 0; i < parts.length && curr !== undefined && curr !== null; i++) {
                        curr = curr[parts[i]];
                    }
                    return curr !== undefined && curr !== null ? String(curr) : "";
                }
            }
            if (scope === "err" || scope === "error") {
                const errObj = context[scope] || context.err || context.error;
                if (errObj) {
                    if (!prop)
                        return typeof errObj === "object" ? errObj.message || JSON.stringify(errObj) : String(errObj);
                    const parts = prop.split(".");
                    let curr = errObj;
                    for (let i = 0; i < parts.length && curr !== undefined && curr !== null; i++) {
                        curr = curr[parts[i]];
                    }
                    return curr !== undefined && curr !== null ? String(curr) : "";
                }
            }
            return match;
        },
    );

    // 2. Resolve complex expressions or ternary inside {...}
    result = result.replace(/\{([^{}]+)\}/g, (match, innerExpr) => {
        const trimmed = innerExpr.trim();

        if (/^(?:const|var|constant|variable|constants|vars)\./.test(trimmed)) {
            return match;
        }

        let resolvedExpr = trimmed;
        if (resolvedExpr.includes("[") && resolvedExpr.includes("]")) {
            resolvedExpr = resolvedExpr.replace(/\[(?:data\.)?([a-zA-Z0-9_]+)\]/g, (m, key) => {
                if (/^\d+$/.test(key)) return m;
                const idxVal = context && context[key] !== undefined ? context[key] : engine.getState(key);
                return idxVal !== undefined ? `[${idxVal}]` : m;
            });
        }

        if (
            /[?!=><+*/&|%-]/.test(resolvedExpr) ||
            resolvedExpr.includes(".") ||
            resolvedExpr.includes("data.") ||
            resolvedExpr.includes("local.") ||
            resolvedExpr.includes("api.")
        ) {
            try {
                const evaluated = EUIXExpressionParser.eval(resolvedExpr, (name) => {
                    if (name.startsWith("api.") || name.startsWith("$api.")) {
                        const clean = name.replace(/^(\$api|api)\./, "");
                        const parts = clean.split(".");
                        const endpointId = parts[0];
                        const prop = parts.slice(1).join(".");
                        const status = isFn(engine.getApiStatus)
                            ? engine.getApiStatus(endpointId)
                            : engine._apiStatus?.[endpointId];
                        if (!status) return undefined;
                        if (!prop) return status;
                        return prop.split(".").reduce((acc, p) => (acc ? acc[p] : undefined), status);
                    }
                    if (name.startsWith("local.") || name.startsWith("$local.")) {
                        const lk = name.replace(/^(\$local|local)\./, "");
                        if (context._localState && context._localState[lk] !== undefined) {
                            return context._localState[lk];
                        }
                        if (context.local && context.local[lk] !== undefined) {
                            return context.local[lk];
                        }
                    }
                    if (name.startsWith("global.") || name.startsWith("$global.")) {
                        const gk = name.replace(/^(\$global|global)\.(data\.)?/, "");
                        return engine.getState(gk);
                    }
                    if (name.startsWith("$date.") || name.startsWith("date.")) {
                        const helper =
                            engine.$date ||
                            engine.date ||
                            (isFn(engine.getState) ? engine.getState("$date") : null) ||
                            (isFn(engine.getState) ? engine.getState("date") : null);
                        const prop = name.replace(/^(\$date|date)\./, "");
                        if (!helper) return undefined;
                        if (!prop) return helper;
                        return prop
                            .split(".")
                            .reduce((acc, p) => (acc !== undefined && acc !== null ? acc[p] : undefined), helper);
                    }
                    if (name === "$date" || name === "date") {
                        return (
                            engine.$date ||
                            engine.date ||
                            (isFn(engine.getState) ? engine.getState("$date") : null) ||
                            (isFn(engine.getState) ? engine.getState("date") : null)
                        );
                    }
                    if (name.startsWith("$device.") || name.startsWith("device.")) {
                        let dev =
                            engine.$device ||
                            engine.device ||
                            (isFn(engine.getState) ? engine.getState("$device") || engine.getState("device") : null) ||
                            (context && (context.$device || context.device));
                        if (!dev && typeof navigator !== "undefined") {
                            const nav = navigator;
                            dev = {
                                online: typeof nav.onLine === "boolean" ? nav.onLine : true,
                                hardwareConcurrency: Number(nav.hardwareConcurrency) || 8,
                                cores: Number(nav.hardwareConcurrency) || 8,
                                deviceMemory: Number(nav.deviceMemory) || 8,
                                memory: Number(nav.deviceMemory) || 8,
                                batteryLevel: 1,
                                batteryCharging: false,
                                prefersDark: true,
                                reducedMotion: false,
                            };
                        }
                        const prop = name.replace(/^(\$device|device)\./, "");
                        if (!dev) return undefined;
                        if (!prop) return dev;
                        return prop
                            .split(".")
                            .reduce((acc, p) => (acc !== undefined && acc !== null ? acc[p] : undefined), dev);
                    }
                    if (name === "$device" || name === "device") {
                        return (
                            engine.$device ||
                            engine.device ||
                            (isFn(engine.getState) ? engine.getState("$device") || engine.getState("device") : null) ||
                            (context && (context.$device || context.device))
                        );
                    }

                    const cleanKey = name.replace(/^(?:parent\.)?data\./, "");
                    if (context._localState && context._localState[cleanKey] !== undefined) {
                        return context._localState[cleanKey];
                    }

                    const parts = name.split(".");
                    const firstPart = parts[0];

                    if (context && context[firstPart] !== undefined && context[firstPart] !== null) {
                        let curr = context[firstPart];
                        if (parts.length === 1) {
                            return curr;
                        }
                        for (let i = 1; i < parts.length && curr !== undefined && curr !== null; i++) {
                            curr = curr[parts[i]];
                        }
                        if (curr !== undefined) return curr;
                    }

                    const val = engine.getState(engine.parseBindPath(cleanKey));
                    if (val !== undefined && val !== null) return val;

                    if (context && context[name] !== undefined) {
                        return context[name];
                    }

                    if (
                        name.includes(".") &&
                        context &&
                        context[firstPart] !== undefined &&
                        context[firstPart] !== null
                    ) {
                        let curr = context[firstPart];
                        for (let i = 1; i < parts.length && curr !== undefined && curr !== null; i++) {
                            curr = curr[parts[i]];
                        }
                        if (curr !== undefined) return curr;
                    }

                    return undefined;
                });
                if (evaluated !== undefined && evaluated !== null && typeof evaluated !== "object") {
                    return String(evaluated);
                }
            } catch (_) {}
        }

        if (/^(?:parent\.)?data\./.test(resolvedExpr)) {
            const cleanKey = resolvedExpr.replace(/^(?:parent\.)?data\./, "");
            if (context._localState && context._localState[cleanKey] !== undefined) {
                const val = context._localState[cleanKey];
                return val !== undefined && val !== null
                    ? typeof val === "object"
                        ? safeStringify(val)
                        : String(val)
                    : "";
            }
            const val = engine.getState(engine.parseBindPath(cleanKey));
            return val !== undefined && val !== null
                ? typeof val === "object"
                    ? safeStringify(val)
                    : String(val)
                : "";
        }

        if (/^(?:local|\$local)\./.test(trimmed)) {
            const cleanKey = trimmed.replace(/^(?:local|\$local)\./, "");
            if (context._localState && context._localState[cleanKey] !== undefined) {
                const val = context._localState[cleanKey];
                return val !== undefined && val !== null
                    ? typeof val === "object"
                        ? safeStringify(val)
                        : String(val)
                    : "";
            }
            if (context.local && context.local[cleanKey] !== undefined) {
                const val = context.local[cleanKey];
                return val !== undefined && val !== null
                    ? typeof val === "object"
                        ? safeStringify(val)
                        : String(val)
                    : "";
            }
        }

        if (
            context &&
            context[trimmed] !== undefined &&
            context[trimmed] !== null &&
            typeof context[trimmed] !== "object"
        ) {
            return String(context[trimmed]);
        }

        return match;
    });

    // 3. Resolve {props.key} and {scope.key}
    result = result.replace(/\{(\w+)\.(\w+)\}/g, (match, scope, prop) => {
        if (context[scope] && typeof context[scope] === "object") {
            return context[scope][prop] !== undefined ? context[scope][prop] : "";
        }
        return match;
    });

    return result;
}

export function evalCondition(engine, expr, context = {}) {
    if (!expr) return true;

    const resolved = engine.interpolate(expr, context);
    if (resolved === "true") return true;
    if (resolved === "false" || resolved === "") return false;

    const resolveValueFn = (name) => {
        let val;
        if (name.startsWith("data.")) {
            val = engine.getState(name.slice(5));
        } else {
            const ctxMatch = name.match(/^(\w+)(?:\.(\w+))?$/);
            if (ctxMatch) {
                const [_, scope, prop] = ctxMatch;
                if (scope && context[scope] !== undefined) {
                    val = prop ? context[scope][prop] : context[scope];
                }
            }
            if (val === undefined) val = engine.getState(name);
        }
        if (typeof val === "string" && val.trim() !== "" && !Number.isNaN(Number(val))) {
            return Number(val);
        }
        return val;
    };

    if (/[==|!=|>|<|&&||||!|()]/.test(expr)) {
        const cleanExpr = expr.replace(/\{([^}]+)\}/g, "$1");
        const res = EUIXExpressionParser.eval(cleanExpr, resolveValueFn);
        return res !== undefined ? Boolean(res) : Boolean(resolved);
    }

    return Boolean(resolved);
}

export function appendChildren(engine, fragment, nodes, context, { skipTags = [] } = {}) {
    if (!nodes) return fragment;
    const len = nodes.length;
    const hasSkip = skipTags && skipTags.length > 0;
    for (let i = 0; i < len; i++) {
        const child = nodes[i];
        if (hasSkip && child.nodeType === 1 && skipTags.includes(child.tagName.toLowerCase())) {
            continue;
        }
        const el = engine.createHTMLElement(child, context);
        if (el) fragment.appendChild(el);
    }
    return fragment;
}

const _SKIP_CONDITIONAL_TAGS = Object.freeze({ skipTags: ["else", "else_if"] });

function _parseConditionalBranches(xmlNode) {
    const branches = [];
    let current = {
        type: "if",
        condition: xmlNode.getAttribute("condition") || "",
        nodes: [],
        sealed: false,
    };

    const children = xmlNode.childNodes;
    const len = children ? children.length : 0;
    for (let i = 0; i < len; i++) {
        const child = children[i];
        if (child.nodeType === 1) {
            const tag = child.tagName.toLowerCase();
            if (tag === "else_if") {
                branches.push(current);
                current = {
                    type: "else_if",
                    condition: child.getAttribute("condition") || "",
                    nodes: Array.from(child.childNodes),
                    sealed: true,
                };
                continue;
            }
            if (tag === "else") {
                branches.push(current);
                current = {
                    type: "else",
                    condition: null,
                    nodes: Array.from(child.childNodes),
                    sealed: true,
                };
                continue;
            }
        }
        if (!current.sealed) {
            current.nodes.push(child);
        }
    }
    branches.push(current);
    return branches;
}

function _getConditionalActiveIndex(engine, branches, context) {
    const len = branches.length;
    for (let i = 0; i < len; i++) {
        const b = branches[i];
        if (b.type === "else" || engine.evalCondition(b.condition, context)) {
            return i;
        }
    }
    return -1;
}

function _renderConditionalBranch(engine, containerNode, branchNodes, context) {
    containerNode.innerHTML = "";
    if (branchNodes && branchNodes.length > 0) {
        const fragment = document.createDocumentFragment();
        engine.appendChildren(fragment, branchNodes, context, _SKIP_CONDITIONAL_TAGS);
        containerNode.appendChild(fragment);
    }
}

function _switchConditionalBranch(engine, containerNode, branches, newIndex, context) {
    const oldNodes = containerNode.children;
    const oldLen = oldNodes ? oldNodes.length : 0;
    const targetNodes = newIndex !== -1 ? branches[newIndex].nodes : null;

    if (oldLen > 0 && isFn(engine._runLeaveTransitionThenRemove)) {
        let pendingCount = oldLen;
        const onDone = () => {
            pendingCount--;
            if (pendingCount <= 0) {
                _renderConditionalBranch(engine, containerNode, targetNodes, context);
            }
        };
        const oldArr = Array.from(oldNodes);
        for (let i = 0; i < oldLen; i++) {
            engine._runLeaveTransitionThenRemove(oldArr[i], onDone);
        }
    } else {
        _renderConditionalBranch(engine, containerNode, targetNodes, context);
    }
}

export function renderConditional(engine, xmlNode, context = {}) {
    const containerNode = document.createElement("div");
    containerNode.className = "euix-if-branch";
    containerNode.style.display = "contents";

    const branches = _parseConditionalBranches(xmlNode);
    let activeIndex = _getConditionalActiveIndex(engine, branches, context);

    if (activeIndex !== -1) {
        engine.appendChildren(containerNode, branches[activeIndex].nodes, context, _SKIP_CONDITIONAL_TAGS);
    }

    const keys = new Set();
    const branchLen = branches.length;
    for (let i = 0; i < branchLen; i++) {
        const cond = branches[i].condition;
        if (cond) {
            const stateKeys = engine.extractStateKeys(cond);
            const kLen = stateKeys.length;
            for (let j = 0; j < kLen; j++) {
                keys.add(stateKeys[j]);
            }
        }
    }

    const updateFn = () => {
        const newIndex = _getConditionalActiveIndex(engine, branches, context);
        if (newIndex !== activeIndex) {
            activeIndex = newIndex;
            _switchConditionalBranch(engine, containerNode, branches, newIndex, context);
        }
    };

    for (const k of keys) {
        engine.registerBinding(k, containerNode, "conditional", updateFn);
    }

    return containerNode;
}

export function resolveBindPath(engine, xmlNode) {
    if (typeof xmlNode === "string") {
        return engine.parseBindPath(xmlNode);
    }
    if (!xmlNode) return "";
    const bindAttr = typeof xmlNode.getAttribute === "function" ? xmlNode.getAttribute("bind") : null;
    if (bindAttr) return engine.parseBindPath(bindAttr);

    const onChange = engine.getChild(xmlNode, "on_change");
    if (onChange && typeof onChange.getAttribute === "function" && onChange.getAttribute("action") === "SET_STATE") {
        const pathNode = engine.getChild(onChange, "path");
        if (pathNode) return engine.parseBindPath(pathNode.textContent);
    }

    const valNode = engine.getChild(xmlNode, "value");
    if (valNode) {
        const match = String(valNode.textContent || "")
            .trim()
            .match(/^\{data\.(\w+)\}$/);
        if (match) return match[1];
    }

    if (xmlNode.textContent) {
        const match = String(xmlNode.textContent || "")
            .trim()
            .match(/^\{data\.(\w+)\}$/);
        if (match) return match[1];
    }

    return "";
}

export function applyNodeAttributes(engine, el, xmlNode, context = {}) {
    if (!el || !xmlNode || xmlNode.nodeType !== 1 || !xmlNode.attributes) return;

    const validationAttrs = ["pattern", "minlength", "maxlength", "min", "max", "step", "title", "autocomplete"];
    const attrs = xmlNode.attributes;
    const aLen = attrs.length;

    for (let aIdx = 0; aIdx < aLen; aIdx++) {
        const attr = attrs[aIdx];
        const attrName = attr.name;
        const attrValue = attr.value;
        if (attrValue === undefined || attrValue === null) continue;

        const lowerAttrName = attrName.toLowerCase();

        if (attrName === "id") {
            const idVal = engine.interpolate(attrValue, context);
            el.id = idVal;
            el.setAttribute("id", idVal);
        } else if (
            lowerAttrName === "test-id" ||
            lowerAttrName === "test_id" ||
            lowerAttrName === "testid" ||
            lowerAttrName === "data-testid" ||
            lowerAttrName === "data-euix-test"
        ) {
            const testVal = engine.interpolate(attrValue, context);
            el.setAttribute("data-euix-test", testVal);
            el.setAttribute(attrName, testVal);
        } else if (lowerAttrName === "action" || lowerAttrName === "data-euix-action") {
            const actionVal = engine.interpolate(attrValue, context);
            el.setAttribute("data-euix-action", actionVal);
            el.setAttribute(attrName, actionVal);
        } else if (attrName.startsWith("on") && attrName.length > 2 && !attrName.startsWith("on_")) {
            const eventName = attrName.toLowerCase();
            const handlerCode = engine.interpolate(attrValue, context);
            try {
                const isAsync = handlerCode.includes("await ");
                const AsyncFn = Object.getPrototypeOf(async () => {}).constructor;
                el[eventName] = isAsync
                    ? new AsyncFn("event", "$evt", handlerCode)
                    : new Function("event", "$evt", handlerCode);
            } catch (_) {
                el.setAttribute(attrName, handlerCode);
            }
        } else if (BOOLEAN_ATTRS.has(lowerAttrName)) {
            const interpolated = engine.interpolate(attrValue, context);
            const lower = String(interpolated).trim().toLowerCase();
            const isExplicitFalse = lower === "false" || lower === "0" || lower === "null" || lower === "undefined";
            const isBoolTrue =
                !isExplicitFalse &&
                (lower === "true" ||
                    lower === "1" ||
                    lower === lowerAttrName ||
                    (attrValue === "" && !String(attrValue).includes("{")));

            if (isBoolTrue) {
                el.setAttribute(attrName, "");
                try {
                    el[attrName] = true;
                } catch (_) {}
            } else {
                el.removeAttribute(attrName);
                try {
                    el[attrName] = false;
                } catch (_) {}
            }
        } else if (validationAttrs.includes(lowerAttrName)) {
            if (!attrValue.includes("data.") && !attrValue.includes("local.")) {
                el.setAttribute(attrName, engine.interpolate(attrValue, context));
            }
        } else if (attrName === "class") {
            const interpolatedVal = engine.interpolate(attrValue, context);
            if (el.namespaceURI === SVG_NAMESPACE) {
                el.setAttribute("class", interpolatedVal);
            } else {
                if (
                    el.className &&
                    el.className !== interpolatedVal &&
                    !el.className.split(" ").includes(interpolatedVal)
                ) {
                    el.className = [el.className, interpolatedVal].filter(Boolean).join(" ");
                } else if (!el.className) {
                    el.className = interpolatedVal;
                }
            }
        } else if (attrName === "style") {
            let interpolatedVal = engine.interpolate(attrValue, context);
            if (
                typeof interpolatedVal === "string" &&
                interpolatedVal.trim().startsWith("{") &&
                interpolatedVal.trim().endsWith("}")
            ) {
                try {
                    const parsed = JSON.parse(interpolatedVal);
                    if (typeof parsed === "object" && parsed !== null) {
                        interpolatedVal = Object.entries(parsed)
                            .filter(([_k, v]) => v !== undefined && v !== null && v !== "")
                            .map(
                                ([k, v]) =>
                                    `${k.startsWith("--") ? k : k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`,
                            )
                            .join(" ");
                    }
                } catch (_) {}
            } else if (interpolatedVal && typeof interpolatedVal === "object") {
                interpolatedVal = Object.entries(interpolatedVal)
                    .filter(([_k, v]) => v !== undefined && v !== null && v !== "")
                    .map(([k, v]) => `${k.startsWith("--") ? k : k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`)
                    .join(" ");
            }
            el.setAttribute("style", interpolatedVal);
        } else if (attrName === "type") {
            el.setAttribute("type", engine.interpolate(attrValue, context));
        } else {
            const interpolatedVal = engine.interpolate(attrValue, context);
            el.setAttribute(attrName, interpolatedVal);
            if (attrName === "draggable") {
                try {
                    const isDraggable = interpolatedVal === "true";
                    if (isFn(engine.enableDraggable)) {
                        engine.enableDraggable(el, isDraggable, context);
                    } else {
                        el.draggable = isDraggable;
                    }
                } catch (_) {}
            }
        }

        const matches = Array.from(
            attrValue.matchAll(
                /(?:parent\.)?(?:data|local|\$local|api|\$api|\$route|\$router|\$fetcher)\.([a-zA-Z0-9_.[\]]+)/g,
            ),
        );
        if (matches.length > 0) {
            const uniqueKeys = new Set();
            for (let mIdx = 0; mIdx < matches.length; mIdx++) {
                uniqueKeys.add(matches[mIdx][1]);
            }
            for (const key of uniqueKeys) {
                if (
                    attrValue.includes("$route.") ||
                    attrValue.includes("$router.") ||
                    attrValue.includes("$fetcher.")
                ) {
                    const scopeMatch = attrValue.match(/\$(route|router|fetcher)/);
                    const scopeKey = scopeMatch ? scopeMatch[0] : "$route";
                    engine.registerBinding(scopeKey, el, "attribute", () => {
                        engine.updateAttributeBinding(el, attrName, attrValue, context);
                    });
                    engine.registerBinding(`${scopeKey}.${key}`, el, "attribute", () => {
                        engine.updateAttributeBinding(el, attrName, attrValue, context);
                    });
                } else if (attrValue.includes(`api.${key}`) || attrValue.includes(`$api.${key}`)) {
                    const parts = key.split(".");
                    const epId = parts[0];
                    const epProp = parts[1];
                    if (epProp) {
                        engine.registerBinding(`api:${epId}:${epProp}`, el, "attribute", () => {
                            engine.updateAttributeBinding(el, attrName, attrValue, context);
                        });
                    }
                    engine.registerBinding(`api:${epId}`, el, "attribute", () => {
                        engine.updateAttributeBinding(el, attrName, attrValue, context);
                    });
                } else {
                    const rootKey = getRootKey(key);
                    const isLocal =
                        context._localState &&
                        (context._localState[key] !== undefined ||
                            context._localState[rootKey] !== undefined ||
                            attrValue.includes(`local.${key}`) ||
                            attrValue.includes(`$local.${key}`));
                    const bindKey = context._instanceId && isLocal ? `${context._instanceId}:${key}` : key;
                    const rootBindKey = context._instanceId && isLocal ? `${context._instanceId}:${rootKey}` : rootKey;
                    const updateFn = () => {
                        engine.updateAttributeBinding(el, attrName, attrValue, context);
                    };
                    engine.registerBinding(bindKey, el, "attribute", updateFn);
                    if (rootBindKey !== bindKey) {
                        engine.registerBinding(rootBindKey, el, "attribute", updateFn);
                    }
                    const innerBracketMatches = key.match(/\[(?:data\.)?([a-zA-Z0-9_]+)\]/g) || [];
                    for (let bIdx = 0; bIdx < innerBracketMatches.length; bIdx++) {
                        const innerKey = innerBracketMatches[bIdx].replace(/[[\]]|data\./g, "");
                        if (!/^\d+$/.test(innerKey)) {
                            engine.registerBinding(innerKey, el, "attribute", updateFn);
                        }
                    }
                }
            }
            engine.updateAttributeBinding(el, attrName, attrValue, context);
        }
    }
}

export function updateAttributeBinding(engine, el, attrName, template, context = {}) {
    if (!el || !attrName || !template) return;
    const newAttrVal = engine.interpolate(template, context);
    const lowerAttrName = attrName.toLowerCase();

    if (BOOLEAN_ATTRS.has(lowerAttrName)) {
        const lower = String(newAttrVal).trim().toLowerCase();
        const isExplicitFalse =
            lower === "false" || lower === "0" || lower === "null" || lower === "undefined" || lower === "";
        const isBoolTrue =
            !isExplicitFalse &&
            (lower === "true" || lower === "1" || lower === lowerAttrName || engine.isTruthy(newAttrVal));

        if (isBoolTrue) {
            el.setAttribute(attrName, "");
            try {
                el[attrName] = true;
            } catch (_) {}
        } else {
            el.removeAttribute(attrName);
            try {
                el[attrName] = false;
            } catch (_) {}
        }
        return;
    }

    if (attrName === "value" && "value" in el && el.namespaceURI !== SVG_NAMESPACE) {
        if (el.value !== newAttrVal) el.value = newAttrVal;
    } else if (attrName === "class" && el.namespaceURI !== SVG_NAMESPACE) {
        if (el.className !== newAttrVal) el.className = newAttrVal;
    } else if (attrName === "style") {
        let styleVal = newAttrVal;
        if (typeof styleVal === "string" && styleVal.trim().startsWith("{") && styleVal.trim().endsWith("}")) {
            try {
                const parsed = JSON.parse(styleVal);
                if (typeof parsed === "object" && parsed !== null) {
                    styleVal = Object.entries(parsed)
                        .filter(([_k, v]) => v !== undefined && v !== null && v !== "")
                        .map(
                            ([k, v]) => `${k.startsWith("--") ? k : k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`,
                        )
                        .join(" ");
                }
            } catch (_) {}
        } else if (styleVal && typeof styleVal === "object") {
            styleVal = Object.entries(styleVal)
                .filter(([_k, v]) => v !== undefined && v !== null && v !== "")
                .map(([k, v]) => `${k.startsWith("--") ? k : k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`)
                .join(" ");
        }
        if (el.getAttribute("style") !== styleVal) el.setAttribute("style", styleVal);
    } else {
        if (el.getAttribute(attrName) !== newAttrVal) el.setAttribute(attrName, newAttrVal);
    }
}

export function applyRef(engine, el, xmlNode, context = {}) {
    if (!el || !xmlNode || xmlNode.nodeType !== 1) return el;
    engine.applyNodeAttributes(el, xmlNode, context);
    const refAttr = xmlNode.getAttribute("ref");
    if (refAttr) {
        const resolvedRef = engine.interpolate(refAttr, context);
        if (resolvedRef) {
            engine.refs[resolvedRef] = el;
            el.dataset.xuiRef = resolvedRef;
        }
    }
    return el;
}

export function isStaticSubtree(xmlNode, engine = null) {
    if (!xmlNode) return false;
    if (xmlNode.nodeType === 3) {
        return !xmlNode.nodeValue || !xmlNode.nodeValue.includes("{");
    }
    if (xmlNode.nodeType !== 1) return false;

    if (xmlNode._isStaticSubtree !== undefined) {
        return xmlNode._isStaticSubtree;
    }

    const tagName = (xmlNode.tagName || "").toLowerCase();
    const typeAttr = (xmlNode.getAttribute("type") || "").toLowerCase();
    const srcAttr = xmlNode.getAttribute("src") || xmlNode.getAttribute("url");
    const nameAttr = (xmlNode.getAttribute("name") || "").toLowerCase();

    if (
        srcAttr ||
        tagName.startsWith("on_") ||
        tagName === "for_each" ||
        tagName === "component" ||
        tagName === "import" ||
        tagName === "lazy" ||
        tagName === "slot" ||
        tagName === "children" ||
        tagName === "outlet" ||
        tagName === "conditional" ||
        tagName === "if" ||
        tagName === "style" ||
        tagName === "use_style" ||
        tagName === "use_script" ||
        tagName === "data_model" ||
        tagName === "constants" ||
        tagName === "actions" ||
        tagName === "action_def" ||
        tagName === "webmcp" ||
        tagName === "webmcp_tool" ||
        tagName === "webmcp-tool" ||
        typeAttr === "lazy" ||
        typeAttr === "component" ||
        typeAttr === "outlet" ||
        typeAttr === "custom" ||
        nameAttr === "lazy" ||
        METADATA_AND_EVENT_TAGS.has(tagName)
    ) {
        xmlNode._isStaticSubtree = false;
        return false;
    }

    const EngineClass = engine ? engine.constructor : null;
    if (
        EngineClass?._lazyRegistry?.has(tagName) ||
        EngineClass?._lazyRegistry?.has(nameAttr) ||
        EngineClass?._lazyRegistry?.has(typeAttr)
    ) {
        xmlNode._isStaticSubtree = false;
        return false;
    }

    if (engine) {
        if (
            engine._customComponents?.has(tagName) ||
            engine._componentSpecs?.has(tagName) ||
            (typeAttr && engine._customComponents?.has(typeAttr)) ||
            (typeAttr && engine._componentSpecs?.has(typeAttr)) ||
            (nameAttr && engine._componentSpecs?.has(nameAttr)) ||
            engine.constructor._globalCustomComponents?.has(tagName) ||
            engine.constructor._globalComponentSpecs?.has(tagName) ||
            (typeAttr && engine.constructor._globalCustomComponents?.has(typeAttr)) ||
            (typeAttr && engine.constructor._globalComponentSpecs?.has(typeAttr)) ||
            (nameAttr && engine.constructor._globalComponentSpecs?.has(nameAttr))
        ) {
            xmlNode._isStaticSubtree = false;
            return false;
        }
    }

    const attrs = xmlNode.attributes;
    if (attrs) {
        for (let i = 0; i < attrs.length; i++) {
            const attr = attrs[i];
            const name = attr.name.toLowerCase();
            const val = attr.value || "";
            if (
                name.startsWith("on_") ||
                name === "bind" ||
                name === "ref" ||
                val.includes("{")
            ) {
                xmlNode._isStaticSubtree = false;
                return false;
            }
        }
    }

    const children = xmlNode.childNodes;
    if (children) {
        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            if (child.nodeType === 1) {
                const childTag = (child.tagName || "").toLowerCase();
                if (childTag.startsWith("on_") || EVENT_TAGS.has(childTag)) {
                    xmlNode._isStaticSubtree = false;
                    return false;
                }
            }
            if (!isStaticSubtree(child, engine)) {
                xmlNode._isStaticSubtree = false;
                return false;
            }
        }
    }

    xmlNode._isStaticSubtree = true;
    return true;
}

export function createHTMLElement(engine, xmlNode, context = {}) {
    if (!xmlNode) return null;
    try {
        const el = engine._createHTMLElementInternal(xmlNode, context);
        if (el && el.nodeType === 1) {
            engine.processLifecycleHooks(xmlNode, el, context);
        }
        return el;
    } catch (err) {
        engine.reportError(err, `Error rendering <${xmlNode.tagName || "element"}>`);
        if (typeof document === "undefined") return null;
        const fallback = document.createElement("div");
        fallback.className = "euix-error-fallback";
        fallback.style.cssText =
            "padding:4px 8px;margin:2px 0;background:#fff1f2;border:1px solid #fecdd3;border-radius:6px;color:#e11d48;font-size:11px;font-family:sans-serif;";
        fallback.textContent = `⚠️ Component Error: <${xmlNode.tagName || "unknown"}>`;
        return fallback;
    }
}

export function _createHTMLElementInternal(engine, xmlNode, context = {}) {
    if (!context._skipStaticClone && xmlNode.nodeType === 1) {
        if (xmlNode._staticPrototype) {
            return xmlNode._staticPrototype.cloneNode(true);
        }
        if (xmlNode._isStaticSubtree === undefined) {
            if (isStaticSubtree(xmlNode, engine)) {
                const proto = _createHTMLElementInternal(engine, xmlNode, { ...context, _skipStaticClone: true });
                if (proto) {
                    xmlNode._staticPrototype = proto;
                    return proto.cloneNode(true);
                }
            } else {
                xmlNode._isStaticSubtree = false;
            }
        }
    }

    if (isTxtNode(xmlNode)) {
        let parent = xmlNode.parentNode;
        let isCodeBlock = false;
        while (parent) {
            if (parent.tagName) {
                const tag = parent.tagName.toLowerCase();
                if (tag === "code" || tag === "pre") {
                    isCodeBlock = true;
                    break;
                }
            }
            parent = parent.parentNode;
        }
        const txt = xmlNode.textContent;
        if (isCodeBlock && (!txt?.includes("{") || !txt.includes("}"))) {
            return txt ? document.createTextNode(txt) : null;
        }
        if (!txt || txt.trim() === "") return null;
        const textNode = document.createTextNode(engine.interpolate(txt, context));

        if (txt.includes("$route") || txt.includes("$router") || txt.includes("$fetcher")) {
            const scopeMatch = txt.match(/\$(route|router|fetcher)/);
            const scopeKey = scopeMatch ? scopeMatch[0] : "$route";
            const updateFn = () => {
                textNode.textContent = engine.interpolate(txt, context);
            };
            engine.registerBinding(scopeKey, textNode, "text_node", updateFn);
        }

        const matches = Array.from(
            txt.matchAll(
                /(?:parent\.)?(?:data|local|\$local|api|\$api|\$route|\$router|\$fetcher)(?:\.([a-zA-Z0-9_.[\]]+))?/g,
            ),
        );
        if (matches.length > 0) {
            const uniqueKeys = new Set(matches.map((m) => m[1]).filter(Boolean));
            uniqueKeys.forEach((key) => {
                if (txt.includes("$route.") || txt.includes("$router.") || txt.includes("$fetcher.")) {
                    const scopeMatch = txt.match(/\$(route|router|fetcher)/);
                    const scopeKey = scopeMatch ? scopeMatch[0] : "$route";
                    const updateFn = () => {
                        textNode.textContent = engine.interpolate(txt, context);
                    };
                    engine.registerBinding(`${scopeKey}.${key}`, textNode, "text_node", updateFn);
                } else if (txt.includes(`api.${key}`) || txt.includes(`$api.${key}`)) {
                    const parts = key.split(".");
                    const epId = parts[0];
                    const epProp = parts[1];
                    const updateFn = () => {
                        textNode.textContent = engine.interpolate(txt, context);
                    };
                    if (epProp) {
                        engine.registerBinding(`api:${epId}:${epProp}`, textNode, "text_node", updateFn);
                    }
                    engine.registerBinding(`api:${epId}`, textNode, "text_node", updateFn);
                } else {
                    const rootKey = getRootKey(key);
                    const isLocal =
                        context._localState &&
                        (context._localState[key] !== undefined ||
                            context._localState[rootKey] !== undefined ||
                            txt.includes(`local.${key}`) ||
                            txt.includes(`$local.${key}`));
                    const bindKey = context._instanceId && isLocal ? `${context._instanceId}:${key}` : key;
                    const rootBindKey = context._instanceId && isLocal ? `${context._instanceId}:${rootKey}` : rootKey;
                    const updateFn = () => {
                        textNode.textContent = engine.interpolate(txt, context);
                    };
                    engine.registerBinding(bindKey, textNode, "text_node", updateFn);
                    if (rootBindKey !== bindKey) {
                        engine.registerBinding(rootBindKey, textNode, "text_node", updateFn);
                    }
                    const innerBracketMatches = key.match(/\[(?:data\.)?([a-zA-Z0-9_]+)\]/g) || [];
                    innerBracketMatches.forEach((bm) => {
                        const innerKey = bm.replace(/[[\]]|data\./g, "");
                        if (!/^\d+$/.test(innerKey)) {
                            engine.registerBinding(innerKey, textNode, "text_node", updateFn);
                        }
                    });
                }
            });
        }

        return textNode;
    }

    if (xmlNode.nodeType !== 1) return null;

    const tagName = xmlNode.tagName.toLowerCase();
    if (METADATA_AND_EVENT_TAGS.has(tagName) || tagName.startsWith("on_")) {
        if (["use_script", "script_loader", "load_script"].includes(tagName)) {
            const src = xmlNode.getAttribute("src") || xmlNode.getAttribute("url");
            if (src) engine.loadScript(src, { async: xmlNode.getAttribute("async") !== "false" });
        } else if (["use_style", "style_loader", "load_style"].includes(tagName)) {
            const href = xmlNode.getAttribute("src") || xmlNode.getAttribute("href") || xmlNode.getAttribute("url");
            if (href) engine.loadStyle(href);
        } else if (tagName === "style") {
            processStyleTag(engine, xmlNode, context);
        }
        return null;
    }

    const typeAttr = (xmlNode.getAttribute("type") || "").toLowerCase();

    if (tagName === "slot" || tagName === "children") {
        const frag = document.createElement("div");
        frag.style.display = "contents";
        frag.className = "euix-slot-wrapper";

        const slotName = xmlNode.getAttribute("name");
        const slots = context._projectedSlots;
        let projectedNodes = [];

        if (slotName && slots?.named?.has(slotName)) {
            projectedNodes = slots.named.get(slotName);
        } else if (!slotName && slots?.default?.length > 0) {
            projectedNodes = slots.default;
        }

        if (projectedNodes.length > 0) {
            projectedNodes.forEach((pNode) => {
                if (getTagName(pNode) === "slot") {
                    getChildNodes(pNode).forEach((c) => {
                        const el = engine.createHTMLElement(c, slots.parentContext || context);
                        if (el) frag.appendChild(el);
                    });
                } else {
                    const el = engine.createHTMLElement(pNode, slots.parentContext || context);
                    if (el) frag.appendChild(el);
                }
            });
        } else {
            getChildNodes(xmlNode).forEach((c) => {
                const el = engine.createHTMLElement(c, context);
                if (el) frag.appendChild(el);
            });
        }
        return frag;
    }

    if (engine._customComponents.has(tagName) || engine.constructor._globalCustomComponents?.has(tagName)) {
        const handler =
            engine._customComponents.get(tagName) || engine.constructor._globalCustomComponents.get(tagName);
        const customEl = handler.call(engine, xmlNode, context, engine);
        if (customEl) return engine.applyRef(customEl, xmlNode, context);
    }

    if (
        typeAttr &&
        (engine._customComponents.has(typeAttr) || engine.constructor._globalCustomComponents?.has(typeAttr))
    ) {
        const handler =
            engine._customComponents.get(typeAttr) || engine.constructor._globalCustomComponents.get(typeAttr);
        const customEl = handler.call(engine, xmlNode, context, engine);
        if (customEl) return engine.applyRef(customEl, xmlNode, context);
    }

    if (engine._componentSpecs.has(tagName) || engine.constructor._globalComponentSpecs?.has(tagName)) {
        const specNode = engine._componentSpecs.get(tagName) || engine.constructor._globalComponentSpecs.get(tagName);
        const res = engine.renderComponentSpec(specNode, xmlNode, context);
        return engine.applyRef(res, xmlNode, context);
    }

    const nameAttr = (xmlNode.getAttribute("name") || "").toLowerCase();
    if (nameAttr && (engine._componentSpecs.has(nameAttr) || engine.constructor._globalComponentSpecs?.has(nameAttr))) {
        const specNode = engine._componentSpecs.get(nameAttr) || engine.constructor._globalComponentSpecs.get(nameAttr);
        const res = engine.renderComponentSpec(specNode, xmlNode, context);
        return engine.applyRef(res, xmlNode, context);
    }

    if (typeAttr && (engine._componentSpecs.has(typeAttr) || engine.constructor._globalComponentSpecs?.has(typeAttr))) {
        const specNode = engine._componentSpecs.get(typeAttr) || engine.constructor._globalComponentSpecs.get(typeAttr);
        const res = engine.renderComponentSpec(specNode, xmlNode, context);
        return engine.applyRef(res, xmlNode, context);
    }

    const isFlex = tagName === "flex" || typeAttr === "flex";
    const isGrid = tagName === "grid" || typeAttr === "grid";

    if (isFlex || isGrid) {
        const el = document.createElement("div");
        el.style.display = isFlex ? "flex" : "grid";
        el.className = [
            isFlex ? "euix-flex" : "euix-grid",
            engine.interpolate(xmlNode.getAttribute("class") || "", context),
        ]
            .filter(Boolean)
            .join(" ");
        engine.applyLayoutStyles(el, xmlNode, context);
        engine.bindEvents(xmlNode, el, context);

        const chNodes = xmlNode.childNodes;
        const chLen = chNodes ? chNodes.length : 0;
        for (let i = 0; i < chLen; i++) {
            const child = chNodes[i];
            const childEl = engine.createHTMLElement(child, context);
            if (childEl) {
                engine.applyItemChildStyles(childEl, child, context);
                el.appendChild(childEl);
            }
        }

        return engine.applyRef(el, xmlNode, context);
    }

    if (tagName === "for_each") {
        return renderForEach(engine, xmlNode, context);
    }

    if (tagName === "if") {
        return engine.renderConditional(xmlNode, context);
    }

    if (tagName === "else" || tagName === "else_if") {
        return null;
    }

    if (tagName === "form") {
        const form = document.createElement("form");
        const formClass = engine.interpolate(xmlNode.getAttribute("class") || "", context);
        if (formClass) form.className = formClass;
        engine.bindEvents(xmlNode, form, context);

        form.onsubmit = (e) => {
            e.preventDefault();
        };

        const chNodes = xmlNode.childNodes;
        const chLen = chNodes ? chNodes.length : 0;
        for (let i = 0; i < chLen; i++) {
            const childEl = engine.createHTMLElement(chNodes[i], context);
            if (childEl) form.appendChild(childEl);
        }

        return engine.applyRef(form, xmlNode, context);
    }

    if (tagName === "select") {
        const sel = document.createElement("select");
        const selClass = engine.interpolate(xmlNode.getAttribute("class") || "", context);
        if (selClass) sel.className = selClass;
        const bindPath = engine.resolveBindPath(xmlNode);

        if (bindPath) {
            sel.value = engine.getState(bindPath) ?? "";
            engine.registerBinding(bindPath, sel, "input");
            sel.addEventListener("change", (e) => {
                engine.setState(bindPath, e.target.value);
            });
        }

        engine.bindEvents(xmlNode, sel, context);

        const chNodes = xmlNode.childNodes;
        const chLen = chNodes ? chNodes.length : 0;
        for (let i = 0; i < chLen; i++) {
            const childEl = engine.createHTMLElement(chNodes[i], context);
            if (childEl) sel.appendChild(childEl);
        }

        if (bindPath) sel.value = engine.getState(bindPath) ?? "";

        return engine.applyRef(sel, xmlNode, context);
    }

    if (tagName === "option") {
        const opt = document.createElement("option");
        const valAttr = xmlNode.getAttribute("value");
        opt.value = valAttr ? engine.interpolate(valAttr, context) : xmlNode.textContent.trim();
        opt.textContent = engine.interpolate(xmlNode.textContent.trim(), context);
        if (xmlNode.getAttribute("selected") === "true") opt.selected = true;
        return opt;
    }

    if (tagName === "textarea") {
        const ta = document.createElement("textarea");
        const taClass = engine.interpolate(xmlNode.getAttribute("class") || "", context);
        if (taClass) ta.className = taClass;
        const placeholder = xmlNode.getAttribute("placeholder");
        if (placeholder) ta.placeholder = engine.interpolate(placeholder, context);
        const rows = xmlNode.getAttribute("rows");
        if (rows) ta.rows = parseInt(rows, 10);

        const bindPath = engine.resolveBindPath(xmlNode);
        if (bindPath) {
            ta.value = engine.getState(bindPath) ?? "";
            engine.registerBinding(bindPath, ta, "input");
            ta.oninput = (e) => {
                engine.setState(bindPath, e.target.value, { sourceEl: e.target });
            };
        }
        engine.bindEvents(xmlNode, ta, context);
        return engine.applyRef(ta, xmlNode, context);
    }

    if (tagName === "input") {
        const inputType = (xmlNode.getAttribute("type") || "text").toLowerCase();
        const el = document.createElement("input");
        el.type = inputType;
        if (xmlNode.getAttribute("class")) el.className = engine.interpolate(xmlNode.getAttribute("class"), context);
        if (xmlNode.getAttribute("placeholder"))
            el.placeholder = engine.interpolate(xmlNode.getAttribute("placeholder"), context);
        if (xmlNode.getAttribute("autofocus") === "true") el.dataset.xuiAutofocus = "true";
        if (xmlNode.getAttribute("min")) el.min = xmlNode.getAttribute("min");
        if (xmlNode.getAttribute("max")) el.max = xmlNode.getAttribute("max");
        if (xmlNode.getAttribute("step")) el.step = xmlNode.getAttribute("step");
        if (xmlNode.getAttribute("name")) el.name = engine.interpolate(xmlNode.getAttribute("name"), context);
        if (xmlNode.getAttribute("value")) el.value = engine.interpolate(xmlNode.getAttribute("value"), context);

        const bindPath = engine.resolveBindPath(xmlNode);
        const binding = engine.resolveBinding(xmlNode, context);

        if (inputType === "checkbox") {
            if (binding) {
                el.checked = engine.isTruthy(engine.getBindingValue(binding, context));
                if (binding.type === "state") engine.registerBinding(binding.path, el, "checkbox");
                el.onchange = (e) => engine.setBindingValue(binding, e.target.checked ? "true" : "false", context);
            }
        } else if (inputType === "radio") {
            if (binding) {
                const current = String(engine.getBindingValue(binding, context) ?? "");
                el.checked = current === el.value;
                if (binding.type === "state") engine.registerBinding(binding.path, el, "radio");
                el.onchange = (e) => {
                    if (e.target.checked) engine.setBindingValue(binding, el.value, context);
                };
            }
        } else if (bindPath) {
            el.value = engine.getState(bindPath) ?? "";
            engine.registerBinding(bindPath, el, "input");
            el.oninput = (e) => engine.setState(bindPath, e.target.value, { sourceEl: e.target });
        }

        engine.bindEvents(xmlNode, el, context);
        return engine.applyRef(el, xmlNode, context);
    }

    if (tagName === "img" || tagName === "image") {
        const el = document.createElement("img");
        if (xmlNode.getAttribute("class")) el.className = engine.interpolate(xmlNode.getAttribute("class"), context);
        const rawSrc = xmlNode.getAttribute("src") || "";
        const alt = xmlNode.getAttribute("alt") || "";
        const resolvedSrc = engine.interpolate(rawSrc, context);
        const fallbackSrc =
            "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80";

        el.src = resolvedSrc || fallbackSrc;
        el.alt = engine.interpolate(alt, context);
        el.onerror = () => {
            el.src = fallbackSrc;
        };

        if (xmlNode.getAttribute("width")) el.width = parseInt(xmlNode.getAttribute("width"), 10) || undefined;
        if (xmlNode.getAttribute("height")) el.height = parseInt(xmlNode.getAttribute("height"), 10) || undefined;
        engine.bindEvents(xmlNode, el, context);
        return engine.applyRef(el, xmlNode, context);
    }

    if (tagName === "button") {
        const el = document.createElement("button");
        if (xmlNode.getAttribute("class")) el.className = engine.interpolate(xmlNode.getAttribute("class"), context);
        const btnType = xmlNode.getAttribute("type");
        if (btnType) el.type = btnType;
        engine.bindEvents(xmlNode, el, context);

        const chNodes = xmlNode.childNodes;
        const chLen = chNodes ? chNodes.length : 0;
        for (let i = 0; i < chLen; i++) {
            const child = chNodes[i];
            if (
                child.nodeType === 1 &&
                [
                    "on_click",
                    "on_change",
                    "on_submit",
                    "on_keyup",
                    "on_keydown",
                    "on_mouseenter",
                    "on_mouseleave",
                    "event",
                    "on",
                    "label",
                ].includes(child.tagName.toLowerCase())
            ) {
                if (child.tagName.toLowerCase() === "label") {
                    const lblText = engine.interpolate(child.textContent.trim(), context);
                    el.appendChild(document.createTextNode(lblText));
                }
                continue;
            }
            const childEl = engine.createHTMLElement(child, context);
            if (childEl) el.appendChild(childEl);
        }

        return engine.applyRef(el, xmlNode, context);
    }

    if (tagName === "collapse") {
        return isFn(engine.renderCollapse) ? engine.renderCollapse(xmlNode, context) : null;
    }

    if (tagName === "dialog") {
        return isFn(engine.renderDialog) ? engine.renderDialog(xmlNode, context) : null;
    }

    if (tagName === "head" || tagName === "helmet") {
        return isFn(engine.renderHead) ? engine.renderHead(xmlNode, context) : null;
    }

    if (tagName === "title" && isFn(engine.renderHeadTitle)) {
        return engine.renderHeadTitle(xmlNode, context);
    }

    if (tagName === "component") {
        const type = xmlNode.getAttribute("type");
        const bindPath = engine.resolveBindPath(xmlNode);
        let el;

        if (type === "title") el = document.createElement("h2");
        else if (type === "text") el = document.createElement("span");
        else if (type === "button") el = document.createElement("button");
        else if (type === "image") {
            el = document.createElement("img");
            const src = xmlNode.getAttribute("src") || "";
            const alt = xmlNode.getAttribute("alt") || "";
            el.src = engine.interpolate(src, context);
            el.alt = engine.interpolate(alt, context);
            if (xmlNode.getAttribute("width")) el.width = parseInt(xmlNode.getAttribute("width"), 10) || undefined;
            if (xmlNode.getAttribute("height")) el.height = parseInt(xmlNode.getAttribute("height"), 10) || undefined;
        } else if (type === "text_input") {
            el = document.createElement("input");
            el.type = "text";
            el.placeholder = xmlNode.getAttribute("placeholder") || "";

            if (bindPath) {
                el.value = engine.getState(bindPath) ?? "";
                engine.registerBinding(bindPath, el, "input");

                el.oninput = (e) => {
                    engine.setState(bindPath, e.target.value, {
                        sourceEl: e.target,
                    });
                };
            } else {
                const valNode = engine.getChild(xmlNode, "value");
                if (valNode) el.value = engine.interpolate(valNode.textContent, context);
            }

            if (xmlNode.getAttribute("autofocus") === "true") {
                el.dataset.xuiAutofocus = "true";
            }
        } else if (type === "checkbox") {
            el = document.createElement("input");
            el.type = "checkbox";
            const binding = engine.resolveBinding(xmlNode, context);
            if (binding) {
                el.checked = engine.isTruthy(engine.getBindingValue(binding, context));
                if (binding.type === "state") {
                    engine.registerBinding(binding.path, el, "checkbox");
                }
                el.onchange = (e) => {
                    const next = e.target.checked ? "true" : "false";
                    engine.setBindingValue(binding, next, context);
                };
            }
        } else if (type === "radio") {
            el = document.createElement("input");
            el.type = "radio";
            const radioName = xmlNode.getAttribute("name") || "xui_radio";
            el.name = engine.interpolate(radioName, context);
            const radioVal = xmlNode.getAttribute("value") || "";
            el.value = engine.interpolate(radioVal, context);

            const binding = engine.resolveBinding(xmlNode, context);
            if (binding) {
                const current = String(engine.getBindingValue(binding, context) ?? "");
                el.checked = current === el.value;
                if (binding.type === "state") {
                    engine.registerBinding(binding.path, el, "radio");
                }
                el.onchange = (e) => {
                    if (e.target.checked) {
                        engine.setBindingValue(binding, el.value, context);
                    }
                };
            }
        } else if (type === "textarea") {
            el = document.createElement("textarea");
            if (xmlNode.getAttribute("placeholder"))
                el.placeholder = engine.interpolate(xmlNode.getAttribute("placeholder"), context);
            if (xmlNode.getAttribute("rows")) el.rows = parseInt(xmlNode.getAttribute("rows"), 10);
            if (bindPath) {
                el.value = engine.getState(bindPath) ?? "";
                engine.registerBinding(bindPath, el, "input");
                el.oninput = (e) => {
                    engine.setState(bindPath, e.target.value, { sourceEl: e.target });
                };
            }
        } else if (["number_input", "range_input", "date_input", "color_input", "file_input"].includes(type)) {
            el = document.createElement("input");
            el.type = type.replace("_input", "");
            if (xmlNode.getAttribute("min")) el.min = xmlNode.getAttribute("min");
            if (xmlNode.getAttribute("max")) el.max = xmlNode.getAttribute("max");
            if (xmlNode.getAttribute("step")) el.step = xmlNode.getAttribute("step");
            if (xmlNode.getAttribute("placeholder")) el.placeholder = xmlNode.getAttribute("placeholder");

            if (bindPath) {
                el.value = engine.getState(bindPath) ?? "";
                engine.registerBinding(bindPath, el, "input");
                el.oninput = (e) => {
                    engine.setState(bindPath, e.target.value, { sourceEl: e.target });
                };
            }
        } else {
            try {
                el = document.createElement(tagName);
                if (tagName === "form") {
                    el.onsubmit = (e) => {
                        e.preventDefault();
                    };
                }
            } catch (_) {
                el = document.createElement("div");
            }
        }

        const elClass = engine.interpolate(xmlNode.getAttribute("class") || "", context);
        if (elClass && el) el.className = elClass;

        if (type === "text" && bindPath) {
            const templateNode = engine.getChild(xmlNode, "template");
            let inlineTemplate = "";
            const chNodes = xmlNode.childNodes;
            const chLen = chNodes ? chNodes.length : 0;
            for (let i = 0; i < chLen; i++) {
                const n = chNodes[i];
                if (isTxtNode(n)) inlineTemplate += n.textContent || "";
            }
            inlineTemplate = inlineTemplate.trim();

            if (templateNode) {
                const html = templateNode.innerHTML.trim();
                if (html.includes("<")) el.dataset.xuiHtmlTemplate = html;
                else el.dataset.xuiTextTemplate = templateNode.textContent.trim();
            } else if (inlineTemplate.includes("{value}")) {
                el.dataset.xuiTextTemplate = inlineTemplate;
            }

            engine.registerBinding(bindPath, el, "text");
            engine.syncBindings(bindPath, engine.getState(bindPath));
        }

        engine.bindEvents(xmlNode, el, context);

        const compChNodes = xmlNode.childNodes;
        const compChLen = compChNodes ? compChNodes.length : 0;
        for (let i = 0; i < compChLen; i++) {
            const child = compChNodes[i];
            if (
                child.nodeType === 1 &&
                [
                    "on_click",
                    "on_change",
                    "on_submit",
                    "on_keyup",
                    "on_keydown",
                    "on_mouseenter",
                    "on_mouseleave",
                    "event",
                    "on",
                    "value",
                    "template",
                ].includes(child.tagName.toLowerCase())
            ) {
                continue;
            }
            if (type === "text" && bindPath && isTxtNode(child)) {
                continue;
            }
            const childEl = engine.createHTMLElement(child, context);
            if (childEl) {
                engine.applyItemChildStyles(childEl, child, context);
                el.appendChild(childEl);
            }
        }

        return engine.applyRef(el, xmlNode, context);
    }

    const isSvg = tagName === "svg" || context.isSvg || SVG_TAGS.has(tagName);
    const elementTagName = isSvg || ALLOWED_HTML_TAGS.has(tagName) ? tagName : "div";
    const div = isSvg
        ? document.createElementNS(SVG_NAMESPACE, xmlNode.tagName || tagName)
        : document.createElement(elementTagName);
    const xmlClass = engine.interpolate(xmlNode.getAttribute("class") || "", context);
    if (xmlClass) {
        if (isSvg) div.setAttribute("class", xmlClass);
        else div.className = xmlClass;
    }

    if (tagName === "layout") {
        const layoutType = xmlNode.getAttribute("type") || "";
        div.className = [layoutType, xmlClass].filter(Boolean).join(" ");
        engine.applyLayoutStyles(div, xmlNode, context);
    }

    engine.bindEvents(xmlNode, div, context);

    const isCodeOrPreTag = tagName === "code" || tagName === "pre";
    const isInsideCodeOrPre = context._isInsideCodeOrPre || isCodeOrPreTag;
    const childContext = isSvg
        ? isInsideCodeOrPre
            ? { ...context, isSvg: true, _isInsideCodeOrPre: true }
            : { ...context, isSvg: true }
        : isInsideCodeOrPre && !context._isInsideCodeOrPre
          ? { ...context, _isInsideCodeOrPre: true }
          : context;

    const gChNodes = xmlNode.childNodes;
    const gChLen = gChNodes ? gChNodes.length : 0;
    for (let i = 0; i < gChLen; i++) {
        const child = gChNodes[i];
        if (isElem(child) && (EVENT_TAGS.has(getTagName(child)) || METADATA_AND_EVENT_TAGS.has(getTagName(child)))) {
            continue;
        }
        const childEl = engine.createHTMLElement(child, childContext);
        if (childEl) {
            engine.applyItemChildStyles(childEl, child, childContext);
            div.appendChild(childEl);
        }
    }

    const childElementNodes = getChildNodes(xmlNode).filter((n) => isElem(n) && !EVENT_TAGS.has(getTagName(n)));

    let hasCodeOrPreDescendant = xmlNode._hasCodeOrPre;
    if (hasCodeOrPreDescendant === undefined) {
        hasCodeOrPreDescendant = xmlNode.querySelector
            ? !!(xmlNode.querySelector("code") || xmlNode.querySelector("pre"))
            : false;
        xmlNode._hasCodeOrPre = hasCodeOrPreDescendant;
    }

    if (
        !isInsideCodeOrPre &&
        !hasCodeOrPreDescendant &&
        childElementNodes.length === 0 &&
        !["input", "select", "textarea", "form", "code", "pre"].includes(tagName) &&
        ![
            "text_input",
            "checkbox",
            "radio",
            "textarea",
            "number_input",
            "range_input",
            "date_input",
            "color_input",
            "file_input",
        ].includes(typeAttr)
    ) {
        const bindAttr = xmlNode.getAttribute("bind");
        if (bindAttr) {
            const genericBindPath = engine.resolveBindPath(xmlNode);
            if (genericBindPath) {
                const isLocal =
                    context._localState &&
                    (context._localState[genericBindPath] !== undefined || genericBindPath.startsWith("local."));
                const cleanPath = genericBindPath.replace(/^local\./, "");
                const bindKey = context._instanceId && isLocal ? `${context._instanceId}:${cleanPath}` : cleanPath;
                const trimmed = xmlNode.textContent ? xmlNode.textContent.trim() : "";
                if (trimmed.includes("{value}")) {
                    div.dataset.euixTextTemplate = trimmed;
                }
                engine.registerBinding(bindKey, div, "text");
                engine.syncBindings(bindKey, isLocal ? context._localState[cleanPath] : engine.getState(cleanPath));
            }
        }
    }

    const isContentEditable =
        xmlNode.getAttribute("contenteditable") === "true" || xmlNode.getAttribute("contenteditable") === "";
    if (isContentEditable) {
        const binding = engine.resolveBinding(xmlNode, context);
        if (binding) {
            const initialVal = engine.getBindingValue(binding, context);
            if (initialVal !== undefined && initialVal !== null) {
                div.innerHTML = String(initialVal);
            }
            const updateFn = (val) => {
                if (typeof document !== "undefined" && document.activeElement !== div) {
                    div.innerHTML = val !== undefined && val !== null ? String(val) : "";
                }
            };
            if (binding.type === "state") {
                engine.registerBinding(binding.path, div, "contenteditable", updateFn);
            }
            div.addEventListener("input", () => {
                engine.setBindingValue(binding, div.innerHTML, context, { sourceEl: div });
            });
            div.addEventListener("blur", () => {
                engine.setBindingValue(binding, div.innerHTML, context, { sourceEl: div });
            });
        }
    }

    return engine.applyRef(div, xmlNode, context);
}

export function render(engine) {
    if (!engine.container || !engine.xmlDoc) return;

    engine._bindings = new Map();
    engine.refs = {};
    const root = engine.getChild(engine.xmlDoc, "uid_spec") || engine.xmlDoc.querySelector("uid_spec") || engine.xmlDoc;
    const metadataTags = [
        "data_model",
        "imports",
        "import",
        "constants",
        "vars",
        "variables",
        "component_def",
        "actions",
        "action_def",
        "workflow_def",
        "api_config",
        "api_endpoint",
        "endpoint",
        "api",
        "persistence",
        "navigator_config",
        "device_config",
        "date_config",
        "date-config",
        "date_settings",
        "date-settings",
        "on_mount",
        "on_unmount",
        "on_interval",
        "on_state_change",
        "use_script",
        "use_style",
        "style",
        "animations",
        "animation_def",
        "watch",
        "computed",
        "head",
        "helmet",
        "title",
        "webmcp",
        "webmcp_tool",
        "webmcp-tool",
    ];

    if (isFn(engine.parseHeadMetadata)) {
        engine.parseHeadMetadata(root);
    }
    if (isFn(engine.parseWebMCPMetadata)) {
        engine.parseWebMCPMetadata(root);
    }

    const rootStyles = Array.from(
        root.querySelectorAll ? root.querySelectorAll("style, use_style, style_loader, load_style") : [],
    );
    rootStyles.forEach((st) => {
        if (st.closest && st.closest("component_def")) return;
        const sTag = (st.tagName || "").toLowerCase();
        if (sTag === "style") {
            processStyleTag(engine, st, {});
        } else {
            const href = st.getAttribute("src") || st.getAttribute("href") || st.getAttribute("url");
            if (href) engine.loadStyle(href);
        }
    });

    let uiChildren = Array.from(root.children || []).filter(
        (c) => c.tagName && !metadataTags.includes(c.tagName.toLowerCase()),
    );
    if (uiChildren.length === 0) {
        const fallback = Array.from(root.querySelectorAll("*")).find(
            (c) => c.tagName && !metadataTags.includes(c.tagName.toLowerCase()) && !c.closest("component_def"),
        );
        if (fallback) {
            uiChildren = [fallback];
        } else if (root.tagName && !metadataTags.includes(root.tagName.toLowerCase())) {
            uiChildren = [root];
        }
    }

    if (uiChildren.length > 0 && engine.container) {
        engine.container.innerHTML = "";
        const fragment = document.createDocumentFragment();
        for (const childNode of uiChildren) {
            const dom = engine.createHTMLElement(childNode);
            if (dom) {
                fragment.appendChild(dom);
            }
        }
        engine.container.appendChild(fragment);
    }

    const autofocusEl = engine.container.querySelector("[data-euix-autofocus='true']");
    if (autofocusEl && typeof autofocusEl.focus === "function") {
        autofocusEl.focus();
    }
}

export function scopeCSS(cssText, scopeSelector) {
    if (!cssText || !scopeSelector) return cssText;
    const scopeAttr = scopeSelector.startsWith("[") ? scopeSelector : `[${scopeSelector}]`;

    // Strip comments
    const cleanCss = cssText.replace(/\/\*[\s\S]*?\*\//g, "");

    // Regex to match at-rules like @media (...) { ... } or regular rules selector { ... }
    return cleanCss
        .replace(/(@[^{]+)\{([\s\S]+?)\}\s*\}/gi, (match, atRule, innerRules) => {
            if (atRule.trim().startsWith("@keyframes") || atRule.trim().startsWith("@-webkit-keyframes")) {
                return match;
            }
            const scopedInner = scopeCSS(innerRules, scopeAttr);
            return `${atRule} {\n${scopedInner}\n}`;
        })
        .replace(/([^{}]+)\{([^}]+)\}/g, (match, selectorList, declarations) => {
            const trimmed = selectorList.trim();
            if (trimmed.startsWith("@")) return match;

            const scopedSelectors = selectorList
                .split(",")
                .map((sel) => {
                    const s = sel.trim();
                    if (!s) return s;
                    if (s === ":host") return scopeAttr;
                    if (s.startsWith(":host(")) return s.replace(/:host\((.*?)\)/, `${scopeAttr}$1`);
                    if (s.startsWith(":root") || s.startsWith("html") || s.startsWith("body")) {
                        return s;
                    }
                    return `${scopeAttr} ${s}, ${scopeAttr}${s}`;
                })
                .join(", ");

            return `${scopedSelectors} {${declarations}}`;
        });
}

export function processStyleTag(engine, xmlNode, context = {}, targetEl = null) {
    if (!xmlNode || !engine) return null;
    const href = xmlNode.getAttribute("src") || xmlNode.getAttribute("href") || xmlNode.getAttribute("url");
    if (href) {
        engine.loadStyle(href);
        return null;
    }

    const rawCss = xmlNode.textContent || "";
    if (!rawCss.trim()) return null;

    const isScoped =
        xmlNode.getAttribute("scoped") === "true" ||
        xmlNode.getAttribute("scoped") === "" ||
        (typeof xmlNode.hasAttribute === "function" && xmlNode.hasAttribute("scoped"));

    let scopeId = null;
    if (isScoped) {
        scopeId = context._instanceId || context._scopeId || `euix-s-${Math.random().toString(36).substring(2, 8)}`;
        if (targetEl && isElem(targetEl)) {
            targetEl.setAttribute("data-euix-scope", scopeId);
        } else if (context._rootEl && isElem(context._rootEl)) {
            context._rootEl.setAttribute("data-euix-scope", scopeId);
        } else if (engine.container && isElem(engine.container)) {
            engine.container.setAttribute("data-euix-scope", scopeId);
        }
    }

    const styleEl = typeof document !== "undefined" ? document.createElement("style") : null;
    if (!styleEl) return null;

    if (xmlNode.getAttribute("id")) {
        styleEl.id = xmlNode.getAttribute("id");
    }
    if (xmlNode.getAttribute("media")) {
        styleEl.media = xmlNode.getAttribute("media");
    }
    if (xmlNode.getAttribute("type")) {
        styleEl.type = xmlNode.getAttribute("type");
    }
    if (isScoped) {
        styleEl.setAttribute("data-euix-scoped-for", scopeId);
    }

    const renderCss = () => {
        let css = rawCss;
        css = css.replace(/\{(\s*(?:data|local|\$local|props|\$props|const|\$data|\$state|state)\.[^}]+)\}/g, (match, expr) => {
            return engine.interpolate(`{${expr}}`, context);
        });
        css = css.replace(/\/\*<!\[CDATA\[\*\//g, "").replace(/\/\*\]\]>\*\//g, "");
        if (isScoped && scopeId) {
            css = scopeCSS(css, `[data-euix-scope="${scopeId}"]`);
        }
        styleEl.textContent = css;
    };

    renderCss();

    if (!engine._injectedStyles) {
        engine._injectedStyles = new Set();
    }
    engine._injectedStyles.add(styleEl);

    // Dynamic state expressions in CSS
    const exprMatches = rawCss.match(/\{(\s*(?:data|local|\$local|props|\$props|const|\$data|\$state|state)\.[^}]+)\}/g) || [];
    if (exprMatches.length > 0) {
        exprMatches.forEach((match) => {
            const rawExpr = match.slice(1, -1).trim();
            const keys = rawExpr.match(/(?:data\.|local\.|computed\.)?[a-zA-Z0-9_.]+/g) || [];
            keys.forEach((key) => {
                const cleanKey = engine.parseBindPath(key);
                if (cleanKey) {
                    const bindKey =
                        key.startsWith("local.") && context._instanceId
                            ? `${context._instanceId}:${cleanKey}`
                            : cleanKey;
                    engine.registerBinding(bindKey, styleEl, "style_tag", () => {
                        renderCss();
                    });
                }
            });
        });
    }

    const docHead = typeof document !== "undefined" ? document.head || document.documentElement : null;
    if (docHead) {
        docHead.appendChild(styleEl);
    }

    if (context._instanceId && typeof engine.onUnmount === "function") {
        engine.onUnmount(() => {
            if (styleEl.parentNode) {
                styleEl.parentNode.removeChild(styleEl);
            }
            engine._injectedStyles?.delete(styleEl);
        });
    }

    return styleEl;
}
