/**
 * src/core/actions/BuiltInActions.js
 * Built-in declarative action handlers and internal action dispatcher for EUIX Engine.
 */

import { EUIXExpressionParser } from "../parser/ExpressionParser.js";
import { EUIXStructuredError } from "../parser/errors.js";
import { isFn, MUTATION_OPS, trimStr } from "../utils/constants.js";

export function _handleSetStateAction(actionNode, context = {}) {
    const pathNode = this.getChild(actionNode, "path");
    const valueNode = this.getChild(actionNode, "value");
    if (!pathNode) return;

    const rawPath = trimStr(pathNode);
    const interpolatedPath = this.interpolate(rawPath, context);
    const path = this.parseBindPath(interpolatedPath);

    const rawValue = trimStr(valueNode);
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

    if (hasBraces && (rawValue.includes("?") || /[+\-*/]/.test(cleanExpr))) {
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
                const fn = new Function("$data", "data", "$date", "date", "context", `return (${rawValue});`);
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
        : actionNode.getAttribute("path") || actionNode.getAttribute("target") || actionNode.getAttribute("bind") || "";
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
        actionNode.getAttribute("target") ||
        actionNode.getAttribute("ref") ||
        this.getChild(actionNode, "target")?.textContent ||
        this.getChild(actionNode, "ref")?.textContent;
    if (!target) return;
    const resolved = this.interpolate(target, context).replace(/^ref:/, "");
    if (this.refs[resolved] && isFn(this.refs[resolved].focus)) {
        this.refs[resolved].focus();
    } else {
        const el = document.querySelector(`[data-euix-ref="${resolved}"], #${resolved}`);
        if (el && isFn(el.focus)) el.focus();
    }
}

export function _handleRevalidateAction(actionNode, context = {}) {
    const tagNode = this.getChild(actionNode, "tag") || this.getChild(actionNode, "url");
    const rawTag = tagNode
        ? tagNode.textContent.trim()
        : actionNode.getAttribute("tag") || actionNode.getAttribute("url") || "";
    const tag = this.interpolate(rawTag, context);
    this.revalidateApi(tag);
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
        actionNode.textContent.trim() || actionNode.getAttribute("code") || actionNode.getAttribute("script") || "";
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
                    ].includes(k),
            );
            if (keys.length > 0) {
                preamble = keys.map((k) => `var ${k} = $ctx[${JSON.stringify(k)}];`).join("\n") + "\n";
            }
            if (context._varName && /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(context._varName) && !keys.includes(context._varName)) {
                preamble += `var ${context._varName} = $item;\n`;
            }
        }
        const executableCode = preamble + interpolatedCode;

        const isAsync = executableCode.includes("await ");
        const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor;
        const fn = isAsync
            ? new AsyncFunction(
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
              )
            : new Function(
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
        const indexVal = context._index !== undefined ? context._index : context.index !== undefined ? context.index : 0;
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

function interpolateObjectProperties(engine, obj, context) {
    if (!obj || typeof obj !== "object" || !engine) return obj;
    for (const [k, v] of Object.entries(obj)) {
        if (typeof v === "string" && v.includes("{")) {
            obj[k] = engine.interpolate(v, context);
        } else if (v && typeof v === "object") {
            interpolateObjectProperties(engine, v, context);
        }
    }
    return obj;
}

function evaluateObjectExpression(engine, expr, context = {}) {
    if (!expr || typeof expr !== "string") return null;
    const trimmed = expr.trim();
    if (!trimmed) return null;

    try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object") {
            return interpolateObjectProperties(engine, parsed, context);
        }
    } catch (_) {}

    const sanitized = trimmed.replace(/\{([a-zA-Z_$][a-zA-Z0-9_.]*)\}/g, (match, p1) => {
        const val = engine && isFn(engine.resolveValueFromPath) ? engine.resolveValueFromPath(p1, context) : undefined;
        return val !== undefined ? JSON.stringify(val) : p1;
    });

    try {
        const parsed = JSON.parse(sanitized);
        if (parsed && typeof parsed === "object") {
            return interpolateObjectProperties(engine, parsed, context);
        }
    } catch (_) {}

    try {
        const itemVal =
            context.item !== undefined
                ? context.item
                : context._varName && context[context._varName] !== undefined
                  ? context[context._varName]
                  : undefined;
        const taskVal = context.task !== undefined ? context.task : itemVal;
        const fn = new Function(
            "$data",
            "data",
            "$ctx",
            "context",
            "$item",
            "item",
            "task",
            `return (${sanitized});`,
        );
        const res = fn(
            engine?.state || engine?._rawState || {},
            engine?.state || engine?._rawState || {},
            context,
            context,
            itemVal,
            itemVal,
            taskVal,
        );
        if (res && typeof res === "object") {
            return interpolateObjectProperties(engine, res, context);
        }
    } catch (_) {
        try {
            const fn2 = new Function(
                "$data",
                "data",
                "$ctx",
                "context",
                "$item",
                "item",
                "task",
                `return (${trimmed});`,
            );
            const res2 = fn2(
                engine?.state || engine?._rawState || {},
                engine?.state || engine?._rawState || {},
                context,
                context,
                context.item,
                context.item,
                context.task,
            );
            if (res2 && typeof res2 === "object") {
                return interpolateObjectProperties(engine, res2, context);
            }
        } catch (_) {}
    }

    return null;
}

export function _handleMutateStateAction(actionNode, context = {}) {
    const pathNode = this.getChild(actionNode, "path");
    const opNode = this.getChild(actionNode, "operation");
    const rawPath = trimStr(pathNode) || actionNode.getAttribute("path") || "";
    const interpolatedPath = this.interpolate(rawPath, context);
    const path = this.parseBindPath(interpolatedPath);
    const operation = (trimStr(opNode) || actionNode.getAttribute("operation") || "").toUpperCase();

    if (!path || !operation) return;

    if (operation === MUTATION_OPS.CLEAR || operation === MUTATION_OPS.EMPTY || operation === MUTATION_OPS.RESET) {
        this.batch(() => {
            this.setState(path, []);
            this.applyResets(actionNode);
        });
        return;
    }

    if (operation === MUTATION_OPS.INCREMENT || operation === MUTATION_OPS.DECREMENT) {
        const rawVal = this.getState(path);
        if (!Array.isArray(rawVal)) {
            let num = parseInt(rawVal ?? "0", 10);
            if (Number.isNaN(num)) num = 0;
            num = operation === MUTATION_OPS.INCREMENT ? num + 1 : num - 1;
            const targetIsNumber = typeof this._rawState?.[path] === "number";
            this.setState(path, targetIsNumber ? num : String(num));
            return;
        }

        const idxNode = this.getChild(actionNode, "index");
        const fieldNode = this.getChild(actionNode, "field");
        const rawIdx = idxNode ? idxNode.textContent.trim() : actionNode.getAttribute("index") || "";
        const fieldName = fieldNode ? fieldNode.textContent.trim() : actionNode.getAttribute("field") || "quantity";
        const index = parseInt(this.interpolate(rawIdx, context), 10);

        const currentVal = this.getState(path);
        const currentList = Array.isArray(currentVal)
            ? [...currentVal]
            : Array.isArray(this._rawState[path])
              ? [...this._rawState[path]]
              : [];
        if (!Number.isNaN(index) && index >= 0 && index < currentList.length) {
            const item = { ...currentList[index] };
            let currVal = parseInt(item[fieldName] || 1, 10);
            if (operation === MUTATION_OPS.INCREMENT) {
                currVal += 1;
            } else {
                currVal = Math.max(1, currVal - 1);
            }
            item[fieldName] = currVal;
            currentList[index] = item;
        }
        this.setState(path, currentList);
        return;
    }

    if (operation === MUTATION_OPS.PUSH || operation === MUTATION_OPS.UNSHIFT || operation === MUTATION_OPS.PREPEND) {
        const valNode = this.getChild(actionNode, "value");
        const valItem = (valNode && this.getChild(valNode, "item")) || this.getChild(actionNode, "item") || valNode;
        const rawText = valItem
            ? (typeof valItem.getAttribute === "function" && valItem.getAttribute("text")) ||
              valItem.textContent?.trim() ||
              ""
            : "";
        const textValue = this.interpolate(rawText, context);

        let parsedObj =
            evaluateObjectExpression(this, rawText, context) ||
            evaluateObjectExpression(this, textValue, context);

        const itemId =
            (valItem && typeof valItem.getAttribute === "function" && valItem.getAttribute("id")) ||
            parsedObj?.id ||
            `task-${Date.now()}`;

        let newItem;
        if (parsedObj && typeof parsedObj === "object") {
            newItem = { id: itemId, ...parsedObj };
        } else if (parsedObj !== undefined && parsedObj !== null && typeof parsedObj !== "object") {
            newItem = { id: itemId, text: String(parsedObj), title: String(parsedObj), value: parsedObj };
        } else if (textValue) {
            newItem = { id: itemId, text: textValue, title: textValue, value: textValue };
        } else {
            newItem = { id: itemId };
        }

        if (valItem?.attributes) {
            const vAttrs = valItem.attributes;
            const vaLen = vAttrs.length;
            for (let vaIdx = 0; vaIdx < vaLen; vaIdx++) {
                const attr = vAttrs[vaIdx];
                const interpolatedVal = this.interpolate(attr.value, context);
                if (
                    interpolatedVal !== undefined &&
                    interpolatedVal !== null &&
                    !interpolatedVal.includes("undefined")
                ) {
                    newItem[attr.name] = interpolatedVal;
                }
            }
        }
        if (valItem && typeof valItem.getAttribute === "function") {
            const textAttr = valItem.getAttribute("text");
            if (textAttr && !newItem.text) newItem.text = this.interpolate(textAttr, context);
            const titleAttr = valItem.getAttribute("title");
            if (titleAttr && !newItem.title) newItem.title = this.interpolate(titleAttr, context);
        }
        if (!newItem.text && textValue) newItem.text = textValue;
        if (!newItem.title && textValue) newItem.title = textValue;
        if (!newItem.quantity) newItem.quantity = 1;

        const hasCustomAttributes = Object.keys(newItem).some(
            (k) => k !== "id" && k !== "quantity" && String(newItem[k]).trim() !== "",
        );
        const titleVal = newItem.title || newItem.text || newItem.name || (hasCustomAttributes ? "valid" : "");
        if (!String(titleVal).trim()) return;

        const whereNode = this.getChild(actionNode, "where");
        const rawWhereEquals = whereNode ? whereNode.getAttribute("equals") : null;
        const targetId = rawWhereEquals ? this.interpolate(rawWhereEquals, context) : newItem.id;

        const curVal = this.getState(path);
        const currentList = Array.isArray(curVal)
            ? [...curVal]
            : Array.isArray(this._rawState[path])
              ? [...this._rawState[path]]
              : [];
        const existingIdx = currentList.findIndex((it) => String(it.id) === String(targetId));

        if (existingIdx >= 0 && targetId) {
            const existing = { ...currentList[existingIdx] };
            const currentQty = parseInt(existing.quantity || 1, 10);
            const addQty = parseInt(newItem.quantity || 1, 10);
            existing.quantity = currentQty + addQty;
            currentList[existingIdx] = existing;
        } else {
            if (operation === MUTATION_OPS.UNSHIFT || operation === MUTATION_OPS.PREPEND) {
                currentList.unshift(newItem);
            } else {
                currentList.push(newItem);
            }
        }

        this.batch(() => {
            this.setState(path, currentList);
            this.applyResets(actionNode);
        });
        return;
    }

    if (operation === MUTATION_OPS.REMOVE || operation === MUTATION_OPS.DELETE) {
        const indexNode = this.getChild(actionNode, "index");
        const whereNode = this.getChild(actionNode, "where");
        const curVal = this.getState(path);
        let list = Array.isArray(curVal)
            ? [...curVal]
            : Array.isArray(this._rawState[path])
              ? [...this._rawState[path]]
              : [];

        if (indexNode) {
            const rawIdx = indexNode.textContent.trim() || indexNode.getAttribute("value") || "";
            const interpolatedIdx = this.interpolate(rawIdx, context);
            const idx = parseInt(interpolatedIdx, 10);
            if (!Number.isNaN(idx) && idx >= 0 && idx < list.length) {
                list.splice(idx, 1);
                this.batch(() => {
                    this.setState(path, list);
                    this.applyResets(actionNode);
                });
                return;
            }
        }

        if (whereNode) {
            const field = whereNode.getAttribute("field") || "id";
            const op = whereNode.getAttribute("op") || whereNode.getAttribute("operator") || "equals";
            const rawEquals = whereNode.getAttribute("equals") || whereNode.getAttribute("value") || whereNode.textContent.trim();
            const targetVal = rawEquals !== null ? this.interpolate(rawEquals, context) : null;

            if (targetVal !== null) {
                list = list.filter((item) => {
                    if (!item) return false;
                    const itemVal = String(item[field]);
                    if (op === "equals") return itemVal !== String(targetVal);
                    if (op === "neq") return itemVal === String(targetVal);
                    return true;
                });
            }
        }

        this.batch(() => {
            this.setState(path, list);
            this.applyResets(actionNode);
        });
        return;
    }

    if (operation === MUTATION_OPS.POP) {
        const list = Array.isArray(this._rawState[path]) ? [...this._rawState[path]] : [];
        list.pop();
        this.batch(() => {
            this.setState(path, list);
            this.applyResets(actionNode);
        });
        return;
    }

    if (operation === MUTATION_OPS.SHIFT) {
        const list = Array.isArray(this._rawState[path]) ? [...this._rawState[path]] : [];
        list.shift();
        this.batch(() => {
            this.setState(path, list);
            this.applyResets(actionNode);
        });
        return;
    }

    if (operation === MUTATION_OPS.UPDATE || operation === MUTATION_OPS.SET) {
        const whereNode = this.getChild(actionNode, "where");
        const field = whereNode?.getAttribute("field") || "id";
        const op = whereNode?.getAttribute("op") || whereNode?.getAttribute("operator") || "equals";
        const rawEquals = whereNode ? whereNode.getAttribute("equals") || whereNode.getAttribute("value") || whereNode.textContent.trim() : null;
        const targetVal = rawEquals !== null ? this.interpolate(rawEquals, context) : null;

        const valNode = this.getChild(actionNode, "value");
        const fieldsNode = this.getChild(actionNode, "fields");
        const itemNode = this.getChild(actionNode, "item");
        const rawText = valNode ? valNode.textContent?.trim() || "" : "";
        const parsedObj = evaluateObjectExpression(this, rawText, context);

        const updateValues = parsedObj && typeof parsedObj === "object" ? { ...parsedObj } : {};
        if (valNode?.attributes) {
            for (let vaIdx = 0; vaIdx < valNode.attributes.length; vaIdx++) {
                const attr = valNode.attributes[vaIdx];
                updateValues[attr.name] = this.interpolate(attr.value, context);
            }
        }
        if (fieldsNode?.attributes) {
            for (let faIdx = 0; faIdx < fieldsNode.attributes.length; faIdx++) {
                const attr = fieldsNode.attributes[faIdx];
                updateValues[attr.name] = this.interpolate(attr.value, context);
            }
        }
        if (itemNode?.attributes) {
            for (let iaIdx = 0; iaIdx < itemNode.attributes.length; iaIdx++) {
                const attr = itemNode.attributes[iaIdx];
                updateValues[attr.name] = this.interpolate(attr.value, context);
            }
        }

        const curVal = this.getState(path);
        const list = Array.isArray(curVal)
            ? [...curVal]
            : Array.isArray(this._rawState[path])
              ? [...this._rawState[path]]
              : [];

        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const itemVal = String(item?.[field]);
            const matches = op === "equals" ? itemVal === String(targetVal) : itemVal !== String(targetVal);
            if (matches) {
                if (Object.keys(updateValues).length > 0) {
                    list[i] = { ...item, ...updateValues };
                } else if (rawText) {
                    const updateField = actionNode.getAttribute("field") || "value";
                    list[i] = { ...item, [updateField]: this.interpolate(rawText, context) };
                }
            }
        }

        this.batch(() => {
            this.setState(path, list);
            this.applyResets(actionNode);
            if (!this.getChild(actionNode, "reset")) {
                if (this._rawState && "editing_id" in this._rawState) {
                    this.setState("editing_id", "", { silent: true });
                }
                if (this._rawState && "edit_todo_input" in this._rawState) {
                    this.setState("edit_todo_input", "", { silent: true });
                }
            }
        });
        return;
    }

    if (operation === MUTATION_OPS.MOVE_UP || operation === MUTATION_OPS.MOVE_DOWN) {
        const idxNode = this.getChild(actionNode, "index");
        const whereNode = this.getChild(actionNode, "where");
        const list = Array.isArray(this._rawState[path]) ? [...this._rawState[path]] : [];
        let targetIdx = -1;

        if (idxNode) {
            targetIdx = parseInt(this.interpolate(idxNode.textContent.trim(), context), 10);
        } else if (whereNode) {
            const field = whereNode.getAttribute("field") || "id";
            const eqVal = this.interpolate(whereNode.getAttribute("equals") || whereNode.getAttribute("value") || "", context);
            targetIdx = list.findIndex((it) => String(it?.[field]) === String(eqVal));
        }

        if (targetIdx >= 0 && targetIdx < list.length) {
            const swapIdx = operation === MUTATION_OPS.MOVE_UP ? targetIdx - 1 : targetIdx + 1;
            if (swapIdx >= 0 && swapIdx < list.length) {
                const temp = list[targetIdx];
                list[targetIdx] = list[swapIdx];
                list[swapIdx] = temp;
                this.batch(() => {
                    this.setState(path, list);
                    this.applyResets(actionNode);
                });
            }
        }
        return;
    }

    if (operation === MUTATION_OPS.SWAP) {
        const list = Array.isArray(this._rawState[path]) ? [...this._rawState[path]] : [];
        const indexANode = this.getChild(actionNode, "indexA");
        const indexBNode = this.getChild(actionNode, "indexB");
        const fromNode = this.getChild(actionNode, "from");
        const toNode = this.getChild(actionNode, "to");
        let idxA = parseInt(
            this.interpolate(indexANode ? indexANode.textContent.trim() : fromNode ? fromNode.textContent.trim() : "-1", context),
            10,
        );
        let idxB = parseInt(
            this.interpolate(indexBNode ? indexBNode.textContent.trim() : toNode ? toNode.textContent.trim() : "-1", context),
            10,
        );

        const whereNode = this.getChild(actionNode, "where");
        const targetWhereNode = this.getChild(actionNode, "target_where") || this.getChild(actionNode, "where_target");

        if (idxA === -1 && whereNode) {
            const field = whereNode.getAttribute("field") || "id";
            const eqVal = this.interpolate(whereNode.getAttribute("equals") || whereNode.getAttribute("value") || "", context);
            idxA = list.findIndex((it) => String(it?.[field]) === String(eqVal));
        }
        if (idxB === -1 && targetWhereNode) {
            const field = targetWhereNode.getAttribute("field") || "id";
            const eqVal = this.interpolate(targetWhereNode.getAttribute("equals") || targetWhereNode.getAttribute("value") || "", context);
            idxB = list.findIndex((it) => String(it?.[field]) === String(eqVal));
        }

        if (idxA >= 0 && idxB >= 0 && idxA < list.length && idxB < list.length) {
            const temp = list[idxA];
            list[idxA] = list[idxB];
            list[idxB] = temp;
            this.batch(() => {
                this.setState(path, list);
                this.applyResets(actionNode);
            });
        }
        return;
    }

    if (operation === MUTATION_OPS.REVERSE) {
        const list = Array.isArray(this._rawState[path]) ? [...this._rawState[path]] : [];
        list.reverse();
        this.batch(() => {
            this.setState(path, list);
            this.applyResets(actionNode);
        });
        return;
    }

    if (operation === MUTATION_OPS.INSERT) {
        const indexNode = this.getChild(actionNode, "index");
        const valNode = this.getChild(actionNode, "value");
        const valItem = (valNode && this.getChild(valNode, "item")) || this.getChild(actionNode, "item") || valNode;
        const rawIdx = indexNode ? indexNode.textContent.trim() : actionNode.getAttribute("index") || "0";
        const idx = parseInt(this.interpolate(rawIdx, context), 10);
        const rawText = valItem
            ? (typeof valItem.getAttribute === "function" && valItem.getAttribute("text")) ||
              valItem.textContent?.trim() ||
              ""
            : "";
        const textValue = this.interpolate(rawText, context);
        let parsedObj =
            evaluateObjectExpression(this, rawText, context) ||
            evaluateObjectExpression(this, textValue, context);
        const itemId =
            (valItem && typeof valItem.getAttribute === "function" && valItem.getAttribute("id")) ||
            parsedObj?.id ||
            `task-${Date.now()}`;
        const newItem = parsedObj && typeof parsedObj === "object" ? { id: itemId, ...parsedObj } : { id: itemId, text: textValue };

        const list = Array.isArray(this._rawState[path]) ? [...this._rawState[path]] : [];
        const safeIdx = Math.max(0, Math.min(list.length, Number.isNaN(idx) ? list.length : idx));
        list.splice(safeIdx, 0, newItem);
        this.batch(() => {
            this.setState(path, list);
            this.applyResets(actionNode);
        });
        return;
    }

    if (operation === MUTATION_OPS.UPDATE) {
        const whereNode = this.getChild(actionNode, "where");
        const valNode = this.getChild(actionNode, "value");
        const fieldsNode =
            this.getChild(actionNode, "fields") ||
            this.getChild(actionNode, "item") ||
            valNode ||
            actionNode;
        if (!fieldsNode) return;

        const list = Array.isArray(this._rawState[path]) ? this._rawState[path] : [];
        const updates = {};
        const fnAttrs = fieldsNode.attributes;
        if (fnAttrs) {
            const fnLen = fnAttrs.length;
            for (let fnIdx = 0; fnIdx < fnLen; fnIdx++) {
                const attr = fnAttrs[fnIdx];
                updates[attr.name] = this.interpolate(attr.value, context);
            }
        }
        if (valNode && valNode.textContent?.trim()) {
            const rawValText = valNode.textContent.trim();
            const smartObj =
                evaluateObjectExpression(this, rawValText, context) ||
                evaluateObjectExpression(this, this.interpolate(rawValText, context), context);
            if (smartObj && typeof smartObj === "object") {
                Object.assign(updates, smartObj);
            }
        }

        if (updates.text !== undefined && !String(updates.text).trim()) return;

        const matchesWhere = (item) => {
            if (!whereNode) return true;
            if (!item) return false;
            const field = whereNode.getAttribute("field") || "id";
            const op = (whereNode.getAttribute("op") || "eq").toLowerCase();
            const rawMatch =
                whereNode.getAttribute("equals") ?? whereNode.getAttribute("value") ?? whereNode.textContent.trim();
            const expected = this.interpolate(rawMatch, context);
            const actual = item[field];

            const isMatch =
                actual === expected ||
                (actual !== undefined &&
                    actual !== null &&
                    expected !== undefined &&
                    expected !== null &&
                    String(actual) === String(expected));

            if (op === "neq" || op === "!=" || op === "ne") {
                return !isMatch;
            }
            return isMatch;
        };

        const touchedIds = [];
        this.batch(() => {
            const nextList = list.map((item) => {
                if (!matchesWhere(item)) return item;
                touchedIds.push(item.id);
                return { ...item, ...updates };
            });
            this.setState(path, nextList);
            this.applyResets(actionNode);

            if (touchedIds.length === 1 && String(this._rawState.editing_id) === String(touchedIds[0])) {
                if ("editing_id" in this._rawState) this.setState("editing_id", "", { silent: true });
                if ("edit_todo_input" in this._rawState) this.setState("edit_todo_input", "", { silent: true });
            }
        });
    }
}

export function _handleUndoStateAction(actionNode, context = {}) {
    if (this._devtools?.history) return this._devtools.history.undo();
    if (this._historyManager) return this._historyManager.undo();
    return false;
}

export function _handleRedoStateAction(actionNode, context = {}) {
    if (this._devtools?.history) return this._devtools.history.redo();
    if (this._historyManager) return this._historyManager.redo();
    return false;
}

export function _handleTakeSnapshotAction(actionNode, context = {}) {
    const label = (actionNode?.getAttribute && actionNode.getAttribute("label")) || "Manual Snapshot";
    if (this._devtools?.history) return this._devtools.history.takeSnapshot(label);
    if (this._historyManager) return this._historyManager.takeSnapshot(label);
    return null;
}
