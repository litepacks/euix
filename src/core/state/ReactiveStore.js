/**
 * src/core/state/ReactiveStore.js
 * Centralized reactive state store, deep proxy observation, batching, and binding synchronization for EUIX Engine.
 */

import { EUIXStructuredError } from "../parser/errors.js";
import { EMPTY_ARR, isBool, isFn, isStr, safeStringify, splitPath } from "../utils/constants.js";
import { applyArrayMutation } from "./Mutations.js";

export function getState(engine, key) {
    if (!key || !engine._rawState) return undefined;
    let strKey = String(key);
    if (strKey.includes("[") && strKey.includes("]")) {
        strKey = strKey.replace(/\[\s*(?:data\.)?([a-zA-Z0-9_]+)\s*\]/g, (m, k) => {
            if (/^\d+$/.test(k)) return `[${k}]`;
            const v = engine._rawState ? engine._rawState[k] : undefined;
            return v !== undefined ? `[${v}]` : m;
        });
    }
    const cleanKey = strKey.replace(/^(data|state|computed)\./, "");
    if (engine._computedRegistry?.has(cleanKey)) {
        return engine.getComputed(cleanKey);
    }
    let val =
        engine._rawState && engine._rawState[cleanKey] !== undefined
            ? engine._rawState[cleanKey]
            : engine._rawState
              ? engine._rawState[key]
              : undefined;
    const parsedKey = engine.parseBindPath(key);
    if (val === undefined && (parsedKey.includes(".") || parsedKey.includes("["))) {
        const parts = splitPath(parsedKey);
        let curr = engine._rawState ? engine._rawState[parts[0]] : undefined;
        for (let i = 1; i < parts.length && curr !== undefined && curr !== null; i++) {
            curr = curr[parts[i]];
        }
        if (curr !== undefined) val = curr;
    }
    return val;
}

export function resolveValueFromPath(engine, path, context = {}) {
    if (!path) return undefined;

    if (typeof path === "string" && path.includes("[")) {
        path = path.replace(/\[\s*([^\]]+)\s*\]/g, (m, innerKey) => {
            const trimmed = innerKey.trim().replace(/^['"]|['"]$/g, "");
            if (/^\d+$/.test(trimmed)) return `.${trimmed}`;
            const innerVal = resolveValueFromPath(engine, trimmed, context);
            return innerVal !== undefined ? `.${innerVal}` : m;
        });
    }

    if (path.startsWith("computed.")) {
        return engine.getComputed(path.slice(9));
    }
    if (engine._computedRegistry?.has(path)) {
        return engine.getComputed(path);
    }
    if (path.startsWith("local.") || path.startsWith("$local.")) {
        const key = path.replace(/^(\$local|local)\./, "");
        if (context._localState && context._localState[key] !== undefined) {
            return context._localState[key];
        }
        if (context.local && context.local[key] !== undefined) {
            return context.local[key];
        }
    }
    if (path.startsWith("global.") || path.startsWith("$global.")) {
        const key = path.replace(/^(\$global|global)\.(data\.)?/, "");
        return engine.getState(key);
    }
    if (path.startsWith("$route.") || path.startsWith("$router.") || path.startsWith("$fetcher.")) {
        const scope = path.startsWith("$route") ? "$route" : path.startsWith("$router") ? "$router" : "$fetcher";
        const prop = path.slice(scope.length + 1);
        const rootState = engine.getState(scope) || context?.[scope];
        if (!rootState) return undefined;
        if (!prop) return rootState;
        return prop.split(".").reduce((acc, p) => (acc !== undefined && acc !== null ? acc[p] : undefined), rootState);
    }
    if (path === "$route" || path === "$router" || path === "$fetcher") {
        return engine.getState(path) || context?.[path];
    }
    if (path.startsWith("$date.") || path.startsWith("date.")) {
        const helper =
            engine.$date ||
            engine.date ||
            (isFn(engine.getState) ? engine.getState("$date") : null) ||
            (isFn(engine.getState) ? engine.getState("date") : null);
        const prop = path.replace(/^(\$date|date)\./, "");
        if (!helper) return undefined;
        if (!prop) return helper;
        return prop.split(".").reduce((acc, p) => (acc !== undefined && acc !== null ? acc[p] : undefined), helper);
    }
    if (path === "$date" || path === "date") {
        return (
            engine.$date ||
            engine.date ||
            (isFn(engine.getState) ? engine.getState("$date") : null) ||
            (isFn(engine.getState) ? engine.getState("date") : null)
        );
    }
    if (path.startsWith("$device.") || path.startsWith("device.")) {
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
        const prop = path.replace(/^(\$device|device)\./, "");
        if (!dev) return undefined;
        if (!prop) return dev;
        return prop.split(".").reduce((acc, p) => (acc !== undefined && acc !== null ? acc[p] : undefined), dev);
    }
    if (path === "$device" || path === "device") {
        return (
            engine.$device ||
            engine.device ||
            (isFn(engine.getState) ? engine.getState("$device") || engine.getState("device") : null) ||
            (context && (context.$device || context.device))
        );
    }
    if (path.startsWith("api.") || path.startsWith("$api.")) {
        const clean = path.replace(/^(\$api|api)\./, "");
        const parts = clean.split(".");
        const endpointId = parts[0];
        const prop = parts.slice(1).join(".");
        const status = isFn(engine.getApiStatus) ? engine.getApiStatus(endpointId) : engine._apiStatus?.[endpointId];
        if (!status) return undefined;
        if (!prop) return status;
        return prop.split(".").reduce((acc, p) => (acc ? acc[p] : undefined), status);
    }
    if (path.startsWith("stream.") || path.startsWith("$stream.")) {
        const clean = path.replace(/^(\$stream|stream)\./, "");
        const parts = clean.split(".");
        const streamId = parts[0];
        const prop = parts.slice(1).join(".");
        const status = isFn(engine.getStreamStatus) ? engine.getStreamStatus(streamId) : engine._streamStatus?.[streamId];
        if (!status) return undefined;
        if (!prop) return status;
        return prop.split(".").reduce((acc, p) => (acc !== undefined && acc !== null ? acc[p] : undefined), status);
    }
    if (path.startsWith("errors.") || path.startsWith("$errors.")) {
        const clean = path.replace(/^(\$errors|errors)\./, "");
        if (engine._formErrors && engine._formErrors[clean] !== undefined) {
            return engine._formErrors[clean];
        }
        const stateErrors = isFn(engine.getState) ? engine.getState("errors") || engine.getState("$errors") : null;
        if (stateErrors && typeof stateErrors === "object") {
            return stateErrors[clean];
        }
        return isFn(engine.getState) ? engine.getState(path) : undefined;
    }
    if (path === "errors" || path === "$errors") {
        return engine._formErrors || (isFn(engine.getState) ? engine.getState("errors") || engine.getState("$errors") : null) || {};
    }
    if (path === "$isValid" || path === "isValid") {
        return engine._isFormValid !== undefined ? engine._isFormValid : (isFn(engine.getState) ? engine.getState("$isValid") : true);
    }
    if (path.startsWith("data.") || path.startsWith("state.")) {
        const cleanKey = path.replace(/^(data|state)\./, "");
        if (context._localState && context._localState[cleanKey] !== undefined) {
            return context._localState[cleanKey];
        }
        return engine.getState(cleanKey);
    }
    if (path.startsWith("constants.") || path.startsWith("const.")) {
        const key = path.replace(/^(constants|const)\./, "");
        if (context && context.constants && context.constants[key] !== undefined) {
            return context.constants[key];
        }
        return engine.getConstant(key);
    }
    if (path.startsWith("vars.")) {
        const key = path.replace(/^vars\./, "");
        if (context && context.constants && context.constants[key] !== undefined) {
            return context.constants[key];
        }
        return engine.getConstant(key);
    }
    if (path.startsWith("args.") || path.startsWith("params.")) {
        const key = path.replace(/^(args|params)\./, "");
        const argsObj = context.args || context.params || {};
        return argsObj[key];
    }
    if (path.startsWith("err.") || path.startsWith("error.")) {
        const key = path.replace(/^(err|error)\./, "");
        const errObj = context.err || context.error;
        return errObj && typeof errObj === "object" ? errObj[key] : undefined;
    }
    if (path.startsWith("result.")) {
        const key = path.slice(7);
        return context.result && typeof context.result === "object" ? context.result[key] : undefined;
    }
    if (path === "result") {
        return context.result;
    }
    if (path === "err" || path === "error") {
        return context.err || context.error;
    }
    const ctxMatch = path.match(/^(\w+)(?:\.(.+))?$/);
    if (ctxMatch) {
        const [_, scope, prop] = ctxMatch;
        if (scope && context && context[scope] !== undefined && context[scope] !== null) {
            if (prop) {
                const parts = prop.split(".");
                let curr = context[scope];
                for (let i = 0; i < parts.length && curr !== undefined && curr !== null; i++) {
                    curr = curr[parts[i]];
                }
                return curr;
            }
            return context[scope];
        }
    }
    if (context && context.constants && context.constants[path] !== undefined) {
        return context.constants[path];
    }
    const constVal = engine.getConstant(path);
    if (constVal !== undefined) return constVal;
    return engine.getState(path);
}

export function _invalidateComputed(engine, changedKey, allAffected) {
    if (!engine._depGraph || !engine._computedRegistry) return;
    const affected = engine._depGraph.getAffectedComputed(changedKey);
    if (!affected || affected.size === 0) return;
    affected.forEach((cId) => {
        if (allAffected) allAffected.add(cId);
        const cNode = engine._computedRegistry.get(cId);
        if (cNode && !cNode.isDirty) {
            cNode.isDirty = true;
            _invalidateComputed(engine, cId, allAffected);
            _invalidateComputed(engine, `computed.${cId}`, allAffected);
        }
    });
}

export function flushStateUpdates(engine) {
    if (!engine._pendingBatchChanges || engine._pendingBatchChanges.size === 0) {
        engine._dirtyBitmask = 0n;
        return;
    }
    const pending = Array.from(engine._pendingBatchChanges.values());
    engine._pendingBatchChanges.clear();
    const _dirtyMask = engine._dirtyBitmask;
    engine._dirtyBitmask = 0n;

    const allAffected = new Set();
    const executedFns = new Set();
    const syncedPaths = new Set();

    for (let i = 0; i < pending.length; i++) {
        const { key, value, sourceEl } = pending[i];
        _invalidateComputed(engine, key, allAffected);
        engine.syncBindings(key, value, sourceEl, executedFns);
        syncedPaths.add(key);
        if (key.includes(".")) {
            const rootKey = key.split(".")[0];
            if (!syncedPaths.has(rootKey)) {
                engine.syncBindings(rootKey, engine._rawState[rootKey], sourceEl, executedFns);
                engine.syncBindings(`data.${rootKey}`, engine._rawState[rootKey], sourceEl, executedFns);
                syncedPaths.add(rootKey);
            }
            engine.syncBindings(`data.${key}`, value, sourceEl, executedFns);
        }
    }

    allAffected.forEach((cId) => {
        const cNode = engine._computedRegistry ? engine._computedRegistry.get(cId) : null;
        if (cNode) {
            const cVal = cNode.evaluate();
            engine.syncBindings(`computed.${cId}`, cVal, null);
            engine.syncBindings(cId, cVal, null);
        }
    });

    pending.forEach(({ key, value, oldValue, silent, context }) => {
        if (!silent) {
            engine.triggerStateWatchers(key, value, oldValue);
            if (isFn(engine._triggerReactiveWatchers)) {
                engine._triggerReactiveWatchers(key, value, oldValue, context);
            }
        }
    });
}

export function setState(engine, key, value, options = {}) {
    if (typeof key === "object" && key !== null && !Array.isArray(key)) {
        engine.batch(() => {
            Object.entries(key).forEach(([k, v]) => {
                setState(engine, k, v, options);
            });
        });
        return;
    }

    const opts = (isBool(options) ? { silent: options } : options) || {};
    const { silent = false, sourceEl = null, context = null, batch = false } = opts;
    if (!key || !isStr(key)) return;
    if (!engine._rawState) return;

    if (engine._isEvaluatingComputed) {
        const err = new EUIXStructuredError({
            message: `State mutation prohibited inside computed getter (key: "${key}"). Computed properties must be deterministic and side-effect free.`,
            code: "COMPUTED_MUTATION_ERROR",
        });
        engine.reportError(err, "Computed Mutation Guard");
        throw err;
    }

    if (engine._computedRegistry?.has(key)) {
        const err = new EUIXStructuredError({
            message: `Cannot mutate read-only computed property '${key}'`,
            code: "COMPUTED_MUTATION_ERROR",
        });
        engine.reportError(err, "Computed Mutation Guard");
        throw err;
    }

    const ctxSignal = context?._cancellationSignal || engine._currentActionContext?._cancellationSignal;
    if (ctxSignal?.isCancelled) {
        return;
    }

    engine._updateDepth = (engine._updateDepth || 0) + 1;
    if (engine._updateDepth > (engine._maxUpdateDepth || 50)) {
        const currentDepth = engine._updateDepth;
        engine._updateDepth = 0;
        const err = new Error(
            `[EUIXEngine Infinite Loop Guard] Cascade limit exceeded (${currentDepth} updates) on state key "${key}". Possible circular state reactivity loop.`,
        );
        engine.reportError(err, "Infinite Loop Guard");
        throw err;
    }

    const markStart = `euix:setState:${key}:start`;
    const markEnd = `euix:setState:${key}:end`;
    if (typeof performance !== "undefined" && performance.mark) {
        try {
            performance.mark(markStart);
        } catch (_) {}
    }

    try {
        const oldValue = engine._rawState[key];
        engine._rawState[key] = value;

        const keyMask = engine.getKeyMask(key);
        if (typeof keyMask === "bigint" || typeof engine._dirtyBitmask === "bigint") {
            engine._dirtyBitmask = BigInt(engine._dirtyBitmask || 0) | BigInt(keyMask);
        } else {
            engine._dirtyBitmask |= keyMask;
        }

        if (key.includes(".") || key.includes("[")) {
            const parts = splitPath(key);
            const firstPart = parts[0];
            let curr = engine._rawState[firstPart];
            if (typeof curr !== "object" || curr === null) {
                curr = /^\d+$/.test(parts[1]) ? [] : {};
                engine._rawState[firstPart] = curr;
            }
            for (let i = 1; i < parts.length - 1; i++) {
                const p = parts[i];
                if (typeof curr[p] !== "object" || curr[p] === null) {
                    curr[p] = /^\d+$/.test(parts[i + 1]) ? [] : {};
                }
                curr = curr[p];
            }
            if (curr && typeof curr === "object") {
                curr[parts[parts.length - 1]] = value;
            }
        }

        if (isFn(engine._savePersistedState)) {
            engine._savePersistedState(key, value);
        }
        if (engine._devtools?.enabled && !silent) {
            engine._devtools.logAction("setState", { path: key, value });
        }

        if (engine._isBatching || batch) {
            engine._pendingBatchChanges = engine._pendingBatchChanges || new Map();
            engine._pendingBatchChanges.set(key, { key, value, oldValue, silent, sourceEl, context });
            if (typeof queueMicrotask === "function" && !engine._microtaskScheduled) {
                engine._microtaskScheduled = true;
                queueMicrotask(() => {
                    engine._microtaskScheduled = false;
                    engine.flushStateUpdates();
                });
            }
            return;
        }

        const allAffected = new Set();
        _invalidateComputed(engine, key, allAffected);

        engine.syncBindings(key, value, sourceEl);
        if (key.includes(".")) {
            const rootKey = key.split(".")[0];
            engine.syncBindings(rootKey, engine._rawState[rootKey], sourceEl);
            engine.syncBindings(`data.${rootKey}`, engine._rawState[rootKey], sourceEl);
            engine.syncBindings(`data.${key}`, value, sourceEl);
        }

        allAffected.forEach((cId) => {
            const cNode = engine._computedRegistry ? engine._computedRegistry.get(cId) : null;
            if (cNode) {
                const cVal = cNode.evaluate();
                engine.syncBindings(`computed.${cId}`, cVal, sourceEl);
                engine.syncBindings(cId, cVal, sourceEl);
            }
        });

        if (!silent) {
            engine.triggerStateWatchers(key, value, oldValue);
            if (isFn(engine._triggerReactiveWatchers)) {
                engine._triggerReactiveWatchers(key, value, oldValue, context);
            }
        }
    } finally {
        engine._updateDepth = Math.max(0, (engine._updateDepth || 1) - 1);
        if (typeof performance !== "undefined" && performance.mark && performance.measure) {
            try {
                performance.mark(markEnd);
                performance.measure(`⚡ EUIX setState (${key})`, markStart, markEnd);
            } catch (_) {}
        }
    }
}

export function registerBinding(engine, path, el, kind, updateFn = null) {
    if (!path || !el) return;

    let list = engine._bindings.get(path);
    if (!list) {
        list = [];
        engine._bindings.set(path, list);
    }

    const depMask = engine.getKeyMask(path);
    list.push({ el, kind, updateFn, depMask });

    if (typeof el.setAttribute === "function") {
        el.setAttribute("data-euix-key", path);
        el.setAttribute("data-euix-bind", kind);
        el.setAttribute("data-xui-key", path);
        el.setAttribute("data-xui-bind", kind);
    }
}

export function syncBindings(engine, path, value, sourceEl = null, executedFns = null) {
    const list = engine._bindings.get(path);
    if (!list || list.length === 0) return;
    const text =
        value === undefined || value === null ? "" : typeof value === "object" ? safeStringify(value) : String(value);

    let hasDeadNodes = false;
    for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const { el, kind, updateFn } = item;

        if (engine._isMounted && el && el.isConnected === false) {
            hasDeadNodes = true;
            continue;
        }

        if (isFn(updateFn)) {
            if (executedFns) {
                if (executedFns.has(updateFn)) continue;
                executedFns.add(updateFn);
            }
            updateFn(value);
            continue;
        }

        if (kind === "attribute" && updateFn && typeof updateFn === "object") {
            const { attrName, template } = updateFn;
            engine.updateAttributeBinding(el, attrName, template);
            continue;
        }

        if (!el || el === sourceEl) continue;

        if (kind === "input") {
            if (el.value !== text) el.value = text;
            continue;
        }

        if (kind === "checkbox") {
            const boolVal = engine.isTruthy(text);
            if (el.checked !== boolVal) el.checked = boolVal;
            continue;
        }

        if (kind === "radio") {
            const boolVal = String(el.value || "") === text;
            if (el.checked !== boolVal) el.checked = boolVal;
            continue;
        }

        if (kind === "multi_template") {
            const template = el.dataset.euixMultiTemplate;
            if (template) {
                const nextVal = engine.interpolate(template);
                if (el._euixVal !== nextVal) {
                    el._euixVal = nextVal;
                    if (el.nodeType === 3) {
                        el.nodeValue = nextVal;
                    } else if (el.textContent !== nextVal) {
                        el.textContent = nextVal;
                    }
                }
            }
            continue;
        }

        if (kind === "text") {
            if (el._euixVal === text) continue;
            const htmlTemplate = el.dataset.euixHtmlTemplate || el.dataset.xuiHtmlTemplate;
            const textTemplate = el.dataset.euixTextTemplate || el.dataset.xuiTextTemplate;
            if (htmlTemplate) {
                const nextHtml = htmlTemplate.replace(/\{\s*value\s*\}/g, engine.escapeHtml(text));
                if (el.innerHTML !== nextHtml) el.innerHTML = nextHtml;
                el._euixVal = text;
            } else if (textTemplate) {
                const nextTxt = textTemplate.replace(/\{\s*value\s*\}/g, text);
                if (el.textContent !== nextTxt) el.textContent = nextTxt;
                el._euixVal = text;
            } else {
                el._euixVal = text;
                if (el.nodeType === 3) {
                    el.nodeValue = text;
                } else if (el.textContent !== text) {
                    el.textContent = text;
                }
            }
        }
    }

    if (hasDeadNodes) {
        const alive = list.filter((item) => item.el?.isConnected !== false);
        if (alive.length === 0) {
            engine._bindings.delete(path);
        } else {
            engine._bindings.set(path, alive);
        }
    }
}

export function mutateState(engine, key, operation, payload = {}) {
    if (!key || !operation) return;
    const strKey = String(key).trim();
    const cleanKey = strKey.startsWith("data.")
        ? strKey.slice(5)
        : strKey.startsWith("state.")
          ? strKey.slice(6)
          : strKey;

    const op = String(operation).toUpperCase();
    if (op === "CLEAR" || op === "EMPTY" || op === "RESET") {
        engine.setState(cleanKey, EMPTY_ARR);
        return EMPTY_ARR;
    }

    const raw = engine._rawState ? engine._rawState[cleanKey] : null;
    const current = Array.isArray(raw)
        ? raw.slice()
        : Array.isArray(engine.getState?.(cleanKey))
          ? engine.getState(cleanKey).slice()
          : [];
    const mutated = applyArrayMutation(current, op, payload);
    engine.setState(cleanKey, mutated);
    return mutated;
}

export function batch(engine, fn) {
    return batchUpdates(engine, fn);
}

export function batchUpdates(engine, fn) {
    if (!isFn(fn)) return;
    const wasBatching = engine._isBatching || engine._batching;
    engine._isBatching = true;
    engine._batching = true;
    try {
        fn();
    } finally {
        engine._isBatching = wasBatching;
        engine._batching = wasBatching;
        if (!wasBatching) {
            engine.flushStateUpdates();
        }
    }
}

export function toggleState(engine, key) {
    const currentVal = engine.getState(key);
    engine.setState(key, !currentVal);
    return engine.getState(key);
}
