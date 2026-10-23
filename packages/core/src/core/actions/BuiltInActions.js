/**
 * src/core/actions/BuiltInActions.js
 * Built-in declarative action handlers and internal action dispatcher for EUIX Engine.
 */

import { EUIXExpressionParser } from "../parser/ExpressionParser.js";
import { EUIXStructuredError } from "../parser/errors.js";
import { isFn, trimStr } from "../utils/constants.js";
import {
    interpolateObjectProperties,
    evaluateObjectExpression,
    parseMutateExpr,
    _handleMutateStateAction,
} from "./MutateStateAction.js";

const _actionEvalCache = new Map();
const MAX_ACTION_CACHE = 1000;
const _scriptFnCache = new Map();
const MAX_SCRIPT_CACHE = 500;
const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;

function _getActionEvalFn(rawExpr) {
    let fn = _actionEvalCache.get(rawExpr);
    if (!fn) {
        if (_actionEvalCache.size >= MAX_ACTION_CACHE) {
            const firstKey = _actionEvalCache.keys().next().value;
            if (firstKey !== undefined) _actionEvalCache.delete(firstKey);
        }
        fn = new Function("$data", "data", "$date", "date", "context", `return (${rawExpr});`);
        _actionEvalCache.set(rawExpr, fn);
    }
    return fn;
}

function _getCompiledScriptFn(executableCode, isAsync) {
    let fn = _scriptFnCache.get(executableCode);
    if (!fn) {
        if (_scriptFnCache.size >= MAX_SCRIPT_CACHE) {
            const firstKey = _scriptFnCache.keys().next().value;
            if (firstKey !== undefined) _scriptFnCache.delete(firstKey);
        }
        const Ctor = isAsync ? AsyncFunction : Function;
        fn = new Ctor(
            "$el",
            "$data",
            "$engine",
            "$evt",
            "$args",
            "$result",
            "$retry",
            "$cancellationSignal",
            "$newValue",
            "$prevValue",
            "$oldValue",
            "$path",
            "$err",
            "$date",
            "$ctx",
            "$context",
            "$item",
            "$index",
            "$local",
            executableCode,
        );
        _scriptFnCache.set(executableCode, fn);
    }
    return fn;
}

export function clearActionCaches() {
    _actionEvalCache.clear();
    _scriptFnCache.clear();
}

export function _handleSetStateAction(actionNode, context = {}) {
    const pathNode = this.getChild(actionNode, "path");
    const valueNode = this.getChild(actionNode, "value");
    let rawPath =
        trimStr(pathNode) ||
        (actionNode.getAttribute ? actionNode.getAttribute("path") || actionNode.getAttribute("set") || "" : "");
    let rawValue = trimStr(valueNode) || (actionNode.getAttribute ? actionNode.getAttribute("value") || "" : "");

    if (!rawPath) return;

    // Check if rawPath is an inline shorthand like "counter={data.counter + 1}" or "count: 5"
    if (!rawValue) {
        const eqIdx = rawPath.indexOf("=");
        const colonIdx = rawPath.indexOf(":");
        const splitIdx = eqIdx !== -1 ? eqIdx : colonIdx;
        if (splitIdx !== -1) {
            rawValue = rawPath.slice(splitIdx + 1).trim();
            rawPath = rawPath.slice(0, splitIdx).trim();
        } else if (context._evt && context._evt.target) {
            const t = context._evt.target;
            rawValue = t.type === "checkbox" ? (t.checked ? "true" : "false") : (t.value ?? "");
        }
    }

    if (
        (rawValue.startsWith("'") && rawValue.endsWith("'") && rawValue.length >= 2) ||
        (rawValue.startsWith('"') && rawValue.endsWith('"') && rawValue.length >= 2)
    ) {
        rawValue = rawValue.slice(1, -1);
    }

    const interpolatedPath = this.interpolate(rawPath, context);
    const path = this.parseBindPath(interpolatedPath);

    let nextValue = "";

    const evalGetter = (key) => {
        const cleanKey = this.parseBindPath(key);
        if (key.startsWith("local.") && context._localState) {
            const lk = key.replace(/^local\./, "");
            const val = context._localState[lk];
            const num = parseFloat(val);
            return !Number.isNaN(num) && val !== "" && val !== null ? num : (val ?? 0);
        }
        if (context._localState && context._localState[cleanKey] !== undefined) {
            const val = context._localState[cleanKey];
            const num = parseFloat(val);
            return !Number.isNaN(num) && val !== "" && val !== null ? num : (val ?? 0);
        }
        const val = this.getState(cleanKey);
        const num = parseFloat(val);
        return !Number.isNaN(num) && val !== "" && val !== null ? num : (val ?? 0);
    };

    const cleanExpr = rawValue
        .replace(/\{\s*(data\.\w+|local\.\w+|\$local\.\w+|\w+)\s*\}/g, "$1")
        .replace(/^\{\s*|\s*\}$/g, "")
        .trim();
    const hasBraces = /^\{.*\}$/.test(rawValue.trim()) || rawValue.includes("{");

    const targetIsNumber =
        typeof this._rawState?.[path] === "number" ||
        typeof context._localState?.[path] === "number" ||
        (context._localState && typeof context._localState[rawPath.replace(/^(\$local|local)\./, "")] === "number");

    const targetIsBool =
        typeof this._rawState?.[path] === "boolean" ||
        typeof context._localState?.[path] === "boolean" ||
        (context._localState && typeof context._localState[rawPath.replace(/^(\$local|local)\./, "")] === "boolean");

    const hasMathOrTernary =
        (/(?:^|\s|\d|[a-zA-Z_$])[+\-*/](?:\s|\d|[a-zA-Z_$])/.test(cleanExpr) && !cleanExpr.startsWith("http")) ||
        cleanExpr.includes("?");

    if (hasMathOrTernary) {
        try {
            const evaluated = EUIXExpressionParser.eval(cleanExpr, evalGetter);
            if (evaluated !== undefined && typeof evaluated === "number" && !Number.isNaN(evaluated)) {
                nextValue = targetIsNumber ? evaluated : String(evaluated);
            } else if (typeof evaluated === "boolean") {
                nextValue = targetIsBool ? evaluated : String(evaluated);
            }
        } catch (_) {}
    }

    if (nextValue === "") {
        if (rawValue.includes("{")) {
            nextValue = this.interpolate(rawValue, context);
        } else if (rawValue.includes("(") && rawValue.includes(")")) {
            try {
                const fn = _getActionEvalFn(rawValue);
                const evaluated = fn(this.data, this.data, this.$date || this.date, this.$date || this.date, context);
                nextValue = evaluated !== undefined ? evaluated : "";
            } catch (_) {
                nextValue = this.interpolate(rawValue, context);
            }
        } else {
            nextValue = this.interpolate(rawValue, context);
        }
    }

    if (
        targetIsNumber &&
        typeof nextValue === "string" &&
        nextValue.trim() !== "" &&
        !Number.isNaN(Number(nextValue))
    ) {
        nextValue = Number(nextValue);
    } else if (targetIsBool && typeof nextValue === "string") {
        if (nextValue === "true") nextValue = true;
        else if (nextValue === "false") nextValue = false;
    }

    this._setScopedState(rawPath, path, nextValue, context);

    const focusNode = this.getChild(actionNode, "focus");
    if (focusNode) {
        const targetStr = focusNode.textContent.trim();
        const resolved = this.interpolate(targetStr, context).replace(/^ref:/, "");
        if (this.refs[resolved] && isFn(this.refs[resolved].focus)) {
            this.refs[resolved].focus();
        } else {
            this._pendingFocusKey = this.parseBindPath(targetStr);
        }
    }
}

export function _handleToggleStateAction(actionNode, context = {}) {
    const pathNode = this.getChild(actionNode, "path");
    const rawPath = pathNode
        ? pathNode.textContent.trim()
        : actionNode.getAttribute
          ? actionNode.getAttribute("path") ||
            actionNode.getAttribute("target") ||
            actionNode.getAttribute("bind") ||
            actionNode.getAttribute("toggle") ||
            ""
          : "";
    const interpolatedPath = this.interpolate(rawPath, context);
    const path = this.parseBindPath(interpolatedPath);
    if (!path) return;

    let currentVal;
    if (rawPath.startsWith("local.") || rawPath.startsWith("$local.")) {
        const localKey = rawPath.replace(/^(\$local|local)\./, "");
        currentVal = context._localState ? context._localState[localKey] : undefined;
    } else if (context._localState && context._localState[path] !== undefined && !rawPath.startsWith("global.")) {
        currentVal = context._localState[path];
    } else {
        currentVal = this.getState(path);
    }

    const isTruthy = currentVal === true || currentVal === "true" || currentVal === 1 || currentVal === "1";
    const targetIsBool =
        typeof this._rawState?.[path] === "boolean" ||
        typeof context._localState?.[path] === "boolean" ||
        (context._localState && typeof context._localState[rawPath.replace(/^(\$local|local)\./, "")] === "boolean");
    const nextValue = targetIsBool ? !isTruthy : isTruthy ? "false" : "true";
    this._setScopedState(rawPath, path, nextValue, context);
}

export function _handleFocusAction(actionNode, context = {}) {
    const target =
        (actionNode.getAttribute
            ? actionNode.getAttribute("target") || actionNode.getAttribute("focus") || actionNode.getAttribute("ref")
            : "") ||
        this.getChild(actionNode, "target")?.textContent ||
        this.getChild(actionNode, "focus")?.textContent ||
        this.getChild(actionNode, "ref")?.textContent;
    if (!target) return;
    const resolved = this.interpolate(target, context).replace(/^ref:/, "");
    if (this.refs[resolved] && isFn(this.refs[resolved].focus)) {
        this.refs[resolved].focus();
    } else {
        const el = document.querySelector(`[data-euix-ref="${resolved}"], [data-xui-ref="${resolved}"], #${resolved}`);
        if (el && isFn(el.focus)) el.focus();
    }
}

export function _handleRevalidateAction(actionNode, context = {}) {
    const routeAttr = actionNode?.getAttribute ? actionNode.getAttribute("route") : null;
    if (routeAttr && this.router && typeof this.router.revalidate === "function") {
        this.router.revalidate(routeAttr);
        return;
    }
    const tagNode = this.getChild
        ? this.getChild(actionNode, "tag") ||
          this.getChild(actionNode, "url") ||
          this.getChild(actionNode, "revalidate")
        : null;
    const rawTag = tagNode
        ? tagNode.textContent.trim()
        : actionNode?.getAttribute
          ? actionNode.getAttribute("tag") ||
            actionNode.getAttribute("revalidate") ||
            actionNode.getAttribute("url") ||
            ""
          : "";
    const tag = this.interpolate(rawTag, context);
    if (typeof this.revalidateApi === "function") {
        this.revalidateApi(tag);
    } else if (this.router && typeof this.router.revalidate === "function") {
        this.router.revalidate(tag);
    }
}

export function _handleSetTitleAction(actionNode, context = {}) {
    const valNode = this.getChild(actionNode, "value") || this.getChild(actionNode, "title");
    const rawVal = valNode
        ? valNode.textContent.trim()
        : actionNode.getAttribute("value") || actionNode.getAttribute("title") || "";
    const title = this.interpolate(rawVal, context);
    if (typeof document !== "undefined") {
        document.title = title;
    }
}

export function _handleThrowAction(actionNode, context = {}) {
    const msg =
        actionNode.getAttribute("message") ||
        actionNode.getAttribute("msg") ||
        this.getChild(actionNode, "message")?.textContent ||
        "Explicit throw triggered";
    const code = actionNode.getAttribute("code") || "ACTION_EXECUTION_ERROR";
    const interpolatedMsg = this.interpolate(msg, context);
    throw new EUIXStructuredError({
        message: interpolatedMsg,
        code,
        originatingAction: "THROW",
        component: context._componentName,
    });
}

export function _handleRethrowAction(_actionNode, context = {}) {
    const errToThrow =
        context.err ||
        context.error ||
        context._lastError ||
        new EUIXStructuredError({ message: "Explicit rethrow triggered", code: "ACTION_EXECUTION_ERROR" });
    throw errToThrow;
}

export function _handleRunScriptAction(actionNode, context = {}) {
    const code =
        (actionNode.getAttribute
            ? actionNode.getAttribute("run") ||
              actionNode.getAttribute("script") ||
              actionNode.getAttribute("code") ||
              actionNode.getAttribute("eval")
            : "") ||
        actionNode.textContent?.trim() ||
        "";
    if (!code) return;
    const decodedCode = code
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&");
    const interpolatedCode = decodedCode.replace(/\{([a-zA-Z_$][a-zA-Z0-9_.]*)\}/g, (match, p1) => {
        const val = this.resolveValueFromPath(p1, context);
        return val !== undefined ? JSON.stringify(val) : match;
    });
    const targetEl = context._targetEl || (actionNode.parentElement ? actionNode.parentElement : null);
    try {
        let preamble = "";
        if (context) {
            const declRegex = (name) => new RegExp(`\\b(?:const|let|var|function)\\s+${name}\\b`);
            const keys = Object.keys(context).filter(
                (k) =>
                    /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) &&
                    ![
                        "$el",
                        "$data",
                        "$engine",
                        "$evt",
                        "$args",
                        "$result",
                        "$retry",
                        "$cancellationSignal",
                        "$newValue",
                        "$prevValue",
                        "$oldValue",
                        "$path",
                        "$err",
                        "$date",
                        "$ctx",
                        "$context",
                        "$item",
                        "$index",
                        "$local",
                        "this",
                    ].includes(k) &&
                    !declRegex(k).test(interpolatedCode),
            );
            if (keys.length > 0) {
                preamble = keys.map((k) => `var ${k} = $ctx[${JSON.stringify(k)}];`).join("\n") + "\n";
            }
            if (
                context._varName &&
                /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(context._varName) &&
                !keys.includes(context._varName) &&
                !declRegex(context._varName).test(interpolatedCode)
            ) {
                preamble += `var ${context._varName} = $item;\n`;
            }
        }
        const executableCode = preamble + interpolatedCode;

        const isAsync = executableCode.includes("await ");
        const fn = _getCompiledScriptFn(executableCode, isAsync);
        const nVal = context.$newValue !== undefined ? context.$newValue : context.newValue;
        const pVal =
            context.$prevValue !== undefined
                ? context.$prevValue
                : context.prevValue !== undefined
                  ? context.prevValue
                  : context.oldValue;
        const oVal = context.$oldValue !== undefined ? context.$oldValue : context.oldValue;
        const pPath = context.$path || context.path || "";
        const errVal = context.err || context.error || context._lastError || null;
        const dateHelper = this.$date || this.date || null;
        const itemVal =
            context.item !== undefined
                ? context.item
                : context._varName && context[context._varName] !== undefined
                  ? context[context._varName]
                  : (() => {
                        const customKey = Object.keys(context).find(
                            (k) =>
                                !k.startsWith("_") &&
                                ![
                                    "args",
                                    "result",
                                    "props",
                                    "local",
                                    "err",
                                    "error",
                                    "data",
                                    "$data",
                                    "state",
                                    "constants",
                                ].includes(k),
                        );
                        return customKey ? context[customKey] : undefined;
                    })();
        const indexVal =
            context._index !== undefined ? context._index : context.index !== undefined ? context.index : 0;
        const localVal = context._localState || context.local || null;
        return fn.call(
            targetEl,
            targetEl,
            this.state || this._proxyState,
            this,
            context._evt || null,
            context.args || {},
            context.result,
            context.retry || context.$retry || null,
            context._cancellationSignal || null,
            nVal,
            pVal,
            oVal,
            pPath,
            errVal,
            dateHelper,
            context,
            context,
            itemVal,
            indexVal,
            localVal,
        );
    } catch (err) {
        this.reportError(err, "Action Execution (RUN_SCRIPT)");
        throw err;
    }
}

export {
    interpolateObjectProperties,
    evaluateObjectExpression,
    parseMutateExpr,
    _handleMutateStateAction,
};

export function _handleUndoStateAction(actionNode, context = {}) {
    const history = this.history || this._historyManager || this._devtools?.history;
    if (history && isFn(history.undo)) return history.undo();
    return false;
}

export function _handleRedoStateAction(actionNode, context = {}) {
    const history = this.history || this._historyManager || this._devtools?.history;
    if (history && isFn(history.redo)) return history.redo();
    return false;
}

export function _handleTakeSnapshotAction(actionNode, context = {}) {
    const label = (actionNode?.getAttribute && actionNode.getAttribute("label")) || "Manual Snapshot";
    const history = this.history || this._historyManager || this._devtools?.history;
    if (history && isFn(history.takeSnapshot)) return history.takeSnapshot(label);
    return null;
}

export function _handleResetErrorBoundaryAction(actionNode, context = {}) {
    const target =
        (actionNode?.getAttribute &&
            (actionNode.getAttribute("target") ||
                actionNode.getAttribute("boundary") ||
                actionNode.getAttribute("name"))) ||
        this.getChild?.(actionNode, "target")?.textContent?.trim();
    if (target) {
        return this.resetErrorBoundary(target);
    }
    if (context._errorBoundary) {
        context._errorBoundary.retry();
        return true;
    }
    if (context._el) {
        const boundary = this.findClosestErrorBoundary(context._el);
        if (boundary) {
            boundary.retry();
            return true;
        }
    }
    return false;
}

export function _handleEmitAction(actionNode, context = {}) {
    const eventName =
        (actionNode?.getAttribute
            ? actionNode.getAttribute("event") ||
              actionNode.getAttribute("name") ||
              actionNode.getAttribute("emit")
            : "") ||
        (this.getChild && this.getChild(actionNode, "event")?.textContent.trim()) ||
        "";
    if (!eventName) return;
    const args = isFn(this._extractActionArgs) ? this._extractActionArgs(actionNode, context) : {};
    if (this.emit) {
        this.emit(eventName, { ...args, context });
    } else if (this.hooks?.emit) {
        this.hooks.emit(eventName, { ...args, context });
    }
    const el = context._targetEl || (actionNode.parentElement ? actionNode.parentElement : null);
    if (el && typeof el.dispatchEvent === "function" && typeof CustomEvent !== "undefined") {
        try {
            el.dispatchEvent(new CustomEvent(eventName, { detail: args, bubbles: true, composed: true }));
        } catch (_) {}
    }
}

