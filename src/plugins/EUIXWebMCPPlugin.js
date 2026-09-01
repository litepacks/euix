/**
 * src/plugins/EUIXWebMCPPlugin.js
 * First-Class WebMCP (Model Context Protocol) Plugin for EUIX Engine.
 * Enables declarative and imperative exposure of application actions as browser AI agent tools
 * via document.modelContext with progressive enhancement, strict sandboxing, and zero external dependencies.
 */

/**
 * Structured WebMCP Error class
 */
export class EUIXWebMCPError extends Error {
    constructor(code, message, details = null) {
        super(message);
        this.name = "EUIXWebMCPError";
        this.code = code || "WEBMCP_ERROR";
        this.details = details;
        this.timestamp = Date.now();
    }
}

/**
 * Validates tool name format (snake_case or alphanumeric with dashes/underscores)
 */
const TOOL_NAME_REGEX = /^[a-zA-Z0-9_-]+$/;

/**
 * Lightweight JSON-safe sanitization and circular reference protection
 */
export function sanitizeResult(value, seen = new WeakSet()) {
    if (value === null || value === undefined) return null;
    const type = typeof value;

    if (type === "string" || type === "number" || type === "boolean") {
        return value;
    }

    if (type === "bigint") {
        return Number(value);
    }

    if (type === "function" || type === "symbol") {
        return undefined;
    }

    // Guard against DOM nodes, Window, Document, global objects, and Event objects
    if (
        (typeof Node !== "undefined" && value instanceof Node) ||
        (typeof Window !== "undefined" && (value instanceof Window || value === window || value?.window === value)) ||
        (typeof Document !== "undefined" && (value instanceof Document || value === document || value?.defaultView)) ||
        (typeof Event !== "undefined" && value instanceof Event) ||
        (typeof globalThis !== "undefined" && value === globalThis) ||
        (value &&
            typeof value === "object" &&
            (value.nodeType !== undefined || typeof value.preventDefault === "function"))
    ) {
        return undefined;
    }

    if (type === "object") {
        if (seen.has(value)) {
            return undefined; // Break circular reference
        }
        seen.add(value);

        if (Array.isArray(value)) {
            const arr = [];
            for (let i = 0; i < value.length; i++) {
                const sanitized = sanitizeResult(value[i], seen);
                if (sanitized !== undefined) {
                    arr.push(sanitized);
                }
            }
            return arr;
        }

        // Plain object or class instance
        const obj = {};
        const keys = Object.keys(value);
        for (let i = 0; i < keys.length; i++) {
            const k = keys[i];
            // Skip private engine/runtime keys
            if (k.startsWith("_") || k.startsWith("$engine")) continue;
            const sanitized = sanitizeResult(value[k], seen);
            if (sanitized !== undefined) {
                obj[k] = sanitized;
            }
        }
        return obj;
    }

    return String(value);
}

/**
 * Compiles parameter definitions into standard JSON Schema
 */
export function compileJsonSchema(params = [], rawSchema = null) {
    if (rawSchema && typeof rawSchema === "object" && rawSchema.type) {
        return rawSchema;
    }

    const properties = {};
    const required = [];

    params.forEach((param) => {
        if (!param || !param.name) return;
        const name = String(param.name).trim();
        const type = (param.type || "string").toLowerCase();

        const propSchema = {
            type: ["string", "number", "integer", "boolean", "array", "object"].includes(type) ? type : "string",
        };

        if (param.description) {
            propSchema.description = String(param.description);
        }

        if (param.default !== undefined) {
            let defVal = param.default;
            if (propSchema.type === "number" || propSchema.type === "integer") {
                defVal = Number(defVal);
            } else if (propSchema.type === "boolean") {
                defVal = defVal === true || String(defVal).toLowerCase() === "true";
            }
            propSchema.default = defVal;
        }

        if (param.enum) {
            if (Array.isArray(param.enum)) {
                propSchema.enum = param.enum;
            } else if (typeof param.enum === "string") {
                propSchema.enum = param.enum
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
            }
        }

        if (param.format) {
            propSchema.format = String(param.format);
        }

        if (param.minimum !== undefined) propSchema.minimum = Number(param.minimum);
        if (param.maximum !== undefined) propSchema.maximum = Number(param.maximum);
        if (param.minLength !== undefined) propSchema.minLength = Number(param.minLength);
        if (param.maxLength !== undefined) propSchema.maxLength = Number(param.maxLength);

        if (propSchema.type === "array" && param.items) {
            propSchema.items = typeof param.items === "string" ? { type: param.items } : param.items;
        }

        properties[name] = propSchema;

        if (param.required === true || String(param.required).toLowerCase() === "true") {
            required.push(name);
        }
    });

    const schema = {
        type: "object",
        properties,
    };

    if (required.length > 0) {
        schema.required = required;
    }

    return schema;
}

/**
 * Lightweight JSON schema validation against input data
 */
export function validateInput(input = {}, schema = {}) {
    const properties = schema.properties || {};
    const required = Array.isArray(schema.required) ? schema.required : [];
    const sanitizedInput = { ...(input || {}) };

    // 1. Check required parameters
    for (let i = 0; i < required.length; i++) {
        const reqKey = required[i];
        const val = sanitizedInput[reqKey];
        if (val === undefined || val === null || val === "") {
            throw new EUIXWebMCPError("VALIDATION_ERROR", `Missing required parameter '${reqKey}' for WebMCP tool.`, {
                parameter: reqKey,
            });
        }
    }

    // 2. Validate types and defaults
    const propKeys = Object.keys(properties);
    for (let i = 0; i < propKeys.length; i++) {
        const key = propKeys[i];
        const spec = properties[key];
        let val = sanitizedInput[key];

        // Apply default if undefined
        if (val === undefined && spec.default !== undefined) {
            val = spec.default;
            sanitizedInput[key] = val;
        }

        if (val === undefined || val === null) continue;

        // Type validation
        if (spec.type === "string" && typeof val !== "string") {
            sanitizedInput[key] = String(val);
        } else if (spec.type === "number" || spec.type === "integer") {
            const num = Number(val);
            if (Number.isNaN(num)) {
                throw new EUIXWebMCPError("VALIDATION_ERROR", `Parameter '${key}' must be a valid number.`, {
                    parameter: key,
                    value: val,
                });
            }
            if (spec.type === "integer" && !Number.isInteger(num)) {
                throw new EUIXWebMCPError("VALIDATION_ERROR", `Parameter '${key}' must be an integer.`, {
                    parameter: key,
                    value: val,
                });
            }
            sanitizedInput[key] = num;
            if (spec.minimum !== undefined && num < spec.minimum) {
                throw new EUIXWebMCPError(
                    "VALIDATION_ERROR",
                    `Parameter '${key}' (${num}) is less than minimum (${spec.minimum}).`,
                    { parameter: key, value: num, minimum: spec.minimum },
                );
            }
            if (spec.maximum !== undefined && num > spec.maximum) {
                throw new EUIXWebMCPError(
                    "VALIDATION_ERROR",
                    `Parameter '${key}' (${num}) exceeds maximum (${spec.maximum}).`,
                    { parameter: key, value: num, maximum: spec.maximum },
                );
            }
        } else if (spec.type === "boolean") {
            sanitizedInput[key] = val === true || String(val).toLowerCase() === "true";
        } else if (spec.type === "array" && !Array.isArray(val)) {
            throw new EUIXWebMCPError("VALIDATION_ERROR", `Parameter '${key}' must be an array.`, {
                parameter: key,
                value: val,
            });
        } else if (spec.type === "object" && (typeof val !== "object" || Array.isArray(val))) {
            throw new EUIXWebMCPError("VALIDATION_ERROR", `Parameter '${key}' must be a plain object.`, {
                parameter: key,
                value: val,
            });
        }

        // Enum validation
        if (spec.enum && Array.isArray(spec.enum) && spec.enum.length > 0) {
            const valToCheck = sanitizedInput[key];
            const isMatch = spec.enum.some((e) => e === valToCheck || String(e) === String(valToCheck));
            if (!isMatch) {
                throw new EUIXWebMCPError(
                    "VALIDATION_ERROR",
                    `Parameter '${key}' value '${sanitizedInput[key]}' is not in allowed enum values [${spec.enum.join(", ")}].`,
                    { parameter: key, value: sanitizedInput[key], allowed: spec.enum },
                );
            }
        }

        // Length validation for strings
        if (spec.type === "string") {
            const strVal = String(sanitizedInput[key]);
            if (spec.minLength !== undefined && strVal.length < spec.minLength) {
                throw new EUIXWebMCPError(
                    "VALIDATION_ERROR",
                    `Parameter '${key}' length (${strVal.length}) is shorter than minLength (${spec.minLength}).`,
                    { parameter: key, minLength: spec.minLength },
                );
            }
            if (spec.maxLength !== undefined && strVal.length > spec.maxLength) {
                throw new EUIXWebMCPError(
                    "VALIDATION_ERROR",
                    `Parameter '${key}' length (${strVal.length}) exceeds maxLength (${spec.maxLength}).`,
                    { parameter: key, maxLength: spec.maxLength },
                );
            }
        }
    }

    return sanitizedInput;
}

/**
 * WebMCP Manager Class attached to each EUIX Engine instance
 */
export class EUIXWebMCPManager {
    constructor(engine, options = {}) {
        this.engine = engine;
        this.options = {
            enabled: true,
            debug: false,
            strict: true,
            defaults: {
                annotations: {
                    readOnlyHint: false,
                },
                exposedTo: undefined,
            },
            ...options,
        };

        this._registeredTools = new Map(); // toolName -> { definition, controller, unwatch, context }
        this._initExecutionState();
    }

    /**
     * Initializes $webmcp reactive state in EUIX Engine
     */
    _initExecutionState() {
        if (this.engine && typeof this.engine.setState === "function") {
            const initialState = {
                executing: false,
                currentTool: null,
                lastResult: null,
                lastError: null,
            };
            if (!this.engine.getState("$webmcp")) {
                this.engine.setState("$webmcp", initialState, { silent: true });
            }
        }
    }

    /**
     * Updates $webmcp reactive execution state
     */
    _updateExecutionState(updates = {}) {
        if (!this.engine || typeof this.engine.setState !== "function") return;
        const current = this.engine.getState("$webmcp") || {};
        this.engine.setState("$webmcp", { ...current, ...updates });
    }

    /**
     * Checks if WebMCP is supported in the current environment
     */
    isSupported() {
        return typeof document !== "undefined" && Boolean(document.modelContext);
    }

    /**
     * Returns native document.modelContext object as low-level escape hatch
     */
    getNativeContext() {
        return typeof document !== "undefined" && document.modelContext ? document.modelContext : null;
    }

    /**
     * Checks if WebMCP plugin is currently active and enabled
     */
    isEnabled() {
        if (typeof this.options.enabled === "function") {
            try {
                return Boolean(this.options.enabled({ state: this.engine?.state, engine: this.engine }));
            } catch (_) {
                return false;
            }
        }
        return Boolean(this.options.enabled);
    }

    /**
     * Registers a WebMCP tool
     */
    register(toolDef, options = {}) {
        if (!toolDef || typeof toolDef !== "object") {
            throw new EUIXWebMCPError("INVALID_TOOL_DEFINITION", "Tool definition must be an object.");
        }

        const name = String(toolDef.name || "").trim();
        if (!name || !TOOL_NAME_REGEX.test(name)) {
            throw new EUIXWebMCPError(
                "INVALID_TOOL_NAME",
                `Invalid tool name '${name}'. Tool names must be non-empty and match [a-zA-Z0-9_-]+`,
            );
        }

        if (this._registeredTools.has(name)) {
            const msg = `[EUIX WebMCP] Tool "${name}" is already registered.`;
            if (this.options.debug) {
                console.warn(msg);
            }
            if (this.options.strict && options.strict !== false) {
                throw new EUIXWebMCPError("DUPLICATE_TOOL", msg, { tool: name });
            }
            // Overwrite existing registration cleanly
            this.unregister(name);
        }

        // Progressive enhancement check
        if (!this.isSupported()) {
            if (this.options.debug) {
                console.log("[EUIX WebMCP] WebMCP is not supported by this browser.");
            }
            // Track internally even if native registration is skipped
            this._registeredTools.set(name, {
                definition: toolDef,
                controller: null,
                unwatch: null,
                context: options.context || {},
            });
            return this;
        }

        if (!this.isEnabled()) {
            if (this.options.debug) {
                console.log(`[EUIX WebMCP] Tool "${name}" skipped because WebMCP is disabled via options.`);
            }
            return this;
        }

        // Compile input schema
        const inputSchema = toolDef.inputSchema || compileJsonSchema(toolDef.params || [], toolDef.rawSchema || null);

        // Annotations
        const readOnly =
            toolDef.readonly === true ||
            toolDef.readOnly === true ||
            toolDef.read_only === true ||
            toolDef.annotations?.readOnlyHint === true;

        const annotations = {
            ...(this.options.defaults?.annotations || {}),
            ...(toolDef.annotations || {}),
            ...(readOnly ? { readOnlyHint: true } : {}),
        };

        // Origin exposure
        let exposedTo = toolDef.exposedTo || toolDef.exposeTo || toolDef.expose_to || this.options.defaults?.exposedTo;
        if (typeof exposedTo === "string") {
            exposedTo = exposedTo
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
        }

        const controller = new AbortController();

        // Native WebMCP tool wrapper
        const nativeTool = {
            name,
            title: toolDef.title || name,
            description: toolDef.description || "",
            inputSchema,
            annotations,
            execute: async (rawInput, clientOrCtx = {}) => {
                const clientSignal = clientOrCtx?.signal || controller.signal;
                return this._executeTool(name, toolDef, rawInput, clientSignal, options.context || {});
            },
        };

        if (exposedTo && exposedTo.length > 0) {
            nativeTool.exposedTo = exposedTo;
        }

        try {
            const nativeOptions = { signal: controller.signal };
            if (exposedTo && exposedTo.length > 0) {
                nativeOptions.exposedTo = exposedTo;
            }
            document.modelContext.registerTool(nativeTool, nativeOptions);
        } catch (err) {
            if (this.options.debug) {
                console.error(`[EUIX WebMCP] Failed to register tool "${name}" with document.modelContext:`, err);
            }
            if (this.options.strict) {
                throw new EUIXWebMCPError(
                    "REGISTRATION_FAILED",
                    `Failed to register WebMCP tool '${name}': ${err.message}`,
                );
            }
        }

        this._registeredTools.set(name, {
            definition: toolDef,
            controller,
            unwatch: options.unwatch || null,
            context: options.context || {},
        });

        return this;
    }

    /**
     * Executes a tool through the EUIX action/state pipeline
     */
    async _executeTool(toolName, toolDef, rawInput, clientSignal, customContext = {}) {
        this._updateExecutionState({
            executing: true,
            currentTool: toolName,
        });

        try {
            // 1. Validate & populate input parameters
            const input = validateInput(rawInput || {}, toolDef.inputSchema || {});

            // Check if aborted before execution
            if (clientSignal?.aborted) {
                throw new EUIXWebMCPError("ABORTED", "Tool execution was cancelled.");
            }

            // 2. Build restricted EUIX execution context
            const execContext = {
                state: {
                    get: (path) => {
                        if (!this.engine) return undefined;
                        if (this.engine._rawState === null && typeof this.engine.initDataModel === "function") {
                            this.engine.initDataModel();
                        }
                        return this.engine.getState(path);
                    },
                    set: (path, val, opts) => {
                        if (!this.engine) return;
                        if (this.engine._rawState === null && typeof this.engine.initDataModel === "function") {
                            this.engine.initDataModel();
                        }
                        return this.engine.setState(path, val, opts);
                    },
                },
                actions: {
                    run: (actionName, payload = {}) =>
                        this._runAction(actionName, { ...payload, signal: clientSignal }, execContext, customContext),
                },
                router: this.engine?.router
                    ? {
                          navigate: (to, opts) => this.engine.router.navigate(to, opts),
                          location: this.engine.router.location,
                          params: this.engine.router.params,
                          search: this.engine.router.search,
                          back: () => this.engine.router.back(),
                          forward: () => this.engine.router.forward(),
                          revalidate: (id) => this.engine.router.revalidate(id),
                      }
                    : null,
                params: input,
                query: this.engine?.router?.search || {},
                signal: clientSignal,
                ...customContext,
            };

            let rawResult;

            // 3. Delegate to tool execution target
            if (typeof toolDef.execute === "function") {
                rawResult = await toolDef.execute(input, execContext);
            } else if (toolDef.action) {
                rawResult = await this._runAction(
                    toolDef.action,
                    { ...input, signal: clientSignal },
                    execContext,
                    customContext,
                );
            } else if (toolDef.handler) {
                const handlerFn =
                    typeof toolDef.handler === "function"
                        ? toolDef.handler
                        : typeof window !== "undefined" && typeof window[toolDef.handler] === "function"
                          ? window[toolDef.handler]
                          : null;
                if (!handlerFn) {
                    throw new EUIXWebMCPError(
                        "HANDLER_NOT_FOUND",
                        `Handler '${toolDef.handler}' for tool '${toolName}' was not found.`,
                    );
                }
                rawResult = await handlerFn(input, execContext);
            } else {
                throw new EUIXWebMCPError(
                    "NO_EXECUTION_TARGET",
                    `Tool '${toolName}' has no action, execute function, or handler specified.`,
                );
            }

            // 4. Sanitize and normalize return value
            const sanitized = sanitizeResult(rawResult);

            this._updateExecutionState({
                executing: false,
                currentTool: null,
                lastResult: sanitized,
                lastError: null,
            });

            return sanitized;
        } catch (err) {
            const webmcpError =
                err instanceof EUIXWebMCPError
                    ? err
                    : new EUIXWebMCPError(
                          "ACTION_EXECUTION_FAILED",
                          this.options.debug ? err.message : "The tool action failed during execution.",
                          this.options.debug ? { originalError: err.message } : null,
                      );

            this._updateExecutionState({
                executing: false,
                currentTool: null,
                lastError: webmcpError,
            });

            if (this.options.debug) {
                console.error(`[EUIX WebMCP] Execution error in tool "${toolName}":`, err);
            }

            throw webmcpError;
        }
    }

    /**
     * Invokes an EUIX action preserving existing action pipeline
     */
    async _runAction(actionName, payload = {}, execContext = {}, customContext = {}) {
        if (!this.engine) {
            throw new EUIXWebMCPError("ENGINE_UNAVAILABLE", "EUIX Engine instance is not available.");
        }

        const normalizedName = String(actionName).trim();

        // 1. Router Navigate special action handling
        if (
            (normalizedName === "router.navigate" ||
                normalizedName.toUpperCase() === "NAVIGATE" ||
                normalizedName.toUpperCase() === "ROUTER_NAVIGATE") &&
            this.engine.router
        ) {
            const to = payload.to || payload.path || payload.url || payload.id || payload;
            return await this.engine.router.navigate(to, payload);
        }

        // 2. Action Composer Subroutine Workflow
        if (typeof this.engine.hasActionDef === "function" && this.engine.hasActionDef(normalizedName)) {
            return await this.engine.executeAction(normalizedName, payload, {
                ...customContext,
                _webmcpContext: execContext,
            });
        }

        // 3. Custom Action Handler / Global Action Table
        const customHandler =
            this.engine._customActions?.get(normalizedName) ||
            this.engine.constructor?._globalActionHandlers?.get(normalizedName.toUpperCase()) ||
            this.engine._customActions?.get(normalizedName.toUpperCase());

        if (customHandler) {
            // Mock or create action XML-like context
            const actionNode = {
                getAttribute: (k) => (payload[k] !== undefined ? String(payload[k]) : null),
                tagName: normalizedName,
            };
            return await customHandler.call(this.engine, actionNode, {
                ...customContext,
                ...payload,
                _webmcpContext: execContext,
            });
        }

        // 4. Direct method on engine
        if (typeof this.engine[normalizedName] === "function") {
            return await this.engine[normalizedName](payload, execContext);
        }

        throw new EUIXWebMCPError(
            "ACTION_NOT_FOUND",
            `EUIX action '${normalizedName}' is not defined in the application.`,
        );
    }

    /**
     * Unregisters a tool by name and aborts its signal
     */
    unregister(name) {
        if (!name) return false;
        const entry = this._registeredTools.get(name);
        if (!entry) return false;

        if (entry.controller) {
            try {
                entry.controller.abort();
            } catch (_) {}
        }

        if (typeof entry.unwatch === "function") {
            try {
                entry.unwatch();
            } catch (_) {}
        }

        this._registeredTools.delete(name);

        if (this.isSupported() && typeof document.modelContext.unregisterTool === "function") {
            try {
                document.modelContext.unregisterTool(name);
            } catch (_) {}
        }

        return true;
    }

    /**
     * Checks if a tool is currently registered
     */
    has(name) {
        return this._registeredTools.has(name);
    }

    /**
     * Gets registered tool metadata
     */
    get(name) {
        const entry = this._registeredTools.get(name);
        return entry ? entry.definition : undefined;
    }

    /**
     * Lists all currently registered tools
     */
    list() {
        const tools = [];
        this._registeredTools.forEach((entry, name) => {
            tools.push({
                name,
                title: entry.definition.title || name,
                description: entry.definition.description || "",
                inputSchema: entry.definition.inputSchema || {},
                annotations: entry.definition.annotations || {},
                exposedTo: entry.definition.exposedTo,
            });
        });
        return tools;
    }

    /**
     * Clears all registered tools and aborts their controllers
     */
    clear() {
        const names = Array.from(this._registeredTools.keys());
        names.forEach((name) => this.unregister(name));
        this._registeredTools.clear();
    }

    /**
     * Disposes the WebMCP manager
     */
    dispose() {
        this.clear();
    }
}

/**
 * Parses XML `<webmcp>` or `<webmcp_tool>` tags into structured tool definitions
 */
export function parseXmlToolDef(toolNode, engine, context = {}) {
    const name = toolNode.getAttribute("name") || toolNode.getAttribute("id");
    const title = toolNode.getAttribute("title") || name;
    const description = toolNode.getAttribute("description") || "";
    const action = toolNode.getAttribute("action") || "";
    const handler = toolNode.getAttribute("handler") || "";
    const readOnly =
        toolNode.getAttribute("readonly") === "true" ||
        toolNode.getAttribute("read_only") === "true" ||
        toolNode.getAttribute("readOnly") === "true";
    const exposedTo =
        toolNode.getAttribute("expose-to") ||
        toolNode.getAttribute("expose_to") ||
        toolNode.getAttribute("exposedTo") ||
        toolNode.getAttribute("exposed_to") ||
        undefined;
    const ifCondition = toolNode.getAttribute("if") || toolNode.getAttribute("condition") || null;

    // Extract child <param> nodes
    const paramNodes = Array.from(toolNode.children || []).filter(
        (c) => c.tagName && (c.tagName.toLowerCase() === "param" || c.tagName.toLowerCase() === "parameter"),
    );

    const params = paramNodes.map((pNode) => ({
        name: pNode.getAttribute("name") || pNode.getAttribute("id"),
        type: pNode.getAttribute("type") || "string",
        description: pNode.getAttribute("description") || pNode.textContent.trim() || "",
        required: pNode.getAttribute("required") === "true" || pNode.hasAttribute("required"),
        default: pNode.getAttribute("default") || undefined,
        enum: pNode.getAttribute("enum") || undefined,
        format: pNode.getAttribute("format") || undefined,
        minimum: pNode.getAttribute("minimum") || pNode.getAttribute("min") || undefined,
        maximum: pNode.getAttribute("maximum") || pNode.getAttribute("max") || undefined,
        minLength: pNode.getAttribute("minlength") || pNode.getAttribute("minLength") || undefined,
        maxLength: pNode.getAttribute("maxlength") || pNode.getAttribute("maxLength") || undefined,
    }));

    // Extract custom raw <schema> if present
    const schemaNode = Array.from(toolNode.children || []).find(
        (c) => c.tagName && ["schema", "input_schema", "inputschema"].includes(c.tagName.toLowerCase()),
    );
    let rawSchema = null;
    if (schemaNode) {
        try {
            rawSchema = JSON.parse(schemaNode.textContent.trim());
        } catch (_) {}
    } else if (toolNode.getAttribute("schema")) {
        try {
            rawSchema = JSON.parse(toolNode.getAttribute("schema"));
        } catch (_) {}
    }

    const inputSchema = compileJsonSchema(params, rawSchema);

    return {
        name,
        title,
        description,
        action,
        handler,
        readonly: readOnly,
        exposedTo,
        ifCondition,
        params,
        inputSchema,
    };
}

/**
 * Registers a declarative tool with reactive if-condition support
 */
export function registerDeclarativeTool(engine, toolDef, context = {}) {
    if (!engine || !engine.webmcp || !toolDef || !toolDef.name) return;

    // Dynamic state conditional tool (<tool if="...">)
    if (toolDef.ifCondition) {
        const conditionExpr = toolDef.ifCondition;

        const evaluateCondition = () => {
            try {
                return Boolean(engine.evalCondition(conditionExpr, context));
            } catch (_) {
                return false;
            }
        };

        const updateRegistration = () => {
            const isConditionMet = evaluateCondition();
            if (isConditionMet) {
                if (!engine.webmcp.has(toolDef.name)) {
                    engine.webmcp.register(toolDef, { context, strict: false });
                }
            } else {
                if (engine.webmcp.has(toolDef.name)) {
                    engine.webmcp.unregister(toolDef.name);
                }
            }
        };

        // Extract state keys from condition to setup watchers
        const cleanExpr = conditionExpr.replace(/[{}]/g, "");
        const matches = Array.from(
            cleanExpr.matchAll(/(?:parent\.)?(?:data|local|\$local|\$state|state)\.([a-zA-Z0-9_.[\]]+)/g),
        );
        const unwatchers = [];

        if (matches.length > 0) {
            const uniqueKeys = new Set(matches.map((m) => m[1].split(".")[0]));
            uniqueKeys.forEach((key) => {
                const isLocal =
                    context._localState &&
                    (context._localState[key] !== undefined || cleanExpr.includes(`local.${key}`));
                const bindKey = context._instanceId && isLocal ? `${context._instanceId}:${key}` : key;
                if (typeof engine.watch === "function") {
                    const unwatch = engine.watch(bindKey, updateRegistration);
                    if (typeof unwatch === "function") unwatchers.push(unwatch);
                }
            });
        }

        const unwatchAll = () => {
            unwatchers.forEach((unwatch) => unwatch());
        };

        // Initial evaluation
        if (evaluateCondition()) {
            engine.webmcp.register(toolDef, { context, unwatch: unwatchAll, strict: false });
        }

        return;
    }

    // Normal static tool
    engine.webmcp.register(toolDef, { context });
}

/**
 * EUIX WebMCP Plugin Factory & Plugin Definition
 */
export function WebMCPPlugin(pluginOptions = {}) {
    return {
        name: "webmcp",
        install(engineClass) {
            EUIXWebMCPPlugin.install(engineClass, pluginOptions);
        },
    };
}

export const EUIXWebMCPPlugin = {
    name: "webmcp",
    install(engineClass, pluginOptions = {}) {
        const proto = engineClass.prototype;

        // Define getter/setter for engine.webmcp
        if (!Object.hasOwn(proto, "webmcp")) {
            Object.defineProperty(proto, "webmcp", {
                get() {
                    if (!this._webmcpManager) {
                        this._webmcpManager = new EUIXWebMCPManager(this, pluginOptions);
                    }
                    return this._webmcpManager;
                },
                configurable: true,
                enumerable: true,
            });
        }

        // Hook into engine destroy/unmount for cleanup
        if (typeof proto.onUnmount === "function") {
            const originalDestroy = proto.destroy;
            proto.destroy = function () {
                if (this._webmcpManager) {
                    this._webmcpManager.dispose();
                }
                if (typeof originalDestroy === "function") {
                    return originalDestroy.apply(this, arguments);
                }
                return this;
            };
        }

        // Parse WebMCP metadata tags from root or component XML
        proto.parseWebMCPMetadata = function (rootNode, context = {}) {
            if (!rootNode || !this.webmcp) return;

            const webmcpNodes = Array.from(
                rootNode.querySelectorAll ? rootNode.querySelectorAll("webmcp, webmcp_tool, webmcp-tool") : [],
            );

            // Also check root itself
            if (
                rootNode.tagName &&
                ["webmcp", "webmcp_tool", "webmcp-tool"].includes(rootNode.tagName.toLowerCase()) &&
                !webmcpNodes.includes(rootNode)
            ) {
                webmcpNodes.push(rootNode);
            }

            webmcpNodes.forEach((node) => {
                const toolNodes = Array.from(node.children || []).filter(
                    (c) =>
                        c.tagName && (c.tagName.toLowerCase() === "tool" || c.tagName.toLowerCase() === "webmcp_tool"),
                );

                const isSingleTool =
                    node.tagName &&
                    (node.tagName.toLowerCase() === "webmcp_tool" || node.tagName.toLowerCase() === "tool");
                const targetNodes = isSingleTool ? [node] : toolNodes;

                targetNodes.forEach((tNode) => {
                    const toolDef = parseXmlToolDef(tNode, this, context);
                    if (toolDef && toolDef.name && !this.webmcp.has(toolDef.name)) {
                        registerDeclarativeTool(this, toolDef, context);
                    }
                });
            });
        };

        // Component definition handler for <webmcp>
        const renderWebMCPHandler = function (xmlNode, context = {}) {
            if (!this.webmcp) return null;

            const toolNodes = Array.from(xmlNode.children || []).filter(
                (c) => c.tagName && (c.tagName.toLowerCase() === "tool" || c.tagName.toLowerCase() === "webmcp_tool"),
            );

            // If xmlNode itself is a single <webmcp_tool> or <tool>
            const isSingleTool =
                xmlNode.tagName &&
                (xmlNode.tagName.toLowerCase() === "webmcp_tool" || xmlNode.tagName.toLowerCase() === "tool");
            const targetNodes = isSingleTool ? [xmlNode] : toolNodes;

            const registeredToolNames = [];

            targetNodes.forEach((tNode) => {
                const toolDef = parseXmlToolDef(tNode, this, context);
                if (toolDef && toolDef.name) {
                    registerDeclarativeTool(this, toolDef, context);
                    registeredToolNames.push(toolDef.name);
                }
            });

            // If inside a component instance, attach cleanup hook to context
            if (context._instanceId && registeredToolNames.length > 0) {
                if (typeof this.onUnmount === "function") {
                    this.onUnmount(() => {
                        registeredToolNames.forEach((name) => this.webmcp?.unregister(name));
                    });
                }
            }

            // Return non-rendering comment marker
            return typeof document !== "undefined" ? document.createComment("euix:webmcp") : null;
        };

        // Register custom XML layout components
        engineClass.registerComponent("webmcp", renderWebMCPHandler);
        engineClass.registerComponent("webmcp_tool", renderWebMCPHandler);
        engineClass.registerComponent("webmcp-tool", renderWebMCPHandler);
    },
};

export default EUIXWebMCPPlugin;
