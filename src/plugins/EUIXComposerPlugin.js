/**
 * EUIXComposerPlugin.js
 * Action Composer Subroutines & Workflow System Plugin for EUIX Engine.
 */

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
    constructor({ name = "", args = {}, engine = null, parent = null, eventContext = {} } = {}) {
        this.name = name;
        this.args = { ...(args || {}) };
        this.params = this.args;
        this.engine = engine;
        this.parent = parent || null;
        this.depth = parent ? (parent.depth + 1) : 1;
        this.callChain = new Set(parent ? parent.callChain : []);
        if (name) this.callChain.add(name);

        this.result = undefined;
        this._targetEl = eventContext._targetEl || (parent ? parent._targetEl : null);
        this._evt = eventContext._evt || (parent ? parent._evt : null);
        this.props = eventContext.props || (parent ? parent.props : {});
        this.constants = eventContext.constants || (parent ? parent.constants : {});
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

        if (context.parent && context.parent.callChain.has(actionDef.name)) {
            const chainStr = Array.from(context.parent.callChain).concat(actionDef.name).join(" -> ");
            throw new EUIXActionRecursionError(`[EUIX Action Composer] Circular action recursion detected: ${chainStr}`);
        }

        if (context.depth > (engine?._maxActionDepth || 25)) {
            throw new EUIXActionRecursionError(`[EUIX Action Composer] Maximum action recursion depth (${engine?._maxActionDepth || 25}) exceeded for action <${actionDef.name}>`);
        }

        if (Array.isArray(actionDef.params)) {
            actionDef.params.forEach(param => {
                if (param.required) {
                    const val = args[param.name];
                    if (val === undefined || val === null || val === "") {
                        throw new EUIXActionValidationError(`[EUIX Action Composer] Missing required argument '${param.name}' for action '${actionDef.name}'`);
                    }
                }
            });
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
            actionDef = {
                name: normalizedName,
                params: xmlNodeOrObj.params || [],
                steps: xmlNodeOrObj.steps || [],
                returnExpr: xmlNodeOrObj.returnExpr || "",
                rawNode: xmlNodeOrObj.rawNode || null
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
            const tag = child.tagName.toLowerCase();
            if (["param", "arg_def", "parameter", "return"].includes(tag)) return;
            steps.push(child);
        });

        return {
            name,
            params,
            steps,
            returnExpr,
            rawNode: xmlNode
        };
    }
}

export class EUIXActionComposer {
    static async execute(actionDef, rawArgs = {}, engine = null, parentEventContext = {}) {
        const startTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();

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

        EUIXActionValidator.validateInvocation(actionDef, invocationCtx.args, invocationCtx, engine);

        let executionError = null;

        const prevContext = engine ? engine._currentActionContext : null;
        if (engine) engine._currentActionContext = invocationCtx;

        try {
            for (const step of actionDef.steps) {
                mergedContext.result = invocationCtx.result;

                if (step.tagName && step.tagName.toLowerCase() === "if") {
                    const cond = step.getAttribute("condition") || step.getAttribute("test");
                    if (cond && engine && !engine.evalCondition(cond, mergedContext)) {
                        const elseNode = engine.getChild(step, "else") || (step.nextElementSibling && step.nextElementSibling.tagName?.toLowerCase() === "else" ? step.nextElementSibling : null);
                        if (elseNode) {
                            const elseRes = await engine._handleActionInternal(elseNode, mergedContext);
                            if (elseRes !== undefined) invocationCtx.result = elseRes;
                        }
                        continue;
                    }
                }

                const res = await engine._handleActionInternal(step, mergedContext);
                if (res !== undefined) {
                    invocationCtx.result = res;
                }
            }

            if (actionDef.returnExpr && engine) {
                mergedContext.result = invocationCtx.result;
                const evaluatedReturn = engine.interpolate(actionDef.returnExpr, mergedContext);
                try {
                    const parsedObj = JSON.parse(evaluatedReturn);
                    invocationCtx.result = parsedObj;
                } catch (_) {
                    invocationCtx.result = evaluatedReturn;
                }
            }
        } catch (err) {
            const StructuredErrorClass = (engine && engine.constructor.EUIXStructuredError) || (typeof window !== "undefined" && window.EUIXStructuredError);
            executionError = StructuredErrorClass ? StructuredErrorClass.from(err, { originatingAction: actionDef.name }) : err;
            if (engine) engine.reportError(executionError, `Action Composer (${actionDef.name})`);
            throw executionError;
        } finally {
            if (engine) engine._currentActionContext = prevContext;

            const endTime = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
            const durationMs = Math.round((endTime - startTime) * 100) / 100;

            if (typeof window !== "undefined" && window.__EUIX_DEVTOOLS_LOG_ACTION__) {
                window.__EUIX_DEVTOOLS_LOG_ACTION__({
                    type: "ACTION_COMPOUND",
                    actionName: actionDef.name,
                    args: invocationCtx.args,
                    result: invocationCtx.result,
                    durationMs,
                    error: executionError ? executionError.message : null,
                    timestamp: new Date().toISOString()
                });
            }
        }

        return invocationCtx.result;
    }
}

export const EUIXComposerPlugin = {
    name: "composer",
    install(engineClass) {
        engineClass.registerAction("EXECUTE_ACTION", async function(actionNode, context) {
            const actionName = actionNode.getAttribute("name") || actionNode.getAttribute("action_name") || actionNode.getAttribute("target") || this.getChild(actionNode, "name")?.textContent.trim();
            if (!actionName) return;

            const rawArgs = {};
            Array.from(actionNode.attributes || []).forEach(attr => {
                if (!["action", "name", "action_name", "target"].includes(attr.name)) {
                    rawArgs[attr.name] = attr.value;
                }
            });

            const argNodes = Array.from(actionNode.querySelectorAll("arg, param, argument"));
            argNodes.forEach(argNode => {
                const argName = argNode.getAttribute("name") || argNode.getAttribute("id");
                if (argName) {
                    const argVal = argNode.getAttribute("value") || argNode.getAttribute("expr") || argNode.textContent.trim();
                    rawArgs[argName] = argVal;
                }
            });

            return this.executeAction(actionName, rawArgs, context);
        });
    }
};

export default EUIXComposerPlugin;
