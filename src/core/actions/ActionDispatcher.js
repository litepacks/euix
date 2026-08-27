/**
 * src/core/actions/ActionDispatcher.js
 * Declarative Action routing, try/catch/finally error handling, event delegation, and action composition for EUIX Engine.
 */

import { EUIXStructuredError } from "../parser/errors.js";
import { ACTION_DISPATCH_TABLE, genId, getNow, isFn } from "../utils/constants.js";

export function _setScopedState(engine, rawPath, path, nextValue, context = {}) {
    if (rawPath.startsWith("local.") || rawPath.startsWith("$local.")) {
        const localKey = rawPath.replace(/^(\$local|local)\./, "");
        if (context._localState) {
            context._localState[localKey] = nextValue;
            if (context._instanceId) {
                engine.syncBindings(`${context._instanceId}:${localKey}`, nextValue);
            }
            return true;
        }
    } else if (context._localState && context._localState[path] !== undefined && !rawPath.startsWith("global.")) {
        context._localState[path] = nextValue;
        if (context._instanceId) {
            engine.syncBindings(`${context._instanceId}:${path}`, nextValue);
        }
        return true;
    }
    engine.setState(path, nextValue);
    return false;
}

export function applyResets(engine, actionNode) {
    engine.getChildren(actionNode, "reset").forEach((resetNode) => {
        const path = engine.parseBindPath(resetNode.textContent || resetNode.getAttribute("path") || "");
        if (path) engine.setState(path, "", { silent: true });
    });
}

export function confirmAction(engine, actionNode, context = {}) {
    const confirmNode = engine.getChild(actionNode, "confirm");
    const confirmAttr = actionNode.getAttribute("confirm");

    if (!confirmNode && !confirmAttr) return true;

    if (confirmNode) {
        const condition = confirmNode.getAttribute("condition");
        if (condition && !engine.evalCondition(condition, context)) return true;
        const message = engine.interpolate(confirmNode.textContent.trim(), context);
        return window.confirm(message || "Are you sure?");
    }

    return window.confirm(engine.interpolate(confirmAttr, context) || "Are you sure?");
}

export function _handleActionError(engine, err, actionNode, context = {}) {
    const actName = actionNode?.getAttribute ? actionNode.getAttribute("action") || actionNode.tagName : "unknown";
    const structuredErr = EUIXStructuredError.from(err, {
        originatingAction: actName,
        component: context._componentName,
    });
    engine.reportError(structuredErr, `Action Execution Fallback (${actName})`);
    const errMsg = err?.message ? err.message : "";
    const isLoopGuard =
        errMsg.includes("Infinite Loop Guard") ||
        errMsg.includes("Cascade limit exceeded") ||
        errMsg.includes("Maximum watcher reaction depth");
    if (
        structuredErr.code === "WATCHER_CYCLE_ERROR" ||
        structuredErr.code === "COMPUTED_CYCLE_ERROR" ||
        isLoopGuard ||
        (context && (context._inTryScope || context.rethrow))
    ) {
        throw structuredErr;
    }
    return undefined;
}

export function handleAction(engine, actionNode, context = {}) {
    if (!actionNode) return;
    try {
        const res = _handleActionInternal(engine, actionNode, context);
        if (res && isFn(res.then)) {
            return res.catch((err) => _handleActionError(engine, err, actionNode, context));
        }
        return res;
    } catch (err) {
        return _handleActionError(engine, err, actionNode, context);
    }
}

export async function _handleTryCatchFinally(engine, tryNode, context = {}) {
    const catchNodes = engine.getChildren(tryNode, "catch");
    const finallyNodes = engine.getChildren(tryNode, "finally");

    if (catchNodes.length > 1) {
        const err = new EUIXStructuredError({
            message: "<try> block can only contain one <catch> handler",
            code: "VALIDATION_ERROR",
            originatingAction: "TRY",
            component: context._componentName,
        });
        engine.reportError(err, "Syntax Validation");
        throw err;
    }

    if (finallyNodes.length > 1) {
        const err = new EUIXStructuredError({
            message: "<try> block can only contain one <finally> handler",
            code: "VALIDATION_ERROR",
            originatingAction: "TRY",
            component: context._componentName,
        });
        engine.reportError(err, "Syntax Validation");
        throw err;
    }

    const tryActionNodes = engine.getChildren(tryNode).filter((c) => {
        const tag = c.tagName ? c.tagName.toLowerCase() : "";
        return tag !== "catch" && tag !== "finally";
    });

    const scopeId = genId("try_");
    const startTime = getNow();

    if (engine._devtools && isFn(engine._devtools.logErrorScope)) {
        engine._devtools.logErrorScope("TRY_ENTER", { scopeId, component: context._componentName });
    }

    let tryResult;
    let caughtError = null;

    const tryContext = {
        ...context,
        _inTryScope: true,
    };

    try {
        for (const childNode of tryActionNodes) {
            tryResult = await _handleActionInternal(engine, childNode, tryContext);
        }
        if (engine._devtools && isFn(engine._devtools.logErrorScope)) {
            engine._devtools.logErrorScope("TRY_SUCCESS", {
                scopeId,
                duration: getNow() - startTime,
            });
        }
    } catch (rawErr) {
        caughtError = EUIXStructuredError.from(rawErr, {
            originatingAction: tryNode.getAttribute("action") || "TRY",
            component: context._componentName,
        });

        if (engine._devtools && isFn(engine._devtools.logErrorScope)) {
            engine._devtools.logErrorScope("ACTION_ERROR", { scopeId, error: caughtError.toJSON() });
        }

        const catchNode = catchNodes[0];
        if (catchNode) {
            const varName =
                catchNode.getAttribute("var") || catchNode.getAttribute("as") || catchNode.getAttribute("id") || "err";
            const catchContext = {
                ...context,
                _inTryScope: true,
                [varName]: caughtError,
                err: caughtError,
                error: caughtError,
                _lastError: caughtError,
            };

            if (engine._devtools && typeof engine._devtools.logErrorScope === "function") {
                engine._devtools.logErrorScope("CATCH_ENTER", { scopeId, varName, error: caughtError.toJSON() });
            }

            try {
                const catchActions = engine.getChildren(catchNode);
                for (const catchAct of catchActions) {
                    tryResult = await _handleActionInternal(engine, catchAct, catchContext);
                }
            } catch (catchErr) {
                caughtError = EUIXStructuredError.from(catchErr, {
                    originatingAction: "CATCH",
                    component: context._componentName,
                });
            }
        }
    } finally {
        const finallyNode = finallyNodes[0];
        let pendingError = caughtError;

        if (finallyNode) {
            if (engine._devtools && typeof engine._devtools.logErrorScope === "function") {
                engine._devtools.logErrorScope("FINALLY_ENTER", { scopeId });
            }
            try {
                const finallyActions = engine.getChildren(finallyNode);
                for (const finAct of finallyActions) {
                    await _handleActionInternal(engine, finAct, context);
                }
                if (engine._devtools && typeof engine._devtools.logErrorScope === "function") {
                    engine._devtools.logErrorScope("FINALLY_COMPLETE", { scopeId });
                }
            } catch (finErr) {
                pendingError = EUIXStructuredError.from(finErr, {
                    originatingAction: "FINALLY",
                    component: context._componentName,
                });
            }
        }

        if (pendingError) {
            if (engine._devtools && typeof engine._devtools.logErrorScope === "function") {
                engine._devtools.logErrorScope("ERROR_PROPAGATED", { scopeId, error: pendingError.toJSON() });
            }
            throw pendingError;
        }
    }

    return tryResult;
}

export function _handleActionInternal(engine, actionNode, context = {}) {
    if (context._cancellationSignal?.isCancelled) {
        context._cancellationSignal.throwIfCancelled();
    }

    const prevContext = engine._currentActionContext;
    engine._currentActionContext = context;

    const actionName = actionNode?.getAttribute
        ? actionNode.getAttribute("action") || actionNode.getAttribute("name") || actionNode.tagName
        : typeof actionNode === "string"
          ? actionNode
          : "ACTION";

    const actionPayload = {
        action: actionName,
        context,
        timestamp: Date.now(),
    };
    const startTime = typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();

    if (engine.hooks) {
        engine.hooks.emit("action:start", actionPayload);
    }
    if (typeof engine._updateDevToolsStatus === "function") {
        engine._updateDevToolsStatus("pendingActions", 1);
    }

    const onComplete = (err, result) => {
        if (typeof engine._updateDevToolsStatus === "function") {
            engine._updateDevToolsStatus("pendingActions", -1);
        }
        const duration =
            (typeof performance !== "undefined" && performance.now ? performance.now() : Date.now()) - startTime;
        if (engine.hooks) {
            engine.hooks.emit("action:end", {
                ...actionPayload,
                duration,
                error: err || null,
                result,
                status: err ? "error" : "success",
            });
        }
    };

    try {
        const res = _executeActionInternalBody(engine, actionNode, context);
        if (res && isFn(res.then)) {
            return res
                .then((val) => {
                    onComplete(null, val);
                    return val;
                })
                .catch((err) => {
                    onComplete(err, null);
                    throw err;
                })
                .finally(() => {
                    engine._currentActionContext = prevContext;
                });
        }
        onComplete(null, res);
        engine._currentActionContext = prevContext;
        return res;
    } catch (err) {
        onComplete(err, null);
        engine._currentActionContext = prevContext;
        throw err;
    }
}

export function _executeActionInternalBody(engine, actionNode, context = {}) {
    const actionAttr = actionNode.getAttribute ? actionNode.getAttribute("action") : null;
    const tagNameLower = actionNode.tagName ? actionNode.tagName.toLowerCase() : "";

    if (engine._devtools?.enabled) {
        const pathNode = engine.getChild(actionNode, "path");
        const opNode = engine.getChild(actionNode, "operation");
        engine._devtools.logAction(actionAttr || actionNode.tagName, {
            path: pathNode ? pathNode.textContent.trim() : "",
            operation: opNode ? opNode.textContent.trim() : "",
        });
    }

    if (
        ["watch", "on_mount", "on_unmount", "on_state_change", "on_click", "if", "else", "step"].includes(
            tagNameLower,
        ) &&
        !actionAttr
    ) {
        const actionChildren = actionNode.children;
        const acLen = actionChildren ? actionChildren.length : 0;
        if (acLen > 0) {
            let lastResult;
            for (let i = 0; i < acLen; i++) {
                const step = actionChildren[i];
                if (step.nodeType === 1 && step.tagName.toLowerCase() !== "else") {
                    lastResult = _handleActionInternal(engine, step, context);
                }
            }
            return lastResult;
        }
    }

    if (tagNameLower === "catch" || tagNameLower === "finally") {
        const err = new EUIXStructuredError({
            message: `Orphan <${tagNameLower}> tag encountered without a parent <try> block`,
            code: "VALIDATION_ERROR",
            originatingAction: tagNameLower.toUpperCase(),
            component: context._componentName,
        });
        engine.reportError(err, "Syntax Validation");
        throw err;
    }

    const primaryKey = (actionAttr || tagNameLower).toUpperCase();

    // 1. Direct O(1) Action Dispatch via Table
    const handlerName = ACTION_DISPATCH_TABLE[primaryKey];
    if (handlerName && typeof engine[handlerName] === "function") {
        return engine[handlerName](actionNode, context);
    }

    // 2. Action Composer Subroutine Resolution
    const isComposedCallTag = ["execute_action", "call_action", "run_workflow", "action", "step"].includes(
        tagNameLower,
    );
    const isComposedCallAttr =
        actionAttr === "EXECUTE_ACTION" || actionAttr === "CALL_ACTION" || actionAttr === "RUN_WORKFLOW";
    const targetComposedName =
        isComposedCallAttr || isComposedCallTag
            ? actionNode.getAttribute("name") ||
              actionNode.getAttribute("action_name") ||
              actionNode.getAttribute("target") ||
              engine.getChild(actionNode, "name")?.textContent.trim() ||
              actionAttr
            : actionAttr || tagNameLower;

    if (targetComposedName && isFn(engine.hasActionDef) && engine.hasActionDef(targetComposedName)) {
        const args = isFn(engine._extractActionArgs) ? engine._extractActionArgs(actionNode, context) : {};
        return engine.executeAction(targetComposedName, args, context);
    }

    // 3. Custom Action Handlers
    const customHandler =
        (actionAttr && engine._customActions.get(actionAttr)) ||
        (actionAttr && engine.constructor._globalActionHandlers?.get(actionAttr.toUpperCase())) ||
        (tagNameLower && engine.constructor._globalActionHandlers?.get(tagNameLower.toUpperCase()));

    if (customHandler) {
        return customHandler.call(engine, actionNode, context, engine);
    }
}

export function executeEventHandlers(engine, handlerNodes, eventType, e, el, context = {}) {
    if (isFn(engine.handleDragEvent)) {
        engine.handleDragEvent(eventType, e, el, context);
    }
    if (eventType === "submit") {
        e.preventDefault();
        const formEl = el.tagName === "FORM" ? el : el.closest ? el.closest("form") : null;
        if (formEl && isFn(formEl.checkValidity)) {
            if (!formEl.checkValidity()) {
                if (isFn(formEl.reportValidity)) {
                    formEl.reportValidity();
                }
                return;
            }
        }
    }

    if (
        eventType === "click" &&
        (el.type === "submit" || (el.tagName === "BUTTON" && el.closest && el.closest("form")))
    ) {
        const formEl = el.closest ? el.closest("form") : null;
        if (formEl && isFn(formEl.checkValidity)) {
            if (!formEl.checkValidity()) {
                if (isFn(formEl.reportValidity)) {
                    formEl.reportValidity();
                }
                e.preventDefault();
                return;
            }
        }
    }

    const eventContext = Object.assign(Object.create(context), { _targetEl: el, _evt: e });
    const hLen = handlerNodes.length;

    for (let i = 0; i < hLen; i++) {
        const node = handlerNodes[i];
        const targetKey = node.getAttribute("key") || node.getAttribute("code");
        if (targetKey && e.key && e.key.toLowerCase() !== targetKey.toLowerCase()) {
            continue;
        }

        if (
            node.getAttribute("prevent_default") === "true" ||
            node.getAttribute("prevent") === "true" ||
            node.getAttribute("prevent_default") === ""
        ) {
            if (e && isFn(e.preventDefault)) e.preventDefault();
        }
        if (
            node.getAttribute("stop_propagation") === "true" ||
            node.getAttribute("stop") === "true" ||
            node.getAttribute("stop_propagation") === ""
        ) {
            if (e && isFn(e.stopPropagation)) e.stopPropagation();
        }

        if (!confirmAction(engine, node, eventContext)) continue;

        if (node.getAttribute("action")) {
            const actType = node.getAttribute("action");
            if (actType === "XHR") engine.handleXHR(node, eventContext);
            else engine.handleAction(node, eventContext);
        } else {
            const childActions = [];
            const nChildren = node.children;
            const ncLen = nChildren ? nChildren.length : 0;
            for (let cIdx = 0; cIdx < ncLen; cIdx++) {
                const c = nChildren[cIdx];
                if (c.tagName && c.tagName.toLowerCase() !== "confirm") {
                    childActions.push(c);
                }
            }
            if (childActions.length) {
                (async () => {
                    const caLen = childActions.length;
                    for (let aIdx = 0; aIdx < caLen; aIdx++) {
                        await engine.handleAction(childActions[aIdx], eventContext);
                    }
                })().catch((err) => engine.reportError(err, "Event Action Execution"));
            }
        }
    }
}

export function _setupContainerEventDelegation(engine, containerTarget) {
    if (!containerTarget || containerTarget._delegatedBound) return;
    containerTarget._delegatedBound = true;
    const events = ["click", "change", "input", "submit", "keyup", "keydown"];
    for (let eIdx = 0; eIdx < events.length; eIdx++) {
        const evtType = events[eIdx];
        containerTarget.addEventListener(evtType, (e) => {
            let target = e.target;
            if (target && target.nodeType === 3) {
                target = target.parentNode;
            }
            while (target && target !== containerTarget) {
                if (target.correspondingUseElement) {
                    target = target.correspondingUseElement;
                }
                const handlerNodes = target.__euixEvents
                    ? target.__euixEvents[evtType]
                    : target._euixEventMap
                      ? target._euixEventMap.get(evtType)
                      : null;
                if (handlerNodes) {
                    if (e._euixHandled) return;
                    e._euixHandled = true;
                    const targetContext = target._euixContext || {};
                    executeEventHandlers(engine, handlerNodes, evtType, e, target, targetContext);
                    break;
                }
                target = target.parentNode || target.parentElement;
            }
        });
    }
}

export function bindEvents(engine, xmlNode, el, context = {}) {
    if (!el || xmlNode.nodeType !== 1) return;
    if (xmlNode._hasEventTags === false) return;

    const eventMap = new Map();
    const rawChildren = xmlNode.childNodes || xmlNode.children || [];
    const chLen = rawChildren.length;

    for (let i = 0; i < chLen; i++) {
        const child = rawChildren[i];
        if (child.nodeType !== 1) continue;
        const tagName = child.tagName.toLowerCase();
        let eventType = null;

        if (tagName === "on_click") eventType = "click";
        else if (tagName === "on_change") eventType = "change";
        else if (tagName === "on_submit")
            eventType = el.tagName && el.tagName.toLowerCase() === "button" ? "click" : "submit";
        else if (tagName === "on_keyup") eventType = "keyup";
        else if (tagName === "on_keydown") eventType = "keydown";
        else if (tagName === "on_mouseenter") eventType = "mouseenter";
        else if (tagName === "on_mouseleave") eventType = "mouseleave";
        else if (tagName.startsWith("on_")) eventType = tagName.replace(/^on_/, "");
        else if (tagName === "event" || tagName === "on") {
            eventType = (
                child.getAttribute("type") ||
                child.getAttribute("name") ||
                child.getAttribute("event") ||
                "click"
            ).toLowerCase();
        }

        if (eventType) {
            let list = eventMap.get(eventType);
            if (!list) {
                list = [];
                eventMap.set(eventType, list);
            }
            list.push(child);
        }
    }

    if (typeof engine.setupDropListener === "function") {
        engine.setupDropListener(el, eventMap, context);
    }

    if (eventMap.size === 0) {
        xmlNode._hasEventTags = false;
        return;
    }

    xmlNode._hasEventTags = true;
    el._euixEventMap = eventMap;
    el._euixContext = context;

    const actionNames = [];
    const eventsObj = Object.create(null);

    eventMap.forEach((handlerNodes, eventType) => {
        eventsObj[eventType] = handlerNodes;
        const hLen = handlerNodes.length;
        for (let i = 0; i < hLen; i++) {
            const h = handlerNodes[i];
            const act = h?.getAttribute ? h.getAttribute("action") || h.getAttribute("name") : null;
            if (act && !actionNames.includes(act)) actionNames.push(act);
        }

        el.addEventListener(eventType, (e) => {
            if (e._euixHandled) return;
            e._euixHandled = true;
            executeEventHandlers(engine, handlerNodes, eventType, e, el, context);
        });
    });

    if (actionNames.length > 0 && !el.hasAttribute("data-euix-action")) {
        el.setAttribute("data-euix-action", actionNames.join(","));
    }
    el.__euixEvents = eventsObj;
}
