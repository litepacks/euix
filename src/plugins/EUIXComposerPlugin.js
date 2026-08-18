/**
 * EUIXComposerPlugin.js
 * Action Composer Subroutines & Workflow System Plugin for EUIX Engine.
 */

import { EUIXStructuredError } from "../core/EUIXEngineCore.js";

const EMPTY_OBJ = Object.freeze({});
const EMPTY_ARR = Object.freeze([]);

export class EUIXActionRecursionError extends Error {
    constructor(message) {
        super(message);
        this.name = "EUIXActionRecursionError";
    }
}

export class EUIXActionValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "EUIXActionValidationError";
    }
}

export class EUIXActionContext {
    constructor({ name = "", args = EMPTY_OBJ, engine = null, parent = null, eventContext = EMPTY_OBJ } = EMPTY_OBJ) {
        this.name = name;
        this.args = args && Object.keys(args).length > 0 ? { ...args } : EMPTY_OBJ;
        this.params = this.args;
        this.engine = engine;
        this.parent = parent || null;
        this.depth = parent ? (parent.depth + 1) : 1;
        this.callChain = new Set(parent ? parent.callChain : EMPTY_ARR);
        if (name) this.callChain.add(name);

        this.result = undefined;
        this._targetEl = eventContext._targetEl || (parent ? parent._targetEl : null);
        this._evt = eventContext._evt || (parent ? parent._evt : null);
        this.props = eventContext.props || (parent ? parent.props : EMPTY_OBJ);
        this.constants = eventContext.constants || (parent ? parent.constants : EMPTY_OBJ);
        this._componentApiConfig = eventContext._componentApiConfig || (parent ? parent._componentApiConfig : null);
    }
}

export class EUIXActionValidator {
    static validateDefinition(name, def) {
        if (!name || typeof name !== "string") {
            throw new EUIXActionValidationError("Action definition must have a valid name string.");
        }
        if (!def || typeof def !== "object") {
            throw new EUIXActionValidationError(`Action definition for '${name}' must be an object or XML node.`);
        }
    }

    static validateInvocation(actionDef, args, context, engine) {
        if (!actionDef) {
            throw new EUIXActionValidationError(`Unknown action: '${context.name}'`);
        }

        // Recursion loop detection via callChain
        if (context.parent && context.parent.callChain.has(actionDef.name)) {
            const chainStr = Array.from(context.parent.callChain).concat(actionDef.name).join(" -> ");
            throw new EUIXActionRecursionError(`[EUIX Action Composer] Circular action recursion detected: ${chainStr}`);
        }

        // Recursion depth limit guard
        if (context.depth > (engine?._maxActionDepth || 25)) {
            throw new EUIXActionRecursionError(`[EUIX Action Composer] Maximum action recursion depth (${engine?._maxActionDepth || 25}) exceeded for action <${actionDef.name}>`);
        }

        // Parameter requirements validation
        const req = actionDef._requiredParams || (Array.isArray(actionDef.params) ? actionDef.params.filter(p => p.required) : EMPTY_ARR);
        for (let i = 0; i < req.length; i++) {
            const param = req[i];
            const val = args[param.name];
            if (val === undefined || val === null || val === "") {
                throw new EUIXActionValidationError(`[EUIX Action Composer] Missing required argument '${param.name}' for action '${actionDef.name}'`);
            }
        }
    }
}

export class EUIXActionRegistry {
    constructor() {
        this._actions = new Map();
    }

    register(name, xmlNodeOrObj) {
        if (!name || typeof name !== "string") return null;
        const normalizedName = name.trim();

        let actionDef;
        if (xmlNodeOrObj && (xmlNodeOrObj.nodeType === 1 || xmlNodeOrObj.nodeType === 9)) {
            actionDef = EUIXActionRegistry.parseXmlActionDef(normalizedName, xmlNodeOrObj);
        } else if (xmlNodeOrObj && typeof xmlNodeOrObj === "object") {
            const p = xmlNodeOrObj.params || EMPTY_ARR;
            actionDef = {
                name: normalizedName,
                params: p,
                steps: xmlNodeOrObj.steps || EMPTY_ARR,
                returnExpr: xmlNodeOrObj.returnExpr || "",
                rawNode: xmlNodeOrObj.rawNode || null,
                _requiredParams: Array.isArray(p) ? p.filter(item => item.required) : EMPTY_ARR,
                _defaultParams: Array.isArray(p) ? p.filter(item => item.default !== undefined) : EMPTY_ARR
            };
        } else {
            return null;
        }

        EUIXActionValidator.validateDefinition(normalizedName, actionDef);
        this._actions.set(normalizedName, actionDef);
        return actionDef;
    }

    has(name) {
        return !!name && this._actions.has(String(name).trim());
    }

    get(name) {
        return name ? this._actions.get(String(name).trim()) : undefined;
    }

    getAll() {
        return new Map(this._actions);
    }

    clear() {
        this._actions.clear();
    }

    static parseXmlActionDef(name, xmlNode) {
        const params = [];
        const steps = [];
        let returnExpr = "";

        const paramNodes = Array.from(xmlNode.querySelectorAll("param, arg_def, parameter"));
        paramNodes.forEach(pNode => {
            const pName = pNode.getAttribute("name") || pNode.getAttribute("id");
            if (pName) {
                const defaultVal = pNode.getAttribute("default") || pNode.getAttribute("value") || pNode.textContent.trim() || undefined;
                const required = pNode.getAttribute("required") === "true" || pNode.hasAttribute("required");
                const type = pNode.getAttribute("type") || "string";
                params.push({ name: pName, default: defaultVal, required, type });
            }
        });

        const returnNode = Array.from(xmlNode.childNodes).find(n => n.nodeType === (typeof Node !== "undefined" ? Node.ELEMENT_NODE : 1) && n.tagName && n.tagName.toLowerCase() === "return");
        if (returnNode) {
            returnExpr = returnNode.textContent.trim() || returnNode.getAttribute("value") || returnNode.getAttribute("expr") || "";
        }

        const childNodes = Array.from(xmlNode.childNodes).filter(n => n.nodeType === (typeof Node !== "undefined" ? Node.ELEMENT_NODE : 1));
        childNodes.forEach(child => {
            const tag = child.tagName ? child.tagName.toLowerCase() : "";
            if (["param", "arg_def", "parameter", "return"].includes(tag)) return;
            child._cachedTag = tag;
            if (tag === "if") {
                child._cachedCond = child.getAttribute("condition") || child.getAttribute("test") || null;
                const innerElse = child.querySelector ? child.querySelector("else") : null;
                const nextElse = (child.nextElementSibling && child.nextElementSibling.tagName?.toLowerCase() === "else") ? child.nextElementSibling : null;
                child._cachedElseNode = innerElse || nextElse || null;
            }
            steps.push(child);
        });

        const requiredParams = params.filter(p => p.required);
        const defaultParams = params.filter(p => p.default !== undefined);

        return {
            name,
            params,
            steps,
            returnExpr,
            rawNode: xmlNode,
            _requiredParams: requiredParams.length > 0 ? requiredParams : EMPTY_ARR,
            _defaultParams: defaultParams.length > 0 ? defaultParams : EMPTY_ARR
        };
    }
}

export class EUIXActionComposer {
    static async execute(actionDef, rawArgs = EMPTY_OBJ, engine = null, parentEventContext = EMPTY_OBJ) {
        const startTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

        // 1. Resolve arguments in caller context & apply param defaults
        const evaluatedArgs = {};
        const callerContext = parentEventContext instanceof EUIXActionContext ? parentEventContext : parentEventContext;

        if (Array.isArray(actionDef.params)) {
            actionDef.params.forEach(p => {
                let val = rawArgs[p.name];
                if (val === undefined && p.default !== undefined) {
                    val = engine ? engine.interpolate(String(p.default), callerContext) : p.default;
                }
                if (typeof val === "string" && engine) {
                    val = engine.interpolate(val, callerContext);
                }
                evaluatedArgs[p.name] = val;
            });
        }

        Object.keys(rawArgs).forEach(k => {
            if (evaluatedArgs[k] === undefined) {
                const val = rawArgs[k];
                evaluatedArgs[k] = (typeof val === "string" && engine) ? engine.interpolate(val, callerContext) : val;
            }
        });

        // 2. Build invocation context
        const parentActionContext = parentEventContext instanceof EUIXActionContext ? parentEventContext : (parentEventContext._actionCtx || null);
        const invocationCtx = new EUIXActionContext({
            name: actionDef.name,
            args: evaluatedArgs,
            engine,
            parent: parentActionContext,
            eventContext: parentEventContext
        });

        const mergedContext = {
            ...parentEventContext,
            args: invocationCtx.args,
            params: invocationCtx.args,
            result: invocationCtx.result,
            _actionCtx: invocationCtx
        };

        // 3. Validation
        EUIXActionValidator.validateInvocation(actionDef, invocationCtx.args, invocationCtx, engine);

        let executionError = null;

        const prevContext = engine ? engine._currentActionContext : null;
        if (engine) engine._currentActionContext = invocationCtx;

        try {
            // 4. Sequential Step Execution
            let skipNextElse = false;
            const steps = actionDef.steps || EMPTY_ARR;
            const stepLen = steps.length;
            for (let sIdx = 0; sIdx < stepLen; sIdx++) {
                const step = steps[sIdx];
                mergedContext.result = invocationCtx.result;
                const tag = step._cachedTag !== undefined ? step._cachedTag : (step.tagName ? step.tagName.toLowerCase() : "");

                if (tag === "else") {
                    if (skipNextElse) {
                        skipNextElse = false;
                        continue;
                    }
                    const res = await engine._handleActionInternal(step, mergedContext);
                    if (res !== undefined) invocationCtx.result = res;
                    continue;
                }

                if (tag === "if") {
                    const cond = step._cachedCond !== undefined ? step._cachedCond : (step.getAttribute("condition") || step.getAttribute("test"));
                    const isTrue = !cond || !engine || engine.evalCondition(cond, mergedContext);

                    if (isTrue) {
                        skipNextElse = true;
                        const res = await engine._handleActionInternal(step, mergedContext);
                        if (res !== undefined) invocationCtx.result = res;
                    } else {
                        skipNextElse = false;
                        const elseNode = step._cachedElseNode !== undefined ? step._cachedElseNode : (engine.getChild(step, "else") || (step.nextElementSibling && step.nextElementSibling.tagName?.toLowerCase() === "else" ? step.nextElementSibling : null));
                        if (elseNode) {
                            const elseRes = await engine._handleActionInternal(elseNode, mergedContext);
                            if (elseRes !== undefined) invocationCtx.result = elseRes;
                            if (elseNode === step.nextElementSibling) {
                                skipNextElse = true;
                            }
                        }
                    }
                    continue;
                }

                skipNextElse = false;
                const res = await engine._handleActionInternal(step, mergedContext);
                if (res !== undefined) {
                    invocationCtx.result = res;
                }
            }

            // 5. Evaluate Return Expression if present
            if (actionDef.returnExpr && engine) {
                mergedContext.result = invocationCtx.result;
                const trimmedReturn = actionDef.returnExpr.trim();
                if (trimmedReturn === "{result}" && invocationCtx.result !== undefined) {
                    // Preserve original exact type of step result
                } else {
                    const evaluatedReturn = engine.interpolate(actionDef.returnExpr, mergedContext);
                    try {
                        invocationCtx.result = JSON.parse(evaluatedReturn);
                    } catch (_) {
                        invocationCtx.result = evaluatedReturn;
                    }
                }
            }
        } catch (err) {
            executionError = err;
            if (engine) engine.reportError(err, `Action Composer (${actionDef.name})`);
            throw err;
        } finally {
            if (engine) engine._currentActionContext = prevContext;

            const endTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
            const durationMs = Math.round((endTime - startTime) * 100) / 100;

            if (typeof window !== "undefined" && typeof window.__EUIX_DEVTOOLS_LOG_ACTION__ === "function") {
                try {
                    window.__EUIX_DEVTOOLS_LOG_ACTION__({
                        type: "ACTION_COMPOUND",
                        actionName: actionDef.name,
                        name: actionDef.name,
                        args: invocationCtx.args,
                        result: invocationCtx.result,
                        durationMs,
                        error: executionError ? executionError.message : null,
                        depth: invocationCtx.depth
                    });
                } catch (_) {}
            }

            if (engine && engine._devtools && engine._devtools.enabled) {
                try {
                    engine._devtools.logAction("ActionComposer", {
                        name: actionDef.name,
                        caller: parentActionContext ? parentActionContext.name : (invocationCtx._targetEl ? invocationCtx._targetEl.tagName : "engine"),
                        args: invocationCtx.args,
                        result: invocationCtx.result,
                        durationMs,
                        error: executionError ? executionError.message : null,
                        depth: invocationCtx.depth
                    });
                } catch (_) {}
            }
        }

        return invocationCtx.result;
    }
}

export const EUIXComposerPlugin = {
    name: "composer",
    install(engineClass) {
        if (!engineClass._globalActionRegistry) {
            engineClass._globalActionRegistry = new EUIXActionRegistry();
        }

        engineClass.registerActionDef = function(name, xmlNodeOrObj) {
            if (!engineClass._globalActionRegistry) engineClass._globalActionRegistry = new EUIXActionRegistry();
            return engineClass._globalActionRegistry.register(name, xmlNodeOrObj);
        };

        const proto = engineClass.prototype || engineClass;

        proto.registerActionDef = function(name, xmlNodeOrObj) {
            if (!this._actionRegistry) this._actionRegistry = new EUIXActionRegistry();
            const def = this._actionRegistry.register(name, xmlNodeOrObj);
            engineClass.registerActionDef(name, xmlNodeOrObj);
            return def;
        };

        proto.hasActionDef = function(name) {
            if (!name) return false;
            const normalized = String(name).trim();
            return (this._actionRegistry && this._actionRegistry.has(normalized)) ||
                (engineClass._globalActionRegistry && engineClass._globalActionRegistry.has(normalized));
        };

        proto.getActionDef = function(name) {
            if (!name) return undefined;
            const normalized = String(name).trim();
            if (this._actionRegistry && this._actionRegistry.has(normalized)) {
                return this._actionRegistry.get(normalized);
            }
            if (engineClass._globalActionRegistry && engineClass._globalActionRegistry.has(normalized)) {
                return engineClass._globalActionRegistry.get(normalized);
            }
            return undefined;
        };

        proto.executeAction = async function(actionName, args = {}, context = {}) {
            const actionDef = this.getActionDef(actionName);
            if (!actionDef) {
                const err = new EUIXActionValidationError(`[EUIX Action Composer] Unknown action: '${actionName}'`);
                this.reportError(err, "Action Execution");
                throw err;
            }
            const effectiveCtx = (context && (context instanceof EUIXActionContext || context._actionCtx))
                ? context
                : (this._currentActionContext || context);
            return await EUIXActionComposer.execute(actionDef, args, this, effectiveCtx);
        };

        proto.initActionRegistry = function() {
            if (!this._actionRegistry) this._actionRegistry = new EUIXActionRegistry();
            if (!engineClass._globalActionRegistry) engineClass._globalActionRegistry = new EUIXActionRegistry();

            if (!this.xmlDoc) return;
            const actionDefNodes = Array.from(this.xmlDoc.querySelectorAll("action_def, workflow_def"));
            actionDefNodes.forEach(node => {
                const name = node.getAttribute("name") || node.getAttribute("id");
                if (name) {
                    this._actionRegistry.register(name, node);
                    engineClass._globalActionRegistry.register(name, node);
                }
            });
        };

        const extractActionArgs = (engine, actionNode, context = {}) => {
            const args = {};

            if (actionNode.attributes) {
                Array.from(actionNode.attributes).forEach(attr => {
                    const attrName = attr.name;
                    if (["action", "name", "action_name", "class", "id", "target"].includes(attrName)) return;

                    let key = attrName;
                    if (key.startsWith("arg-") || key.startsWith("param-")) {
                        key = key.slice(4);
                    }
                    args[key] = (engine && typeof engine.interpolate === "function") ? engine.interpolate(attr.value, context) : attr.value;
                });
            }

            const argNodes = [
                ...(engine && typeof engine.getChildren === "function" ? engine.getChildren(actionNode, "arg") : Array.from(actionNode.querySelectorAll ? actionNode.querySelectorAll("arg") : actionNode.children || []).filter(c => c.tagName && c.tagName.toLowerCase() === "arg")),
                ...(engine && typeof engine.getChildren === "function" ? engine.getChildren(actionNode, "param") : Array.from(actionNode.querySelectorAll ? actionNode.querySelectorAll("param") : actionNode.children || []).filter(c => c.tagName && c.tagName.toLowerCase() === "param")),
                ...(engine && typeof engine.getChildren === "function" ? engine.getChildren(actionNode, "argument") : Array.from(actionNode.querySelectorAll ? actionNode.querySelectorAll("argument") : actionNode.children || []).filter(c => c.tagName && c.tagName.toLowerCase() === "argument"))
            ];

            argNodes.forEach(node => {
                const name = node.getAttribute("name") || node.getAttribute("id");
                if (name) {
                    const rawVal = node.getAttribute("value") || node.getAttribute("expr") || node.textContent.trim();
                    args[name] = (engine && typeof engine.interpolate === "function") ? engine.interpolate(rawVal, context) : rawVal;
                }
            });

            return args;
        };

        proto._extractActionArgs = function(actionNode, context = {}) {
            return extractActionArgs(this, actionNode, context);
        };

        const handleComposerCall = async function(actionNode, context) {
            const actionName = actionNode.getAttribute("name") || actionNode.getAttribute("action_name") || actionNode.getAttribute("target") || (this.getChild && this.getChild(actionNode, "name")?.textContent.trim());
            if (!actionName) return;
            const rawArgs = this._extractActionArgs ? this._extractActionArgs(actionNode, context) : extractActionArgs(this, actionNode, context);
            return this.executeAction(actionName, rawArgs, context);
        };

        engineClass.registerAction("EXECUTE_ACTION", handleComposerCall);
        engineClass.registerAction("CALL_ACTION", handleComposerCall);
        engineClass.registerAction("RUN_WORKFLOW", handleComposerCall);
        engineClass.registerAction("ACTION", handleComposerCall);
    }
};

export default EUIXComposerPlugin;
