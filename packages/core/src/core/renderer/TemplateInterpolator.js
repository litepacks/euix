/**
 * src/core/renderer/TemplateInterpolator.js
 * High-performance string template interpolation, state key extraction, and condition evaluation for EUIX Engine.
 */

import { EUIXExpressionParser } from "../parser/ExpressionParser.js";
import {
    getCompiledTemplate,
    safeStringify,
    isObj,
    isStr,
} from "../utils/constants.js";
import { resolveScopedValue } from "../binding/BindingResolver.js";

const EXTRACT_KEYS_CACHE = new Map();
const EXTRACT_KEYS_CACHE_MAX = 1000;

export function extractStateKeys(expr) {
    if (!expr || !isStr(expr)) return [];
    let cached = EXTRACT_KEYS_CACHE.get(expr);
    if (cached !== undefined) return cached;

    const keys = new Set();
    const matches = expr.match(/(?:data|local|\$local)\.([a-zA-Z0-9_.]+)/g);
    if (matches) {
        for (let i = 0; i < matches.length; i++) {
            const clean = matches[i].replace(/^(?:data|local|\$local)\./, "");
            keys.add(clean);
            const dot = clean.indexOf(".");
            if (dot !== -1) {
                keys.add(clean.slice(0, dot));
            }
        }
    }
    const plainMatches = expr.match(/\{([a-zA-Z0-9_]+)\}/g);
    if (plainMatches) {
        for (let i = 0; i < plainMatches.length; i++) {
            keys.add(plainMatches[i].slice(1, -1));
        }
    }
    if (!expr.includes("{")) {
        const bareMatches = expr.match(/[a-zA-Z_$][a-zA-Z0-9_]*/g);
        if (bareMatches) {
            for (let i = 0; i < bareMatches.length; i++) {
                const w = bareMatches[i];
                if (w !== "true" && w !== "false" && w !== "null" && w !== "undefined" && w !== "data") {
                    keys.add(w);
                }
            }
        }
    }
    cached = Array.from(keys);
    if (EXTRACT_KEYS_CACHE.size >= EXTRACT_KEYS_CACHE_MAX) {
        const first = EXTRACT_KEYS_CACHE.keys().next().value;
        if (first !== undefined) EXTRACT_KEYS_CACHE.delete(first);
    }
    EXTRACT_KEYS_CACHE.set(expr, cached);
    return cached;
}

export function interpolate(engine, text, context = {}) {
    if (!text || !isStr(text) || !text.includes("{")) return text || "";

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
                    return isStr(v)
                        ? v
                        : typeof v === "number"
                          ? String(v)
                          : isObj(v)
                            ? safeStringify(v)
                            : String(v ?? "");
                }
                const v = engine.getState(inner);
                if (v !== undefined) {
                    return isStr(v)
                        ? v
                        : typeof v === "number"
                          ? String(v)
                          : isObj(v)
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
                            return isStr(v)
                                ? v
                                : typeof v === "number"
                                  ? String(v)
                                  : isObj(v)
                                    ? safeStringify(v)
                                    : String(v ?? "");
                        }
                    }
                } else if (scope.startsWith("$") || scope === "api" || scope === "stream" || scope === "errors" || scope === "device") {
                    const scopedVal = resolveScopedValue(engine, scope, prop, context);
                    if (scopedVal !== undefined && scopedVal !== null) {
                        return isStr(scopedVal)
                            ? scopedVal
                            : typeof scopedVal === "number"
                              ? String(scopedVal)
                              : typeof scopedVal === "object"
                                ? safeStringify(scopedVal)
                                : String(scopedVal ?? "");
                    }
                } else if (scope === "props" || scope === "$props") {
                    const propsObj = (context && context.props !== undefined)
                        ? context.props
                        : (engine?.props !== undefined ? engine.props : (context && context[prop] !== undefined ? context : null));
                    if (propsObj && typeof propsObj === "object") {
                        let curr = propsObj;
                        const parts = prop.split(".");
                        for (let pIdx = 0; pIdx < parts.length; pIdx++) {
                            if (curr === undefined || curr === null) break;
                            curr = curr[parts[pIdx]];
                        }
                        if (curr !== undefined && curr !== null) {
                            return isStr(curr)
                                ? curr
                                : typeof curr === "number"
                                  ? String(curr)
                                  : typeof curr === "object"
                                    ? safeStringify(curr)
                                    : String(curr ?? "");
                        }
                    }
                } else if (context && context[scope] !== undefined && context[scope] !== null) {
                    let curr = context[scope];
                    const parts = prop.split(".");
                    for (let pIdx = 0; pIdx < parts.length; pIdx++) {
                        if (curr === undefined || curr === null) break;
                        curr = curr[parts[pIdx]];
                    }
                    if (curr !== undefined)
                        return isStr(curr)
                            ? curr
                            : isObj(curr)
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
                        isStr(v) || typeof v === "number"
                            ? v
                            : isObj(v)
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
                            ? isStr(v) || typeof v === "number"
                                ? v
                                : isObj(v)
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
            } else if (c.scope.startsWith("$") || c.scope === "device") {
                const scopedVal = resolveScopedValue(engine, c.scope, c.prop, context);
                if (scopedVal !== undefined && scopedVal !== null) {
                    out += typeof scopedVal === "object" ? safeStringify(scopedVal) : String(scopedVal);
                }
            } else if (c.scope === "data" || c.scope === "state" || c.scope === "global" || c.scope === "$global") {
                const v = engine.getState(c.prop);
                out +=
                    v !== undefined
                        ? isStr(v) || typeof v === "number"
                            ? v
                            : isObj(v)
                              ? safeStringify(v)
                              : (v ?? "")
                        : "";
            } else if (c.scope === "parent") {
                const clean = c.prop.replace(/^data\./, "");
                const v = engine.getState(clean);
                out += v !== undefined ? (isObj(v) ? safeStringify(v) : (v ?? "")) : "";
            } else if (c.scope === "props" || c.scope === "$props") {
                const propsObj = (context && context.props !== undefined)
                    ? context.props
                    : (engine?.props !== undefined ? engine.props : (context && context[c.prop] !== undefined ? context : null));
                if (propsObj && typeof propsObj === "object") {
                    let curr = propsObj;
                    const parts = c.parts || (c.prop ? [c.prop] : []);
                    for (let p = 0; p < parts.length && curr !== undefined && curr !== null; p++) {
                        curr = curr[parts[p]];
                    }
                    if (curr !== undefined && curr !== null) {
                        out += typeof curr === "object" ? safeStringify(curr) : String(curr);
                    }
                }
            } else if (c.scope === "local" || c.scope === "$local") {
                if (context && context._localState && context._localState[c.prop] !== undefined) {
                    const v = context._localState[c.prop];
                    out += isObj(v) ? safeStringify(v) : (v ?? "");
                } else if (context && context.local && context.local[c.prop] !== undefined) {
                    const v = context.local[c.prop];
                    out += isObj(v) ? safeStringify(v) : (v ?? "");
                }
            } else if (
                c.scope === "api" ||
                c.scope === "$api" ||
                c.scope === "stream" ||
                c.scope === "$stream" ||
                c.scope === "errors" ||
                c.scope === "$errors"
            ) {
                const val = resolveScopedValue(engine, c.scope, c.prop, context);
                if (val !== undefined && val !== null) {
                    out += typeof val === "object" ? safeStringify(val) : String(val);
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
                        out += isObj(curr) ? JSON.stringify(curr) : (curr ?? "");
                    }
                }
            } else if (context && context[c.scope] !== undefined && context[c.scope] !== null) {
                let curr = context[c.scope];
                const parts = c.parts;
                for (let p = 0; p < parts.length && curr !== undefined && curr !== null; p++) {
                    curr = curr[parts[p]];
                }
                if (curr !== undefined) {
                    out += isObj(curr) ? JSON.stringify(curr) : (curr ?? "");
                }
            }
        }
        return out;
    }

    // Fast-path 3: JIT compiled template function for complex expressions/ternaries/math
    const jitFn = EUIXExpressionParser.compileTemplateFunction(text);
    if (jitFn) {
        const effectiveContext = context?.props !== undefined ? context : { ...context, props: engine?.props };
        const dataScope = engine ? engine._rawState || engine.state : null;
        const localScope = effectiveContext._localState || effectiveContext.local;
        const res = jitFn(dataScope, localScope, effectiveContext, engine, (p) => engine.resolveValueFromPath(p, effectiveContext));
        if (res !== undefined && res !== null) return res;
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

    // 1.5. Resolve {props.name}, {$props.name}, {args.name}, {params.name}, {result.name}, {result}, {err.name}, {error.name}, {local.name}, {$local.name}, {global.name}, {errors.name}, {$errors.name}, {api.name}, {$api.name}, {stream.name}, {$stream.name}, {$route.name}, {$router.name}, {$fetcher.name}
    result = result.replace(
        /\{(props|\$props|args|params|result|err|error|local|\$local|global|errors|\$errors|api|\$api|stream|\$stream|\$route|\$router|\$fetcher)(?:\.([a-zA-Z0-9_.]+))?\}/g,
        (match, scope, prop) => {
            if (scope === "props" || scope === "$props") {
                const propsObj = (context && context.props !== undefined) ? context.props : engine.props;
                if (propsObj && typeof propsObj === "object") {
                    if (!prop) return typeof propsObj === "object" ? JSON.stringify(propsObj) : String(propsObj);
                    const parts = prop.split(".");
                    let curr = propsObj;
                    for (let i = 0; i < parts.length && curr !== undefined && curr !== null; i++) {
                        curr = curr[parts[i]];
                    }
                    return curr !== undefined && curr !== null ? (typeof curr === "object" ? JSON.stringify(curr) : String(curr)) : "";
                }
                return "";
            }
            if (
                scope === "stream" ||
                scope === "$stream" ||
                scope === "errors" ||
                scope === "$errors" ||
                scope === "$route" ||
                scope === "$router" ||
                scope === "$fetcher" ||
                scope === "api" ||
                scope === "$api"
            ) {
                const val = resolveScopedValue(engine, scope, prop, context);
                if (val !== undefined && val !== null) {
                    return typeof val === "object" ? JSON.stringify(val) : String(val);
                }
                return (scope === "api" || scope === "$api") && !prop ? match : "";
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
            const exprCtx = context?.props !== undefined ? context : { ...context, props: engine.props };
            try {
                const evaluated = EUIXExpressionParser.eval(
                    resolvedExpr,
                    (name) => {
                        const dotIdx = name.indexOf(".");
                        if (dotIdx !== -1) {
                            const scope = name.slice(0, dotIdx);
                            const prop = name.slice(dotIdx + 1);
                            if (
                                scope === "api" ||
                                scope === "$api" ||
                                scope === "stream" ||
                                scope === "$stream" ||
                                scope === "errors" ||
                                scope === "$errors" ||
                                scope === "date" ||
                                scope === "$date" ||
                                scope === "device" ||
                                scope === "$device" ||
                                scope === "$route" ||
                                scope === "$router" ||
                                scope === "$fetcher"
                            ) {
                                const scopedVal = resolveScopedValue(engine, scope, prop, context);
                                if (scopedVal !== undefined) return scopedVal;
                            }
                            if (scope === "local" || scope === "$local") {
                                if (context._localState && context._localState[prop] !== undefined) {
                                    return context._localState[prop];
                                }
                                if (context.local && context.local[prop] !== undefined) {
                                    return context.local[prop];
                                }
                            }
                            if (scope === "global" || scope === "$global") {
                                const gk = prop.replace(/^data\./, "");
                                return engine.getState(gk);
                            }
                        } else if (
                            name === "$date" ||
                            name === "date" ||
                            name === "$device" ||
                            name === "device" ||
                            name === "$route" ||
                            name === "$router"
                        ) {
                            return resolveScopedValue(engine, name, "", context);
                        }

                        const cleanKey = name.replace(/^(?:parent\.)?data\./, "");
                        if (context._localState && context._localState[cleanKey] !== undefined) {
                            return context._localState[cleanKey];
                        }

                        const parts = name.split(".");
                        const firstPart = parts[0];

                        const ctxProps = context && context.props !== undefined ? context.props : engine.props;
                        if (firstPart === "props" && ctxProps !== undefined && ctxProps !== null) {
                            let curr = ctxProps;
                            if (parts.length === 1) return curr;
                            for (let i = 1; i < parts.length && curr !== undefined && curr !== null; i++) {
                                curr = curr[parts[i]];
                            }
                            if (curr !== undefined) return curr;
                        }

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
                    },
                    exprCtx,
                    engine,
                );
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
        if (scope === "props" && engine.props && typeof engine.props === "object") {
            return engine.props[prop] !== undefined ? engine.props[prop] : "";
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
        if (isStr(val) && val.trim() !== "" && !Number.isNaN(Number(val))) {
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
