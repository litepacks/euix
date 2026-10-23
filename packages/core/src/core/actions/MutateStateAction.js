/**
 * src/core/actions/MutateStateAction.js
 * Declarative state mutation query engine (PUSH, REMOVE, UPDATE, SWAP, SORT, etc.) for EUIX Engine.
 */

import { isFn, MUTATION_OPS, trimStr } from "../utils/constants.js";

export function interpolateObjectProperties(engine, obj, context) {
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

export function evaluateObjectExpression(engine, expr, context = {}) {
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
        const fn = new Function("$data", "data", "$ctx", "context", "$item", "item", "task", `return (${sanitized});`);
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

export function parseMutateExpr(expr) {
    if (!expr || typeof expr !== "string") return null;
    const trimmed = expr.trim();

    const m = trimmed.match(
        /^([a-zA-Z0-9_$.]+)\.([a-zA-Z_]+)(?:\(([\s\S]*)\)|(?:\s+where\s+([\s\S]+))|(?:\s+(.*)))?$/i,
    );
    if (!m) return null;

    const path = m[1];
    const operation = m[2].toUpperCase();
    const parenArgs = m[3];
    const whereClause = m[4];
    const restArgs = m[5];

    let where = null;
    const value = parenArgs || restArgs || "";

    if (whereClause) {
        const wm = whereClause.trim().match(/^([a-zA-Z0-9_$.]+)\s*(==|=|===|equals|!=|neq)\s*(.*)$/i);
        if (wm) {
            where = {
                field: wm[1].replace(/^(item|row)\./, ""),
                op: wm[2] === "!=" || wm[2] === "neq" ? "neq" : "eq",
                equals: wm[3].replace(/^['"]|['"]$/g, ""),
            };
        }
    }

    return { path, operation, value, where };
}

export function _handleMutateStateAction(actionNode, context = {}) {
    const mutateAttr = actionNode.getAttribute
        ? actionNode.getAttribute("mutate") || actionNode.getAttribute("expr")
        : null;
    let path = "";
    let operation = "";
    let parsedWhere = null;
    let shorthandValue = null;

    if (mutateAttr) {
        const parsed = parseMutateExpr(mutateAttr);
        if (parsed) {
            const interpolatedRawPath = this.interpolate(parsed.path, context);
            path = this.parseBindPath(interpolatedRawPath);
            operation = parsed.operation;
            parsedWhere = parsed.where;
            shorthandValue = parsed.value;
        }
    }

    if (!path) {
        const pathNode = this.getChild(actionNode, "path");
        const rawPath =
            trimStr(pathNode) ||
            (actionNode.getAttribute ? actionNode.getAttribute("path") || actionNode.getAttribute("target") : "") ||
            "";
        const interpolatedPath = this.interpolate(rawPath, context);
        path = this.parseBindPath(interpolatedPath);
    }
    if (!operation) {
        const opNode = this.getChild(actionNode, "operation") || this.getChild(actionNode, "op");
        operation = (
            trimStr(opNode) ||
            (actionNode.getAttribute ? actionNode.getAttribute("operation") || actionNode.getAttribute("op") : "") ||
            ""
        ).toUpperCase();
    }

    if (!path || !operation) return;

    if (operation === MUTATION_OPS.CLEAR || operation === MUTATION_OPS.EMPTY || operation === MUTATION_OPS.RESET) {
        this.batch(() => {
            this.setState(path, []);
            this.applyResets(actionNode);
        });
        return;
    }

    if (
        parsedWhere &&
        (operation === MUTATION_OPS.REMOVE ||
            operation === MUTATION_OPS.DELETE ||
            operation === "REMOVE" ||
            operation === "DELETE")
    ) {
        const equalsVal = this.interpolate(parsedWhere.equals, context);
        this.mutateState(path, "REMOVE", {
            where: {
                field: parsedWhere.field,
                equals: equalsVal,
                op: parsedWhere.op,
            },
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
        const rawText =
            shorthandValue ||
            (valItem
                ? (typeof valItem.getAttribute === "function" && valItem.getAttribute("text")) ||
                  valItem.textContent?.trim() ||
                  ""
                : actionNode.getAttribute
                  ? actionNode.getAttribute("value") || ""
                  : "");
        const textValue = this.interpolate(rawText, context);

        const parsedObj =
            evaluateObjectExpression(this, rawText, context) || evaluateObjectExpression(this, textValue, context);

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
            const rawEquals =
                whereNode.getAttribute("equals") || whereNode.getAttribute("value") || whereNode.textContent.trim();
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
        } else if (!indexNode && shorthandValue) {
            const rawTarget = this.interpolate(shorthandValue, context);
            const target = rawTarget.replace(/^['"]|['"]$/g, "");
            list = list.filter((item) => {
                if (!item) return false;
                if (item === target) return false;
                if (item.id !== undefined && (item.id === target || String(item.id) === String(target))) return false;
                return true;
            });
        }

        this.batch(() => {
            this.setState(path, list);
            this.applyResets(actionNode);
        });
        return;
    }

    if (operation === MUTATION_OPS.POP) {
        const curVal = this.getState(path);
        const list = Array.isArray(curVal)
            ? [...curVal]
            : Array.isArray(this._rawState?.[path])
              ? [...this._rawState[path]]
              : [];
        list.pop();
        this.batch(() => {
            this.setState(path, list);
            this.applyResets(actionNode);
        });
        return;
    }

    if (operation === MUTATION_OPS.SHIFT) {
        const curVal = this.getState(path);
        const list = Array.isArray(curVal)
            ? [...curVal]
            : Array.isArray(this._rawState?.[path])
              ? [...this._rawState[path]]
              : [];
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
        const rawEquals = whereNode
            ? whereNode.getAttribute("equals") || whereNode.getAttribute("value") || whereNode.textContent.trim()
            : null;
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
            : Array.isArray(this._rawState?.[path])
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
        const curVal = this.getState(path);
        const list = Array.isArray(curVal)
            ? [...curVal]
            : Array.isArray(this._rawState?.[path])
              ? [...this._rawState[path]]
              : [];
        let targetIdx = -1;

        if (idxNode) {
            targetIdx = parseInt(this.interpolate(idxNode.textContent.trim(), context), 10);
        } else if (whereNode) {
            const field = whereNode.getAttribute("field") || "id";
            const eqVal = this.interpolate(
                whereNode.getAttribute("equals") || whereNode.getAttribute("value") || "",
                context,
            );
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
        const curVal = this.getState(path);
        const list = Array.isArray(curVal)
            ? [...curVal]
            : Array.isArray(this._rawState?.[path])
              ? [...this._rawState[path]]
              : [];
        const indexANode = this.getChild(actionNode, "indexA");
        const indexBNode = this.getChild(actionNode, "indexB");
        const fromNode = this.getChild(actionNode, "from");
        const toNode = this.getChild(actionNode, "to");
        let idxA = parseInt(
            this.interpolate(
                indexANode ? indexANode.textContent.trim() : fromNode ? fromNode.textContent.trim() : "-1",
                context,
            ),
            10,
        );
        let idxB = parseInt(
            this.interpolate(
                indexBNode ? indexBNode.textContent.trim() : toNode ? toNode.textContent.trim() : "-1",
                context,
            ),
            10,
        );

        const whereNode = this.getChild(actionNode, "where");
        const targetWhereNode = this.getChild(actionNode, "target_where") || this.getChild(actionNode, "where_target");

        if (idxA === -1 && whereNode) {
            const field = whereNode.getAttribute("field") || "id";
            const eqVal = this.interpolate(
                whereNode.getAttribute("equals") || whereNode.getAttribute("value") || "",
                context,
            );
            idxA = list.findIndex((it) => String(it?.[field]) === String(eqVal));
        }
        if (idxB === -1 && targetWhereNode) {
            const field = targetWhereNode.getAttribute("field") || "id";
            const eqVal = this.interpolate(
                targetWhereNode.getAttribute("equals") || targetWhereNode.getAttribute("value") || "",
                context,
            );
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
        const curVal = this.getState(path);
        const list = Array.isArray(curVal)
            ? [...curVal]
            : Array.isArray(this._rawState?.[path])
              ? [...this._rawState[path]]
              : [];
        list.reverse();
        this.batch(() => {
            this.setState(path, list);
            this.applyResets(actionNode);
        });
        return;
    }

    if (operation === MUTATION_OPS.SORT) {
        const curVal = this.getState(path);
        const list = Array.isArray(curVal)
            ? [...curVal]
            : Array.isArray(this._rawState?.[path])
              ? [...this._rawState[path]]
              : [];
        const byNode =
            this.getChild(actionNode, "by") || this.getChild(actionNode, "field") || this.getChild(actionNode, "key");
        const rawBy = byNode
            ? byNode.textContent.trim()
            : actionNode.getAttribute("by") || actionNode.getAttribute("field") || actionNode.getAttribute("key") || "";
        const field = this.interpolate(rawBy, context);

        const orderNode = this.getChild(actionNode, "order") || this.getChild(actionNode, "direction");
        const rawOrder = orderNode
            ? orderNode.textContent.trim()
            : actionNode.getAttribute("order") || actionNode.getAttribute("direction") || "asc";
        const order = this.interpolate(rawOrder, context).toLowerCase();
        const isDesc = order === "desc" || order === "descending" || order === "reverse";

        if (field) {
            list.sort((a, b) => {
                const valA = a != null && typeof a === "object" ? a[field] : a;
                const valB = b != null && typeof b === "object" ? b[field] : b;
                if (valA === valB) return 0;
                if (valA == null) return isDesc ? -1 : 1;
                if (valB == null) return isDesc ? 1 : -1;
                if (typeof valA === "number" && typeof valB === "number") {
                    return isDesc ? valB - valA : valA - valB;
                }
                const strA = String(valA);
                const strB = String(valB);
                return isDesc ? strB.localeCompare(strA) : strA.localeCompare(strB);
            });
        } else {
            list.sort((a, b) => {
                if (a === b) return 0;
                if (a == null) return isDesc ? -1 : 1;
                if (b == null) return isDesc ? 1 : -1;
                if (typeof a === "number" && typeof a === "number") {
                    return isDesc ? b - a : a - b;
                }
                return isDesc ? String(b).localeCompare(String(a)) : String(a).localeCompare(String(b));
            });
        }
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
        const parsedObj =
            evaluateObjectExpression(this, rawText, context) || evaluateObjectExpression(this, textValue, context);
        const itemId =
            (valItem && typeof valItem.getAttribute === "function" && valItem.getAttribute("id")) ||
            parsedObj?.id ||
            `task-${Date.now()}`;
        const newItem =
            parsedObj && typeof parsedObj === "object" ? { id: itemId, ...parsedObj } : { id: itemId, text: textValue };

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
            this.getChild(actionNode, "fields") || this.getChild(actionNode, "item") || valNode || actionNode;
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
