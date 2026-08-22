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

    if (hasBraces && (rawValue.includes("?") || /[+\-*/]/.test(cleanExpr))) {
        try {
            const evaluated = EUIXExpressionParser.eval(cleanExpr, evalGetter);
            if (evaluated !== undefined && typeof evaluated === "number" && !Number.isNaN(evaluated)) {
                nextValue = String(evaluated);
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
    const nextValue = isTruthy ? "false" : "true";
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
        const isAsync = interpolatedCode.includes("await ");
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
                  interpolatedCode,
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
                  interpolatedCode,
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
        );
    } catch (err) {
        this.reportError(err, "Action Execution (RUN_SCRIPT)");
        throw err;
    }
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
            this.setState(path, String(num));
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
                item[fieldName] = currVal;
                currentList[index] = item;
            } else {
                currVal -= 1;
                if (currVal <= 0) {
                    currentList.splice(index, 1);
                } else {
                    item[fieldName] = currVal;
                    currentList[index] = item;
                }
            }
            this.setState(path, currentList);
        }
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

        let parsedObj = null;
        if (textValue?.startsWith("{") && textValue.endsWith("}")) {
            try {
                parsedObj = JSON.parse(textValue);
            } catch (_e) {}
        }

        const itemId =
            (valItem && typeof valItem.getAttribute === "function" && valItem.getAttribute("id")) ||
            parsedObj?.id ||
            `task-${Date.now()}`;
        const newItem = parsedObj && typeof parsedObj === "object" ? { id: itemId, ...parsedObj } : { id: itemId };
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
        if (!parsedObj && !newItem.text && textValue) newItem.text = textValue;
        if (!parsedObj && !newItem.title && textValue) newItem.title = textValue;
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
            existing.quantity = currentQty + 1;
            currentList[existingIdx] = existing;
            this.setState(path, currentList);
            this.applyResets(actionNode);
            return;
        }

        if (newItem.status === undefined || newItem.status === null || newItem.status === "") {
            const selCol = this.getState("new_kanban_col");
            if (selCol && ["todo", "in_progress", "done"].includes(selCol)) {
                newItem.status = selCol;
            }
        }
        if (!newItem.category && path === "tasks") newItem.category = "General";
        if (newItem.completed === undefined && (path === "todos" || path === "tasks")) newItem.completed = "false";

        this.batch(() => {
            const curVal2 = this.getState(path);
            const currentList2 = Array.isArray(curVal2)
                ? [...curVal2]
                : Array.isArray(this._rawState[path])
                  ? [...this._rawState[path]]
                  : [];
            if (operation === MUTATION_OPS.UNSHIFT || operation === MUTATION_OPS.PREPEND) {
                this.setState(path, [newItem, ...currentList2]);
            } else {
                this.setState(path, [...currentList2, newItem]);
            }
            this.applyResets(actionNode);
            if (!this.getChild(actionNode, "reset") && "new_todo_input" in this._rawState) {
                this.setState("new_todo_input", "", { silent: true });
            }
        });
        return;
    }

    if (operation === MUTATION_OPS.REMOVE) {
        const indexNode = this.getChild(actionNode, "index");
        const whereNode = this.getChild(actionNode, "where");
        const currentVal = this.getState(path);
        const list = Array.isArray(currentVal)
            ? [...currentVal]
            : Array.isArray(this._rawState[path])
              ? [...this._rawState[path]]
              : [];

        if (indexNode) {
            const rawIdx = indexNode.textContent.trim();
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
            const rawMatch = whereNode.getAttribute("equals") || whereNode.textContent.trim();
            const matchValue = this.interpolate(rawMatch, context);

            this.batch(() => {
                const nextList = list.filter((item) => {
                    if (!item) return false;
                    const actual = item[field];
                    return !(
                        actual === matchValue ||
                        (actual !== undefined &&
                            actual !== null &&
                            matchValue !== undefined &&
                            matchValue !== null &&
                            String(actual) === String(matchValue))
                    );
                });
                this.setState(path, nextList);
                this.applyResets(actionNode);
                if (String(this._rawState.editing_id) === String(matchValue)) {
                    if ("editing_id" in this._rawState) this.setState("editing_id", "", { silent: true });
                    if ("edit_todo_input" in this._rawState) this.setState("edit_todo_input", "", { silent: true });
                }
            });
        }
        return;
    }

    if (operation === MUTATION_OPS.MOVE_UP || operation === MUTATION_OPS.MOVE_DOWN) {
        const indexNode = this.getChild(actionNode, "index");
        const whereNode = this.getChild(actionNode, "where");
        const list = Array.isArray(this._rawState[path]) ? [...this._rawState[path]] : [];

        let targetIdx = -1;
        if (indexNode) {
            targetIdx = parseInt(this.interpolate(indexNode.textContent.trim(), context), 10);
        } else if (whereNode) {
            const field = whereNode.getAttribute("field") || "id";
            const rawMatch = whereNode.getAttribute("equals") || whereNode.textContent.trim();
            const expected = this.interpolate(rawMatch, context);
            targetIdx = list.findIndex((item) => String(item[field]) === String(expected));
        }

        if (targetIdx !== -1) {
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
        const whereNode = this.getChild(actionNode, "where");
        const targetWhereNode = this.getChild(actionNode, "target_where") || this.getChild(actionNode, "target");
        const list = Array.isArray(this._rawState[path]) ? [...this._rawState[path]] : [];

        if (whereNode && targetWhereNode) {
            const field1 = whereNode.getAttribute("field") || "id";
            const rawMatch1 = whereNode.getAttribute("equals") || whereNode.textContent.trim();
            const id1 = this.interpolate(rawMatch1, context);

            const field2 = targetWhereNode.getAttribute("field") || "id";
            const rawMatch2 = targetWhereNode.getAttribute("equals") || targetWhereNode.textContent.trim();
            const id2 = this.interpolate(rawMatch2, context);

            const idx1 = list.findIndex((item) => String(item[field1]) === String(id1));
            const idx2 = list.findIndex((item) => String(item[field2]) === String(id2));

            if (idx1 !== -1 && idx2 !== -1 && idx1 !== idx2) {
                const temp = list[idx1];
                list[idx1] = list[idx2];
                list[idx2] = temp;

                if (list[idx1].status && list[idx2].status) {
                    const tempStatus = list[idx1].status;
                    list[idx1].status = list[idx2].status;
                    list[idx2].status = tempStatus;
                }

                this.batch(() => {
                    this.setState(path, list);
                    this.applyResets(actionNode);
                });
            }
        }
        return;
    }

    if (operation === MUTATION_OPS.UPDATE) {
        const whereNode = this.getChild(actionNode, "where");
        const fieldsNode =
            this.getChild(actionNode, "fields") ||
            this.getChild(actionNode, "item") ||
            this.getChild(actionNode, "value") ||
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
