/**
 * EUIXExpressionParser
 * Lightweight AST-based expression tokenizer, parser and evaluator for EUIX Engine.
 */
class EUIXExpressionParser {
    static tokenize(expr) {
        const tokens = [];
        let i = 0;
        while (i < expr.length) {
            const char = expr[i];

            if (/\s/.test(char)) {
                i++;
                continue;
            }

            // String literals
            if (char === '"' || char === "'") {
                const quote = char;
                let str = "";
                i++;
                while (i < expr.length && expr[i] !== quote) {
                    if (expr[i] === "\\" && i + 1 < expr.length) {
                        i++;
                        str += expr[i];
                    } else {
                        str += expr[i];
                    }
                    i++;
                }
                i++; // skip closing quote
                tokens.push({ type: "STRING", value: str });
                continue;
            }

            // Numbers
            if (/\d/.test(char) || (char === "." && /\d/.test(expr[i + 1]))) {
                let numStr = "";
                while (i < expr.length && (/[\d.]/).test(expr[i])) {
                    numStr += expr[i];
                    i++;
                }
                tokens.push({ type: "NUMBER", value: parseFloat(numStr) });
                continue;
            }

            // Two-character operators
            const twoChar = expr.slice(i, i + 2);
            if (["==", "!=", ">=", "<=", "&&", "||"].includes(twoChar)) {
                tokens.push({ type: "OPERATOR", value: twoChar });
                i += 2;
                continue;
            }

            // Single-character operators & punctuation
            if ([">", "<", "!", "+", "-", "*", "/", "%", "(", ")", ",", "?", ":"].includes(char)) {
                if (char === "(" || char === ")" || char === "," || char === "?" || char === ":") {
                    tokens.push({ type: char, value: char });
                } else {
                    tokens.push({ type: "OPERATOR", value: char });
                }
                i++;
                continue;
            }

            // Identifiers / Keywords
            if (/[a-zA-Z_$]/.test(char)) {
                let idStr = "";
                while (i < expr.length && /[a-zA-Z0-9_$.[\]]/.test(expr[i])) {
                    idStr += expr[i];
                    i++;
                }
                if (idStr === "true" || idStr === "false") {
                    tokens.push({ type: "BOOLEAN", value: idStr === "true" });
                } else if (idStr === "null") {
                    tokens.push({ type: "NULL", value: null });
                } else {
                    tokens.push({ type: "IDENTIFIER", value: idStr });
                }
                continue;
            }

            i++;
        }
        return tokens;
    }

    static parseToJs(tokens) {
        let current = 0;
        function peek() { return tokens[current]; }
        function consume() { return tokens[current++]; }

        function parsePrimary() {
            const token = peek();
            if (!token) return "undefined";

            if (token.type === "STRING") {
                consume();
                return JSON.stringify(token.value);
            }
            if (token.type === "NUMBER") {
                consume();
                return String(token.value);
            }
            if (token.type === "BOOLEAN") {
                consume();
                return token.value ? "true" : "false";
            }
            if (token.type === "NULL") {
                consume();
                return "null";
            }
            if (token.type === "(") {
                consume();
                const inner = parseExpression();
                if (peek() && peek().type === ")") consume();
                return `(${inner})`;
            }
            if (token.type === "IDENTIFIER") {
                consume();
                const id = token.value;
                const lower = id.toLowerCase();
                if (peek() && peek().type === "(") {
                    consume();
                    const args = [];
                    if (peek() && peek().type !== ")") {
                        args.push(parseExpression());
                        while (peek() && peek().type === ",") {
                            consume();
                            args.push(parseExpression());
                        }
                    }
                    if (peek() && peek().type === ")") consume();
                    if (lower === "length") {
                        return `((Array.isArray(${args[0]}) || typeof (${args[0]}) === "string") ? (${args[0]}).length : 0)`;
                    }
                    if (lower === "contains" || lower === "includes") {
                        return `((Array.isArray(${args[0]})) ? (${args[0]}).includes(${args[1]}) : (typeof (${args[0]}) === "string" ? (${args[0]}).includes(String(${args[1]})) : false))`;
                    }
                    if (lower === "not") {
                        return `(!(${args[0]}) || (${args[0]}) === "false")`;
                    }
                    return "undefined";
                }
                if (id.includes(".") || id.startsWith("data.") || id.startsWith("parent.") || id.startsWith("local.") || id.startsWith("props.")) {
                    return `($r(${JSON.stringify(id)}))`;
                }
                return `(($r(${JSON.stringify(id)})) !== undefined ? ($r(${JSON.stringify(id)})) : ${JSON.stringify(id)})`;
            }
            if (token.type === "OPERATOR" && token.value === "!") {
                consume();
                return `(!${parseUnary()} || ${parseUnary()} === "false")`;
            }
            consume();
            return "undefined";
        }

        function parseUnary() {
            if (peek() && peek().type === "OPERATOR" && (peek().value === "!" || peek().value === "-")) {
                const op = consume().value;
                if (op === "!") return `(!(${parseUnary()}) || (${parseUnary()}) === "false")`;
                if (op === "-") return `(-Number(${parseUnary()}))`;
            }
            return parsePrimary();
        }

        function parseBinary(nextLevel, ops, codeGen) {
            let left = nextLevel();
            while (peek() && peek().type === "OPERATOR" && ops.includes(peek().value)) {
                const op = consume().value;
                const right = nextLevel();
                left = codeGen(op, left, right);
            }
            return left;
        }

        function parseMultiplicative() {
            return parseBinary(parseUnary, ["*", "/", "%"], (op, l, r) => {
                if (op === "*") return `(Number(${l}) * Number(${r}))`;
                if (op === "/") return `(Number(${r}) !== 0 ? Number(${l}) / Number(${r}) : 0)`;
                if (op === "%") return `(Number(${r}) !== 0 ? Number(${l}) % Number(${r}) : 0)`;
            });
        }

        function parseAdditive() {
            return parseBinary(parseMultiplicative, ["+", "-"], (op, l, r) => {
                if (op === "+") return `((typeof (${l}) === "string" || typeof (${r}) === "string") ? String((${l}) ?? "") + String((${r}) ?? "") : Number(${l}) + Number(${r}))`;
                if (op === "-") return `(Number(${l}) - Number(${r}))`;
            });
        }

        function parseRelational() {
            return parseBinary(parseAdditive, [">", "<", ">=", "<="], (op, l, r) => {
                return `(Number(${l}) ${op} Number(${r}))`;
            });
        }

        function parseEquality() {
            return parseBinary(parseRelational, ["==", "!="], (op, l, r) => {
                if (op === "==") return `(String((${l}) ?? "").trim() === String((${r}) ?? "").trim())`;
                if (op === "!=") return `(String((${l}) ?? "").trim() !== String((${r}) ?? "").trim())`;
            });
        }

        function parseLogicalAnd() {
            return parseBinary(parseEquality, ["&&"], (op, l, r) => `(Boolean(${l}) && Boolean(${r}))`);
        }

        function parseLogicalOr() {
            return parseBinary(parseLogicalAnd, ["||"], (op, l, r) => `(Boolean(${l}) || Boolean(${r}))`);
        }

        function parseTernary() {
            let test = parseLogicalOr();
            if (peek() && peek().type === "?" || (peek() && peek().type === "OPERATOR" && peek().value === "?")) {
                consume();
                let cons = parseExpression();
                if (peek() && peek().type === ":" || (peek() && peek().type === "OPERATOR" && peek().value === ":")) {
                    consume();
                    let alt = parseExpression();
                    return `(((${test}) !== false && (${test}) !== "false" && (${test}) !== 0 && (${test}) !== null && (${test}) !== undefined && (${test}) !== "") ? (${cons}) : (${alt}))`;
                }
            }
            return test;
        }

        function parseExpression() { return parseTernary(); }

        return parseExpression();
    }

    static _compiledFnCache = new Map();
    static _compiledTemplateFnCache = new Map();
    static _compiledFnCacheMaxSize = 2000;
    static _cacheStats = { hits: 0, misses: 0 };

    static compileExpression(exprString) {
        let fn = this._compiledFnCache.get(exprString);
        if (fn !== undefined) {
            this._cacheStats.hits++;
            return fn;
        }

        this._cacheStats.misses++;
        try {
            const tokens = this.tokenize(exprString);
            const jsCode = this.parseToJs(tokens);
            fn = new Function("$r", `try { return (${jsCode}); } catch (_) { return undefined; }`);
        } catch (_) {
            fn = null;
        }

        if (this._compiledFnCache.size >= this._compiledFnCacheMaxSize) {
            const firstKey = this._compiledFnCache.keys().next().value;
            if (firstKey !== undefined) this._compiledFnCache.delete(firstKey);
        }
        this._compiledFnCache.set(exprString, fn);
        return fn;
    }

    static compileTemplateFunction(templateString) {
        if (!templateString || typeof templateString !== "string" || !templateString.includes("{")) {
            return null;
        }

        let cached = this._compiledTemplateFnCache.get(templateString);
        if (cached !== undefined) {
            this._cacheStats.hits++;
            return cached;
        }

        this._cacheStats.misses++;
        try {
            const parts = [];
            let lastIdx = 0;
            let i = 0;
            const len = templateString.length;

            while (i < len) {
                if (templateString.charCodeAt(i) === 123) { // '{'
                    const nextChar = templateString.charAt(i + 1).trim();
                    if (nextChar === '"' || nextChar === "'") {
                        const nextColon = templateString.indexOf(":", i + 1);
                        const nextClose = templateString.indexOf("}", i + 1);
                        if (nextColon !== -1 && (nextClose === -1 || nextColon < nextClose)) {
                            i++;
                            continue;
                        }
                    }

                    let closeIdx = -1;
                    let inQuote = null;
                    for (let j = i + 1; j < len; j++) {
                        const ch = templateString.charAt(j);
                        if (inQuote) {
                            if (ch === inQuote && templateString.charAt(j - 1) !== "\\") {
                                inQuote = null;
                            }
                        } else if (ch === '"' || ch === "'") {
                            inQuote = ch;
                        } else if (ch === "{") {
                            break;
                        } else if (ch === "}") {
                            closeIdx = j;
                            break;
                        }
                    }

                    if (closeIdx === -1) {
                        i++;
                        continue;
                    }

                    const expr = templateString.slice(i + 1, closeIdx).trim();
                    if (expr && !expr.startsWith('"') && !expr.includes('":') && !expr.includes("':")) {
                        if (i > lastIdx) {
                            parts.push(JSON.stringify(templateString.slice(lastIdx, i)));
                        }
                        const tokens = this.tokenize(expr);
                        const jsExpr = this.parseToJs(tokens);
                        parts.push(`((${jsExpr}) ?? "")`);
                        i = closeIdx;
                        lastIdx = closeIdx + 1;
                    }
                }
                i++;
            }

            if (parts.length === 0) {
                cached = null;
            } else {
                if (lastIdx < len) {
                    parts.push(JSON.stringify(templateString.slice(lastIdx)));
                }
                const code = parts.length === 1 ? parts[0] : parts.join(" + ");
                cached = new Function("$engine", "$ctx", "$r", `try { return String(${code}); } catch (_) { return ""; }`);
            }
        } catch (_) {
            cached = null;
        }

        if (this._compiledTemplateFnCache.size >= this._compiledFnCacheMaxSize) {
            const firstKey = this._compiledTemplateFnCache.keys().next().value;
            if (firstKey !== undefined) this._compiledTemplateFnCache.delete(firstKey);
        }
        this._compiledTemplateFnCache.set(templateString, cached);
        return cached;
    }

    static eval(exprString, resolveValueFn) {
        if (!exprString || !exprString.trim()) return undefined;
        try {
            const compiled = this.compileExpression(exprString);
            if (compiled) {
                return compiled(resolveValueFn);
            }
        } catch (_) {}
        return undefined;
    }

    static clearExpressionCache() {
        this._compiledFnCache.clear();
        this._compiledTemplateFnCache.clear();
        this._cacheStats = { hits: 0, misses: 0 };
    }

    static getExpressionCacheStats() {
        const total = this._cacheStats.hits + this._cacheStats.misses;
        return {
            size: this._compiledFnCache.size,
            templateSize: this._compiledTemplateFnCache.size,
            maxSize: this._compiledFnCacheMaxSize,
            hits: this._cacheStats.hits,
            misses: this._cacheStats.misses,
            hitRatio: total > 0 ? Number((this._cacheStats.hits / total).toFixed(4)) : 0
        };
    }
}

// Pure internal helpers for tree-shaking and minification optimization
const EMPTY_ARR = Object.freeze([]);
const EMPTY_OBJ = Object.freeze({});
const noop = () => {};

const isObj = (v) => v !== null && typeof v === "object";
const isFn = (v) => typeof v === "function";
const isStr = (v) => typeof v === "string";
const isBool = (v) => typeof v === "boolean";
const isElem = (n) => n && n.nodeType === 1;
const isTxtNode = (n) => n && (n.nodeType === 3 || n.nodeType === 4);
const trimStr = (s) => typeof s === "string" ? s.trim() : (s && s.textContent ? s.textContent.trim() : "");
const splitPath = (p) => (p ? String(p).replace(/\[(\w+)\]/g, ".$1").split(".").filter(Boolean) : EMPTY_ARR);
const getRootKey = (p) => String(p || "").split(/[.[]/)[0];
const getTagName = (n) => (n && n.tagName ? n.tagName.toLowerCase() : "");
const genId = (p = "id_") => p + Math.random().toString(36).substring(2, 9);
const getNow = () => (typeof performance !== "undefined" && isFn(performance.now) ? performance.now() : Date.now());
const getAttr = (n, ...names) => {
    if (!n || !n.getAttribute) return "";
    for (const name of names) {
        const val = n.getAttribute(name);
        if (val !== null && val !== undefined && val !== "") return val;
    }
    return "";
};
const getChildNodes = (n) => (n && n.childNodes && n.childNodes.length > 0 ? Array.from(n.childNodes) : EMPTY_ARR);
const getChildrenList = (n) => (n && n.children && n.children.length > 0 ? Array.from(n.children) : EMPTY_ARR);
const isScoped = (n) => {
    if (!n || !n.getAttribute) return false;
    const s = n.getAttribute("scope");
    return n.getAttribute("isolated") === "true" || n.getAttribute("scoped") === "true" || s === "local" || s === "isolated" || s === "scoped";
};
const toNum = (val, defaultVal = 0) => {
    const n = Number(val);
    return isNaN(n) ? defaultVal : n;
};

const ALLOWED_HTML_TAGS = new Set([
    "button", "input", "textarea", "select", "form", "a", "img", "option", "table", "tr", "td", "th",
    "div", "span", "strong", "em", "label", "p", "h1", "h2", "h3", "h4", "h5", "h6",
    "section", "article", "header", "footer", "nav", "aside", "main", "figure", "figcaption",
    "mark", "small", "sub", "sup", "code", "pre", "blockquote", "br", "hr", "b", "i", "u", "s",
    "ul", "ol", "li", "kbd", "details", "summary", "svg", "path", "circle", "rect", "line",
    "polyline", "polygon", "ellipse", "g", "defs", "use", "clippath", "mask", "pattern",
    "lineargradient", "radialgradient", "stop", "symbol", "marker", "tspan"
]);

const _templateTokensCache = new Map();

function getCompiledTemplate(text) {
    let compiled = _templateTokensCache.get(text);
    if (compiled !== undefined) return compiled;

    if (/[?!=><+\-*/(),]/.test(text)) {
        if (_templateTokensCache.size > 1000) _templateTokensCache.clear();
        _templateTokensCache.set(text, null);
        return null;
    }

    const chunks = [];
    let lastIdx = 0;
    const len = text.length;
    let isPureSimple = true;

    for (let i = 0; i < len; i++) {
        if (text.charCodeAt(i) === 123) { // '{'
            const closeIdx = text.indexOf("}", i + 1);
            if (closeIdx === -1) {
                isPureSimple = false;
                break;
            }
            if (i > lastIdx) {
                chunks.push({ type: "static", val: text.slice(lastIdx, i) });
            }
            const rawInner = text.slice(i + 1, closeIdx).trim();
            if (!rawInner || /[?!=><+\-*/(),\[\]]/.test(rawInner)) {
                isPureSimple = false;
                break;
            }

            const dotIdx = rawInner.indexOf(".");
            if (dotIdx === -1) {
                chunks.push({ type: "token", isSimple: true, scope: rawInner, prop: "" });
            } else {
                const scope = rawInner.slice(0, dotIdx);
                const prop = rawInner.slice(dotIdx + 1);
                chunks.push({
                    type: "token",
                    isSimple: false,
                    scope,
                    prop,
                    parts: prop.includes(".") ? prop.split(".") : [prop]
                });
            }
            i = closeIdx;
            lastIdx = closeIdx + 1;
        }
    }

    if (!isPureSimple) {
        compiled = null;
    } else {
        if (lastIdx < len) {
            chunks.push({ type: "static", val: text.slice(lastIdx) });
        }
        compiled = chunks;
    }

    if (_templateTokensCache.size > 1000) _templateTokensCache.clear();
    _templateTokensCache.set(text, compiled);
    return compiled;
}

const EVENT_TAGS = new Set(["event", "on", "on_click", "on_change", "on_submit", "on_keyup", "on_keydown", "on_mouseenter", "on_mouseleave"]);

const METADATA_AND_EVENT_TAGS = new Set([
    "event", "on", "on_click", "on_change", "on_submit", "on_keyup", "on_keydown", 
    "on_mouseenter", "on_mouseleave", "on_interval", "on_timer", "on_mount", 
    "on_state_change", "on_visible", "on_update", "watch", "api_config", "api_endpoint", "endpoint", "api", 
    "persistence", "data_model", "imports", "constants", "vars", "variables",
    "use_script", "script_loader", "load_script", "use_style", "style_loader", "load_style",
    "actions", "action_def", "workflow_def", "animations", "animation_def", "keyframe_def", "keyframe", "animate", "transition"
]);

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const SVG_TAGS = new Set([
    "svg", "path", "g", "circle", "rect", "line", "polyline", "polygon", "ellipse", 
    "text", "tspan", "use", "defs", "clippath", "clipPath", "mask", "pattern", "image", 
    "foreignobject", "foreignObject", "lineargradient", "linearGradient", "radialgradient", 
    "radialGradient", "stop", "symbol", "marker"
]);

const BOOLEAN_ATTRS = new Set([
    "disabled", "checked", "readonly", "required", "autofocus", "hidden", 
    "selected", "multiple", "open", "novalidate", "reversed", "inert", 
    "allowfullscreen", "playsinline", "async", "defer", "loop", "muted", 
    "autoplay", "controls", "default", "ismap"
]);

const ACTION_DISPATCH_TABLE = {
    "SET_STATE": "_handleSetStateAction",
    "TOGGLE_STATE": "_handleToggleStateAction",
    "TOGGLE": "_handleToggleStateAction",
    "MUTATE_STATE": "_handleMutateStateAction",
    "REVALIDATE_API": "_handleRevalidateAction",
    "REVALIDATE": "_handleRevalidateAction",
    "FOCUS": "_handleFocusAction",
    "XHR": "handleXHR",
    "RUN_SCRIPT": "_handleRunScriptAction",
    "EVAL_JS": "_handleRunScriptAction",
    "EXEC_JS": "_handleRunScriptAction",
    "SCRIPT": "_handleRunScriptAction",
    "DELAY": "_handleDelay",
    "WAIT": "_handleDelay",
    "SLEEP": "_handleDelay",
    "TIMEOUT": "_handleTimeout",
    "RETRY": "_handleRetry",
    "TRY": "_handleTryCatchFinally",
    "RETHROW": "_handleRethrowAction",
    "THROW": "_handleThrowAction",
    "ANIMATE": "_handleAnimateAction",
    "TRANSITION": "_handleAnimateAction",
    "SET_TITLE": "_handleSetTitleAction"
};

/**
 * Action Composer Errors
 */
class EUIXActionRecursionError extends Error {
    constructor(message) {
        super(message);
        this.name = "EUIXActionRecursionError";
    }
}

class EUIXActionValidationError extends Error {
    constructor(message) {
        super(message);
        this.name = "EUIXActionValidationError";
    }
}

/**
 * EUIXXMLParseError
 * Line & column accurate error for EUIX Engine XML templates with visual code frame.
 */
class EUIXXMLParseError extends Error {
    constructor(message, line = 1, column = 1, codeFrame = "", sourceXml = "") {
        super(message);
        this.name = "EUIXXMLParseError";
        this.code = "XML_PARSE_ERROR";
        this.line = line;
        this.column = column;
        this.codeFrame = codeFrame;
        this.sourceXml = sourceXml;
        this.timestamp = new Date().toISOString();
    }
}

/**
 * EUIXStructuredError
 * Categorized, structured error object for EUIX Engine actions.
 */
class EUIXStructuredError extends Error {
    constructor({
        message = "An action execution error occurred",
        code = "ACTION_EXECUTION_ERROR",
        originatingAction = "UNKNOWN",
        status = null,
        request = null,
        component = null,
        cause = null,
        caller = null,
        sourceLocation = null
    } = {}) {
        super(message);
        this.name = "EUIXStructuredError";
        this.code = code;
        this.originatingAction = originatingAction;
        this.status = status;
        this.request = request;
        this.component = component;
        this.cause = cause;
        this.caller = caller;
        this.sourceLocation = sourceLocation;
        this.timestamp = new Date().toISOString();

        if (cause && cause.stack) {
            this.stack = cause.stack;
        }
    }

    static from(err, defaultInfo = {}) {
        if (err instanceof EUIXStructuredError) {
            if (defaultInfo.component && !err.component) err.component = defaultInfo.component;
            if (defaultInfo.originatingAction && (!err.originatingAction || err.originatingAction === "UNKNOWN")) {
                err.originatingAction = defaultInfo.originatingAction;
            }
            return err;
        }

        let code = defaultInfo.code || "ACTION_EXECUTION_ERROR";
        let message = (err && err.message) ? err.message : String(err || "Unknown error");
        let status = defaultInfo.status || (err && err.status) || null;
        let request = defaultInfo.request || (err && err.request) || null;

        if (err && err.name === "EUIXActionValidationError") {
            code = "VALIDATION_ERROR";
        } else if (err && err.name === "EUIXActionRecursionError") {
            code = "ACTION_RECURSION_ERROR";
        } else if (status || (code && code.startsWith("API_"))) {
            code = code || "API_HTTP_ERROR";
        }

        return new EUIXStructuredError({
            message,
            code,
            originatingAction: defaultInfo.originatingAction || "UNKNOWN",
            status,
            request,
            component: defaultInfo.component || null,
            cause: err instanceof Error ? err : null,
            caller: defaultInfo.caller || null,
            sourceLocation: defaultInfo.sourceLocation || null
        });
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            originatingAction: this.originatingAction,
            status: this.status,
            request: this.request,
            component: this.component,
            timestamp: this.timestamp
        };
    }
}



/**
 * EUIXActionContext
 * Scoped execution context for composed action invocations.
 */
class EUIXActionContext {
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

/**
 * EUIXActionValidator
 * Static and runtime validation rules for Action Composer.
 */
class EUIXActionValidator {
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

/**
 * EUIXActionRegistry
 * Central registry for pre-parsed action definitions.
 */
class EUIXActionRegistry {
    constructor() {
        this._actions = new Map();
    }

    register(name, xmlNodeOrObj) {
        if (!name || !isStr(name)) return null;
        const normalizedName = name.trim();

        let actionDef;
        if (xmlNodeOrObj && (xmlNodeOrObj.nodeType === 1 || xmlNodeOrObj.nodeType === 9)) {
            actionDef = EUIXActionRegistry.parseXmlActionDef(normalizedName, xmlNodeOrObj);
        } else if (isObj(xmlNodeOrObj)) {
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

        const returnNode = getChildNodes(xmlNode).find(n => isElem(n) && getTagName(n) === "return");
        if (returnNode) {
            returnExpr = trimStr(returnNode) || getAttr(returnNode, "value", "expr");
        }

        const childNodes = getChildNodes(xmlNode).filter(isElem);
        childNodes.forEach(child => {
            const tag = getTagName(child);
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

/**
 * EUIXActionComposer
 * Sequential execution engine for composed actions.
 */
class EUIXActionComposer {
    static async execute(actionDef, rawArgs = EMPTY_OBJ, engine = null, parentEventContext = EMPTY_OBJ) {
        const startTime = getNow();

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

        // Include any extra passed arguments not declared in params
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

        // Merged context for expression interpolation inside step handlers
        const mergedContext = {
            ...parentEventContext,
            args: invocationCtx.args,
            params: invocationCtx.args,
            result: invocationCtx.result,
            _actionCtx: invocationCtx
        };

        // 3. Validation (recursion loop, depth limit, missing required args)
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

            const endTime = getNow();
            const durationMs = Math.round((endTime - startTime) * 100) / 100;

            // DevTools logger hook
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

class EUIXEngineCore {
    static _installedPlugins = new Set();
    static _globalActionHandlers = new Map();
    static _componentAstCache = new Map();
    static _componentUrlCache = new Map();

    static clearComponentCache() {
        if (EUIXEngineCore._componentAstCache) EUIXEngineCore._componentAstCache.clear();
        if (EUIXEngineCore._componentUrlCache) EUIXEngineCore._componentUrlCache.clear();
    }

    static use(plugin) {
        if (!plugin) return EUIXEngineCore;
        if (EUIXEngineCore._installedPlugins.has(plugin)) return EUIXEngineCore;
        EUIXEngineCore._installedPlugins.add(plugin);

        if (isFn(plugin)) {
            plugin(EUIXEngineCore);
        } else if (plugin && isFn(plugin.install)) {
            plugin.install(EUIXEngineCore);
        }
        return EUIXEngineCore;
    }

    static registerAction(actionType, handler) {
        if (!EUIXEngineCore._globalActionHandlers) EUIXEngineCore._globalActionHandlers = new Map();
        if (actionType && isFn(handler)) {
            EUIXEngineCore._globalActionHandlers.set(String(actionType).toUpperCase(), handler);
        }
    }

    constructor(containerSelector) {
        this.container = typeof containerSelector === "string" 
            ? document.querySelector(containerSelector) 
            : containerSelector;
        this.state = null;
        this._rawState = null;
        this.xmlDoc = null;
        this._batching = false;
        this._pendingFocusKey = null;
        this._bindings = new Map();
        this._customComponents = new Map();
        this._customActions = new Map();
        this._componentSpecs = new Map();
        this.refs = {};
        this.onError = null;
        this.constants = new Map();
        this._stateWatchers = new Map();
        this._globalStateWatchers = [];
        this._persistenceConfig = new Map();
        this._pendingAsyncLoads = [];
        this._activeIntervals = [];
        this._apiConfig = {
            baseUrl: "",
            credentials: undefined,
            headers: new Map(),
            timeout: 0,
            onRequest: null,
            onResponse: null,
            revalidateFocus: false,
            revalidateOnline: false
        };
        this._registeredXhrs = new Set();
        this._xhrCache = new Map();
        if (!EUIXEngineCore._globalConstants) {
            EUIXEngineCore._globalConstants = new Map();
        }
        if (!EUIXEngineCore._globalComponentSpecs) {
            EUIXEngineCore._globalComponentSpecs = new Map();
        }
        this._actionRegistry = new EUIXActionRegistry();
        if (!EUIXEngineCore._globalActionRegistry) {
            EUIXEngineCore._globalActionRegistry = new EUIXActionRegistry();
        }
        this._maxActionDepth = 25;
        this._depGraph = null;
        this._computedRegistry = null;
        this._watchRegistry = null;
        this._isEvaluatingComputed = false;
        this._reactiveDepth = 0;
        this._setupStorageListener();
        this._initRevalidationListeners();
    }

    _initRevalidationListeners() {
        if (typeof window === "undefined" || this._revalidationBound) return;
        this._revalidationBound = true;

        const onRevalidateEvent = (evtType) => {
            if (!this._registeredXhrs || this._registeredXhrs.size === 0) return;
            this._registeredXhrs.forEach(item => {
                const shouldFocus = evtType === "focus" && (item.revalidateFocus || this._apiConfig.revalidateFocus);
                const shouldOnline = evtType === "online" && (item.revalidateOnline || this._apiConfig.revalidateOnline);

                if ((item.method === "GET" || item.method === "HEAD") && (shouldFocus || shouldOnline)) {
                    if (this._xhrCache && item.url) {
                        this._xhrCache.delete(item.url);
                    }
                    this.handleXHR(item.actionNode, item.context);
                }
            });
        };

        window.addEventListener("focus", () => onRevalidateEvent("focus"));
        window.addEventListener("online", () => onRevalidateEvent("online"));
    }

    revalidateApi(tagOrUrl = "") {
        const filter = String(tagOrUrl).trim();
        if (!this._registeredXhrs || this._registeredXhrs.size === 0) return this;
        if (this._isRevalidating) return this;

        this._isRevalidating = true;
        try {
            const targets = [];
            this._registeredXhrs.forEach(item => {
                const isGetOrHead = (item.method === "GET" || item.method === "HEAD");
                if (!filter) {
                    if (isGetOrHead) targets.push(item);
                } else {
                    const isExplicitUrlFilter = filter.includes("/");
                    const matchesTag = Boolean(item.tag && item.tag === filter);
                    const matchesUrl = (isGetOrHead || isExplicitUrlFilter) && Boolean(item.url && item.url.includes(filter));
                    if (matchesTag || matchesUrl) {
                        targets.push(item);
                    }
                }
            });

            targets.forEach(item => {
                if (this._xhrCache && item.url) {
                    this._xhrCache.delete(item.url);
                }
                this.handleXHR(item.actionNode, item.context);
            });
        } finally {
            this._isRevalidating = false;
        }

        return this;
    }

    async loadDataModel(urlOrObj) {
        if (typeof urlOrObj === "string") {
            try {
                if (typeof fetch === "undefined") return null;
                const res = await fetch(urlOrObj);
                const json = await res.json();
                if (typeof json === "object" && json !== null) {
                    this.batch(() => {
                        Object.entries(json).forEach(([k, v]) => this.setState(k, v));
                    });
                }
                return json;
            } catch (err) {
                this.reportError(err, `Failed to load data model from '${urlOrObj}'`);
                return null;
            }
        } else if (typeof urlOrObj === "object" && urlOrObj !== null) {
            this.batch(() => {
                Object.entries(urlOrObj).forEach(([k, v]) => this.setState(k, v));
            });
            return urlOrObj;
        }
    }

    async loadConstants(urlOrObj) {
        if (typeof urlOrObj === "string") {
            try {
                if (typeof fetch === "undefined") return null;
                const res = await fetch(urlOrObj);
                const json = await res.json();
                if (typeof json === "object" && json !== null) {
                    Object.entries(json).forEach(([k, v]) => this.registerConstant(k, String(v)));
                }
                return json;
            } catch (err) {
                this.reportError(err, `Failed to load constants from '${urlOrObj}'`);
                return null;
            }
        } else if (typeof urlOrObj === "object" && urlOrObj !== null) {
            Object.entries(urlOrObj).forEach(([k, v]) => this.registerConstant(k, String(v)));
            return urlOrObj;
        }
    }

    async preloadAsyncResources() {
        if (this._mountPromise) {
            await this._mountPromise;
        }
        if (this._pendingAsyncLoads && this._pendingAsyncLoads.length > 0) {
            await Promise.all(this._pendingAsyncLoads);
            this._pendingAsyncLoads = [];
        }
        return this;
    }

    unmount() {
        return this.destroy();
    }

    destroy() {
        this._isMounted = false;
        if (this._activeIntervals && this._activeIntervals.length > 0) {
            this._activeIntervals.forEach(id => clearInterval(id));
            this._activeIntervals = [];
        }
        if (this._bindings) {
            this._bindings.clear();
        }
        if (this._stateWatchers) {
            this._stateWatchers.clear();
        }
        if (this._globalStateWatchers) {
            this._globalStateWatchers = [];
        }
        if (this._watchRegistry) {
            this._watchRegistry.clear();
        }
        if (this._computedRegistry) {
            this._computedRegistry.clear();
        }
        if (this._activeAnimations) {
            this._activeAnimations.forEach(anim => anim.cancel && anim.cancel());
            this._activeAnimations.clear();
        }
        if (this._activeControllers) {
            this._activeControllers.forEach(ctrl => ctrl.cancel && ctrl.cancel());
            this._activeControllers.clear();
        }
        if (this._externalResources) {
            this._externalResources.forEach(res => res.dispose && res.dispose());
            this._externalResources.clear();
        }
        if (this.refs) {
            this.refs = {};
        }
        if (this.container) {
            this.container.innerHTML = "";
        }
        if (EUIXEngineCore.instance === this) {
            EUIXEngineCore.instance = null;
        }
        return this;
    }

    _getTestStats() {
        return {
            activeIntervals: this._activeIntervals ? this._activeIntervals.length : 0,
            activeWatchers: (this._stateWatchers ? this._stateWatchers.size : 0) + (this._watchRegistry ? this._watchRegistry.size : 0),
            activeSubscriptions: this._bindings ? this._bindings.size : 0,
            activeXhrs: this._registeredXhrs ? this._registeredXhrs.size : 0,
            mountedComponents: this._componentSpecs ? this._componentSpecs.size : 0,
            activeAnimations: this._activeAnimations ? this._activeAnimations.size : 0,
            activeControllers: this._activeControllers ? this._activeControllers.size : 0,
            activeResources: this._externalResources ? this._externalResources.size : 0
        };
    }

    getBindingsStats() {
        let totalBindings = 0;
        const uniqueElements = new Set();
        if (this._bindings) {
            for (const list of this._bindings.values()) {
                if (Array.isArray(list)) {
                    totalBindings += list.length;
                    list.forEach(item => {
                        if (item.el) uniqueElements.add(item.el);
                    });
                }
            }
        }
        return {
            totalBindings,
            uniqueElements: uniqueElements.size,
            registeredKeys: this._bindings ? this._bindings.size : 0
        };
    }

    getPerformanceMetrics() {
        const bindingsStats = this.getBindingsStats();
        return {
            mountDuration: this._mountDuration || 0,
            activeBindingsCount: bindingsStats.totalBindings,
            boundElementsCount: bindingsStats.uniqueElements,
            astCache: EUIXEngineCore.getAstCacheStats(),
            componentCache: {
                astCount: EUIXEngineCore._componentAstCache ? EUIXEngineCore._componentAstCache.size : 0,
                urlCount: EUIXEngineCore._componentUrlCache ? EUIXEngineCore._componentUrlCache.size : 0
            },
            expressionCacheSize: EUIXExpressionParser._cache ? EUIXExpressionParser._cache.size : 0,
            componentsCount: this._componentSpecs ? this._componentSpecs.size : 0,
            rawStateKeysCount: this._rawState ? Object.keys(this._rawState).length : 0,
            activeWatchersCount: (this._stateWatchers ? this._stateWatchers.size : 0) + (this._watchRegistry ? this._watchRegistry.size : 0),
            computedPropertiesCount: this._computedRegistry ? this._computedRegistry.size : 0,
            memory: (typeof performance !== "undefined" && performance.memory && performance.memory.usedJSHeapSize) ? {
                usedJSHeapSize: `${(performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(1)} MB`,
                totalJSHeapSize: `${(performance.memory.totalJSHeapSize / (1024 * 1024)).toFixed(1)} MB`
            } : null
        };
    }

    getProfilerData() {
        return this.getPerformanceMetrics();
    }

    configureApi(options = {}) {
        if (!isObj(options)) return this;
        if (options.baseUrl !== undefined) this._apiConfig.baseUrl = String(options.baseUrl).trim();
        if (options.credentials !== undefined) this._apiConfig.credentials = options.credentials;
        if (options.timeout !== undefined) this._apiConfig.timeout = parseInt(options.timeout, 10) || 0;
        if (isFn(options.onRequest)) this._apiConfig.onRequest = options.onRequest;
        if (isFn(options.onResponse)) this._apiConfig.onResponse = options.onResponse;
        
        if (isObj(options.headers)) {
            Object.entries(options.headers).forEach(([k, v]) => {
                this.setApiHeader(k, v);
            });
        }
        return this;
    }

    setApiHeader(name, value) {
        if (!name) return this;
        this._apiConfig.headers.set(String(name).trim(), String(value !== undefined ? value : "").trim());
        return this;
    }

    removeApiHeader(name) {
        if (!name) return this;
        this._apiConfig.headers.delete(String(name).trim());
        return this;
    }

    _setupStorageListener() {}

    persist(key, options) {
        return this;
    }

    clearPersistedState(key) {
        return this;
    }

    _savePersistedState(key, value) {}

    watch(key, callback) {
        if (!key || !isFn(callback)) return noop;
        const parsedKey = this.parseBindPath(key);
        if (!this._stateWatchers.has(parsedKey)) this._stateWatchers.set(parsedKey, []);
        this._stateWatchers.get(parsedKey).push(callback);
        return () => {
            const list = this._stateWatchers.get(parsedKey) || [];
            this._stateWatchers.set(parsedKey, list.filter(cb => cb !== callback));
        };
    }

    onStateChange(callback) {
        if (!isFn(callback)) return noop;
        this._globalStateWatchers.push(callback);
        return () => {
            this._globalStateWatchers = this._globalStateWatchers.filter(cb => cb !== callback);
        };
    }

    watchState(key, callback) {
        return this.watch(key, callback);
    }

    triggerStateWatchers(key, newValue, oldValue) {
        if (!this._reactiveDepth) this._reactiveDepth = 0;
        this._reactiveDepth++;

        if (this._reactiveDepth > 25) {
            this._reactiveDepth = 0;
            const err = new EUIXStructuredError({
                message: `Maximum watcher reaction depth (25) exceeded for path "${key}". Possible circular watcher cascade loop.`,
                code: "WATCHER_CYCLE_ERROR"
            });
            this.reportError(err, "Watcher Cycle Guard");
            throw err;
        }

        const isCycleError = (err) => {
            const msg = err && err.message ? err.message : "";
            const code = err && err.code ? err.code : "";
            return code === "WATCHER_CYCLE_ERROR" || code === "COMPUTED_CYCLE_ERROR" ||
                msg.includes("Infinite Loop Guard") || msg.includes("Maximum watcher reaction depth") ||
                msg.includes("Cascade limit exceeded");
        };

        try {
            if (this._globalStateWatchers && this._globalStateWatchers.length) {
                this._globalStateWatchers.forEach(cb => {
                    try { cb(key, newValue, oldValue); } catch (err) {
                        if (isCycleError(err)) throw err;
                        this.reportError(err, `onStateChange watcher error on "${key}"`);
                    }
                });
            }
            if (this._stateWatchers) {
                const watchContext = {
                    path: key,
                    $path: key,
                    newValue,
                    $newValue: newValue,
                    oldValue,
                    $oldValue: oldValue,
                    prevValue: oldValue,
                    $prevValue: oldValue
                };
                for (const [wKey, list] of this._stateWatchers.entries()) {
                    if (wKey === key || wKey.startsWith(key + ".") || key.startsWith(wKey + ".") || key.startsWith(wKey + "[")) {
                        list.forEach(cb => {
                            try { cb(newValue, oldValue, key, watchContext); } catch (err) {
                                if (isCycleError(err)) throw err;
                                this.reportError(err, `Watcher error on "${key}"`);
                            }
                        });
                    }
                }
            }
        } finally {
            this._reactiveDepth = Math.max(0, (this._reactiveDepth || 1) - 1);
        }
    }

    enableDevTools(autoOpen = false) {
        if (typeof window !== "undefined") {
            const devToolsClass = window.EUIXDevTools || (typeof EUIXDevTools !== "undefined" ? EUIXDevTools : null);
            if (devToolsClass && isFn(devToolsClass.init)) {
                const devtools = devToolsClass.init(this);
                if (devtools && autoOpen) devtools.toggle(true);
            }
        }
        return this;
    }

    static enableDevTools(autoOpen = false) {
        if (EUIXEngineCore.instance) {
            return EUIXEngineCore.instance.enableDevTools(autoOpen);
        }
        return null;
    }

    reportError(error, contextInfo = "") {
        const msg = error instanceof Error ? error.message : String(error);
        if (typeof console !== "undefined" && !EUIXEngineCore.silent && (typeof process === "undefined" || !process.env || process.env.NODE_ENV !== "test")) {
            console.warn(`[EUIXEngine Fallback] ${contextInfo ? contextInfo + ": " : ""}${msg}`);
        }
        if (isFn(this.onError)) {
            try {
                this.onError(error, contextInfo);
            } catch (_) {}
        }
    }

    static _astCache = new Map();
    static _astCacheMaxSize = 500;
    static _astCacheStats = { hits: 0, misses: 0 };

    static _cloneDocument(doc) {
        if (!doc) return null;
        try {
            if (typeof document !== "undefined" && document.implementation && isFn(document.implementation.createDocument)) {
                const cloned = document.implementation.createDocument(null, null, null);
                if (doc.documentElement) {
                    cloned.appendChild(cloned.importNode(doc.documentElement, true));
                }
                return cloned;
            }
            return doc.cloneNode(true);
        } catch (_) {
            return doc.cloneNode(true);
        }
    }

    static parseXmlToAst(xmlString, options = {}) {
        if (!xmlString || typeof xmlString !== "string") return null;

        // 1. Decode HTML named entities dynamically using native DOMParser text/html (zero dictionary / zero bundle bloat)
        let processedXml = xmlString;
        const entityMatches = Array.from(new Set(xmlString.match(/&([a-zA-Z0-9]+);/g) || []));
        if (entityMatches.length > 0 && typeof DOMParser !== "undefined") {
            const nonXmlEntities = entityMatches.filter(e => !["&amp;", "&lt;", "&gt;", "&quot;", "&apos;"].includes(e));
            if (nonXmlEntities.length > 0) {
                try {
                    const htmlDoc = new DOMParser().parseFromString(nonXmlEntities.join("___EUIX_ENT___"), "text/html");
                    const decodedList = (htmlDoc.body ? htmlDoc.body.textContent : "").split("___EUIX_ENT___");
                    nonXmlEntities.forEach((entity, idx) => {
                        const decoded = decodedList[idx];
                        if (decoded && decoded !== entity) {
                            processedXml = processedXml.replaceAll(entity, decoded);
                        }
                    });
                } catch (_) {}
            }
        }

        // 2. Remove stray closing tags for void elements & ensure self-closing for unclosed void tags
        processedXml = processedXml.replace(/<\/(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)>/gi, "");
        processedXml = processedXml.replace(/<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)(\s[^>]*?)?(?<!\/)>/gi, "<$1$2 />");

        // 3. Normalize bare/valueless boolean attributes inside tags (e.g. <button disabled> -> <button disabled="">)
        processedXml = processedXml.replace(/<([a-zA-Z0-9_\-]+)([^>]*?)(\/?)>/g, (match, tagName, attrsStr, selfClose) => {
            if (!attrsStr || !attrsStr.trim()) return match;
            let inQuotes = false;
            let quoteChar = "";
            let newAttrs = "";
            let i = 0;

            while (i < attrsStr.length) {
                const char = attrsStr[i];
                if (inQuotes) {
                    newAttrs += char;
                    if (char === quoteChar) inQuotes = false;
                    i++;
                    continue;
                }
                if (char === "\"" || char === "'") {
                    inQuotes = true;
                    quoteChar = char;
                    newAttrs += char;
                    i++;
                    continue;
                }
                if (/\s/.test(char)) {
                    newAttrs += char;
                    i++;
                    continue;
                }
                if (/[a-zA-Z0-9_\-:]/.test(char)) {
                    let name = "";
                    while (i < attrsStr.length && /[a-zA-Z0-9_\-:]/.test(attrsStr[i])) {
                        name += attrsStr[i];
                        i++;
                    }
                    let j = i;
                    while (j < attrsStr.length && /\s/.test(attrsStr[j])) j++;
                    if (j < attrsStr.length && attrsStr[j] === "=") {
                        newAttrs += name;
                    } else {
                        newAttrs += name + "=\"\"";
                    }
                    continue;
                }
                newAttrs += char;
                i++;
            }
            return "<" + tagName + newAttrs + (selfClose ? (newAttrs.endsWith(" ") ? "/>" : " />") : ">");
        });

        // 4. Escape < inside attribute values: ="..." or ='\''...'\''
        let sanitizedXml = processedXml.replace(/=("[^"]*"|'[^']*')/g, (match) => {
            return match.replace(/</g, "&lt;");
        });

        // 5. Escape remaining unescaped ampersands (e.g. raw "&&", "Tom & Jerry", URLs)
        sanitizedXml = sanitizedXml.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;");

        // 6. Auto-wrap raw script/action tags in CDATA if they contain unescaped code
        sanitizedXml = sanitizedXml.replace(/(<(?:on_click|on_mount|on_unmount|on_interval|on_state_change|step|script)[^>]*action=["']RUN_SCRIPT["'][^>]*>)([\s\S]*?)(<\/(?:on_click|on_mount|on_unmount|on_interval|on_state_change|step|script)>)/gi, (m, openTag, content, closeTag) => {
            if (content.includes("<![CDATA[")) return m;
            return openTag + "<![CDATA[" + content + "]]>" + closeTag;
        });

        const bypassCache = options && options.bypassCache === true;

        if (!bypassCache && EUIXEngineCore._astCache.has(sanitizedXml)) {
            EUIXEngineCore._astCacheStats.hits++;
            const cachedDoc = EUIXEngineCore._astCache.get(sanitizedXml);
            // Refresh LRU position (delete and re-insert)
            EUIXEngineCore._astCache.delete(sanitizedXml);
            EUIXEngineCore._astCache.set(sanitizedXml, cachedDoc);
            return EUIXEngineCore._cloneDocument(cachedDoc);
        }

        EUIXEngineCore._astCacheStats.misses++;
        const parser = new DOMParser();
        const doc = parser.parseFromString(sanitizedXml, "text/xml");

        const parseError = doc.querySelector("parsererror");
        if (parseError) {
            const errorText = parseError.textContent || "";
            const lineMatch = errorText.match(/line\s+(\d+)/i) || errorText.match(/:(\d+):/);
            const colMatch = errorText.match(/column\s+(\d+)/i) || errorText.match(/:(\d+):(\d+)/);
            const line = lineMatch ? parseInt(lineMatch[1], 10) : 1;
            const col = colMatch ? parseInt(colMatch[colMatch.length - 1], 10) : 1;
            const codeFrame = EUIXEngineCore.generateCodeFrame(xmlString, line, col);
            const msg = `[EUIX XML Parse Error] at line ${line}, column ${col}:\n${codeFrame || errorText}`;
            const err = new EUIXXMLParseError(msg, line, col, codeFrame, xmlString);
            if (options && options.silent === true) {
                // Return document if silent
            } else {
                throw err;
            }
        }

        if (!bypassCache && !parseError) {
            if (EUIXEngineCore._astCache.size >= EUIXEngineCore._astCacheMaxSize) {
                const oldestKey = EUIXEngineCore._astCache.keys().next().value;
                if (oldestKey !== undefined) {
                    EUIXEngineCore._astCache.delete(oldestKey);
                }
            }
            EUIXEngineCore._astCache.set(sanitizedXml, doc);
        }

        return EUIXEngineCore._cloneDocument(doc);
    }

    static generateCodeFrame(source, line = 1, col = 1, windowSize = 2) {
        if (!source || typeof source !== "string") return "";
        const lines = source.split("\n");
        const startLine = Math.max(1, line - windowSize);
        const endLine = Math.min(lines.length, line + windowSize);
        const gutterWidth = String(endLine).length;

        let frame = "";
        for (let i = startLine; i <= endLine; i++) {
            const lineContent = lines[i - 1] || "";
            const isTarget = i === line;
            const lineNumStr = String(i).padStart(gutterWidth, " ");
            if (isTarget) {
                frame += `> ${lineNumStr} | ${lineContent}\n`;
                if (col > 0) {
                    frame += `  ${" ".repeat(gutterWidth)} | ${" ".repeat(Math.max(0, col - 1))}^\n`;
                }
            } else {
                frame += `  ${lineNumStr} | ${lineContent}\n`;
            }
        }
        return frame;
    }

    static clearAstCache() {
        EUIXEngineCore._astCache.clear();
        EUIXEngineCore._astCacheStats = { hits: 0, misses: 0 };
    }

    static getAstCacheStats() {
        const total = EUIXEngineCore._astCacheStats.hits + EUIXEngineCore._astCacheStats.misses;
        const hitRatio = total > 0 ? (EUIXEngineCore._astCacheStats.hits / total) : 0;
        return {
            size: EUIXEngineCore._astCache.size,
            maxSize: EUIXEngineCore._astCacheMaxSize,
            hits: EUIXEngineCore._astCacheStats.hits,
            misses: EUIXEngineCore._astCacheStats.misses,
            hitRatio: parseFloat(hitRatio.toFixed(4))
        };
    }

    static setAstCacheSize(maxSize) {
        if (typeof maxSize === "number" && maxSize > 0) {
            EUIXEngineCore._astCacheMaxSize = maxSize;
            while (EUIXEngineCore._astCache.size > EUIXEngineCore._astCacheMaxSize) {
                const oldestKey = EUIXEngineCore._astCache.keys().next().value;
                if (oldestKey !== undefined) {
                    EUIXEngineCore._astCache.delete(oldestKey);
                } else {
                    break;
                }
            }
        }
    }

    static mount(xmlString, containerSelector = "#app", options = {}) {
        const engine = new EUIXEngineCore(containerSelector);
        EUIXEngineCore.instance = engine;
        engine.mount(xmlString, options);
        return engine;
    }

    static async mountAsync(xmlString, containerSelector = "#app", options = {}) {
        const engine = EUIXEngineCore.mount(xmlString, containerSelector, options);
        await engine.preloadAsyncResources();
        return engine;
    }

    static async loadComponent(name, url, options = {}) {
        try {
            if (!EUIXEngineCore._componentUrlCache) EUIXEngineCore._componentUrlCache = new Map();
            if (EUIXEngineCore._componentUrlCache.has(url)) {
                const cachedDoc = EUIXEngineCore._componentUrlCache.get(url);
                return EUIXEngineCore.registerComponentSpec(name, cachedDoc, options);
            }
            if (typeof fetch === "undefined") {
                console.error("[EUIXEngine] fetch is not available in this environment.");
                return null;
            }
            const isDev = typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
            const res = await fetch(url, isDev ? { cache: "no-cache" } : undefined);
            const xmlText = isFn(res.text) ? await res.text() : (typeof res === "string" ? res : String(res));
            
            const doc = EUIXEngineCore.parseXmlToAst(xmlText, options);
            if (EUIXEngineCore._componentUrlCache.size < 200) {
                EUIXEngineCore._componentUrlCache.set(url, doc);
            }

            const nestedImports = Array.from(doc.querySelectorAll("import"));
            for (const imp of nestedImports) {
                const impSrc = imp.getAttribute("src");
                const impName = imp.getAttribute("name") || imp.getAttribute("as");
                if (impSrc && impName) {
                    await EUIXEngineCore.loadComponent(impName, impSrc, options);
                }
            }

            return EUIXEngineCore.registerComponentSpec(name, doc, options);
        } catch (err) {
            console.error(`[EUIXEngine] Failed to load component from file ('${name}' -> '${url}'):`, err);
            return null;
        }
    }

    static registerComponentSpec(name, xmlStringOrNode, options = {}) {
        let node;
        if (typeof xmlStringOrNode === "string") {
            if (!EUIXEngineCore._componentAstCache) EUIXEngineCore._componentAstCache = new Map();
            let doc;
            if (EUIXEngineCore._componentAstCache.has(xmlStringOrNode)) {
                doc = EUIXEngineCore._componentAstCache.get(xmlStringOrNode);
            } else {
                doc = EUIXEngineCore.parseXmlToAst(xmlStringOrNode, options);
                if (EUIXEngineCore._componentAstCache.size < 200) {
                    EUIXEngineCore._componentAstCache.set(xmlStringOrNode, doc);
                }
            }

            const nestedDefs = Array.from(doc.querySelectorAll("component_def"));
            nestedDefs.forEach(def => {
                const defName = def.getAttribute("name") || def.getAttribute("id");
                if (defName && defName.toLowerCase() !== (name || "").toLowerCase()) {
                    EUIXEngineCore.registerComponentSpec(defName, def, options);
                }
            });

            node = doc.querySelector("component_def, uid_spec, flex, grid, layout") || doc.documentElement;
        } else if (xmlStringOrNode && (xmlStringOrNode.nodeType === 1 || xmlStringOrNode.nodeType === 9)) {
            if (xmlStringOrNode.nodeType === 1) {
                const tagName = xmlStringOrNode.tagName ? xmlStringOrNode.tagName.toLowerCase() : "";
                if (["component_def", "uid_spec", "flex", "grid", "layout"].includes(tagName)) {
                    node = xmlStringOrNode;
                } else {
                    node = xmlStringOrNode.querySelector("component_def, uid_spec, flex, grid, layout") || xmlStringOrNode;
                }
            } else {
                node = xmlStringOrNode.querySelector("component_def, uid_spec, flex, grid, layout") || xmlStringOrNode.documentElement;
            }

            const nestedDefs = Array.from(xmlStringOrNode.querySelectorAll("component_def"));
            nestedDefs.forEach(def => {
                const defName = def.getAttribute("name") || def.getAttribute("id");
                if (defName && defName.toLowerCase() !== (name || "").toLowerCase() && def !== node) {
                    EUIXEngineCore.registerComponentSpec(defName, def);
                }
            });
        } else {
            node = xmlStringOrNode;
        }

        const compName = (name || (node && node.getAttribute && node.getAttribute("name")) || (node && node.getAttribute && node.getAttribute("id")) || "").toLowerCase();
        if (compName && node) {
            if (!EUIXEngineCore._globalComponentSpecs) EUIXEngineCore._globalComponentSpecs = new Map();
            EUIXEngineCore._globalComponentSpecs.set(compName, node);

            if (!EUIXEngineCore._globalActionRegistry) EUIXEngineCore._globalActionRegistry = new EUIXActionRegistry();
            const actionDefNodes = Array.from(node.querySelectorAll ? node.querySelectorAll("action_def, workflow_def") : []);
            actionDefNodes.forEach(def => {
                const actName = def.getAttribute("name") || def.getAttribute("id");
                if (actName) {
                    EUIXEngineCore._globalActionRegistry.register(actName, def);
                }
            });
        }
        return compName;
    }

    async loadComponentFile(name, url) {
        const compName = await EUIXEngineCore.loadComponent(name, url);
        if (compName && EUIXEngineCore._globalComponentSpecs.has(compName)) {
            this._componentSpecs.set(compName, EUIXEngineCore._globalComponentSpecs.get(compName));
        }
        return compName;
    }

    registerComponentSpec(name, xmlStringOrNode) {
        const compName = EUIXEngineCore.registerComponentSpec(name, xmlStringOrNode);
        if (compName && EUIXEngineCore._globalComponentSpecs.has(compName)) {
            const specNode = EUIXEngineCore._globalComponentSpecs.get(compName);
            this._componentSpecs.set(compName, specNode);

            if (!this._actionRegistry) this._actionRegistry = new EUIXActionRegistry();
            const actionDefNodes = Array.from(specNode.querySelectorAll ? specNode.querySelectorAll("action_def, workflow_def") : []);
            actionDefNodes.forEach(def => {
                const actName = def.getAttribute("name") || def.getAttribute("id");
                if (actName) {
                    this._actionRegistry.register(actName, def);
                }
            });
        }
        return compName;
    }

    static registerActionDef(name, xmlNodeOrObj) {
        if (!EUIXEngineCore._globalActionRegistry) EUIXEngineCore._globalActionRegistry = new EUIXActionRegistry();
        return EUIXEngineCore._globalActionRegistry.register(name, xmlNodeOrObj);
    }

    registerActionDef(name, xmlNodeOrObj) {
        if (!this._actionRegistry) this._actionRegistry = new EUIXActionRegistry();
        const def = this._actionRegistry.register(name, xmlNodeOrObj);
        EUIXEngineCore.registerActionDef(name, xmlNodeOrObj);
        return def;
    }

    hasActionDef(name) {
        if (!name) return false;
        const normalized = String(name).trim();
        return (this._actionRegistry && this._actionRegistry.has(normalized)) ||
            (EUIXEngineCore._globalActionRegistry && EUIXEngineCore._globalActionRegistry.has(normalized));
    }

    getActionDef(name) {
        if (!name) return undefined;
        const normalized = String(name).trim();
        if (this._actionRegistry && this._actionRegistry.has(normalized)) {
            return this._actionRegistry.get(normalized);
        }
        if (EUIXEngineCore._globalActionRegistry && EUIXEngineCore._globalActionRegistry.has(normalized)) {
            return EUIXEngineCore._globalActionRegistry.get(normalized);
        }
        return undefined;
    }

    async executeAction(actionName, args = {}, context = {}) {
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
    }

    initActionRegistry() {
        if (!this._actionRegistry) this._actionRegistry = new EUIXActionRegistry();
        if (!EUIXEngineCore._globalActionRegistry) EUIXEngineCore._globalActionRegistry = new EUIXActionRegistry();

        if (!this.xmlDoc) return;
        const actionDefNodes = Array.from(this.xmlDoc.querySelectorAll("action_def, workflow_def"));
        actionDefNodes.forEach(node => {
            const name = node.getAttribute("name") || node.getAttribute("id");
            if (name) {
                this._actionRegistry.register(name, node);
                EUIXEngineCore._globalActionRegistry.register(name, node);
            }
        });
    }

    _extractActionArgs(actionNode, context = {}) {
        const args = {};

        if (actionNode.attributes) {
            Array.from(actionNode.attributes).forEach(attr => {
                const attrName = attr.name;
                if (["action", "name", "action_name", "class", "id"].includes(attrName)) return;

                let key = attrName;
                if (key.startsWith("arg-") || key.startsWith("param-")) {
                    key = key.slice(4);
                }
                args[key] = this.interpolate(attr.value, context);
            });
        }

        const argNodes = [
            ...this.getChildren(actionNode, "arg"),
            ...this.getChildren(actionNode, "param"),
            ...this.getChildren(actionNode, "argument")
        ];

        argNodes.forEach(node => {
            const name = node.getAttribute("name") || node.getAttribute("id");
            if (name) {
                const rawVal = node.getAttribute("value") || node.textContent.trim();
                args[name] = this.interpolate(rawVal, context);
            }
        });

        return args;
    }

    static autoInit() {
        if (typeof document === "undefined") return;
        const scripts = document.querySelectorAll('script[type="application/euix"], script[type="text/euix"], script[data-euix-app], euix-app');
        scripts.forEach(script => {
            if (script.closest && script.closest('code, pre, [data-euix-example], .no-auto-init')) return;
            if (script.dataset?.euixAutoInitialized) return;
            if (script.dataset) script.dataset.euixAutoInitialized = "true";
            const targetSelector = script.getAttribute("target") || script.dataset?.target || "#app";
            const xml = (script.tagName.toLowerCase() === "euix-app" ) ? script.innerHTML.trim() : script.textContent.trim();
            if (xml) {
                const engine = EUIXEngineCore.mount(xml, targetSelector);
                if (engine) {
                    engine.enableDevTools(false);
                }
            }
        });
    }

    getChild(node, tagName) {
        if (!node) return null;
        const tag = tagName.toLowerCase();
        const list = (node.children && node.children.length > 0) 
            ? getChildrenList(node)
            : getChildNodes(node).filter(isElem);
        return list.find(c => getTagName(c) === tag) || null;
    }

    getChildren(node, tagName) {
        if (!node) return [];
        const list = (node.children && node.children.length > 0) 
            ? getChildrenList(node)
            : getChildNodes(node).filter(isElem);
        if (!tagName) return list;
        const tag = tagName.toLowerCase();
        return list.filter(c => getTagName(c) === tag);
    }

    registerComponent(type, handler) {
        if (isStr(type) && isFn(handler)) {
            this._customComponents.set(type, handler);
        }
    }

    registerAction(actionType, handler) {
        if (isStr(actionType) && isFn(handler)) {
            this._customActions.set(actionType, handler);
        }
    }

    batch(fn) {
        const wasBatching = this._batching;
        this._batching = true;
        try {
            fn();
        } finally {
            this._batching = wasBatching;
            if (!wasBatching) {
                if (this._rawState) {
                    Object.keys(this._rawState).forEach(key => {
                        this.syncBindings(key, this._rawState[key]);
                    });
                }
            }
        }
    }

    static escapeRegExp(str) {
        if (!str) return "";
        return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    escapeRegExp(str) {
        return EUIXEngineCore.escapeRegExp(str);
    }

    parseBindPath(expr) {
        if (!expr) return "";
        return String(expr)
            .trim()
            .replace(/^\{\s*(?:data|global|\$global|local|\$local|state)\.([a-zA-Z0-9_.[\]]+)\s*\}$/, "$1")
            .replace(/^(?:data|global|\$global|state)\./, "")
            .replace(/^\{\s*|\s*\}$/g, "");
    }

    extractStateKeys(expr) {
        if (!expr) return [];
        const keys = new Set();
        const matches = expr.match(/(?:data|local|\$local|api|\$api)\.([a-zA-Z0-9_.[\]]+)/g) || [];
        matches.forEach(m => {
            const clean = m.replace(/^(?:data|local|\$local|api|\$api)\./, "");
            const rootKey = getRootKey(clean);
            keys.add(clean);
            if (rootKey) keys.add(rootKey);
            const innerBracketMatches = clean.match(/\[(?:data\.)?([a-zA-Z0-9_]+)\]/g) || [];
            innerBracketMatches.forEach(bm => {
                const innerKey = bm.replace(/[[\]]|data\./g, "");
                if (!/^\d+$/.test(innerKey)) keys.add(innerKey);
            });
            if (m.startsWith("api.") || m.startsWith("$api.")) {
                const parts = clean.split(".");
                const epId = parts[0];
                const epProp = parts[1];
                if (epProp) keys.add(`api:${epId}:${epProp}`);
                keys.add(`api:${epId}`);
            }
        });
        const plainMatches = expr.match(/\{(\w+)\}/g) || [];
        plainMatches.forEach(m => keys.add(m.replace(/^\{|\}$/g, "")));
        return Array.from(keys);
    }

    isTruthy(value) {
        return value === true || value === "true" || value === 1 || value === "1";
    }

    resolveBinding(xmlNode, context = {}) {
        const bindAttr = xmlNode.getAttribute("bind");
        if (bindAttr) {
            const raw = String(bindAttr).trim().replace(/^\{\s*|\s*\}$/g, "");
            if (raw.startsWith("data.")) {
                return { type: "state", path: raw.slice(5) };
            }
            const ctxMatch = raw.match(/^(\w+)\.(\w+)$/);
            if (ctxMatch && context[ctxMatch[1]] && typeof context[ctxMatch[1]] === "object") {
                return { type: "context", scope: ctxMatch[1], prop: ctxMatch[2] };
            }
            return { type: "state", path: this.parseBindPath(raw) };
        }

        const path = this.resolveBindPath(xmlNode);
        return path ? { type: "state", path } : null;
    }

    getBindingValue(binding, context = {}) {
        if (!binding) return undefined;
        if (binding.type === "state") return this.getState(binding.path);
        return context[binding.scope] ? context[binding.scope][binding.prop] : undefined;
    }

    setBindingValue(binding, value, context = {}, options = {}) {
        if (!binding) return;
        if (binding.type === "state") {
            this.setState(binding.path, value, options);
            return;
        }
        if (context[binding.scope] && typeof context[binding.scope] === "object") {
            context[binding.scope][binding.prop] = value;
            if (!options.silent && !this._batching) {
                this.syncBindings(binding.scope, context[binding.scope]);
                if (context._parentStateKey) {
                    this.syncBindings(context._parentStateKey, this.getState(context._parentStateKey));
                }
            }
        }
    }

    escapeHtml(text) {
        return String(text)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    getState(key) {
        if (!key || !this._rawState) return undefined;
        let strKey = String(key);
        if (strKey.includes("[") && strKey.includes("]")) {
            strKey = strKey.replace(/\[\s*(?:data\.)?([a-zA-Z0-9_]+)\s*\]/g, (m, k) => {
                if (/^\d+$/.test(k)) return `[${k}]`;
                const v = this._rawState ? this._rawState[k] : undefined;
                return v !== undefined ? `[${v}]` : m;
            });
        }
        const cleanKey = strKey.replace(/^(data|state|computed)\./, "");
        if (this._computedRegistry && this._computedRegistry.has(cleanKey)) {
            return this.getComputed(cleanKey);
        }
        let val = (this._rawState && this._rawState[cleanKey] !== undefined) ? this._rawState[cleanKey] : (this._rawState ? this._rawState[key] : undefined);
        const parsedKey = this.parseBindPath(key);
        if (val === undefined && (parsedKey.includes(".") || parsedKey.includes("["))) {
            const parts = splitPath(parsedKey);
            let curr = this._rawState ? this._rawState[parts[0]] : undefined;
            for (let i = 1; i < parts.length && curr !== undefined && curr !== null; i++) {
                curr = curr[parts[i]];
            }
            if (curr !== undefined) val = curr;
        }
        return val;
    }

    resolveValueFromPath(path, context = {}) {
        if (!path) return undefined;

        if (typeof path === "string" && path.includes("[")) {
            path = path.replace(/\[\s*([^\]]+)\s*\]/g, (m, innerKey) => {
                const trimmed = innerKey.trim().replace(/^['"]|['"]$/g, "");
                if (/^\d+$/.test(trimmed)) return `.${trimmed}`;
                const innerVal = this.resolveValueFromPath(trimmed, context);
                return innerVal !== undefined ? `.${innerVal}` : m;
            });
        }

        if (path.startsWith("computed.")) {
            return this.getComputed(path.slice(9));
        }
        if (this._computedRegistry && this._computedRegistry.has(path)) {
            return this.getComputed(path);
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
            return this.getState(key);
        }
        if (path.startsWith("api.") || path.startsWith("$api.")) {
            const clean = path.replace(/^(\$api|api)\./, "");
            const parts = clean.split(".");
            const endpointId = parts[0];
            const prop = parts.slice(1).join(".");
            const status = isFn(this.getApiStatus) ? this.getApiStatus(endpointId) : (this._apiStatus && this._apiStatus[endpointId]);
            if (!status) return undefined;
            if (!prop) return status;
            return prop.split(".").reduce((acc, p) => (acc ? acc[p] : undefined), status);
        }
        if (path.startsWith("data.") || path.startsWith("state.")) {
            const cleanKey = path.replace(/^(data|state)\./, "");
            if (context._localState && context._localState[cleanKey] !== undefined) {
                return context._localState[cleanKey];
            }
            return this.getState(cleanKey);
        }
        if (path.startsWith("constants.") || path.startsWith("const.")) {
            const key = path.replace(/^(constants|const)\./, "");
            if (context && context.constants && context.constants[key] !== undefined) {
                return context.constants[key];
            }
            return this.getConstant(key);
        }
        if (path.startsWith("vars.")) {
            const key = path.replace(/^vars\./, "");
            if (context && context.constants && context.constants[key] !== undefined) {
                return context.constants[key];
            }
            return this.getConstant(key);
        }
        if (path.startsWith("args.") || path.startsWith("params.")) {
            const key = path.replace(/^(args|params)\./, "");
            const argsObj = context.args || context.params || {};
            return argsObj[key];
        }
        if (path.startsWith("err.") || path.startsWith("error.")) {
            const key = path.replace(/^(err|error)\./, "");
            const errObj = context.err || context.error;
            return (errObj && typeof errObj === "object") ? errObj[key] : undefined;
        }
        if (path.startsWith("result.")) {
            const key = path.slice(7);
            return (context.result && typeof context.result === "object") ? context.result[key] : undefined;
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
        const constVal = this.getConstant(path);
        if (constVal !== undefined) return constVal;
        return this.getState(path);
    }

    batchUpdates(fn) {
        if (!isFn(fn)) return;
        const wasBatching = this._isBatching;
        this._isBatching = true;
        try {
            fn();
        } finally {
            this._isBatching = wasBatching;
            if (!wasBatching) {
                this.flushStateUpdates();
            }
        }
    }

    flushStateUpdates() {
        if (!this._pendingBatchChanges || this._pendingBatchChanges.size === 0) return;
        const pending = Array.from(this._pendingBatchChanges.values());
        this._pendingBatchChanges.clear();

        const allAffected = new Set();
        const invalidateComputed = (changedKey) => {
            const affected = this._depGraph ? this._depGraph.getAffectedComputed(changedKey) : new Set();
            affected.forEach(cId => {
                allAffected.add(cId);
                const cNode = this._computedRegistry ? this._computedRegistry.get(cId) : null;
                if (cNode && !cNode.isDirty) {
                    cNode.isDirty = true;
                    invalidateComputed(cId);
                    invalidateComputed("computed." + cId);
                }
            });
        };

        const executedFns = new Set();
        const syncedPaths = new Set();

        for (let i = 0; i < pending.length; i++) {
            const { key, value, sourceEl } = pending[i];
            invalidateComputed(key);
            this.syncBindings(key, value, sourceEl, executedFns);
            syncedPaths.add(key);
            if (key.includes(".")) {
                const rootKey = key.split(".")[0];
                if (!syncedPaths.has(rootKey)) {
                    this.syncBindings(rootKey, this._rawState[rootKey], sourceEl, executedFns);
                    this.syncBindings("data." + rootKey, this._rawState[rootKey], sourceEl, executedFns);
                    syncedPaths.add(rootKey);
                }
                this.syncBindings("data." + key, value, sourceEl, executedFns);
            }
        }

        allAffected.forEach(cId => {
            const cNode = this._computedRegistry ? this._computedRegistry.get(cId) : null;
            if (cNode) {
                const cVal = cNode.evaluate();
                this.syncBindings("computed." + cId, cVal, null);
                this.syncBindings(cId, cVal, null);
            }
        });

        pending.forEach(({ key, value, oldValue, silent, context }) => {
            if (!silent) {
                this.triggerStateWatchers(key, value, oldValue);
                if (isFn(this._triggerReactiveWatchers)) {
                    this._triggerReactiveWatchers(key, value, oldValue, context);
                }
            }
        });
    }

    setStates(obj, options = {}) {
        return this.setState(obj, null, options);
    }

    setState(key, value, options = {}) {
        if (typeof key === "object" && key !== null && !Array.isArray(key)) {
            this.batch(() => {
                Object.entries(key).forEach(([k, v]) => {
                    this.setState(k, v, options);
                });
            });
            return;
        }

        const opts = (isBool(options) ? { silent: options } : options) || {};
        const { silent = false, sourceEl = null, context = null, batch = false } = opts;
        if (!key || !isStr(key)) return;
        if (!this._rawState) return;

        if (this._isEvaluatingComputed) {
            const err = new EUIXStructuredError({
                message: `State mutation prohibited inside computed getter (key: "${key}"). Computed properties must be deterministic and side-effect free.`,
                code: "COMPUTED_MUTATION_ERROR"
            });
            this.reportError(err, "Computed Mutation Guard");
            throw err;
        }

        if (this._computedRegistry && this._computedRegistry.has(key)) {
            const err = new EUIXStructuredError({
                message: `Cannot mutate read-only computed property '${key}'`,
                code: "COMPUTED_MUTATION_ERROR"
            });
            this.reportError(err, "Computed Mutation Guard");
            throw err;
        }

        const ctxSignal = (context && context._cancellationSignal) ||
            (this._currentActionContext && this._currentActionContext._cancellationSignal);
        if (ctxSignal && ctxSignal.isCancelled) {
            return;
        }

        this._updateDepth = (this._updateDepth || 0) + 1;
        if (this._updateDepth > (this._maxUpdateDepth || 50)) {
            const currentDepth = this._updateDepth;
            this._updateDepth = 0;
            const err = new Error(`[EUIXEngine Infinite Loop Guard] Cascade limit exceeded (${currentDepth} updates) on state key "${key}". Possible circular state reactivity loop.`);
            this.reportError(err, "Infinite Loop Guard");
            throw err;
        }

        const markStart = `euix:setState:${key}:start`;
        const markEnd = `euix:setState:${key}:end`;
        if (typeof performance !== "undefined" && performance.mark) {
            try { performance.mark(markStart); } catch (_) {}
        }

        try {
            const oldValue = this._rawState[key];
            this._rawState[key] = value;

            if (key.includes(".") || key.includes("[")) {
                const parts = splitPath(key);
                const firstPart = parts[0];
                let curr = this._rawState[firstPart];
                if (typeof curr !== "object" || curr === null) {
                    curr = /^\d+$/.test(parts[1]) ? [] : {};
                    this._rawState[firstPart] = curr;
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

            this._savePersistedState(key, value);
            if (this._devtools && this._devtools.enabled && !silent) {
                this._devtools.logAction("setState", { path: key, value });
            }

            if (this._isBatching || batch) {
                this._pendingBatchChanges = this._pendingBatchChanges || new Map();
                this._pendingBatchChanges.set(key, { key, value, oldValue, silent, sourceEl, context });
                if (typeof queueMicrotask === "function" && !this._microtaskScheduled) {
                    this._microtaskScheduled = true;
                    queueMicrotask(() => {
                        this._microtaskScheduled = false;
                        this.flushStateUpdates();
                    });
                }
                return;
            }

            const allAffected = new Set();
            const invalidateComputed = (changedKey) => {
                const affected = this._depGraph ? this._depGraph.getAffectedComputed(changedKey) : new Set();
                affected.forEach(cId => {
                    allAffected.add(cId);
                    const cNode = this._computedRegistry ? this._computedRegistry.get(cId) : null;
                    if (cNode && !cNode.isDirty) {
                        cNode.isDirty = true;
                        invalidateComputed(cId);
                        invalidateComputed("computed." + cId);
                    }
                });
            };
            invalidateComputed(key);

            this.syncBindings(key, value, sourceEl);
            if (key.includes(".")) {
                const rootKey = key.split(".")[0];
                this.syncBindings(rootKey, this._rawState[rootKey], sourceEl);
                this.syncBindings("data." + rootKey, this._rawState[rootKey], sourceEl);
                this.syncBindings("data." + key, value, sourceEl);
            }

            allAffected.forEach(cId => {
                const cNode = this._computedRegistry ? this._computedRegistry.get(cId) : null;
                if (cNode) {
                    const cVal = cNode.evaluate();
                    this.syncBindings("computed." + cId, cVal, sourceEl);
                    this.syncBindings(cId, cVal, sourceEl);
                }
            });

            if (!silent) {
                this.triggerStateWatchers(key, value, oldValue);
                if (isFn(this._triggerReactiveWatchers)) {
                    this._triggerReactiveWatchers(key, value, oldValue, context);
                }
            }
        } finally {
            this._updateDepth = Math.max(0, (this._updateDepth || 1) - 1);
            if (typeof performance !== "undefined" && performance.mark && performance.measure) {
                try {
                    performance.mark(markEnd);
                    performance.measure(`⚡ EUIX setState (${key})`, markStart, markEnd);
                } catch (_) {}
            }
        }
    }

    toggleState(key) {
        const currentVal = this.getState(key);
        this.setState(key, !currentVal);
        return this.getState(key);
    }

    mutateState(key, operation, payload = {}) {
        const cleanKey = String(key || "").replace(/^(data|state)\./, "");
        if (!cleanKey || !operation) return;
        const op = String(operation).toUpperCase();
        const current = Array.isArray(this.getState(cleanKey)) ? [...this.getState(cleanKey)] : [];

        if (op === "CLEAR" || op === "EMPTY" || op === "RESET") {
            this.setState(cleanKey, []);
            return [];
        }
        if (op === "PUSH" || op === "APPEND") {
            const item = (payload && typeof payload === "object" && payload.item !== undefined) ? payload.item : payload;
            current.push(item);
            this.setState(cleanKey, current);
            return current;
        }
        if (op === "UNSHIFT" || op === "PREPEND") {
            const item = (payload && typeof payload === "object" && payload.item !== undefined) ? payload.item : payload;
            current.unshift(item);
            this.setState(cleanKey, current);
            return current;
        }
        if (op === "POP") {
            current.pop();
            this.setState(cleanKey, current);
            return current;
        }
        if (op === "SHIFT") {
            current.shift();
            this.setState(cleanKey, current);
            return current;
        }
        if (op === "REMOVE" || op === "DELETE") {
            let updated;
            if (payload && payload.where) {
                const { field, equals } = payload.where;
                updated = current.filter(item => item && String(item[field]) !== String(equals));
            } else if (payload && payload.index !== undefined) {
                updated = current.filter((_, idx) => idx !== Number(payload.index));
            } else {
                updated = current.filter(item => item !== payload);
            }
            this.setState(cleanKey, updated);
            return updated;
        }
        if (op === "INSERT") {
            const idx = Number(payload.index || 0);
            const item = (payload && typeof payload === "object" && payload.item !== undefined) ? payload.item : payload;
            current.splice(idx, 0, item);
            this.setState(cleanKey, current);
            return current;
        }
        if (op === "UPDATE") {
            if (payload && payload.where) {
                const { field, equals } = payload.where;
                const updated = current.map(item => {
                    if (item && String(item[field]) === String(equals)) {
                        return (typeof payload.value === "object") ? { ...item, ...payload.value } : payload.value;
                    }
                    return item;
                });
                this.setState(cleanKey, updated);
                return updated;
            }
        }
        if (op === "SWAP") {
            const idx1 = Number(payload.index1);
            const idx2 = Number(payload.index2);
            if (!isNaN(idx1) && !isNaN(idx2) && idx1 >= 0 && idx2 >= 0 && idx1 < current.length && idx2 < current.length) {
                const temp = current[idx1];
                current[idx1] = current[idx2];
                current[idx2] = temp;
                this.setState(cleanKey, current);
            }
            return current;
        }
    }

    registerBinding(path, el, kind, updateFn = null) {
        if (!path || !el) return;
        if (!this._bindings.has(path)) this._bindings.set(path, []);
        this._bindings.get(path).push({ el, kind, updateFn });
        if (el.dataset) {
            el.dataset.xuiKey = path;
            el.dataset.xuiBind = kind;
        }
    }

    syncBindings(path, value, sourceEl = null, executedFns = null) {
        const list = this._bindings.get(path);
        if (!list || list.length === 0) return;
        const text = value === undefined || value === null ? "" : String(value);

        let hasDeadNodes = false;
        for (let i = 0; i < list.length; i++) {
            const item = list[i];
            const { el, kind, updateFn } = item;

            if (this._isMounted && el && el.isConnected === false) {
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
                this.updateAttributeBinding(el, attrName, template);
                continue;
            }

            if (!el || el === sourceEl) continue;

            if (kind === "input") {
                if (el.value !== text) el.value = text;
                continue;
            }

            if (kind === "checkbox") {
                el.checked = this.isTruthy(text);
                continue;
            }

            if (kind === "radio") {
                el.checked = (String(el.value || "") === text);
                continue;
            }

            if (kind === "multi_template") {
                const template = el.dataset.euixMultiTemplate;
                if (template) {
                    el.textContent = this.interpolate(template);
                }
                continue;
            }

            if (kind === "text") {
                const htmlTemplate = el.dataset.euixHtmlTemplate || el.dataset.xuiHtmlTemplate;
                const textTemplate = el.dataset.euixTextTemplate || el.dataset.xuiTextTemplate;
                if (htmlTemplate) {
                    el.innerHTML = htmlTemplate.replace(/\{\s*value\s*\}/g, this.escapeHtml(text));
                } else if (textTemplate) {
                    el.textContent = textTemplate.replace(/\{\s*value\s*\}/g, text);
                } else {
                    el.textContent = text;
                }
            }
        }

        if (hasDeadNodes) {
            const alive = list.filter(item => !item.el || item.el.isConnected !== false);
            if (alive.length === 0) {
                this._bindings.delete(path);
            } else {
                this._bindings.set(path, alive);
            }
        }
    }

    applyLayoutStyles(el, xmlNode, context) {
        if (xmlNode._staticLayoutStyle !== undefined) {
            if (xmlNode._staticLayoutStyle) {
                const s = xmlNode._staticLayoutStyle;
                if (s.flexDirection) el.style.flexDirection = s.flexDirection;
                if (s.alignItems) el.style.alignItems = s.alignItems;
                if (s.justifyContent) el.style.justifyContent = s.justifyContent;
                if (s.gap) el.style.gap = s.gap;
                if (s.columnGap) el.style.columnGap = s.columnGap;
                if (s.rowGap) el.style.rowGap = s.rowGap;
                if (s.flexWrap) el.style.flexWrap = s.flexWrap;
                if (s.gridTemplateColumns) el.style.gridTemplateColumns = s.gridTemplateColumns;
                if (s.gridTemplateRows) el.style.gridTemplateRows = s.gridTemplateRows;
                if (s.cssText) el.style.cssText += ";" + s.cssText;
            }
            return;
        }

        const isFlex = el.style.display === "flex";
        let isDynamic = false;
        const staticStyle = {};

        const dir = xmlNode.getAttribute("direction") || xmlNode.getAttribute("dir");
        if (dir) {
            if (dir.includes("{")) {
                isDynamic = true;
                el.style.flexDirection = this.interpolate(dir, context).trim();
            } else {
                el.style.flexDirection = dir;
                staticStyle.flexDirection = dir;
            }
        }

        const alignMap = {
            start: "flex-start",
            end: "flex-end",
            center: "center",
            stretch: "stretch",
            baseline: "baseline"
        };
        const align = xmlNode.getAttribute("align");
        if (align) {
            if (align.includes("{")) {
                isDynamic = true;
                const val = this.interpolate(align, context).trim().toLowerCase();
                el.style.alignItems = alignMap[val] || val;
            } else {
                const val = align.toLowerCase();
                const v = alignMap[val] || val;
                el.style.alignItems = v;
                staticStyle.alignItems = v;
            }
        }

        const justifyMap = {
            start: "flex-start",
            end: "flex-end",
            center: "center",
            between: "space-between",
            around: "space-around",
            evenly: "space-evenly",
            stretch: "stretch"
        };
        const justify = xmlNode.getAttribute("justify");
        if (justify) {
            if (justify.includes("{")) {
                isDynamic = true;
                const val = this.interpolate(justify, context).trim().toLowerCase();
                el.style.justifyContent = justifyMap[val] || val;
            } else {
                const val = justify.toLowerCase();
                const v = justifyMap[val] || val;
                el.style.justifyContent = v;
                staticStyle.justifyContent = v;
            }
        }

        const gap = xmlNode.getAttribute("gap");
        if (gap) {
            if (gap.includes("{")) {
                isDynamic = true;
                const val = this.interpolate(gap, context).trim();
                el.style.gap = /^\d+$/.test(val) ? val + "px" : val;
            } else {
                const v = /^\d+$/.test(gap) ? gap + "px" : gap;
                el.style.gap = v;
                staticStyle.gap = v;
            }
        }

        const gapX = xmlNode.getAttribute("gap_x") || xmlNode.getAttribute("col_gap");
        if (gapX) {
            if (gapX.includes("{")) {
                isDynamic = true;
                const val = this.interpolate(gapX, context).trim();
                el.style.columnGap = /^\d+$/.test(val) ? val + "px" : val;
            } else {
                const v = /^\d+$/.test(gapX) ? gapX + "px" : gapX;
                el.style.columnGap = v;
                staticStyle.columnGap = v;
            }
        }

        const gapY = xmlNode.getAttribute("gap_y") || xmlNode.getAttribute("row_gap");
        if (gapY) {
            if (gapY.includes("{")) {
                isDynamic = true;
                const val = this.interpolate(gapY, context).trim();
                el.style.rowGap = /^\d+$/.test(val) ? val + "px" : val;
            } else {
                const v = /^\d+$/.test(gapY) ? gapY + "px" : gapY;
                el.style.rowGap = v;
                staticStyle.rowGap = v;
            }
        }

        const wrap = xmlNode.getAttribute("wrap");
        if (wrap) {
            if (wrap.includes("{")) {
                isDynamic = true;
                const val = this.interpolate(wrap, context).trim();
                if (isFlex) {
                    el.style.flexWrap = (val === "true" || val === "wrap") ? "wrap" : "nowrap";
                }
            } else {
                if (isFlex) {
                    const v = (wrap === "true" || wrap === "wrap") ? "wrap" : "nowrap";
                    el.style.flexWrap = v;
                    staticStyle.flexWrap = v;
                }
            }
        }

        const cols = xmlNode.getAttribute("cols") || xmlNode.getAttribute("columns");
        if (cols) {
            if (cols.includes("{")) {
                isDynamic = true;
                const val = this.interpolate(cols, context).trim();
                el.style.gridTemplateColumns = /^\d+$/.test(val) ? `repeat(${val}, minmax(0, 1fr))` : val;
            } else {
                const v = /^\d+$/.test(cols) ? `repeat(${cols}, minmax(0, 1fr))` : cols;
                el.style.gridTemplateColumns = v;
                staticStyle.gridTemplateColumns = v;
            }
        }

        const rows = xmlNode.getAttribute("rows");
        if (rows) {
            if (rows.includes("{")) {
                isDynamic = true;
                const val = this.interpolate(rows, context).trim();
                el.style.gridTemplateRows = /^\d+$/.test(val) ? `repeat(${val}, minmax(0, 1fr))` : val;
            } else {
                const v = /^\d+$/.test(rows) ? `repeat(${rows}, minmax(0, 1fr))` : rows;
                el.style.gridTemplateRows = v;
                staticStyle.gridTemplateRows = v;
            }
        }

        const customStyle = xmlNode.getAttribute("style");
        if (customStyle) {
            if (customStyle.includes("{")) {
                isDynamic = true;
                const styleStr = this.interpolate(customStyle, context).trim();
                if (styleStr) el.style.cssText += ";" + styleStr;
            } else {
                el.style.cssText += ";" + customStyle;
                staticStyle.cssText = customStyle;
            }
        }

        if (!isDynamic) {
            xmlNode._staticLayoutStyle = staticStyle;
        }
    }

    applyItemChildStyles(childEl, childXmlNode, context) {
        if (!childEl || !isElem(childXmlNode)) return;

        const flex = childXmlNode.getAttribute("flex");
        if (flex) {
            childEl.style.flex = this.interpolate(flex, context).trim();
        }

        const colSpan = childXmlNode.getAttribute("col_span");
        if (colSpan) {
            const val = this.interpolate(colSpan, context).trim();
            childEl.style.gridColumn = val.startsWith("span") ? val : `span ${val} / span ${val}`;
        }

        const rowSpan = childXmlNode.getAttribute("row_span");
        if (rowSpan) {
            const val = this.interpolate(rowSpan, context).trim();
            childEl.style.gridRow = val.startsWith("span") ? val : `span ${val} / span ${val}`;
        }
    }

    mount(appXmlString, options = {}) {
        const mountStart = getNow();
        this.xmlDoc = EUIXEngineCore.parseXmlToAst(appXmlString, { ...options, silent: true });

        const parserError = this.xmlDoc.querySelector("parsererror");
        if (parserError) {
            const errorText = parserError.textContent.trim();
            const lineMatch = errorText.match(/line\s+(\d+)/i) || errorText.match(/:(\d+):/);
            const colMatch = errorText.match(/column\s+(\d+)/i) || errorText.match(/:(\d+):(\d+)/);
            const line = lineMatch ? parseInt(lineMatch[1], 10) : 1;
            const col = colMatch ? parseInt(colMatch[colMatch.length - 1], 10) : 1;
            const codeFrame = EUIXEngineCore.generateCodeFrame(appXmlString, line, col);
            const errMsg = `[EUIX XML Parse Error] at line ${line}, column ${col}:\n${codeFrame || errorText}`;
            this.reportError(errMsg, "XML Parse Error");
            if (this.container) {
                this.container.innerHTML = `
                    <div class="euix-mount-error" style="padding:16px;background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;color:#991b1b;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">
                        <h3 style="margin:0 0 8px 0;font-size:14px;font-weight:bold;">⚠️ EUIXEngine XML Parse Error (Line ${line}, Col ${col})</h3>
                        <pre style="margin:0;font-size:12px;white-space:pre-wrap;line-height:1.4;">${this.escapeHtml(codeFrame || errorText)}</pre>
                    </div>
                `;
            }
            return this;
        }

        const defNodes = Array.from(this.xmlDoc.querySelectorAll("component_def"));
        defNodes.forEach(def => {
            const name = def.getAttribute("name") || def.getAttribute("id");
            if (name) {
                this.registerComponentSpec(name, def);
            }
        });

        this._pendingAsyncLoads = [];
        this.initConstants();
        this.initDataModel();
        this.initActionRegistry();

        const importNodes = Array.from(this.xmlDoc.querySelectorAll("import"));
        if (importNodes.length > 0 && typeof fetch !== "undefined") {
            importNodes.forEach(imp => {
                const src = imp.getAttribute("src");
                const name = imp.getAttribute("name") || imp.getAttribute("as");
                if (src && name) this._pendingAsyncLoads.push(this.loadComponentFile(name, src));
            });
        }

        if (this._pendingAsyncLoads.length > 0) {
            const pendingPromises = [...this._pendingAsyncLoads];
            this._pendingAsyncLoads = [];
            this._mountPromise = Promise.all(pendingPromises).then(() => {
                this.initConstants();
                this.initDataModel();
                this.render();
                this._isMounted = true;
                this.runMountActions();
            });
            return this;
        }

        this.render();
        this._isMounted = true;
        this.runMountActions();
        const mountEnd = getNow();
        this._mountDuration = parseFloat((mountEnd - mountStart).toFixed(2));
        return this;
    }

    runMountActions() {
        const root = this.getChild(this.xmlDoc, "uid_spec") || this.xmlDoc.querySelector("uid_spec");
        if (!root) return;
        const rootDom = this.container ? (this.container.firstElementChild || this.container) : null;
        if (rootDom) {
            this.processLifecycleHooks(root, rootDom, {});
        } else {
            this.getChildren(root, "on_mount").forEach(node => {
                this.handleAction(node, {});
            });
        }
    }

    processLifecycleHooks(xmlNode, domEl, context = {}) {
        if (!xmlNode || !isElem(domEl)) return;
        const contextWithEl = { ...context, _targetEl: domEl };

        // 1. <on_state_change watch="..."> / <on_change watch="..."> / <watch path="...">
        const onChangeNodes = [
            ...this.getChildren(xmlNode, "on_state_change"),
            ...this.getChildren(xmlNode, "on_change"),
            ...this.getChildren(xmlNode, "on_update"),
            ...this.getChildren(xmlNode, "watch")
        ];
        onChangeNodes.forEach(node => {
            const rawWatch = node.getAttribute("watch") || node.getAttribute("path") || node.getAttribute("key") || node.getAttribute("bind");
            const watchPath = rawWatch ? this.parseBindPath(rawWatch) : null;
            if (watchPath) {
                const unwatch = this.watch(watchPath, (newValue, oldValue) => {
                    if (typeof document !== "undefined" && !document.body.contains(domEl)) {
                        unwatch();
                        return;
                    }
                    this.handleAction(node, { ...contextWithEl, newValue, oldValue });
                });
            }
        });

        // 2. <on_mount>
        const onMountNodes = this.getChildren(xmlNode, "on_mount");
        onMountNodes.forEach(node => {
            this.handleAction(node, contextWithEl);
        });

        // 3. <on_interval ms="5000"> / <on_timer ms="1000">
        const onIntervalNodes = [...this.getChildren(xmlNode, "on_interval"), ...this.getChildren(xmlNode, "on_timer")];
        onIntervalNodes.forEach(node => {
            const ms = parseInt(node.getAttribute("ms") || node.getAttribute("delay") || "5000", 10);
            if (ms > 0) {
                const intervalId = setInterval(() => {
                    if (typeof document !== "undefined" && !document.body.contains(domEl)) {
                        clearInterval(intervalId);
                        return;
                    }
                    const condAttr = node.getAttribute("if") || node.getAttribute("when") || node.getAttribute("condition");
                    if (condAttr) {
                        const evalCond = this.evalCondition(condAttr, context);
                        if (!evalCond) return;
                    }
                    this.handleAction(node, context);
                }, ms);
                if (this._activeIntervals) this._activeIntervals.push(intervalId);
                domEl.dataset.euixInterval = String(intervalId);
            }
        });

        // 4. <on_visible> (IntersectionObserver)
        const onVisibleNodes = this.getChildren(xmlNode, "on_visible");
        if (onVisibleNodes.length && typeof IntersectionObserver !== "undefined") {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        onVisibleNodes.forEach(node => this.handleAction(node, context));
                        if (onVisibleNodes.every(n => n.getAttribute("once") !== "false")) {
                            observer.unobserve(domEl);
                        }
                    }
                });
            });
            observer.observe(domEl);
        }

        // 5. <on_unmount> / <on_destroy>
        const onUnmountNodes = [...this.getChildren(xmlNode, "on_unmount"), ...this.getChildren(xmlNode, "on_destroy")];
        if (onUnmountNodes.length && typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
            let fired = false;
            const observer = new MutationObserver(() => {
                if (!fired && !document.body.contains(domEl)) {
                    fired = true;
                    observer.disconnect();
                    onUnmountNodes.forEach(node => this.handleAction(node, context));
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    }

    getJsonPath(obj, path) {
        if (!path) return obj;
        return String(path).split(".").reduce((acc, key) => {
            if (acc == null) return acc;
            return acc[key];
        }, obj);
    }

    mapResponseItems(items, itemMapNode) {
        if (!itemMapNode || !Array.isArray(items)) return items;

        const fieldNodes = this.getChildren(itemMapNode, "field");
        return items.map((raw) => {
            const mapped = {};
            const templates = [];

            fieldNodes.forEach(field => {
                const as = field.getAttribute("as");
                if (!as) return;

                const template = field.getAttribute("template");
                if (template) {
                    templates.push({ as, template });
                    return;
                }

                const from = field.getAttribute("from") || as;
                let value = raw[from];
                let matchStr = field.getAttribute("match");
                if (matchStr && value != null) {
                    let pattern = matchStr;
                    let flags = "";
                    const regexLiteralMatch = matchStr.match(/^\/(.+)\/([a-z]*)$/i);
                    if (regexLiteralMatch) {
                        pattern = regexLiteralMatch[1];
                        flags = regexLiteralMatch[2];
                    }
                    try {
                        const m = String(value).match(new RegExp(pattern, flags));
                        value = m ? (m[1] ?? m[0]) : value;
                    } catch (e) {
                        console.warn("[EUIXEngine] Regex Match Error:", e);
                    }
                }
                mapped[as] = value == null ? "" : String(value);
            });

            templates.forEach(({ as, template }) => {
                mapped[as] = template.replace(/\{(\w+)\}/g, (_, key) => mapped[key] ?? "");
            });

            return mapped;
        });
    }

    handleXHR(actionNode, context = {}) {
        this.reportError(new Error("[EUIXEngine Core] XHR actions require EUIXApiPlugin to be registered."), "XHR Handler");
        return null;
    }

    static registerConstant(name, value) {
        if (!EUIXEngineCore._globalConstants) EUIXEngineCore._globalConstants = new Map();
        EUIXEngineCore._globalConstants.set(name, value);
    }

    registerConstant(name, value) {
        if (!this.constants) this.constants = new Map();
        this.constants.set(name, value);
    }

    getConstant(name) {
        if (this.constants && this.constants.has(name)) return this.constants.get(name);
        if (EUIXEngineCore._globalConstants && EUIXEngineCore._globalConstants.has(name)) return EUIXEngineCore._globalConstants.get(name);
        return undefined;
    }

    initConstants() {
        if (!this.constants) this.constants = new Map();
        if (!this.xmlDoc) return;

        const containers = Array.from(this.xmlDoc.querySelectorAll("constants, vars, variables"));
        containers.forEach(container => {
            const src = container.getAttribute("src") || container.getAttribute("url");
            if (src && typeof fetch !== "undefined") {
                const interpolatedSrc = this.interpolate(src);
                const p = this.loadConstants(interpolatedSrc);
                if (this._pendingAsyncLoads) this._pendingAsyncLoads.push(p);
            }
        });

        const constsNodes = Array.from(this.xmlDoc.querySelectorAll("const, constant, var, variable"));
        constsNodes.forEach(node => {
            const id = node.getAttribute("id") || node.getAttribute("name") || node.getAttribute("key");
            const src = node.getAttribute("src") || node.getAttribute("url");
            if (src && typeof fetch !== "undefined") {
                const interpolatedSrc = this.interpolate(src);
                const p = fetch(interpolatedSrc)
                    .then(res => res.json())
                    .then(json => {
                        if (typeof json === "object" && json !== null) {
                            const val = json[id] !== undefined ? json[id] : (json.value || json.text || JSON.stringify(json));
                            this.registerConstant(id, String(val));
                        }
                    })
                    .catch(err => this.reportError(err, `Failed to load external constant '${id}' from '${src}'`));
                if (this._pendingAsyncLoads) this._pendingAsyncLoads.push(p);
            } else if (id) {
                this.constants.set(id, node.textContent.trim());
            }
        });
    }

    initDataModel() {
        const rawState = {};
        const pendingEndpoints = [];

        const collectStatesFromDoc = (doc, isMainDoc = false) => {
            if (!doc) return;
            const dataModelNode = this.getChild(doc.querySelector("uid_spec") || doc, "data_model") || doc.querySelector("data_model");
            if (dataModelNode) {
                const src = dataModelNode.getAttribute("src") || dataModelNode.getAttribute("url");
                if (src && isMainDoc && typeof fetch !== "undefined") {
                    const interpolatedSrc = this.interpolate(src);
                    const p = this.loadDataModel(interpolatedSrc);
                    if (this._pendingAsyncLoads) this._pendingAsyncLoads.push(p);
                }
            }

            let isDocIsolated = !isMainDoc && (isScoped(doc) || isScoped(dataModelNode));

            const stateNodes = dataModelNode ? this.getChildren(dataModelNode, "state") : (doc.querySelectorAll ? Array.from(doc.querySelectorAll("data_model > state")) : []);

            stateNodes.forEach(node => {
                const id = node.getAttribute("id");
                if (!id) return;
                const scope = node.getAttribute("scope");
                const isStateIsolated = isDocIsolated || scope === "local" || scope === "isolated" || scope === "scoped";

                if (isStateIsolated && !isMainDoc && scope !== "global") {
                    return;
                }

                const type = node.getAttribute("type");
                const src = node.getAttribute("src") || node.getAttribute("url");
                const persistAttr = node.getAttribute("persist") || node.getAttribute("storage");

                if (src && isMainDoc && typeof fetch !== "undefined") {
                    const interpolatedSrc = this.interpolate(src);
                    const p = fetch(interpolatedSrc)
                        .then(res => res.json())
                        .then(json => {
                            this.setState(id, json);
                        })
                        .catch(err => this.reportError(err, `Failed to load external state '${id}' from '${src}'`));
                    if (this._pendingAsyncLoads) this._pendingAsyncLoads.push(p);
                } else if (type === "array") {
                    const childItems = this.getChildren(node, "item");
                    if (childItems && childItems.length > 0) {
                        const items = childItems.map(item => {
                            const obj = {};
                            Array.from(item.attributes).forEach(attr => obj[attr.name] = attr.value);
                            return obj;
                        });
                        rawState[id] = items;
                    } else {
                        const txt = node.textContent.trim();
                        if (txt && (txt.startsWith("[") || txt.startsWith("{"))) {
                            try {
                                rawState[id] = JSON.parse(txt);
                            } catch (_) {
                                rawState[id] = [];
                            }
                        } else {
                            rawState[id] = [];
                        }
                    }
                } else if (type === "number" || type === "int" || type === "float") {
                    const txt = node.textContent.trim();
                    rawState[id] = txt !== "" ? Number(txt) : 0;
                } else if (type === "boolean" || type === "bool") {
                    const txt = node.textContent.trim().toLowerCase();
                    rawState[id] = txt === "true";
                } else if (type === "object" || type === "json") {
                    const txt = node.textContent.trim();
                    try {
                        rawState[id] = txt ? JSON.parse(txt) : {};
                    } catch (_) {
                        rawState[id] = {};
                    }
                } else if (type === "html" || (node.children && node.children.length > 0)) {
                    rawState[id] = node.innerHTML.trim();
                } else {
                    rawState[id] = node.textContent.trim() || "";
                }

                if (persistAttr) {
                    const customKey = node.getAttribute("storage_key") || node.getAttribute("key");
                    this._persistenceConfig.set(id, {
                        storage: String(persistAttr).toLowerCase(),
                        storageKey: customKey || `euix_state_${id}`
                    });
                }
            });

            const computedNodes = doc.querySelectorAll ? Array.from(doc.querySelectorAll("computed")) : Array.from(doc.getElementsByTagName("computed"));
            computedNodes.forEach(node => {
                const id = node.getAttribute("id") || node.getAttribute("name");
                const deps = node.getAttribute("deps") || node.getAttribute("watch");
                const getter = node.textContent.trim() || node.getAttribute("value") || node.getAttribute("expr");
                if (id && isFn(this.computed)) {
                    this.computed(id, getter, deps);
                }
            });

            const watchNodes = doc.querySelectorAll ? Array.from(doc.querySelectorAll("watch")) : Array.from(doc.getElementsByTagName("watch"));
            watchNodes.forEach(node => {
                const path = node.getAttribute("path") || node.getAttribute("watch") || node.getAttribute("on");
                if (path && isFn(this.watch)) {
                    this.watch(path, node);
                }
            });

            const animDefNodes = [...Array.from(doc.getElementsByTagName("animation_def")), ...Array.from(doc.getElementsByTagName("keyframe_def"))];
            animDefNodes.forEach(node => {
                const name = node.getAttribute("name") || node.getAttribute("id");
                if (name && isFn(this.registerAnimationDef)) {
                    this.registerAnimationDef(name, node);
                }
            });

            const persistenceNode = doc.querySelector("persistence");
            if (persistenceNode) {
                const defaultStorage = persistenceNode.getAttribute("storage") || "local";
                const prefix = persistenceNode.getAttribute("prefix") || "";
                const persistItems = Array.from(persistenceNode.querySelectorAll("persist, item, key, persisted_key"));
                persistItems.forEach(item => {
                    const key = item.getAttribute("key") || item.getAttribute("id") || item.textContent.trim();
                    const itemStorage = item.getAttribute("storage") || defaultStorage;
                    const customStorageKey = item.getAttribute("storage_key") || (prefix ? `${prefix}${key}` : null);
                    if (key) {
                        this._persistenceConfig.set(key, {
                            storage: String(itemStorage).toLowerCase(),
                            storageKey: customStorageKey || `euix_state_${key}`
                        });
                    }
                });
            }

            const apiConfigNode = doc.querySelector("api_config, api_client, api");
            if (apiConfigNode) {
                const baseUrl = apiConfigNode.getAttribute("base_url") || apiConfigNode.getAttribute("baseUrl") || apiConfigNode.getAttribute("url");
                if (baseUrl) this._apiConfig.baseUrl = baseUrl.trim();

                const credentials = apiConfigNode.getAttribute("credentials");
                if (credentials) this._apiConfig.credentials = credentials.trim();

                const timeout = apiConfigNode.getAttribute("timeout");
                if (timeout) this._apiConfig.timeout = parseInt(timeout, 10) || 0;

                const headerNodes = Array.from(apiConfigNode.querySelectorAll("headers > header, header"));
                headerNodes.forEach(h => {
                    const name = h.getAttribute("name") || h.getAttribute("key");
                    const val = h.textContent.trim() || h.getAttribute("value") || "";
                    if (name) this.setApiHeader(name, val);
                });
            }

            const apiEndpoints = doc.querySelectorAll
                ? Array.from(doc.querySelectorAll("api_endpoint, endpoint"))
                : Array.from(doc.getElementsByTagName("api_endpoint")).concat(Array.from(doc.getElementsByTagName("endpoint")));
            apiEndpoints.forEach(node => {
                const autoFetchAttr = node.getAttribute("auto_fetch");
                const autoFetch = autoFetchAttr !== "false";
                pendingEndpoints.push({ node, autoFetch });
            });

            if (isMainDoc) {
                const useScriptNodes = Array.from(doc.querySelectorAll("use_script, script_loader, load_script"));
                useScriptNodes.forEach(node => {
                    const src = node.getAttribute("src") || node.getAttribute("url");
                    if (src) {
                        const p = this.loadScript(src, { async: node.getAttribute("async") !== "false" });
                        if (this._pendingAsyncLoads) this._pendingAsyncLoads.push(p);
                    }
                });

                const useStyleNodes = Array.from(doc.querySelectorAll("use_style, style_loader, load_style"));
                useStyleNodes.forEach(node => {
                    const href = node.getAttribute("src") || node.getAttribute("href") || node.getAttribute("url");
                    if (href) this.loadStyle(href);
                });
            }
        };

        if (EUIXEngineCore._globalComponentSpecs) {
            EUIXEngineCore._globalComponentSpecs.forEach(spec => collectStatesFromDoc(spec, false));
        }
        if (this._componentSpecs) {
            this._componentSpecs.forEach(spec => collectStatesFromDoc(spec, false));
        }

        if (this.xmlDoc) {
            collectStatesFromDoc(this.xmlDoc, true);
        }

        for (const [key, config] of this._persistenceConfig.entries()) {
            const store = config.storage === "session"
                ? (typeof sessionStorage !== "undefined" ? sessionStorage : null)
                : (typeof localStorage !== "undefined" ? localStorage : null);
            if (store) {
                const storedVal = store.getItem(config.storageKey);
                if (storedVal !== null) {
                    try {
                        rawState[key] = JSON.parse(storedVal);
                    } catch (_) {
                        rawState[key] = storedVal;
                    }
                } else if (rawState[key] !== undefined) {
                    this._savePersistedState(key, rawState[key]);
                }
            }
        }

        this._rawState = rawState;
        const self = this;
        this.state = new Proxy(rawState, {
            get(target, prop, receiver) {
                if (typeof prop === "string") {
                    if (self._computedRegistry && self._computedRegistry.has(prop)) {
                        return self.getComputed(prop);
                    }
                }
                const val = Reflect.get(target, prop, receiver);
                if (Array.isArray(val) && typeof prop === "string") {
                    return new Proxy(val, {
                        get(arrTarget, arrProp, arrReceiver) {
                            const mutatingMethods = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"];
                            if (typeof arrProp === "string" && mutatingMethods.includes(arrProp)) {
                                return function(...args) {
                                    const res = Array.prototype[arrProp].apply(arrTarget, args);
                                    self.setState(prop, arrTarget);
                                    return res;
                                };
                            }
                            return Reflect.get(arrTarget, arrProp, arrReceiver);
                        },
                        set(arrTarget, arrKey, arrVal) {
                            const res = Reflect.set(arrTarget, arrKey, arrVal);
                            if (arrKey !== "length") {
                                self.setState(prop, arrTarget);
                            }
                            return res;
                        }
                    });
                }
                return val;
            },
            set(target, key, value) {
                target[key] = value;
                self._savePersistedState(key, value);
                if (self._batching) {
                    self.syncBindings(key, value);
                    return true;
                }
                self.syncBindings(key, value);
                return true;
            }
        });

        this._proxyState = this.state;

        if (isFn(this.handleXHR) && pendingEndpoints.length > 0) {
            pendingEndpoints.forEach(({ node, autoFetch }) => {
                if (autoFetch) {
                    this.handleXHR(node);
                } else {
                    this.handleXHR(node, { _registerOnly: true });
                }
            });
        }

        return this.state;
    }

    loadScript(src, options = {}) {
        if (typeof document === 'undefined' || !src) return Promise.resolve();
        const cleanUrl = this.interpolate(src, options.context || {});
        if (!cleanUrl) return Promise.resolve();

        const isJSDOM = typeof window !== 'undefined' && window.navigator && window.navigator.userAgent && window.navigator.userAgent.includes('jsdom');

        const existing = document.querySelector(`script[src="${cleanUrl}"]`);
        if (existing) {
            if (existing.getAttribute('data-loaded') === 'true') {
                return Promise.resolve();
            }
            return new Promise((resolve) => {
                const onDone = () => resolve();
                existing.addEventListener('load', onDone, { once: true });
                existing.addEventListener('error', onDone, { once: true });
                setTimeout(onDone, isJSDOM ? 10 : 500);
            });
        }

        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = cleanUrl;
            script.async = options.async !== false;
            if (options.defer) script.defer = true;
            if (options.id) script.id = options.id;

            let settled = false;
            const done = () => {
                if (!settled) {
                    settled = true;
                    script.setAttribute('data-loaded', 'true');
                    resolve();
                }
            };

            script.onload = done;
            script.onerror = done;
            document.head.appendChild(script);

            if (isJSDOM) {
                setTimeout(done, 10);
            } else {
                setTimeout(done, 5000);
            }
        });
    }

    loadStyle(href, options = {}) {
        if (typeof document === 'undefined' || !href) return;
        const cleanUrl = this.interpolate(href, options.context || {});
        if (!cleanUrl) return;

        if (document.querySelector(`link[href="${cleanUrl}"]`)) return;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cleanUrl;
        if (options.id) link.id = options.id;
        document.head.appendChild(link);
    }

    extractStateKeys(expr) {
        if (!expr) return [];
        const keys = new Set();
        const matches = expr.match(/(?:data|local|\$local)\.(\w+)/g) || [];
        matches.forEach(m => keys.add(m.replace(/^(?:data|local|\$local)\./, "")));
        const plainMatches = expr.match(/\{(\w+)\}/g) || [];
        plainMatches.forEach(m => keys.add(m.replace(/^\{|\}$/g, "")));
        return Array.from(keys);
    }

    interpolate(text, context = {}) {
        if (!text || typeof text !== "string" || !text.includes("{")) return text || "";

        // Fast-path: single simple token e.g. "{item.text}" or "{todo.completed}" or "{data.count}"
        if (text.charCodeAt(0) === 123 && text.charCodeAt(text.length - 1) === 125) {
            const inner = text.slice(1, -1).trim();
            if (!/[?!=><+\-*/(),]/.test(inner) && !inner.includes("{")) {
                const dotIdx = inner.indexOf(".");
                if (dotIdx === -1) {
                    if (context && context[inner] !== undefined) {
                        const v = context[inner];
                        return typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "");
                    }
                    const v = this.getState(inner);
                    if (v !== undefined) return typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "");
                } else {
                    const scope = inner.slice(0, dotIdx);
                    const prop = inner.slice(dotIdx + 1);
                    if (scope === "data" || scope === "state" || scope === "global" || scope === "$global") {
                        if (!prop.includes("[")) {
                            const v = this.getState(prop);
                            if (v !== undefined) return typeof v === "object" && v !== null ? JSON.stringify(v) : String(v ?? "");
                        }
                    } else if (context && context[scope] !== undefined && context[scope] !== null) {
                        let curr = context[scope];
                        const parts = prop.split(".");
                        for (let p of parts) {
                            if (curr === undefined || curr === null) break;
                            curr = curr[p];
                        }
                        if (curr !== undefined) return typeof curr === "object" && curr !== null ? JSON.stringify(curr) : String(curr ?? "");
                    }
                }
            }
        }

        // Fast-path 2: compiled tokenized template chunks (Multi-token without regex overhead)
        const compiled = getCompiledTemplate(text);
        if (compiled) {
            let out = "";
            for (let i = 0; i < compiled.length; i++) {
                const c = compiled[i];
                if (c.type === "static") {
                    out += c.val;
                } else if (c.isSimple) {
                    if (context && context[c.scope] !== undefined) {
                        const v = context[c.scope];
                        out += (typeof v === "object" && v !== null ? JSON.stringify(v) : (v ?? ""));
                    } else if (this.constants && this.constants.has(c.scope)) {
                        out += this.constants.get(c.scope);
                    } else if (EUIXEngineCore._globalConstants && EUIXEngineCore._globalConstants.has(c.scope)) {
                        out += EUIXEngineCore._globalConstants.get(c.scope);
                    } else {
                        const v = this.getState(c.scope);
                        out += (v !== undefined ? (typeof v === "object" && v !== null ? JSON.stringify(v) : (v ?? "")) : "");
                    }
                } else if (c.scope === "const" || c.scope === "constants" || c.scope === "var" || c.scope === "vars" || c.scope === "constant" || c.scope === "variable") {
                    if (context && context.constants && context.constants[c.prop] !== undefined) {
                        out += context.constants[c.prop];
                    } else if (this.constants && this.constants.has(c.prop)) {
                        out += this.constants.get(c.prop);
                    } else if (EUIXEngineCore._globalConstants && EUIXEngineCore._globalConstants.has(c.prop)) {
                        out += EUIXEngineCore._globalConstants.get(c.prop);
                    }
                } else if (c.scope === "data" || c.scope === "state" || c.scope === "global" || c.scope === "$global") {
                    const v = this.getState(c.prop);
                    out += (v !== undefined ? (typeof v === "object" && v !== null ? JSON.stringify(v) : (v ?? "")) : "");
                } else if (c.scope === "parent") {
                    const clean = c.prop.replace(/^data\./, "");
                    const v = this.getState(clean);
                    out += (v !== undefined ? (typeof v === "object" && v !== null ? JSON.stringify(v) : (v ?? "")) : "");
                } else if (c.scope === "props") {
                    const propsObj = context ? (context.props || context) : null;
                    if (propsObj && propsObj[c.prop] !== undefined) {
                        const v = propsObj[c.prop];
                        out += (typeof v === "object" && v !== null ? JSON.stringify(v) : (v ?? ""));
                    }
                } else if (c.scope === "local" || c.scope === "$local") {
                    if (context && context._localState && context._localState[c.prop] !== undefined) {
                        const v = context._localState[c.prop];
                        out += (typeof v === "object" && v !== null ? JSON.stringify(v) : (v ?? ""));
                    } else if (context && context.local && context.local[c.prop] !== undefined) {
                        const v = context.local[c.prop];
                        out += (typeof v === "object" && v !== null ? JSON.stringify(v) : (v ?? ""));
                    }
                } else if (c.scope === "api" || c.scope === "$api") {
                    if (c.prop) {
                        const parts = c.parts;
                        const endpointId = parts[0];
                        const epProp = parts.slice(1).join(".");
                        const status = isFn(this.getApiStatus) ? this.getApiStatus(endpointId) : (this._apiStatus && this._apiStatus[endpointId]);
                        if (status) {
                            if (!epProp) {
                                out += typeof status === "object" ? JSON.stringify(status) : String(status);
                            } else {
                                const val = epProp.split(".").reduce((acc, p) => (acc ? acc[p] : undefined), status);
                                if (val !== undefined && val !== null) out += String(val);
                            }
                        }
                    }
                } else if (c.scope === "result") {
                    if (!c.prop) {
                        if (context && context.result !== undefined && context.result !== null) {
                            out += typeof context.result === "object" ? JSON.stringify(context.result) : String(context.result);
                        }
                    } else if (context && context.result && typeof context.result === "object") {
                        let curr = context.result;
                        for (let p = 0; p < c.parts.length && curr !== undefined && curr !== null; p++) {
                            curr = curr[c.parts[p]];
                        }
                        if (curr !== undefined && curr !== null) out += String(curr);
                    }
                } else if (c.scope === "err" || c.scope === "error") {
                    const errObj = context ? (context[c.scope] || context.err || context.error) : null;
                    if (errObj) {
                        if (!c.prop) {
                            out += typeof errObj === "object" ? (errObj.message || JSON.stringify(errObj)) : String(errObj);
                        } else {
                            let curr = errObj;
                            for (let p = 0; p < c.parts.length && curr !== undefined && curr !== null; p++) {
                                curr = curr[c.parts[p]];
                            }
                            if (curr !== undefined && curr !== null) out += String(curr);
                        }
                    }
                } else if (c.scope === "args" || c.scope === "params") {
                    const argsObj = context ? (context.args || context.params) : null;
                    if (argsObj && typeof argsObj === "object") {
                        let curr = argsObj;
                        for (let p = 0; p < c.parts.length && curr !== undefined && curr !== null; p++) {
                            curr = curr[c.parts[p]];
                        }
                        if (curr !== undefined) {
                            out += (typeof curr === "object" && curr !== null ? JSON.stringify(curr) : (curr ?? ""));
                        }
                    }
                } else if (context && context[c.scope] !== undefined && context[c.scope] !== null) {
                    let curr = context[c.scope];
                    const parts = c.parts;
                    for (let p = 0; p < parts.length && curr !== undefined && curr !== null; p++) {
                        curr = curr[parts[p]];
                    }
                    if (curr !== undefined) {
                        out += (typeof curr === "object" && curr !== null ? JSON.stringify(curr) : (curr ?? ""));
                    }
                }
            }
            return out;
        }

        // Fast-path 3: JIT compiled template function for complex expressions/ternaries/math
        const jitFn = EUIXExpressionParser.compileTemplateFunction(text);
        if (jitFn) {
            const res = jitFn(this, context, (p) => this.resolveValueFromPath(p, context));
            if (res !== undefined && res !== null) return res;
        }

        let result = text;

        // 1. Resolve {const.name}, {var.name}, {constants.name}, {vars.name}
        result = result.replace(/\{(?:const|var|constant|variable|constants|vars)\.(\w+)\}/g, (match, name) => {
            if (context && context.constants && context.constants[name] !== undefined) {
                return context.constants[name];
            }
            if (this.constants && this.constants.has(name)) {
                return this.constants.get(name);
            }
            if (EUIXEngineCore._globalConstants && EUIXEngineCore._globalConstants.has(name)) {
                return EUIXEngineCore._globalConstants.get(name);
            }
            return match;
        });

        // 1.5. Resolve {args.name}, {params.name}, {result.name}, {result}, {err.name}, {error.name}, {local.name}, {$local.name}, {global.name}, {api.name}, {$api.name}
        result = result.replace(/\{(args|params|result|err|error|local|\$local|global|api|\$api)(?:\.([a-zA-Z0-9_\.]+))?\}/g, (match, scope, prop) => {
            if (scope === "api" || scope === "$api") {
                if (prop) {
                    const parts = prop.split(".");
                    const endpointId = parts[0];
                    const epProp = parts.slice(1).join(".");
                    const status = isFn(this.getApiStatus) ? this.getApiStatus(endpointId) : (this._apiStatus && this._apiStatus[endpointId]);
                    if (!status) return "";
                    if (!epProp) return typeof status === "object" ? JSON.stringify(status) : String(status);
                    const val = epProp.split(".").reduce((acc, p) => (acc ? acc[p] : undefined), status);
                    return val !== undefined && val !== null ? String(val) : "";
                }
                return match;
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
                    const val = this.getState(clean);
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
                if (!prop) return context.result !== undefined && context.result !== null ? (typeof context.result === "object" ? JSON.stringify(context.result) : String(context.result)) : "";
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
                    if (!prop) return typeof errObj === "object" ? (errObj.message || JSON.stringify(errObj)) : String(errObj);
                    const parts = prop.split(".");
                    let curr = errObj;
                    for (let i = 0; i < parts.length && curr !== undefined && curr !== null; i++) {
                        curr = curr[parts[i]];
                    }
                    return curr !== undefined && curr !== null ? String(curr) : "";
                }
            }
            return match;
        });

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
                    const idxVal = (context && context[key] !== undefined) ? context[key] : this.getState(key);
                    return idxVal !== undefined ? `[${idxVal}]` : m;
                });
            }

            if (/[?!=><+\-*/]/.test(resolvedExpr) || resolvedExpr.includes(".") || resolvedExpr.includes("data.") || resolvedExpr.includes("local.") || resolvedExpr.includes("api.")) {
                try {
                    const evaluated = EUIXExpressionParser.eval(resolvedExpr, (name) => {
                        if (name.startsWith("api.") || name.startsWith("$api.")) {
                            const clean = name.replace(/^(\$api|api)\./, "");
                            const parts = clean.split(".");
                            const endpointId = parts[0];
                            const prop = parts.slice(1).join(".");
                            const status = isFn(this.getApiStatus) ? this.getApiStatus(endpointId) : (this._apiStatus && this._apiStatus[endpointId]);
                            if (!status) return undefined;
                            if (!prop) return status;
                            return prop.split(".").reduce((acc, p) => (acc ? acc[p] : undefined), status);
                        }
                        if (name.startsWith("local.") || name.startsWith("$local.")) {
                            const lk = name.replace(/^(\$local|local)\./, "");
                            if (context._localState && context._localState[lk] !== undefined) {
                                return context._localState[lk];
                            }
                            if (context.local && context.local[lk] !== undefined) {
                                return context.local[lk];
                            }
                        }
                        if (name.startsWith("global.") || name.startsWith("$global.")) {
                            const gk = name.replace(/^(\$global|global)\.(data\.)?/, "");
                            return this.getState(gk);
                        }

                        const cleanKey = name.replace(/^(?:parent\.)?data\./, "");
                        if (context._localState && context._localState[cleanKey] !== undefined) {
                            return context._localState[cleanKey];
                        }

                        const parts = name.split(".");
                        const firstPart = parts[0];

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

                        let val = this.getState(this.parseBindPath(cleanKey));
                        if (val !== undefined && val !== null) return val;

                        if (context && context[name] !== undefined) {
                            return context[name];
                        }

                        if (name.includes(".") && context && context[firstPart] !== undefined && context[firstPart] !== null) {
                            let curr = context[firstPart];
                            for (let i = 1; i < parts.length && curr !== undefined && curr !== null; i++) {
                                curr = curr[parts[i]];
                            }
                            if (curr !== undefined) return curr;
                        }

                        return undefined;
                    });
                    if (evaluated !== undefined && evaluated !== null && typeof evaluated !== "object") {
                        return String(evaluated);
                    }
                } catch (_) {}
            }

            if (/^(?:parent\.)?data\./.test(resolvedExpr)) {
                const cleanKey = resolvedExpr.replace(/^(?:parent\.)?data\./, "");
                if (context._localState && context._localState[cleanKey] !== undefined) {
                    const val = context._localState[cleanKey];
                    return val !== undefined && val !== null ? (typeof val === "object" ? JSON.stringify(val) : String(val)) : "";
                }
                const val = this.getState(this.parseBindPath(cleanKey));
                return val !== undefined && val !== null ? (typeof val === "object" ? JSON.stringify(val) : String(val)) : "";
            }

            if (/^(?:local|\$local)\./.test(trimmed)) {
                const cleanKey = trimmed.replace(/^(?:local|\$local)\./, "");
                if (context._localState && context._localState[cleanKey] !== undefined) {
                    const val = context._localState[cleanKey];
                    return val !== undefined && val !== null ? (typeof val === "object" ? JSON.stringify(val) : String(val)) : "";
                }
                if (context.local && context.local[cleanKey] !== undefined) {
                    const val = context.local[cleanKey];
                    return val !== undefined && val !== null ? (typeof val === "object" ? JSON.stringify(val) : String(val)) : "";
                }
            }

            if (context && context[trimmed] !== undefined && context[trimmed] !== null && typeof context[trimmed] !== "object") {
                return String(context[trimmed]);
            }

            return match;
        });

        // 3. Resolve {props.key} and {scope.key}
        result = result.replace(/\{(\w+)\.(\w+)\}/g, (match, scope, prop) => {
            if (context[scope] && typeof context[scope] === "object") {
                return context[scope][prop] !== undefined ? context[scope][prop] : "";
            }
            return match;
        });

        return result;
    }

    evalCondition(expr, context = {}) {
        if (!expr) return true;

        const resolved = this.interpolate(expr, context);
        if (resolved === "true") return true;
        if (resolved === "false" || resolved === "") return false;

        const resolveValueFn = (name) => {
            let val;
            if (name.startsWith("data.")) {
                val = this.getState(name.slice(5));
            } else {
                const ctxMatch = name.match(/^(\w+)(?:\.(\w+))?$/);
                if (ctxMatch) {
                    const [_, scope, prop] = ctxMatch;
                    if (scope && context[scope] !== undefined) {
                        val = prop ? context[scope][prop] : context[scope];
                    }
                }
                if (val === undefined) val = this.getState(name);
            }
            if (typeof val === "string" && val.trim() !== "" && !isNaN(Number(val))) {
                return Number(val);
            }
            return val;
        };

        if (/[==|!=|>|<|&&|\|\||!|\(\)]/.test(expr)) {
            const cleanExpr = expr.replace(/\{([^}]+)\}/g, "$1");
            const res = EUIXExpressionParser.eval(cleanExpr, resolveValueFn);
            return res !== undefined ? Boolean(res) : Boolean(resolved);
        }

        return Boolean(resolved);
    }

    appendChildren(fragment, nodes, context, { skipTags = [] } = {}) {
        Array.from(nodes).forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE && skipTags.includes(child.tagName.toLowerCase())) return;
            const el = this.createHTMLElement(child, context);
            if (el) fragment.appendChild(el);
        });
        return fragment;
    }

    renderConditional(xmlNode, context = {}) {
        const containerNode = document.createElement("div");
        containerNode.className = "euix-if-branch";
        containerNode.style.display = "contents";

        const branches = [];
        let current = {
            type: "if",
            condition: xmlNode.getAttribute("condition") || "",
            nodes: [],
            sealed: false
        };

        Array.from(xmlNode.childNodes).forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === "else_if") {
                branches.push(current);
                current = {
                    type: "else_if",
                    condition: child.getAttribute("condition") || "",
                    nodes: Array.from(child.childNodes),
                    sealed: true
                };
                return;
            }
            if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === "else") {
                branches.push(current);
                current = {
                    type: "else",
                    condition: null,
                    nodes: Array.from(child.childNodes),
                    sealed: true
                };
                return;
            }
            if (current.sealed) return;
            current.nodes.push(child);
        });
        branches.push(current);

        const getActiveIndex = () => {
            for (let i = 0; i < branches.length; i++) {
                const b = branches[i];
                const ok = b.type === "else" ? true : this.evalCondition(b.condition, context);
                if (ok) return i;
            }
            return -1;
        };

        let activeIndex = getActiveIndex();
        if (activeIndex !== -1) {
            this.appendChildren(containerNode, branches[activeIndex].nodes, context, {
                skipTags: ["else", "else_if"]
            });
        }

        const keys = new Set();
        branches.forEach(b => {
            if (b.condition) {
                this.extractStateKeys(b.condition).forEach(k => keys.add(k));
            }
        });

        const updateFn = () => {
            const newIndex = getActiveIndex();
            if (newIndex !== activeIndex) {
                const oldNodes = Array.from(containerNode.children);
                activeIndex = newIndex;
                const renderNewBranch = () => {
                    containerNode.innerHTML = "";
                    if (newIndex !== -1) {
                        const fragment = document.createDocumentFragment();
                        this.appendChildren(fragment, branches[newIndex].nodes, context, {
                            skipTags: ["else", "else_if"]
                        });
                        containerNode.appendChild(fragment);
                    }
                };

                if (oldNodes.length > 0) {
                    let pendingCount = oldNodes.length;
                    const onDone = () => {
                        pendingCount--;
                        if (pendingCount <= 0) renderNewBranch();
                    };
                    oldNodes.forEach(childEl => this._runLeaveTransitionThenRemove(childEl, onDone));
                } else {
                    renderNewBranch();
                }
            }
        };

        keys.forEach(k => this.registerBinding(k, containerNode, "conditional", updateFn));

        return containerNode;
    }

    resolveBindPath(xmlNode) {
        const bindAttr = xmlNode.getAttribute("bind");
        if (bindAttr) return this.parseBindPath(bindAttr);

        const onChange = this.getChild(xmlNode, "on_change");
        if (onChange && onChange.getAttribute("action") === "SET_STATE") {
            const pathNode = this.getChild(onChange, "path");
            if (pathNode) return this.parseBindPath(pathNode.textContent);
        }

        const valNode = this.getChild(xmlNode, "value");
        if (valNode) {
            const match = String(valNode.textContent || "").trim().match(/^\{data\.(\w+)\}$/);
            if (match) return match[1];
        }

        if (xmlNode.textContent) {
            const match = String(xmlNode.textContent || "").trim().match(/\{data\.(\w+)\}/);
            if (match) return match[1];
        }

        return "";
    }

    applyNodeAttributes(el, xmlNode, context = {}) {
        if (!el || !xmlNode || xmlNode.nodeType !== 1 || !xmlNode.attributes) return;

        const validationAttrs = ["pattern", "minlength", "maxlength", "min", "max", "step", "title", "autocomplete"];

        Array.from(xmlNode.attributes).forEach(attr => {
            const attrName = attr.name;
            const attrValue = attr.value;
            if (attrValue === undefined || attrValue === null) return;

            const lowerAttrName = attrName.toLowerCase();

            if (attrName === "id") {
                const idVal = this.interpolate(attrValue, context);
                el.id = idVal;
                el.setAttribute("id", idVal);
            } else if (attrName.startsWith("on") && attrName.length > 2 && !attrName.startsWith("on_")) {
                const eventName = attrName.toLowerCase();
                const handlerCode = this.interpolate(attrValue, context);
                try {
                    const isAsync = handlerCode.includes("await ");
                    const AsyncFn = Object.getPrototypeOf(async function(){}).constructor;
                    el[eventName] = isAsync 
                        ? new AsyncFn("event", "$evt", handlerCode) 
                        : new Function("event", "$evt", handlerCode);
                } catch (_) {
                    el.setAttribute(attrName, handlerCode);
                }
            } else if (BOOLEAN_ATTRS.has(lowerAttrName)) {
                const interpolated = this.interpolate(attrValue, context);
                const lower = String(interpolated).trim().toLowerCase();
                const isExplicitFalse = lower === "false" || lower === "0" || lower === "null" || lower === "undefined";
                const isBoolTrue = !isExplicitFalse && (
                    lower === "true" ||
                    lower === "1" ||
                    lower === lowerAttrName ||
                    (attrValue === "" && !String(attrValue).includes("{"))
                );

                if (isBoolTrue) {
                    el.setAttribute(attrName, "");
                    try { el[attrName] = true; } catch (_) {}
                } else {
                    el.removeAttribute(attrName);
                    try { el[attrName] = false; } catch (_) {}
                }
            } else if (validationAttrs.includes(lowerAttrName)) {
                if (!attrValue.includes("data.") && !attrValue.includes("local.")) {
                    el.setAttribute(attrName, this.interpolate(attrValue, context));
                }
            } else if (attrName === "class") {
                const interpolatedVal = this.interpolate(attrValue, context);
                if (el.namespaceURI === SVG_NAMESPACE) {
                    el.setAttribute("class", interpolatedVal);
                } else {
                    if (el.className && el.className !== interpolatedVal && !el.className.split(" ").includes(interpolatedVal)) {
                        el.className = [el.className, interpolatedVal].filter(Boolean).join(" ");
                    } else if (!el.className) {
                        el.className = interpolatedVal;
                    }
                }
            } else if (attrName === "style") {
                let interpolatedVal = this.interpolate(attrValue, context);
                if (typeof interpolatedVal === "string" && interpolatedVal.trim().startsWith("{") && interpolatedVal.trim().endsWith("}")) {
                    try {
                        const parsed = JSON.parse(interpolatedVal);
                        if (typeof parsed === "object" && parsed !== null) {
                            interpolatedVal = Object.entries(parsed)
                                .filter(([k, v]) => v !== undefined && v !== null && v !== "")
                                .map(([k, v]) => `${k.startsWith("--") ? k : k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`)
                                .join(" ");
                        }
                    } catch (_) {}
                } else if (interpolatedVal && typeof interpolatedVal === "object") {
                    interpolatedVal = Object.entries(interpolatedVal)
                        .filter(([k, v]) => v !== undefined && v !== null && v !== "")
                        .map(([k, v]) => `${k.startsWith("--") ? k : k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`)
                        .join(" ");
                }
                el.setAttribute("style", interpolatedVal);
            } else if (attrName === "type") {
                el.setAttribute("type", this.interpolate(attrValue, context));
            } else {
                const interpolatedVal = this.interpolate(attrValue, context);
                el.setAttribute(attrName, interpolatedVal);
                if (attrName === "draggable") {
                    try {
                        const isDraggable = (interpolatedVal === "true");
                        if (isFn(this.enableDraggable)) {
                            this.enableDraggable(el, isDraggable, context);
                        } else {
                            el.draggable = isDraggable;
                        }
                    } catch (_) {}
                }
            }

            const matches = Array.from(attrValue.matchAll(/(?:parent\.)?(?:data|local|\$local|api|\$api)\.([a-zA-Z0-9_.[\]]+)/g));
            if (matches.length > 0) {
                const uniqueKeys = new Set(matches.map(m => m[1]));
                uniqueKeys.forEach(key => {
                    if (attrValue.includes("api." + key) || attrValue.includes("$api." + key)) {
                        const parts = key.split(".");
                        const epId = parts[0];
                        const epProp = parts[1];
                        if (epProp) {
                            this.registerBinding(`api:${epId}:${epProp}`, el, "attribute", () => {
                                this.updateAttributeBinding(el, attrName, attrValue, context);
                            });
                        }
                        this.registerBinding(`api:${epId}`, el, "attribute", () => {
                            this.updateAttributeBinding(el, attrName, attrValue, context);
                        });
                    } else {
                        const rootKey = getRootKey(key);
                        const isLocal = context._localState && (context._localState[key] !== undefined || context._localState[rootKey] !== undefined || attrValue.includes(`local.${key}`) || attrValue.includes(`$local.${key}`));
                        const bindKey = (context._instanceId && isLocal) ? (context._instanceId + ":" + key) : key;
                        const rootBindKey = (context._instanceId && isLocal) ? (context._instanceId + ":" + rootKey) : rootKey;
                        const updateFn = () => {
                            this.updateAttributeBinding(el, attrName, attrValue, context);
                        };
                        this.registerBinding(bindKey, el, "attribute", updateFn);
                        if (rootBindKey !== bindKey) {
                            this.registerBinding(rootBindKey, el, "attribute", updateFn);
                        }
                        const innerBracketMatches = key.match(/\[(?:data\.)?([a-zA-Z0-9_]+)\]/g) || [];
                        innerBracketMatches.forEach(bm => {
                            const innerKey = bm.replace(/[[\]]|data\./g, "");
                            if (!/^\d+$/.test(innerKey)) {
                                this.registerBinding(innerKey, el, "attribute", updateFn);
                            }
                        });
                    }
                });
                this.updateAttributeBinding(el, attrName, attrValue, context);
            }
        });
    }

    updateAttributeBinding(el, attrName, template, context = {}) {
        if (!el || !attrName || !template) return;
        const newAttrVal = this.interpolate(template, context);
        const lowerAttrName = attrName.toLowerCase();

        if (BOOLEAN_ATTRS.has(lowerAttrName)) {
            const lower = String(newAttrVal).trim().toLowerCase();
            const isExplicitFalse = lower === "false" || lower === "0" || lower === "null" || lower === "undefined" || lower === "";
            const isBoolTrue = !isExplicitFalse && (
                lower === "true" ||
                lower === "1" ||
                lower === lowerAttrName ||
                this.isTruthy(newAttrVal)
            );

            if (isBoolTrue) {
                el.setAttribute(attrName, "");
                try { el[attrName] = true; } catch (_) {}
            } else {
                el.removeAttribute(attrName);
                try { el[attrName] = false; } catch (_) {}
            }
            return;
        }

        if (attrName === "value" && ("value" in el) && el.namespaceURI !== SVG_NAMESPACE) {
            el.value = newAttrVal;
        } else if (attrName === "class" && el.namespaceURI !== SVG_NAMESPACE) {
            el.className = newAttrVal;
        } else if (attrName === "style") {
            let styleVal = newAttrVal;
            if (typeof styleVal === "string" && styleVal.trim().startsWith("{") && styleVal.trim().endsWith("}")) {
                try {
                    const parsed = JSON.parse(styleVal);
                    if (typeof parsed === "object" && parsed !== null) {
                        styleVal = Object.entries(parsed)
                            .filter(([k, v]) => v !== undefined && v !== null && v !== "")
                            .map(([k, v]) => `${k.startsWith("--") ? k : k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`)
                            .join(" ");
                    }
                } catch (_) {}
            } else if (styleVal && typeof styleVal === "object") {
                styleVal = Object.entries(styleVal)
                    .filter(([k, v]) => v !== undefined && v !== null && v !== "")
                    .map(([k, v]) => `${k.startsWith("--") ? k : k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v};`)
                    .join(" ");
            }
            el.setAttribute("style", styleVal);
        } else {
            el.setAttribute(attrName, newAttrVal);
        }
    }

    applyRef(el, xmlNode, context = {}) {
        if (!el || !xmlNode || xmlNode.nodeType !== 1) return el;
        this.applyNodeAttributes(el, xmlNode, context);
        const refAttr = xmlNode.getAttribute("ref");
        if (refAttr) {
            const resolvedRef = this.interpolate(refAttr, context);
            if (resolvedRef) {
                this.refs[resolvedRef] = el;
                el.dataset.xuiRef = resolvedRef;
            }
        }
        return el;
    }

    _getLongestIncreasingSubsequence(arr) {
        const p = Array.from(arr);
        const result = [0];
        let i, j, u, v, c;
        const len = arr.length;
        for (i = 0; i < len; i++) {
            const arrI = arr[i];
            if (arrI !== -1) {
                j = result[result.length - 1];
                if (arr[j] < arrI) {
                    p[i] = j;
                    result.push(i);
                    continue;
                }
                u = 0;
                v = result.length - 1;
                while (u < v) {
                    c = (u + v) >> 1;
                    if (arr[result[c]] < arrI) {
                        u = c + 1;
                    } else {
                        v = c;
                    }
                }
                if (arrI < arr[result[u]]) {
                    if (u > 0) {
                        p[i] = result[u - 1];
                    }
                    result[u] = i;
                }
            }
        }
        u = result.length;
        v = result[u - 1];
        while (u-- > 0) {
            result[u] = v;
            v = p[v];
        }
        return result;
    }

    _reconcileKeyedDOM(container, oldKeyedMap, newKeyedMap, oldKeys, newKeys) {
        if (!oldKeys || oldKeys.length === 0) {
            const fragment = typeof document !== "undefined" ? document.createDocumentFragment() : null;
            for (let i = 0; i < newKeys.length; i++) {
                const entry = newKeyedMap.get(newKeys[i]);
                if (entry && entry.nodes) {
                    for (let n = 0; n < entry.nodes.length; n++) {
                        if (fragment) fragment.appendChild(entry.nodes[n]);
                        else container.appendChild(entry.nodes[n]);
                    }
                }
            }
            if (fragment) container.appendChild(fragment);
            return;
        }

        if (!newKeys || newKeys.length === 0) {
            oldKeyedMap.forEach(entry => {
                if (entry && entry.nodes) {
                    entry.nodes.forEach(n => {
                        if (n && n.parentNode === container) container.removeChild(n);
                    });
                }
            });
            return;
        }

        // 1. Head matching
        let start = 0;
        const oldLen = oldKeys.length;
        const newLen = newKeys.length;
        while (start < oldLen && start < newLen && oldKeys[start] === newKeys[start]) {
            start++;
        }

        // 2. Tail matching
        let oldEnd = oldLen - 1;
        let newEnd = newLen - 1;
        while (oldEnd >= start && newEnd >= start && oldKeys[oldEnd] === newKeys[newEnd]) {
            oldEnd--;
            newEnd--;
        }

        // 3. Remove deleted old nodes
        const activeNewKeys = new Set(newKeys);
        for (let i = start; i <= oldEnd; i++) {
            const oldKey = oldKeys[i];
            if (!activeNewKeys.has(oldKey)) {
                const oldEntry = oldKeyedMap.get(oldKey);
                if (oldEntry && oldEntry.nodes) {
                    oldEntry.nodes.forEach(n => {
                        if (n && n.parentNode === container) container.removeChild(n);
                    });
                }
            }
        }

        // 4. Fast Path: Pure Append / Insert
        if (start > oldEnd) {
            const anchorKey = (newEnd + 1 < newLen) ? newKeys[newEnd + 1] : null;
            const anchorEntry = anchorKey ? newKeyedMap.get(anchorKey) : null;
            const anchorNode = (anchorEntry && anchorEntry.nodes && anchorEntry.nodes[0]) || null;
            const fragment = typeof document !== "undefined" ? document.createDocumentFragment() : null;
            for (let i = start; i <= newEnd; i++) {
                const entry = newKeyedMap.get(newKeys[i]);
                if (entry && entry.nodes) {
                    for (let n = 0; n < entry.nodes.length; n++) {
                        if (fragment) fragment.appendChild(entry.nodes[n]);
                        else container.appendChild(entry.nodes[n]);
                    }
                }
            }
            if (fragment) {
                if (anchorNode && anchorNode.parentNode === container) {
                    container.insertBefore(fragment, anchorNode);
                } else {
                    container.appendChild(fragment);
                }
            }
            return;
        }

        // 5. Fast Path: Pure Removal
        if (start > newEnd) {
            return;
        }

        // 6. Middle sub-array reordering (LIS / Minimal insertBefore)
        const oldKeyToIndex = new Map();
        for (let i = start; i <= oldEnd; i++) {
            oldKeyToIndex.set(oldKeys[i], i);
        }

        const count = newEnd - start + 1;
        const sourceIndices = new Int32Array(count);
        sourceIndices.fill(-1);

        for (let i = 0; i < count; i++) {
            const newIndex = start + i;
            const newKey = newKeys[newIndex];
            if (oldKeyToIndex.has(newKey)) {
                sourceIndices[i] = oldKeyToIndex.get(newKey);
            }
        }

        const lis = this._getLongestIncreasingSubsequence(sourceIndices);
        let lisIdx = lis.length - 1;

        for (let i = count - 1; i >= 0; i--) {
            const newIndex = start + i;
            const newKey = newKeys[newIndex];
            const entry = newKeyedMap.get(newKey);
            const anchorKey = (newIndex + 1 < newLen) ? newKeys[newIndex + 1] : null;
            const anchorEntry = anchorKey ? newKeyedMap.get(anchorKey) : null;
            const anchorNode = (anchorEntry && anchorEntry.nodes && anchorEntry.nodes[0]) || null;

            if (sourceIndices[i] === -1 || lisIdx < 0 || i !== lis[lisIdx]) {
                if (entry && entry.nodes) {
                    for (let n = 0; n < entry.nodes.length; n++) {
                        if (anchorNode && anchorNode.parentNode === container) {
                            container.insertBefore(entry.nodes[n], anchorNode);
                        } else {
                            container.appendChild(entry.nodes[n]);
                        }
                    }
                }
            } else {
                lisIdx--;
            }
        }
    }

    _getCompiledForEachTemplate(xmlNode, varName, baseChildContext, fallbackContext) {
        if (xmlNode._templatePrototype) {
            return xmlNode._templatePrototype;
        }

        const templateChildren = Array.from(xmlNode.children || []);
        const isComplexOrInput = (node) => {
            if (!node || node.nodeType !== 1) return false;
            const tag = (node.tagName || "").toLowerCase();
            if (
                tag === "input" || tag === "select" || tag === "textarea" ||
                tag === "component" || tag === "for_each" || tag === "slot" ||
                tag === "children" || tag.startsWith("on_") || tag.includes("-") ||
                tag === "if" || tag === "else" || tag === "collapse" || tag === "dialog" ||
                (this._componentDefs && this._componentDefs[tag]) ||
                (this._componentRegistry && this._componentRegistry[tag])
            ) {
                return true;
            }
            return Array.from(node.children || []).some(isComplexOrInput);
        };

        const hasComplexChild = templateChildren.some(isComplexOrInput);
        if (hasComplexChild || templateChildren.length === 0) {
            xmlNode._templatePrototype = { canClone: false };
            return xmlNode._templatePrototype;
        }

        const sampleContext = Object.create(baseChildContext);
        sampleContext[varName] = {};
        sampleContext._index = 0;
        sampleContext.index = 0;

        const prototypes = [];
        const dynamicSlots = [];

        for (let cIdx = 0; cIdx < templateChildren.length; cIdx++) {
            const xmlChild = templateChildren[cIdx];
            const domChild = this.createHTMLElement(xmlChild, sampleContext);
            if (!domChild) continue;
            this.applyItemChildStyles(domChild, xmlChild, fallbackContext);

            const recordSlots = (xNode, dNode, path) => {
                if (!xNode || !dNode) return;

                if (xNode.nodeType === 3) {
                    const txt = xNode.textContent;
                    if (txt && txt.includes("{")) {
                        dynamicSlots.push({ childIndex: cIdx, path: [...path], type: "text", rawExpr: txt });
                    }
                    return;
                }

                if (xNode.nodeType === 1) {
                    if (xNode.attributes) {
                        for (let a = 0; a < xNode.attributes.length; a++) {
                            const attr = xNode.attributes[a];
                            const attrName = attr.name;
                            const attrVal = attr.value;
                            if (attrVal && attrVal.includes("{") && !attrName.startsWith("on_")) {
                                dynamicSlots.push({
                                    childIndex: cIdx,
                                    path: [...path],
                                    type: "attr",
                                    name: attrName,
                                    rawExpr: attrVal
                                });
                            }
                        }
                    }

                    const bindAttr = xNode.getAttribute("bind");
                    if (bindAttr) {
                        dynamicSlots.push({
                            childIndex: cIdx,
                            path: [...path],
                            type: "bind",
                            bindPath: bindAttr
                        });
                    }

                    if (dNode._euixEventMap && dNode._euixEventMap.size > 0) {
                        const eventsObj = Object.create(null);
                        dNode._euixEventMap.forEach((handlers, evType) => {
                            eventsObj[evType] = handlers;
                        });
                        dynamicSlots.push({
                            childIndex: cIdx,
                            path: [...path],
                            type: "event",
                            eventMap: new Map(dNode._euixEventMap),
                            eventsObj
                        });
                    }

                    const xChildren = Array.from(xNode.childNodes).filter(n => n.nodeType === 1 || (n.nodeType === 3 && n.textContent && n.textContent.trim() !== ""));
                    const dChildren = Array.from(dNode.childNodes);

                    const len = Math.min(xChildren.length, dChildren.length);
                    for (let i = 0; i < len; i++) {
                        recordSlots(xChildren[i], dChildren[i], [...path, i]);
                    }
                }
            };

            recordSlots(xmlChild, domChild, []);
            prototypes.push(domChild);
        }

        const getNodeAtPath = (root, path) => {
            let curr = root;
            for (let i = 0; i < path.length; i++) {
                if (!curr || !curr.childNodes) return null;
                curr = curr.childNodes[path[i]];
            }
            return curr;
        };

        xmlNode._templatePrototype = {
            canClone: true,
            prototypes,
            dynamicSlots,
            getNodeAtPath
        };

        return xmlNode._templatePrototype;
    }

    createHTMLElement(xmlNode, context = {}) {
        if (!xmlNode) return null;
        try {
            const el = this._createHTMLElementInternal(xmlNode, context);
            if (el && el.nodeType === 1) {
                this.processLifecycleHooks(xmlNode, el, context);
            }
            return el;
        } catch (err) {
            this.reportError(err, `Error rendering <${xmlNode.tagName || 'element'}>`);
            if (typeof document === "undefined") return null;
            const fallback = document.createElement("div");
            fallback.className = "euix-error-fallback";
            fallback.style.cssText = "padding:4px 8px;margin:2px 0;background:#fff1f2;border:1px solid #fecdd3;border-radius:6px;color:#e11d48;font-size:11px;font-family:sans-serif;";
            fallback.textContent = `⚠️ Component Error: <${xmlNode.tagName || 'unknown'}>`;
            return fallback;
        }
    }

    _createHTMLElementInternal(xmlNode, context = {}) {
        if (isTxtNode(xmlNode)) {
            let parent = xmlNode.parentNode;
            let isCodeBlock = false;
            while (parent) {
                if (parent.tagName) {
                    const tag = parent.tagName.toLowerCase();
                    if (tag === "code" || tag === "pre") {
                        isCodeBlock = true;
                        break;
                    }
                }
                parent = parent.parentNode;
            }
            const txt = xmlNode.textContent;
            if (isCodeBlock) {
                return txt ? document.createTextNode(txt) : null;
            }
            if (!txt || txt.trim() === "") return null;
            const textNode = document.createTextNode(this.interpolate(txt, context));

            const matches = Array.from(txt.matchAll(/(?:parent\.)?(?:data|local|\$local|api|\$api)\.([a-zA-Z0-9_.[\]]+)/g));
            if (matches.length > 0) {
                const uniqueKeys = new Set(matches.map(m => m[1]));
                uniqueKeys.forEach(key => {
                    if (txt.includes("api." + key) || txt.includes("$api." + key)) {
                        const parts = key.split(".");
                        const epId = parts[0];
                        const epProp = parts[1];
                        const updateFn = () => {
                            textNode.textContent = this.interpolate(txt, context);
                        };
                        if (epProp) {
                            this.registerBinding(`api:${epId}:${epProp}`, textNode, "text_node", updateFn);
                        }
                        this.registerBinding(`api:${epId}`, textNode, "text_node", updateFn);
                    } else {
                        const rootKey = getRootKey(key);
                        const isLocal = context._localState && (context._localState[key] !== undefined || context._localState[rootKey] !== undefined || txt.includes(`local.${key}`) || txt.includes(`$local.${key}`));
                        const bindKey = (context._instanceId && isLocal) ? (context._instanceId + ":" + key) : key;
                        const rootBindKey = (context._instanceId && isLocal) ? (context._instanceId + ":" + rootKey) : rootKey;
                        const updateFn = () => {
                            textNode.textContent = this.interpolate(txt, context);
                        };
                        this.registerBinding(bindKey, textNode, "text_node", updateFn);
                        if (rootBindKey !== bindKey) {
                            this.registerBinding(rootBindKey, textNode, "text_node", updateFn);
                        }
                        const innerBracketMatches = key.match(/\[(?:data\.)?([a-zA-Z0-9_]+)\]/g) || [];
                        innerBracketMatches.forEach(bm => {
                            const innerKey = bm.replace(/[[\]]|data\./g, "");
                            if (!/^\d+$/.test(innerKey)) {
                                this.registerBinding(innerKey, textNode, "text_node", updateFn);
                            }
                        });
                    }
                });
            }

            return textNode;
        }

        if (xmlNode.nodeType !== 1) return null;

        const tagName = xmlNode.tagName.toLowerCase();
        if (METADATA_AND_EVENT_TAGS.has(tagName) || tagName.startsWith("on_")) {
            if (["use_script", "script_loader", "load_script"].includes(tagName)) {
                const src = xmlNode.getAttribute("src") || xmlNode.getAttribute("url");
                if (src) this.loadScript(src, { async: xmlNode.getAttribute("async") !== "false" });
            } else if (["use_style", "style_loader", "load_style"].includes(tagName)) {
                const href = xmlNode.getAttribute("src") || xmlNode.getAttribute("href") || xmlNode.getAttribute("url");
                if (href) this.loadStyle(href);
            }
            return null;
        }

        const typeAttr = (xmlNode.getAttribute("type") || "").toLowerCase();

        if (tagName === "slot" || tagName === "children") {
            const frag = document.createElement("div");
            frag.style.display = "contents";
            frag.className = "euix-slot-wrapper";

            const slotName = xmlNode.getAttribute("name");
            const slots = context._projectedSlots;
            let projectedNodes = [];

            if (slotName && slots?.named?.has(slotName)) {
                projectedNodes = slots.named.get(slotName);
            } else if (!slotName && slots?.default?.length > 0) {
                projectedNodes = slots.default;
            }

            if (projectedNodes.length > 0) {
                projectedNodes.forEach(pNode => {
                    if (getTagName(pNode) === "slot") {
                        getChildNodes(pNode).forEach(c => {
                            const el = this.createHTMLElement(c, slots.parentContext || context);
                            if (el) frag.appendChild(el);
                        });
                    } else {
                        const el = this.createHTMLElement(pNode, slots.parentContext || context);
                        if (el) frag.appendChild(el);
                    }
                });
            } else {
                getChildNodes(xmlNode).forEach(c => {
                    const el = this.createHTMLElement(c, context);
                    if (el) frag.appendChild(el);
                });
            }
            return frag;
        }

        if (this._customComponents.has(tagName)) {
            const handler = this._customComponents.get(tagName);
            const customEl = handler(xmlNode, context, this);
            if (customEl) return this.applyRef(customEl, xmlNode, context);
        }

        if (typeAttr && this._customComponents.has(typeAttr)) {
            const handler = this._customComponents.get(typeAttr);
            const customEl = handler(xmlNode, context, this);
            if (customEl) return this.applyRef(customEl, xmlNode, context);
        }

        if (this._componentSpecs.has(tagName) || (EUIXEngineCore._globalComponentSpecs && EUIXEngineCore._globalComponentSpecs.has(tagName))) {
            const specNode = this._componentSpecs.get(tagName) || EUIXEngineCore._globalComponentSpecs.get(tagName);
            const res = this.renderComponentSpec(specNode, xmlNode, context);
            return this.applyRef(res, xmlNode, context);
        }

        if (typeAttr && (this._componentSpecs.has(typeAttr) || (EUIXEngineCore._globalComponentSpecs && EUIXEngineCore._globalComponentSpecs.has(typeAttr)))) {
            const specNode = this._componentSpecs.get(typeAttr) || EUIXEngineCore._globalComponentSpecs.get(typeAttr);
            const res = this.renderComponentSpec(specNode, xmlNode, context);
            return this.applyRef(res, xmlNode, context);
        }

        const isFlex = tagName === "flex" || typeAttr === "flex";
        const isGrid = tagName === "grid" || typeAttr === "grid";

        if (isFlex || isGrid) {
            const el = document.createElement("div");
            el.style.display = isFlex ? "flex" : "grid";
            el.className = [isFlex ? "euix-flex" : "euix-grid", this.interpolate(xmlNode.getAttribute("class") || "", context)].filter(Boolean).join(" ");
            this.applyLayoutStyles(el, xmlNode, context);
            this.bindEvents(xmlNode, el, context);

            Array.from(xmlNode.childNodes).forEach(child => {
                const childEl = this.createHTMLElement(child, context);
                if (childEl) {
                    this.applyItemChildStyles(childEl, child, context);
                    el.appendChild(childEl);
                }
            });

            return this.applyRef(el, xmlNode, context);
        }

        if (tagName === "for_each") {
            const listContainer = document.createElement("div");
            listContainer.className = "euix-list-container";
            listContainer.style.display = "contents";

            const setupDelegation = (containerTarget) => {
                if (!containerTarget || containerTarget._delegatedBound) return;
                containerTarget._delegatedBound = true;
                const events = ["click", "change", "input", "submit", "keyup", "keydown"];
                for (let eIdx = 0; eIdx < events.length; eIdx++) {
                    const evtType = events[eIdx];
                    containerTarget.addEventListener(evtType, (e) => {
                        let target = e.target;
                        while (target && target !== containerTarget) {
                            const handlerNodes = target.__euixEvents ? target.__euixEvents[evtType] : (target._euixEventMap ? target._euixEventMap.get(evtType) : null);
                            if (handlerNodes) {
                                if (e._euixHandled) return;
                                e._euixHandled = true;
                                const targetContext = target._euixContext || {};
                                this.executeEventHandlers(handlerNodes, evtType, e, target, targetContext);
                                break;
                            }
                            target = target.parentNode;
                        }
                    });
                }
            };

            setupDelegation(listContainer);

            const isVirtual = xmlNode.getAttribute("virtual") === "true" || xmlNode.getAttribute("virtual_scroll") === "true";
            const itemHeight = parseInt(xmlNode.getAttribute("item_height") || xmlNode.getAttribute("row_height") || "40", 10);
            const containerHeight = xmlNode.getAttribute("height") || xmlNode.getAttribute("max_height") || "400px";
            const buffer = parseInt(xmlNode.getAttribute("buffer") || "4", 10);

            let spacer = null;
            let contentWrapper = null;

            if (isVirtual) {
                listContainer.style.display = "block";
                listContainer.style.position = "relative";
                listContainer.style.overflowY = "auto";
                listContainer.style.height = containerHeight.includes("px") || containerHeight.includes("%") || containerHeight.includes("vh") ? containerHeight : `${containerHeight}px`;
                listContainer.className = [listContainer.className, "euix-virtual-list", xmlNode.getAttribute("class") || ""].filter(Boolean).join(" ");

                spacer = document.createElement("div");
                spacer.className = "euix-virtual-spacer";
                spacer.style.width = "100%";
                spacer.style.pointerEvents = "none";
                listContainer.appendChild(spacer);

                contentWrapper = document.createElement("div");
                contentWrapper.className = "euix-virtual-content";
                contentWrapper.style.position = "absolute";
                contentWrapper.style.top = "0";
                contentWrapper.style.left = "0";
                contentWrapper.style.right = "0";
                listContainer.appendChild(contentWrapper);
            }

            const itemsAttr = xmlNode.getAttribute("items") || "";
            const itemsKey = this.parseBindPath(itemsAttr);
            const varName = xmlNode.getAttribute("var") || "item";
            const keyAttr = xmlNode.getAttribute("key") || xmlNode.getAttribute("key_field") || xmlNode.getAttribute("item_key") || "";

            const getItemKey = (item, idx) => {
                if (keyAttr) {
                    if (keyAttr.startsWith("{") && keyAttr.endsWith("}")) {
                        const childContext = { ...context, [varName]: item, _index: idx, index: idx, _parentStateKey: itemsKey, _insideForEach: true };
                        const res = this.interpolate(keyAttr, childContext);
                        if (res !== undefined && res !== null && res !== "") return String(res);
                    } else if (typeof item === "object" && item !== null && item[keyAttr] !== undefined && item[keyAttr] !== null) {
                        return String(item[keyAttr]);
                    }
                }
                if (typeof item === "object" && item !== null && item.id !== undefined && item.id !== null) {
                    return String(item.id);
                }
                return `__idx_${idx}`;
            };

            const getItemHash = (item) => {
                if (isObj(item)) {
                    if (item.__v !== undefined) return item.__v;
                    let h = "";
                    for (const k in item) {
                        if (k !== "_index" && k !== "index") {
                            const v = item[k];
                            h += k + ":" + (isObj(v) ? (v.id ?? v.key ?? Object.keys(v).length) : v) + ";";
                        }
                    }
                    return h;
                }
                return String(item);
            };

            const renderItems = () => {
                let list = (this._rawState && this._rawState[itemsKey] && Array.isArray(this._rawState[itemsKey]))
                    ? this._rawState[itemsKey]
                    : null;
                if (!list) {
                    const resolved = this.resolveValueFromPath(itemsKey || itemsAttr.replace(/^\{|\}$/g, ""), context);
                    if (Array.isArray(resolved)) {
                        list = resolved;
                    } else {
                        list = [];
                    }
                }

                const templateChildren = Array.from(xmlNode.children);
                const baseChildContext = Object.create(context);
                baseChildContext._parentStateKey = itemsKey;
                baseChildContext._insideForEach = true;

                const compiled = this._getCompiledForEachTemplate(xmlNode, varName, baseChildContext, context);

                const createItemNodes = (item, idx) => {
                    const childContext = Object.create(baseChildContext);
                    childContext[varName] = item;
                    childContext._index = idx;
                    childContext.index = idx;

                    if (compiled && compiled.canClone) {
                        const nodes = [];
                        for (let pIdx = 0; pIdx < compiled.prototypes.length; pIdx++) {
                            const proto = compiled.prototypes[pIdx];
                            const clone = proto.cloneNode(true);
                            nodes.push(clone);
                        }

                        for (let sIdx = 0; sIdx < compiled.dynamicSlots.length; sIdx++) {
                            const slot = compiled.dynamicSlots[sIdx];
                            const rootNode = nodes[slot.childIndex];
                            if (!rootNode) continue;
                            const targetNode = slot.path.length === 0 ? rootNode : compiled.getNodeAtPath(rootNode, slot.path);
                            if (!targetNode) continue;

                            if (slot.type === "text") {
                                const txt = this.interpolate(slot.rawExpr, childContext);
                                if (targetNode.nodeType === 3) {
                                    targetNode.data = txt;
                                } else {
                                    targetNode.textContent = txt;
                                }
                            } else if (slot.type === "attr") {
                                const val = this.interpolate(slot.rawExpr, childContext);
                                if (slot.name === "class") {
                                    targetNode.className = val;
                                } else {
                                    targetNode.setAttribute(slot.name, val);
                                }
                            } else if (slot.type === "bind") {
                                const resolvedBind = this.resolveBindPath(slot.bindPath, childContext);
                                const currentVal = this.getState(resolvedBind) ?? this.resolveValueFromPath(slot.bindPath, childContext);
                                if (targetNode.type === "checkbox") {
                                    targetNode.checked = this.isTruthy(currentVal);
                                } else {
                                    targetNode.value = currentVal ?? "";
                                }
                            } else if (slot.type === "event") {
                                targetNode._euixEventMap = slot.eventMap;
                                targetNode.__euixEvents = slot.eventsObj;
                                targetNode._euixContext = childContext;
                            }
                        }
                        return nodes;
                    }

                    const nodes = [];
                    for (let cIdx = 0; cIdx < templateChildren.length; cIdx++) {
                        const child = templateChildren[cIdx];
                        const el = this.createHTMLElement(child, childContext);
                        if (el) {
                            this.applyItemChildStyles(el, child, context);
                            nodes.push(el);
                        }
                    }
                    return nodes;
                };

                if (isVirtual) {
                    const totalItems = list.length;
                    spacer.style.height = `${totalItems * itemHeight}px`;

                    if (totalItems === 0) {
                        contentWrapper.innerHTML = "";
                        contentWrapper.style.transform = "translateY(0px)";
                        contentWrapper._keyedNodesMap = new Map();
                        return;
                    }

                    const renderSlice = () => {
                        const scrollTop = listContainer.scrollTop || 0;
                        const clientHeight = listContainer.clientHeight || parseInt(containerHeight, 10) || 400;
                        const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
                        const endIndex = Math.min(totalItems, Math.ceil((scrollTop + clientHeight) / itemHeight) + buffer);

                        contentWrapper.style.transform = `translateY(${startIndex * itemHeight}px)`;

                        contentWrapper._keyedNodesMap = contentWrapper._keyedNodesMap || new Map();
                        const oldKeyedMap = contentWrapper._keyedNodesMap;
                        const newKeyedMap = new Map();
                        const activeKeys = new Set();
                        const itemNodesSequence = [];

                        for (let i = startIndex; i < endIndex; i++) {
                            const item = list[i];
                            if (!item) continue;
                            if (typeof item === "object" && item !== null) {
                                try { item._index = i; item.index = i; } catch (_) {}
                            }
                            const key = getItemKey(item, i);
                            const hash = getItemHash(item);
                            activeKeys.add(key);

                            const existing = oldKeyedMap.get(key);
                            let nodes;

                            if (existing && existing.hash === hash && existing.nodes.length > 0) {
                                nodes = existing.nodes;
                            } else {
                                nodes = createItemNodes(item, i);
                                if (existing && existing.nodes) {
                                    existing.nodes.forEach(oldNode => {
                                        if (oldNode && oldNode.parentNode === contentWrapper) {
                                            contentWrapper.removeChild(oldNode);
                                        }
                                    });
                                }
                            }
                            newKeyedMap.set(key, { nodes, hash, index: i });
                            itemNodesSequence.push(...nodes);
                        }

                        oldKeyedMap.forEach((existing, key) => {
                            if (!activeKeys.has(key) && existing.nodes) {
                                existing.nodes.forEach(oldNode => {
                                    if (oldNode && oldNode.parentNode === contentWrapper) {
                                        contentWrapper.removeChild(oldNode);
                                    }
                                });
                            }
                        });

                        const fragment = typeof document !== "undefined" ? document.createDocumentFragment() : null;
                        for (let nIdx = 0; nIdx < itemNodesSequence.length; nIdx++) {
                            const node = itemNodesSequence[nIdx];
                            if (node) {
                                if (fragment) fragment.appendChild(node);
                                else contentWrapper.appendChild(node);
                            }
                        }
                        if (fragment) {
                            contentWrapper.appendChild(fragment);
                        }
                        contentWrapper._keyedNodesMap = newKeyedMap;
                    };

                    renderSlice();

                    if (!listContainer._virtualScrollBound) {
                        listContainer._virtualScrollBound = true;
                        let ticking = false;
                        listContainer.addEventListener("scroll", () => {
                            if (!ticking) {
                                (typeof requestAnimationFrame !== "undefined" ? requestAnimationFrame : (cb) => cb())(() => {
                                    renderSlice();
                                    ticking = false;
                                });
                                ticking = true;
                            }
                        }, { passive: true });
                    }
                    return;
                }

                listContainer._keyedNodesMap = listContainer._keyedNodesMap || new Map();
                const oldKeyedMap = listContainer._keyedNodesMap;
                const oldKeys = listContainer._oldKeysSequence || EMPTY_ARR;
                const newKeyedMap = new Map();
                const newKeys = [];

                for (let idx = 0; idx < list.length; idx++) {
                    const item = list[idx];
                    if (typeof item === "object" && item !== null) {
                        try {
                            item._index = idx;
                            item.index = idx;
                        } catch (_) {}
                    }

                    const key = getItemKey(item, idx);
                    const hash = getItemHash(item);
                    newKeys.push(key);

                    const existing = oldKeyedMap.get(key);
                    let nodes;

                    if (existing && existing.hash === hash && existing.nodes.length > 0) {
                        nodes = existing.nodes;
                    } else {
                        nodes = createItemNodes(item, idx);
                        if (existing && existing.nodes && existing.nodes.length > 0) {
                            const firstOld = existing.nodes[0];
                            if (firstOld && firstOld.parentNode === listContainer) {
                                for (let n = 0; n < nodes.length; n++) {
                                    listContainer.insertBefore(nodes[n], firstOld);
                                }
                                existing.nodes.forEach(oldNode => {
                                    if (oldNode && oldNode.parentNode === listContainer) {
                                        listContainer.removeChild(oldNode);
                                    }
                                });
                            }
                        }
                    }

                    newKeyedMap.set(key, { nodes, hash, index: idx });
                }

                // Reconcile DOM with minimal LIS mutations
                this._reconcileKeyedDOM(listContainer, oldKeyedMap, newKeyedMap, oldKeys, newKeys);

                listContainer._keyedNodesMap = newKeyedMap;
                listContainer._oldKeysSequence = newKeys;
            };

            renderItems();

            if (itemsKey) {
                this.registerBinding(itemsKey, listContainer, "for_each", () => {
                    renderItems();
                });
            }

            return listContainer;
        }

        if (tagName === "if") {
            return this.renderConditional(xmlNode, context);
        }

        if (tagName === "else" || tagName === "else_if") {
            return null;
        }

        if (tagName === "form") {
            const form = document.createElement("form");
            const formClass = this.interpolate(xmlNode.getAttribute("class") || "", context);
            if (formClass) form.className = formClass;
            this.bindEvents(xmlNode, form, context);

            form.onsubmit = (e) => {
                e.preventDefault();
            };

            Array.from(xmlNode.childNodes).forEach(child => {
                const childEl = this.createHTMLElement(child, context);
                if (childEl) form.appendChild(childEl);
            });

            return this.applyRef(form, xmlNode, context);
        }

        if (tagName === "select") {
            const sel = document.createElement("select");
            const selClass = this.interpolate(xmlNode.getAttribute("class") || "", context);
            if (selClass) sel.className = selClass;
            const bindPath = this.resolveBindPath(xmlNode);

            if (bindPath) {
                sel.value = this.getState(bindPath) ?? "";
                this.registerBinding(bindPath, sel, "input");
                sel.addEventListener("change", (e) => {
                    this.setState(bindPath, e.target.value);
                });
            }

            this.bindEvents(xmlNode, sel, context);

            Array.from(xmlNode.childNodes).forEach(child => {
                const childEl = this.createHTMLElement(child, context);
                if (childEl) sel.appendChild(childEl);
            });

            if (bindPath) sel.value = this.getState(bindPath) ?? "";

            return this.applyRef(sel, xmlNode, context);
        }

        if (tagName === "option") {
            const opt = document.createElement("option");
            const valAttr = xmlNode.getAttribute("value");
            opt.value = valAttr ? this.interpolate(valAttr, context) : xmlNode.textContent.trim();
            opt.textContent = this.interpolate(xmlNode.textContent.trim(), context);
            if (xmlNode.getAttribute("selected") === "true") opt.selected = true;
            return opt;
        }

        if (tagName === "textarea") {
            const ta = document.createElement("textarea");
            const taClass = this.interpolate(xmlNode.getAttribute("class") || "", context);
            if (taClass) ta.className = taClass;
            const placeholder = xmlNode.getAttribute("placeholder");
            if (placeholder) ta.placeholder = this.interpolate(placeholder, context);
            const rows = xmlNode.getAttribute("rows");
            if (rows) ta.rows = parseInt(rows, 10);

            const bindPath = this.resolveBindPath(xmlNode);
            if (bindPath) {
                ta.value = this.getState(bindPath) ?? "";
                this.registerBinding(bindPath, ta, "input");
                ta.oninput = (e) => {
                    this.setState(bindPath, e.target.value, { sourceEl: e.target });
                };
            }
            this.bindEvents(xmlNode, ta, context);
            return this.applyRef(ta, xmlNode, context);
        }

        if (tagName === "input") {
            const inputType = (xmlNode.getAttribute("type") || "text").toLowerCase();
            const el = document.createElement("input");
            el.type = inputType;
            if (xmlNode.getAttribute("class")) el.className = this.interpolate(xmlNode.getAttribute("class"), context);
            if (xmlNode.getAttribute("placeholder")) el.placeholder = this.interpolate(xmlNode.getAttribute("placeholder"), context);
            if (xmlNode.getAttribute("autofocus") === "true") el.dataset.xuiAutofocus = "true";
            if (xmlNode.getAttribute("min")) el.min = xmlNode.getAttribute("min");
            if (xmlNode.getAttribute("max")) el.max = xmlNode.getAttribute("max");
            if (xmlNode.getAttribute("step")) el.step = xmlNode.getAttribute("step");
            if (xmlNode.getAttribute("name")) el.name = this.interpolate(xmlNode.getAttribute("name"), context);
            if (xmlNode.getAttribute("value")) el.value = this.interpolate(xmlNode.getAttribute("value"), context);

            const bindPath = this.resolveBindPath(xmlNode);
            const binding = this.resolveBinding(xmlNode, context);

            if (inputType === "checkbox") {
                if (binding) {
                    el.checked = this.isTruthy(this.getBindingValue(binding, context));
                    if (binding.type === "state") this.registerBinding(binding.path, el, "checkbox");
                    el.onchange = (e) => this.setBindingValue(binding, e.target.checked ? "true" : "false", context);
                }
            } else if (inputType === "radio") {
                if (binding) {
                    const current = String(this.getBindingValue(binding, context) ?? "");
                    el.checked = (current === el.value);
                    if (binding.type === "state") this.registerBinding(binding.path, el, "radio");
                    el.onchange = (e) => {
                        if (e.target.checked) this.setBindingValue(binding, el.value, context);
                    };
                }
            } else if (bindPath) {
                el.value = this.getState(bindPath) ?? "";
                this.registerBinding(bindPath, el, "input");
                el.oninput = (e) => this.setState(bindPath, e.target.value, { sourceEl: e.target });
            }

            this.bindEvents(xmlNode, el, context);
            return this.applyRef(el, xmlNode, context);
        }

        if (tagName === "img" || tagName === "image") {
            const el = document.createElement("img");
            if (xmlNode.getAttribute("class")) el.className = this.interpolate(xmlNode.getAttribute("class"), context);
            const rawSrc = xmlNode.getAttribute("src") || "";
            const alt = xmlNode.getAttribute("alt") || "";
            const resolvedSrc = this.interpolate(rawSrc, context);
            const fallbackSrc = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80";

            el.src = resolvedSrc || fallbackSrc;
            el.alt = this.interpolate(alt, context);
            el.onerror = () => {
                el.src = fallbackSrc;
            };

            if (xmlNode.getAttribute("width")) el.width = parseInt(xmlNode.getAttribute("width"), 10) || undefined;
            if (xmlNode.getAttribute("height")) el.height = parseInt(xmlNode.getAttribute("height"), 10) || undefined;
            this.bindEvents(xmlNode, el, context);
            return this.applyRef(el, xmlNode, context);
        }

        if (tagName === "button") {
            const el = document.createElement("button");
            if (xmlNode.getAttribute("class")) el.className = this.interpolate(xmlNode.getAttribute("class"), context);
            const btnType = xmlNode.getAttribute("type");
            if (btnType) el.type = btnType;
            this.bindEvents(xmlNode, el, context);

            Array.from(xmlNode.childNodes).forEach(child => {
                if (child.nodeType === Node.ELEMENT_NODE &&
                    ["on_click", "on_change", "on_submit", "on_keyup", "on_keydown", "on_mouseenter", "on_mouseleave", "event", "on", "label"].includes(child.tagName.toLowerCase())) {
                    if (child.tagName.toLowerCase() === "label") {
                        const lblText = this.interpolate(child.textContent.trim(), context);
                        el.appendChild(document.createTextNode(lblText));
                    }
                    return;
                }
                const childEl = this.createHTMLElement(child, context);
                if (childEl) el.appendChild(childEl);
            });

            return this.applyRef(el, xmlNode, context);
        }

        if (tagName === "collapse") {
            return isFn(this.renderCollapse) ? this.renderCollapse(xmlNode, context) : null;
        }

        if (tagName === "dialog") {
            return isFn(this.renderDialog) ? this.renderDialog(xmlNode, context) : null;
        }

        if (tagName === "head" || tagName === "helmet") {
            return isFn(this.renderHead) ? this.renderHead(xmlNode, context) : null;
        }

        if (tagName === "title" && isFn(this.renderHeadTitle)) {
            return this.renderHeadTitle(xmlNode, context);
        }

        if (tagName === "component") {
            const type = xmlNode.getAttribute("type");
            const bindPath = this.resolveBindPath(xmlNode);
            let el;

            if (type === "title") el = document.createElement("h2");
            else if (type === "text") el = document.createElement("span");
            else if (type === "button") el = document.createElement("button");
            else if (type === "image") {
                el = document.createElement("img");
                const src = xmlNode.getAttribute("src") || "";
                const alt = xmlNode.getAttribute("alt") || "";
                el.src = this.interpolate(src, context);
                el.alt = this.interpolate(alt, context);
                if (xmlNode.getAttribute("width")) el.width = parseInt(xmlNode.getAttribute("width"), 10) || undefined;
                if (xmlNode.getAttribute("height")) el.height = parseInt(xmlNode.getAttribute("height"), 10) || undefined;
            }
            else if (type === "text_input") {
                el = document.createElement("input");
                el.type = "text";
                el.placeholder = xmlNode.getAttribute("placeholder") || "";

                if (bindPath) {
                    el.value = this.getState(bindPath) ?? "";
                    this.registerBinding(bindPath, el, "input");

                    el.oninput = (e) => {
                        this.setState(bindPath, e.target.value, {
                            sourceEl: e.target
                        });
                    };
                } else {
                    const valNode = this.getChild(xmlNode, "value");
                    if (valNode) el.value = this.interpolate(valNode.textContent, context);
                }

                if (xmlNode.getAttribute("autofocus") === "true") {
                    el.dataset.xuiAutofocus = "true";
                }
            } else if (type === "checkbox") {
                el = document.createElement("input");
                el.type = "checkbox";
                const binding = this.resolveBinding(xmlNode, context);
                if (binding) {
                    el.checked = this.isTruthy(this.getBindingValue(binding, context));
                    if (binding.type === "state") {
                        this.registerBinding(binding.path, el, "checkbox");
                    }
                    el.onchange = (e) => {
                        const next = e.target.checked ? "true" : "false";
                        this.setBindingValue(binding, next, context);
                    };
                }
            } else if (type === "radio") {
                el = document.createElement("input");
                el.type = "radio";
                const radioName = xmlNode.getAttribute("name") || "xui_radio";
                el.name = this.interpolate(radioName, context);
                const radioVal = xmlNode.getAttribute("value") || "";
                el.value = this.interpolate(radioVal, context);

                const binding = this.resolveBinding(xmlNode, context);
                if (binding) {
                    const current = String(this.getBindingValue(binding, context) ?? "");
                    el.checked = (current === el.value);
                    if (binding.type === "state") {
                        this.registerBinding(binding.path, el, "radio");
                    }
                    el.onchange = (e) => {
                        if (e.target.checked) {
                            this.setBindingValue(binding, el.value, context);
                        }
                    };
                }
            } else if (type === "textarea") {
                el = document.createElement("textarea");
                if (xmlNode.getAttribute("placeholder")) el.placeholder = this.interpolate(xmlNode.getAttribute("placeholder"), context);
                if (xmlNode.getAttribute("rows")) el.rows = parseInt(xmlNode.getAttribute("rows"), 10);
                if (bindPath) {
                    el.value = this.getState(bindPath) ?? "";
                    this.registerBinding(bindPath, el, "input");
                    el.oninput = (e) => {
                        this.setState(bindPath, e.target.value, { sourceEl: e.target });
                    };
                }
            } else if (["number_input", "range_input", "date_input", "color_input", "file_input"].includes(type)) {
                el = document.createElement("input");
                el.type = type.replace("_input", "");
                if (xmlNode.getAttribute("min")) el.min = xmlNode.getAttribute("min");
                if (xmlNode.getAttribute("max")) el.max = xmlNode.getAttribute("max");
                if (xmlNode.getAttribute("step")) el.step = xmlNode.getAttribute("step");
                if (xmlNode.getAttribute("placeholder")) el.placeholder = xmlNode.getAttribute("placeholder");

                if (bindPath) {
                    el.value = this.getState(bindPath) ?? "";
                    this.registerBinding(bindPath, el, "input");
                    el.oninput = (e) => {
                        this.setState(bindPath, e.target.value, { sourceEl: e.target });
                    };
                }
            } else {
                try {
                    el = document.createElement(tagName);
                    if (tagName === "form") {
                        el.onsubmit = (e) => { e.preventDefault(); };
                    }
                } catch (_) {
                    el = document.createElement("div");
                }
            }

            const elClass = this.interpolate(xmlNode.getAttribute("class") || "", context);
            if (elClass && el) el.className = elClass;

            if (type === "text" && bindPath) {
                const templateNode = this.getChild(xmlNode, "template");
                const inlineTemplate = Array.from(xmlNode.childNodes)
                    .filter(isTxtNode)
                    .map(n => n.textContent)
                    .join("")
                    .trim();

                if (templateNode) {
                    const html = templateNode.innerHTML.trim();
                    if (html.includes("<")) el.dataset.xuiHtmlTemplate = html;
                    else el.dataset.xuiTextTemplate = templateNode.textContent.trim();
                } else if (inlineTemplate.includes("{value}")) {
                    el.dataset.xuiTextTemplate = inlineTemplate;
                }

                this.registerBinding(bindPath, el, "text");
                this.syncBindings(bindPath, this.getState(bindPath));
            }

            this.bindEvents(xmlNode, el, context);

            Array.from(xmlNode.childNodes).forEach(child => {
                if (child.nodeType === Node.ELEMENT_NODE &&
                    ["on_click", "on_change", "on_submit", "on_keyup", "on_keydown", "on_mouseenter", "on_mouseleave", "event", "on", "value", "template"].includes(child.tagName.toLowerCase())) {
                    return;
                }
                if (type === "text" && bindPath && isTxtNode(child)) {
                    return;
                }
                const childEl = this.createHTMLElement(child, context);
                if (childEl) {
                    this.applyItemChildStyles(childEl, child, context);
                    el.appendChild(childEl);
                }
            });

            return this.applyRef(el, xmlNode, context);
        }

        const isSvg = tagName === "svg" || context.isSvg || SVG_TAGS.has(tagName);
        const elementTagName = (isSvg || ALLOWED_HTML_TAGS.has(tagName)) ? tagName : "div";
        const div = isSvg 
            ? document.createElementNS(SVG_NAMESPACE, xmlNode.tagName || tagName)
            : document.createElement(elementTagName);
        const xmlClass = this.interpolate(xmlNode.getAttribute("class") || "", context);
        if (xmlClass) {
            if (isSvg) div.setAttribute("class", xmlClass);
            else div.className = xmlClass;
        }

        if (tagName === "layout") {
            const layoutType = xmlNode.getAttribute("type") || "";
            div.className = [layoutType, xmlClass].filter(Boolean).join(" ");
            this.applyLayoutStyles(div, xmlNode, context);
        }

        this.bindEvents(xmlNode, div, context);

        const isCodeOrPreTag = tagName === "code" || tagName === "pre";
        const isInsideCodeOrPre = context._isInsideCodeOrPre || isCodeOrPreTag;
        const childContext = isSvg 
            ? (isInsideCodeOrPre ? { ...context, isSvg: true, _isInsideCodeOrPre: true } : { ...context, isSvg: true })
            : (isInsideCodeOrPre && !context._isInsideCodeOrPre ? { ...context, _isInsideCodeOrPre: true } : context);

        getChildNodes(xmlNode).forEach(child => {
            if (isElem(child) && (EVENT_TAGS.has(getTagName(child)) || METADATA_AND_EVENT_TAGS.has(getTagName(child)))) {
                return;
            }
            const childEl = this.createHTMLElement(child, childContext);
            if (childEl) {
                this.applyItemChildStyles(childEl, child, childContext);
                div.appendChild(childEl);
            }
        });

        const childElementNodes = getChildNodes(xmlNode).filter(n =>
            isElem(n) && !EVENT_TAGS.has(getTagName(n))
        );

        let hasCodeOrPreDescendant = xmlNode._hasCodeOrPre;
        if (hasCodeOrPreDescendant === undefined) {
            hasCodeOrPreDescendant = xmlNode.querySelector ? !!(xmlNode.querySelector("code") || xmlNode.querySelector("pre")) : false;
            xmlNode._hasCodeOrPre = hasCodeOrPreDescendant;
        }

        if (!isInsideCodeOrPre && !hasCodeOrPreDescendant && childElementNodes.length === 0 && !["input", "select", "textarea", "form", "code", "pre"].includes(tagName) && !["text_input", "checkbox", "radio", "textarea", "number_input", "range_input", "date_input", "color_input", "file_input"].includes(typeAttr)) {
            const bindAttr = xmlNode.getAttribute("bind");
            if (bindAttr) {
                const genericBindPath = this.resolveBindPath(xmlNode);
                if (genericBindPath) {
                    const isLocal = context._localState && (context._localState[genericBindPath] !== undefined || genericBindPath.startsWith("local."));
                    const cleanPath = genericBindPath.replace(/^local\./, "");
                    const bindKey = (context._instanceId && isLocal) ? (context._instanceId + ":" + cleanPath) : cleanPath;
                    const trimmed = xmlNode.textContent ? xmlNode.textContent.trim() : "";
                    if (trimmed.includes("{value}")) {
                        div.dataset.euixTextTemplate = trimmed;
                    }
                    this.registerBinding(bindKey, div, "text");
                    this.syncBindings(bindKey, isLocal ? context._localState[cleanPath] : this.getState(cleanPath));
                }
            }
        }

        const isContentEditable = xmlNode.getAttribute("contenteditable") === "true" || xmlNode.getAttribute("contenteditable") === "";
        if (isContentEditable) {
            const binding = this.resolveBinding(xmlNode, context);
            if (binding) {
                const initialVal = this.getBindingValue(binding, context);
                if (initialVal !== undefined && initialVal !== null) {
                    div.innerHTML = String(initialVal);
                }
                const updateFn = (val) => {
                    if (typeof document !== "undefined" && document.activeElement !== div) {
                        div.innerHTML = (val !== undefined && val !== null ? String(val) : "");
                    }
                };
                if (binding.type === "state") {
                    this.registerBinding(binding.path, div, "contenteditable", updateFn);
                }
                div.addEventListener("input", () => {
                    this.setBindingValue(binding, div.innerHTML, context, { sourceEl: div });
                });
                div.addEventListener("blur", () => {
                    this.setBindingValue(binding, div.innerHTML, context, { sourceEl: div });
                });
            }
        }

        return this.applyRef(div, xmlNode, context);
    }

    executeEventHandlers(handlerNodes, eventType, e, el, context = {}) {
        if (isFn(this.handleDragEvent)) {
            this.handleDragEvent(eventType, e, el, context);
        }
        if (eventType === "submit") {
            e.preventDefault();
            const formEl = el.tagName === "FORM" ? el : el.closest("form");
            if (formEl && isFn(formEl.checkValidity)) {
                if (!formEl.checkValidity()) {
                    if (isFn(formEl.reportValidity)) {
                        formEl.reportValidity();
                    }
                    return;
                }
            }
        }

        if (eventType === "click" && (el.type === "submit" || (el.tagName === "BUTTON" && el.closest("form")))) {
            const formEl = el.closest("form");
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

        const eventContext = { ...context, _targetEl: el, _evt: e };

        for (const node of handlerNodes) {
            const targetKey = node.getAttribute("key") || node.getAttribute("code");
            if (targetKey && e.key && e.key.toLowerCase() !== targetKey.toLowerCase()) {
                continue;
            }

            if (node.getAttribute("prevent_default") === "true" || node.getAttribute("prevent") === "true" || node.getAttribute("prevent_default") === "") {
                if (e && isFn(e.preventDefault)) e.preventDefault();
            }
            if (node.getAttribute("stop_propagation") === "true" || node.getAttribute("stop") === "true" || node.getAttribute("stop_propagation") === "") {
                if (e && isFn(e.stopPropagation)) e.stopPropagation();
            }

            if (!this.confirmAction(node, eventContext)) continue;

            if (node.getAttribute("action")) {
                const actType = node.getAttribute("action");
                if (actType === "XHR") this.handleXHR(node, eventContext);
                else this.handleAction(node, eventContext);
            } else {
                const childActions = Array.from(node.children).filter(c => c.tagName && c.tagName.toLowerCase() !== "confirm");
                if (childActions.length) {
                    (async () => {
                        for (const act of childActions) {
                            await this.handleAction(act, eventContext);
                        }
                    })().catch(err => this.reportError(err, "Event Action Execution"));
                }
            }
        }
    }

    bindEvents(xmlNode, el, context = {}) {
        if (!el || xmlNode.nodeType !== Node.ELEMENT_NODE) return;
        if (xmlNode._hasEventTags === false) return;

        const eventMap = new Map();
        const childNodes = xmlNode.children || [];

        for (let i = 0; i < childNodes.length; i++) {
            const child = childNodes[i];
            const tagName = child.tagName.toLowerCase();
            let eventType = null;

            if (tagName === "on_click") eventType = "click";
            else if (tagName === "on_change") eventType = "change";
            else if (tagName === "on_submit") eventType = (el.tagName && el.tagName.toLowerCase() === "button") ? "click" : "submit";
            else if (tagName === "on_keyup") eventType = "keyup";
            else if (tagName === "on_keydown") eventType = "keydown";
            else if (tagName === "on_mouseenter") eventType = "mouseenter";
            else if (tagName === "on_mouseleave") eventType = "mouseleave";
            else if (tagName.startsWith("on_")) eventType = tagName.replace(/^on_/, "");
            else if (tagName === "event" || tagName === "on") {
                eventType = (child.getAttribute("type") || child.getAttribute("name") || child.getAttribute("event") || "click").toLowerCase();
            }

            if (eventType) {
                if (!eventMap.has(eventType)) eventMap.set(eventType, []);
                eventMap.get(eventType).push(child);
            }
        }

        if (typeof this.setupDropListener === "function") {
            this.setupDropListener(el, eventMap, context);
        }

        if (eventMap.size === 0) {
            xmlNode._hasEventTags = false;
            return;
        }

        xmlNode._hasEventTags = true;
        el._euixEventMap = eventMap;
        el._euixContext = context;

        const eventsObj = Object.create(null);
        eventMap.forEach((handlerNodes, eventType) => {
            eventsObj[eventType] = handlerNodes;
        });
        el.__euixEvents = eventsObj;

        eventMap.forEach((handlerNodes, eventType) => {
            el.addEventListener(eventType, (e) => {
                if (e._euixHandled) return;
                e._euixHandled = true;
                this.executeEventHandlers(handlerNodes, eventType, e, el, context);
            });
        });
    }

    renderComponentSpec(specNode, usageNode, context = {}) {
        if (!specNode) return null;

        const rawChildren = getChildNodes(usageNode).filter(n => isElem(n) || (isTxtNode(n) && trimStr(n) !== ""));
        const namedSlots = new Map();
        const defaultSlots = [];

        rawChildren.forEach(child => {
            if (isElem(child)) {
                const slotName = child.getAttribute("slot") || (getTagName(child) === "slot" ? child.getAttribute("name") : null);
                if (slotName) {
                    if (!namedSlots.has(slotName)) namedSlots.set(slotName, []);
                    namedSlots.get(slotName).push(child);
                    return;
                }
            }
            defaultSlots.push(child);
        });

        const props = {};

        Array.from(usageNode.attributes || []).forEach(attr => {
            if (attr.name !== "type" && attr.name !== "class") {
                props[attr.name] = this.interpolate(attr.value, context);
            }
        });

        const compConstants = {};
        const constsNodes = Array.from(specNode.querySelectorAll("constants > const, constants > constant, vars > var, variables > variable"));
        constsNodes.forEach(node => {
            const id = node.getAttribute("id") || node.getAttribute("name") || node.getAttribute("key");
            if (id) compConstants[id] = node.textContent.trim();
        });

        const compDepth = (context._compDepth || 0) + 1;
        const compName = getAttr(specNode, "name", "id") || getTagName(usageNode) || "component";
        if (compDepth > 20) {
            const err = new Error(`[EUIXEngine Infinite Loop Guard] Maximum component recursion depth (20) exceeded for component <${compName}>`);
            this.reportError(err, "Infinite Component Loop Guard");
            const errEl = document.createElement("div");
            errEl.className = "euix-recursion-error text-xs text-rose-600 font-bold p-2 bg-rose-50 border border-rose-200 rounded";
            errEl.textContent = `[Recursion Error] <${compName}> exceeds max depth (20)`;
            return errEl;
        }

        let componentApiConfig = context._componentApiConfig ? { ...context._componentApiConfig } : null;
        const apiNode = this.getChild(specNode, "api_config") || specNode.querySelector("api_config, api_client, api");
        if (apiNode) {
            const baseUrl = getAttr(apiNode, "base_url", "baseUrl", "url");
            const credentials = apiNode.getAttribute("credentials") || undefined;
            const timeout = toNum(apiNode.getAttribute("timeout"));
            const headers = new Map(componentApiConfig?.headers || []);
            
            const headersNode = this.getChild(apiNode, "headers");
            if (headersNode) {
                this.getChildren(headersNode, "header").forEach(h => {
                    const name = h.getAttribute("name");
                    if (name) headers.set(name, trimStr(h));
                });
            }

            componentApiConfig = { baseUrl, credentials, timeout, headers };
        }

        const dataModelNode = this.getChild(specNode, "data_model") || specNode.querySelector("data_model");
        const isIsolated = isScoped(usageNode) || isScoped(specNode) || isScoped(dataModelNode);

        const localRawState = {};
        let hasLocalState = false;
        const stateNodes = dataModelNode ? this.getChildren(dataModelNode, "state") : (specNode.querySelectorAll ? Array.from(specNode.querySelectorAll("data_model > state")) : []);
        stateNodes.forEach(node => {
            const id = node.getAttribute("id");
            if (!id) return;
            const scope = node.getAttribute("scope");
            const isStateLocal = isIsolated || scope === "local" || scope === "isolated" || scope === "scoped";
            if (isStateLocal && scope !== "global") {
                hasLocalState = true;
                const type = node.getAttribute("type");
                if (type === "array") {
                    const items = this.getChildren(node, "item").map(item => {
                        const obj = {};
                        Array.from(item.attributes).forEach(attr => obj[attr.name] = attr.value);
                        return obj;
                    });
                    localRawState[id] = items;
                } else if (type === "number" || type === "int" || type === "float") {
                    const txt = node.textContent.trim();
                    localRawState[id] = txt !== "" ? Number(txt) : 0;
                } else if (type === "boolean" || type === "bool") {
                    const txt = node.textContent.trim().toLowerCase();
                    localRawState[id] = txt === "true";
                } else if (type === "object" || type === "json") {
                    const txt = node.textContent.trim();
                    try {
                        localRawState[id] = txt ? JSON.parse(txt) : {};
                    } catch (_) {
                        localRawState[id] = {};
                    }
                } else {
                    localRawState[id] = node.textContent.trim() || "";
                }
            }
        });

        if (!EUIXEngineCore._instanceSeq) EUIXEngineCore._instanceSeq = 0;
        const instanceId = "comp_inst_" + (++EUIXEngineCore._instanceSeq);
        const self = this;

        const reactiveLocalState = hasLocalState ? new Proxy(localRawState, {
            get(target, prop, receiver) {
                return Reflect.get(target, prop, receiver);
            },
            set(target, key, value) {
                target[key] = value;
                self.syncBindings(instanceId + ":" + key, value);
                return true;
            }
        }) : null;

        const childContext = {
            ...context,
            parent: context,
            $parent: context,
            props,
            ...props,
            _instanceId: instanceId,
            _localState: reactiveLocalState,
            local: reactiveLocalState,
            $local: reactiveLocalState,
            _compDepth: compDepth,
            _componentApiConfig: componentApiConfig,
            _projectedSlots: {
                named: namedSlots,
                default: defaultSlots,
                parentContext: context
            },
            constants: {
                ...(context.constants || {}),
                ...compConstants
            }
        };

        const metadataTags = ["props", "data_model", "imports", "import", "constants", "vars", "variables", "actions", "action_def", "workflow_def", "head", "helmet", "title"];
        const templateNode = this.getChild(specNode, "template") ||
            this.getChild(specNode, "flex") ||
            this.getChild(specNode, "grid") ||
            this.getChild(specNode, "layout") ||
            this.getChild(specNode, "collapse") ||
            this.getChild(specNode, "dialog") ||
            Array.from(specNode.children || []).find(c => c.tagName && !metadataTags.includes(c.tagName.toLowerCase())) ||
            specNode;

        const rendered = this.createHTMLElement(templateNode, childContext);
        if (isElem(rendered)) {
            rendered.dataset.xuiComponent = compName;
            this.processLifecycleHooks(specNode, rendered, childContext);
        }

        if (rendered && usageNode.getAttribute("class")) {
            const extraClass = usageNode.getAttribute("class");
            rendered.className = [rendered.className, extraClass].filter(Boolean).join(" ");
        }

        return rendered;
    }

    applyResets(actionNode) {
        this.getChildren(actionNode, "reset").forEach(resetNode => {
            const path = this.parseBindPath(resetNode.textContent || resetNode.getAttribute("path") || "");
            if (path) this.setState(path, "", { silent: true });
        });
    }

    confirmAction(actionNode, context = {}) {
        const confirmNode = this.getChild(actionNode, "confirm");
        const confirmAttr = actionNode.getAttribute("confirm");

        if (!confirmNode && !confirmAttr) return true;

        if (confirmNode) {
            const condition = confirmNode.getAttribute("condition");
            if (condition && !this.evalCondition(condition, context)) return true;
            const message = this.interpolate(confirmNode.textContent.trim(), context);
            return window.confirm(message || "Are you sure?");
        }

        return window.confirm(this.interpolate(confirmAttr, context) || "Are you sure?");
    }

    handleAction(actionNode, context = {}) {
        if (!actionNode) return;
        const onError = (err) => {
            const actName = actionNode.getAttribute ? (actionNode.getAttribute("action") || actionNode.tagName) : "unknown";
            const structuredErr = EUIXStructuredError.from(err, {
                originatingAction: actName,
                component: context._componentName
            });
            this.reportError(structuredErr, `Action Execution Fallback (${actName})`);
            const errMsg = (err && err.message) ? err.message : "";
            const isLoopGuard = errMsg.includes("Infinite Loop Guard") || errMsg.includes("Cascade limit exceeded") || errMsg.includes("Maximum watcher reaction depth");
            if (structuredErr.code === "WATCHER_CYCLE_ERROR" || structuredErr.code === "COMPUTED_CYCLE_ERROR" || isLoopGuard || (context && (context._inTryScope || context.rethrow))) {
                throw structuredErr;
            }
            return undefined;
        };

        try {
            const res = this._handleActionInternal(actionNode, context);
            if (res && isFn(res.then)) {
                return res.catch(onError);
            }
            return res;
        } catch (err) {
            return onError(err);
        }
    }

    async _handleTryCatchFinally(tryNode, context = {}) {
        const catchNodes = this.getChildren(tryNode, "catch");
        const finallyNodes = this.getChildren(tryNode, "finally");

        if (catchNodes.length > 1) {
            const err = new EUIXStructuredError({
                message: "<try> block can only contain one <catch> handler",
                code: "VALIDATION_ERROR",
                originatingAction: "TRY",
                component: context._componentName
            });
            this.reportError(err, "Syntax Validation");
            throw err;
        }

        if (finallyNodes.length > 1) {
            const err = new EUIXStructuredError({
                message: "<try> block can only contain one <finally> handler",
                code: "VALIDATION_ERROR",
                originatingAction: "TRY",
                component: context._componentName
            });
            this.reportError(err, "Syntax Validation");
            throw err;
        }

        const tryActionNodes = this.getChildren(tryNode).filter(c => {
            const tag = c.tagName ? c.tagName.toLowerCase() : "";
            return tag !== "catch" && tag !== "finally";
        });

        const scopeId = genId("try_");
        const startTime = getNow();

        if (this._devtools && isFn(this._devtools.logErrorScope)) {
            this._devtools.logErrorScope("TRY_ENTER", { scopeId, component: context._componentName });
        }

        let tryResult = undefined;
        let caughtError = null;

        const tryContext = {
            ...context,
            _inTryScope: true
        };

        try {
            for (const childNode of tryActionNodes) {
                tryResult = await this._handleActionInternal(childNode, tryContext);
            }
            if (this._devtools && isFn(this._devtools.logErrorScope)) {
                this._devtools.logErrorScope("TRY_SUCCESS", {
                    scopeId,
                    duration: getNow() - startTime
                });
            }
        } catch (rawErr) {
            caughtError = EUIXStructuredError.from(rawErr, {
                originatingAction: tryNode.getAttribute("action") || "TRY",
                component: context._componentName
            });

            if (this._devtools && isFn(this._devtools.logErrorScope)) {
                this._devtools.logErrorScope("ACTION_ERROR", { scopeId, error: caughtError.toJSON() });
            }

            const catchNode = catchNodes[0];
            if (catchNode) {
                const varName = catchNode.getAttribute("var") || catchNode.getAttribute("as") || catchNode.getAttribute("id") || "err";
                const catchContext = {
                    ...context,
                    _inTryScope: true,
                    [varName]: caughtError,
                    err: caughtError,
                    error: caughtError,
                    _lastError: caughtError
                };

                if (this._devtools && typeof this._devtools.logErrorScope === "function") {
                    this._devtools.logErrorScope("CATCH_ENTER", { scopeId, varName, error: caughtError.toJSON() });
                }

                try {
                    const catchActions = Array.from(catchNode.children);
                    for (const catchAct of catchActions) {
                        tryResult = await this._handleActionInternal(catchAct, catchContext);
                    }
                } catch (catchErr) {
                    caughtError = EUIXStructuredError.from(catchErr, {
                        originatingAction: "CATCH",
                        component: context._componentName
                    });
                }
            }
        } finally {
            const finallyNode = finallyNodes[0];
            let pendingError = caughtError;

            if (finallyNode) {
                if (this._devtools && typeof this._devtools.logErrorScope === "function") {
                    this._devtools.logErrorScope("FINALLY_ENTER", { scopeId });
                }
                try {
                    const finallyActions = Array.from(finallyNode.children);
                    for (const finAct of finallyActions) {
                        await this._handleActionInternal(finAct, context);
                    }
                    if (this._devtools && typeof this._devtools.logErrorScope === "function") {
                        this._devtools.logErrorScope("FINALLY_COMPLETE", { scopeId });
                    }
                } catch (finErr) {
                    pendingError = EUIXStructuredError.from(finErr, {
                        originatingAction: "FINALLY",
                        component: context._componentName
                    });
                }
            }

            if (pendingError) {
                if (this._devtools && typeof this._devtools.logErrorScope === "function") {
                    this._devtools.logErrorScope("ERROR_PROPAGATED", { scopeId, error: pendingError.toJSON() });
                }
                throw pendingError;
            }
        }

        return tryResult;
    }

    _handleActionInternal(actionNode, context = {}) {
        if (context._cancellationSignal && context._cancellationSignal.isCancelled) {
            context._cancellationSignal.throwIfCancelled();
        }

        const prevContext = this._currentActionContext;
        this._currentActionContext = context;

        try {
            const res = this._executeActionInternalBody(actionNode, context);
            if (res && isFn(res.then)) {
                return res.finally(() => {
                    this._currentActionContext = prevContext;
                });
            }
            this._currentActionContext = prevContext;
            return res;
        } catch (err) {
            this._currentActionContext = prevContext;
            throw err;
        }
    }

    _calculateBackoffDelay(strategy = "fixed", baseDelay = 0, attempt = 1, maxDelay = null) {
        if (baseDelay <= 0) return 0;
        let calculated = baseDelay;

        const cleanStrategy = String(strategy || "fixed").toLowerCase().trim();
        if (cleanStrategy === "linear") {
            calculated = baseDelay * attempt;
        } else if (cleanStrategy === "exponential" || cleanStrategy === "exp") {
            calculated = baseDelay * Math.pow(2, attempt - 1);
        } else if (cleanStrategy === "jitter") {
            const exp = baseDelay * Math.pow(2, attempt - 1);
            calculated = Math.round(exp * (0.5 + Math.random() * 0.5));
        }

        if (maxDelay !== null && maxDelay !== undefined && !isNaN(parseFloat(maxDelay))) {
            const cap = parseFloat(maxDelay);
            if (cap >= 0) calculated = Math.min(calculated, cap);
        }

        return Math.max(0, Math.round(calculated));
    }

    async _handleDelayDirect(ms, context = {}) {
        const duration = parseFloat(ms);
        if (isNaN(duration) || duration < 0) {
            const err = new EUIXStructuredError({
                message: `<delay> duration must be a non-negative number (received: ${ms})`,
                code: "VALIDATION_ERROR",
                originatingAction: "DELAY",
                component: context._componentName
            });
            this.reportError(err, "Delay Validation");
            throw err;
        }

        const signal = context._cancellationSignal;
        if (signal && signal.isCancelled) {
            signal.throwIfCancelled();
        }

        const scopeId = genId("delay_");
        if (this._devtools && isFn(this._devtools.logErrorScope)) {
            this._devtools.logErrorScope("DELAY_START", { scopeId, durationMs: duration, component: context._componentName });
        }

        return new Promise((resolve, reject) => {
            let timerId = null;
            let unsubscribe = null;

            const cleanup = () => {
                if (timerId) clearTimeout(timerId);
                if (unsubscribe) unsubscribe();
            };

            if (signal) {
                unsubscribe = signal.onCancel((reason) => {
                    cleanup();
                    if (this._devtools && typeof this._devtools.logErrorScope === "function") {
                        this._devtools.logErrorScope("DELAY_CANCELLED", { scopeId, reason });
                    }
                    reject(reason || new EUIXStructuredError({ message: "Delay was cancelled", code: "ACTION_CANCELLED" }));
                });
            }

            timerId = setTimeout(() => {
                cleanup();
                if (this._devtools && typeof this._devtools.logErrorScope === "function") {
                    this._devtools.logErrorScope("DELAY_COMPLETED", { scopeId, durationMs: duration });
                }
                resolve(true);
            }, duration);
        });
    }

    async _handleDelay(delayNode, context = {}) {
        const msAttr = delayNode.getAttribute("ms") || delayNode.getAttribute("delay") || delayNode.getAttribute("for") || this.getChild(delayNode, "ms")?.textContent.trim() || this.getChild(delayNode, "delay")?.textContent.trim();
        const interpolatedMs = this.interpolate(msAttr || "0", context);
        return this._handleDelayDirect(interpolatedMs, context);
    }

    async _handleTimeout(timeoutNode, context = {}) {
        const msAttr = timeoutNode.getAttribute("ms") || timeoutNode.getAttribute("timeout") || timeoutNode.getAttribute("duration") || this.getChild(timeoutNode, "ms")?.textContent.trim() || this.getChild(timeoutNode, "timeout")?.textContent.trim();
        const interpolatedMs = this.interpolate(msAttr || "0", context);
        const duration = parseFloat(interpolatedMs);

        if (isNaN(duration) || duration <= 0) {
            const err = new EUIXStructuredError({
                message: `<timeout> duration must be a positive number (received: ${msAttr})`,
                code: "VALIDATION_ERROR",
                originatingAction: "TIMEOUT",
                component: context._componentName
            });
            this.reportError(err, "Timeout Validation");
            throw err;
        }

        const parentSignal = context._cancellationSignal || null;
        if (parentSignal && parentSignal.isCancelled) {
            parentSignal.throwIfCancelled();
        }

        const controller = new EUIXCancellationController(parentSignal);
        const timeoutContext = {
            ...context,
            _cancellationSignal: controller.signal
        };

        const customMsg = timeoutNode.getAttribute("message") || timeoutNode.getAttribute("msg") || this.getChild(timeoutNode, "message")?.textContent.trim();
        const interpolatedMsg = customMsg ? this.interpolate(customMsg, context) : `Execution timed out after ${duration}ms`;

        const scopeId = genId("timeout_");
        const startTime = getNow();

        if (this._devtools && isFn(this._devtools.logErrorScope)) {
            this._devtools.logErrorScope("TIMEOUT_START", { scopeId, timeoutMs: duration, component: context._componentName });
        }

        const timeoutError = new EUIXStructuredError({
            message: interpolatedMsg,
            code: "TIMEOUT_ERROR",
            originatingAction: timeoutNode.getAttribute("action") || "TIMEOUT",
            component: context._componentName
        });
        timeoutError.timeoutMs = duration;
        timeoutError.cancelled = true;

        const childActions = Array.from(timeoutNode.children).filter(c => {
            const tag = c.tagName ? c.tagName.toLowerCase() : "";
            return !["message", "msg", "ms", "duration"].includes(tag);
        });

        let timerId = null;
        const timerPromise = new Promise((_, reject) => {
            timerId = setTimeout(() => {
                const elapsedMs = getNow() - startTime;
                timeoutError.elapsedMs = Math.round(elapsedMs);
                controller.cancel(timeoutError);
                if (this._devtools && isFn(this._devtools.logErrorScope)) {
                    this._devtools.logErrorScope("TIMEOUT_EXCEEDED", { scopeId, timeoutMs: duration, elapsedMs: timeoutError.elapsedMs });
                }
                reject(timeoutError);
            }, duration);
        });

        const actionPromise = (async () => {
            let result = undefined;
            if (childActions.length === 0) {
                const actAttr = timeoutNode.getAttribute("action");
                if (actAttr && actAttr !== "TIMEOUT") {
                    result = await this._handleActionInternal(timeoutNode, timeoutContext);
                }
            } else {
                for (const childNode of childActions) {
                    result = await this._handleActionInternal(childNode, timeoutContext);
                }
            }
            return result;
        })();

        try {
            const result = await Promise.race([actionPromise, timerPromise]);
            clearTimeout(timerId);
            if (this._devtools && isFn(this._devtools.logErrorScope)) {
                this._devtools.logErrorScope("TIMEOUT_COMPLETED", {
                    scopeId,
                    durationMs: getNow() - startTime
                });
            }
            return result;
        } catch (err) {
            clearTimeout(timerId);
            throw err;
        }
    }

    async _handleRetry(retryNode, context = {}) {
        const attemptsAttr = retryNode.getAttribute("attempts") || retryNode.getAttribute("max_attempts") || retryNode.getAttribute("count") || this.getChild(retryNode, "attempts")?.textContent.trim();
        const attemptsStr = this.interpolate(attemptsAttr || "3", context);
        const maxAttempts = parseInt(attemptsStr, 10);

        if (isNaN(maxAttempts) || maxAttempts <= 0) {
            const err = new EUIXStructuredError({
                message: `<retry> attempts must be a positive integer (received: ${attemptsAttr})`,
                code: "VALIDATION_ERROR",
                originatingAction: "RETRY",
                component: context._componentName
            });
            this.reportError(err, "Retry Validation");
            throw err;
        }

        const delayAttr = retryNode.getAttribute("delay") || retryNode.getAttribute("delay_ms") || retryNode.getAttribute("ms") || this.getChild(retryNode, "delay")?.textContent.trim();
        const baseDelay = parseFloat(this.interpolate(delayAttr || "0", context));
        if (isNaN(baseDelay) || baseDelay < 0) {
            const err = new EUIXStructuredError({
                message: `<retry> delay must be a non-negative number (received: ${delayAttr})`,
                code: "VALIDATION_ERROR",
                originatingAction: "RETRY",
                component: context._componentName
            });
            this.reportError(err, "Retry Validation");
            throw err;
        }

        const backoff = retryNode.getAttribute("backoff") || retryNode.getAttribute("strategy") || "fixed";
        const validBackoff = ["fixed", "linear", "exponential", "exp", "jitter"].includes(String(backoff).toLowerCase());
        if (!validBackoff) {
            const err = new EUIXStructuredError({
                message: `<retry> invalid backoff strategy "${backoff}". Supported strategies: fixed, linear, exponential, jitter`,
                code: "VALIDATION_ERROR",
                originatingAction: "RETRY",
                component: context._componentName
            });
            this.reportError(err, "Retry Validation");
            throw err;
        }

        const maxDelayAttr = retryNode.getAttribute("max_delay") || retryNode.getAttribute("max_delay_ms");
        const maxDelay = maxDelayAttr ? parseFloat(this.interpolate(maxDelayAttr, context)) : null;
        if (maxDelay !== null && (isNaN(maxDelay) || maxDelay < baseDelay)) {
            const err = new EUIXStructuredError({
                message: `<retry> max_delay must be a number greater than or equal to initial delay (received: ${maxDelayAttr})`,
                code: "VALIDATION_ERROR",
                originatingAction: "RETRY",
                component: context._componentName
            });
            this.reportError(err, "Retry Validation");
            throw err;
        }

        const onErrorAttr = retryNode.getAttribute("on_error") || retryNode.getAttribute("when") || retryNode.getAttribute("filter");
        const errorFilters = onErrorAttr ? onErrorAttr.split(",").map(s => s.trim().toUpperCase()).filter(Boolean) : null;

        const childActions = Array.from(retryNode.children).filter(c => {
            const tag = c.tagName ? c.tagName.toLowerCase() : "";
            return !["delay", "ms", "attempts", "filter"].includes(tag);
        });

        const scopeId = genId("retry_");
        if (this._devtools && isFn(this._devtools.logErrorScope)) {
            this._devtools.logErrorScope("RETRY_START", { scopeId, maxAttempts, baseDelay, backoff, component: context._componentName });
        }

        let lastError = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const parentSignal = context._cancellationSignal;
            if (parentSignal && parentSignal.isCancelled) {
                parentSignal.throwIfCancelled();
            }

            const nextDelay = (attempt < maxAttempts) ? this._calculateBackoffDelay(backoff, baseDelay, attempt, maxDelay) : 0;
            const retryInfo = {
                attempt,
                max_attempts: maxAttempts,
                maxAttempts,
                is_last: attempt === maxAttempts,
                isLast: attempt === maxAttempts,
                prev_error: lastError,
                prevError: lastError,
                next_delay: nextDelay,
                nextDelay
            };

            const retryContext = {
                ...context,
                retry: retryInfo,
                $retry: retryInfo
            };

            try {
                let result = undefined;
                for (const childNode of childActions) {
                    result = await this._handleActionInternal(childNode, retryContext);
                }

                if (this._devtools && typeof this._devtools.logErrorScope === "function") {
                    this._devtools.logErrorScope("RETRY_SUCCESS", { scopeId, attempt, maxAttempts });
                }
                return result;
            } catch (rawErr) {
                lastError = EUIXStructuredError.from(rawErr, {
                    originatingAction: retryNode.getAttribute("action") || "RETRY",
                    component: context._componentName
                });
                lastError.attempt = attempt;
                lastError.maxAttempts = maxAttempts;

                if (attempt === maxAttempts) {
                    if (this._devtools && typeof this._devtools.logErrorScope === "function") {
                        this._devtools.logErrorScope("RETRY_EXHAUSTED", { scopeId, attempt, error: lastError.toJSON() });
                    }
                    throw lastError;
                }

                if (errorFilters && errorFilters.length > 0) {
                    const codeMatch = errorFilters.includes(lastError.code.toUpperCase());
                    const statusMatch = lastError.status && errorFilters.includes(String(lastError.status));
                    const messageMatch = errorFilters.some(f => lastError.message.toUpperCase().includes(f));
                    if (!codeMatch && !statusMatch && !messageMatch) {
                        if (this._devtools && typeof this._devtools.logErrorScope === "function") {
                            this._devtools.logErrorScope("RETRY_FILTER_MISMATCH", { scopeId, attempt, error: lastError.toJSON() });
                        }
                        throw lastError;
                    }
                }

                if (this._devtools && typeof this._devtools.logErrorScope === "function") {
                    this._devtools.logErrorScope("RETRY_ATTEMPT_FAILED", { scopeId, attempt, nextDelay, error: lastError.toJSON() });
                }

                if (nextDelay > 0) {
                    await this._handleDelayDirect(nextDelay, retryContext);
                }
            }
        }

        throw lastError;
    }

    _handleActionInternal(actionNode, context = {}) {
        if (context._cancellationSignal && context._cancellationSignal.isCancelled) {
            context._cancellationSignal.throwIfCancelled();
        }

        const prevContext = this._currentActionContext;
        this._currentActionContext = context;

        try {
            const res = this._executeActionInternalBody(actionNode, context);
            if (res && typeof res.then === "function") {
                return res.finally(() => {
                    this._currentActionContext = prevContext;
                });
            }
            this._currentActionContext = prevContext;
            return res;
        } catch (err) {
            this._currentActionContext = prevContext;
            throw err;
        }
    }

    _setScopedState(rawPath, path, nextValue, context = {}) {
        if (rawPath.startsWith("local.") || rawPath.startsWith("$local.")) {
            const localKey = rawPath.replace(/^(\$local|local)\./, "");
            if (context._localState) {
                context._localState[localKey] = nextValue;
                if (context._instanceId) {
                    this.syncBindings(context._instanceId + ":" + localKey, nextValue);
                }
                return true;
            }
        } else if (context._localState && context._localState[path] !== undefined && !rawPath.startsWith("global.")) {
            context._localState[path] = nextValue;
            if (context._instanceId) {
                this.syncBindings(context._instanceId + ":" + path, nextValue);
            }
            return true;
        }
        this.setState(path, nextValue);
        return false;
    }

    _handleSetStateAction(actionNode, context = {}) {
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
                return (!isNaN(num) && val !== "" && val !== null) ? num : (val ?? 0);
            }
            if (context._localState && context._localState[cleanKey] !== undefined) {
                const val = context._localState[cleanKey];
                const num = parseFloat(val);
                return (!isNaN(num) && val !== "" && val !== null) ? num : (val ?? 0);
            }
            const val = this.getState(cleanKey);
            const num = parseFloat(val);
            return (!isNaN(num) && val !== "" && val !== null) ? num : (val ?? 0);
        };

        const cleanExpr = rawValue.replace(/\{\s*(data\.\w+|local\.\w+|\$local\.\w+|\w+)\s*\}/g, "$1").replace(/^\{\s*|\s*\}$/g, "").trim();
        const hasBraces = /^\{.*\}$/.test(rawValue.trim()) || rawValue.includes("{");

        if (hasBraces && (rawValue.includes("?") || /[\+\-\*\/]/.test(cleanExpr))) {
            try {
                const evaluated = EUIXExpressionParser.eval(cleanExpr, evalGetter);
                if (evaluated !== undefined && typeof evaluated === "number" && !isNaN(evaluated)) {
                    nextValue = String(evaluated);
                }
            } catch (_) {}
        }

        if (nextValue === "") {
            nextValue = this.interpolate(rawValue, context);
        }

        this._setScopedState(rawPath, path, nextValue, context);

        const focusNode = this.getChild(actionNode, "focus");
        if (focusNode) {
            const targetStr = focusNode.textContent.trim();
            const resolved = this.interpolate(targetStr, context).replace(/^ref:/, '');
            if (this.refs[resolved] && isFn(this.refs[resolved].focus)) {
                this.refs[resolved].focus();
            } else {
                this._pendingFocusKey = this.parseBindPath(targetStr);
            }
        }
    }

    _handleToggleStateAction(actionNode, context = {}) {
        const pathNode = this.getChild(actionNode, "path");
        const rawPath = pathNode ? pathNode.textContent.trim() : (actionNode.getAttribute("path") || actionNode.getAttribute("target") || actionNode.getAttribute("bind") || "");
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

    _handleFocusAction(actionNode, context = {}) {
        const target = actionNode.getAttribute("target") || actionNode.getAttribute("ref") || this.getChild(actionNode, "target")?.textContent || this.getChild(actionNode, "ref")?.textContent;
        if (!target) return;
        const resolved = this.interpolate(target, context).replace(/^ref:/, '');
        if (this.refs[resolved] && isFn(this.refs[resolved].focus)) {
            this.refs[resolved].focus();
        } else {
            const el = document.querySelector(`[data-euix-ref="${resolved}"], #${resolved}`);
            if (el && isFn(el.focus)) el.focus();
        }
    }

    _handleRevalidateAction(actionNode, context = {}) {
        const tagNode = this.getChild(actionNode, "tag") || this.getChild(actionNode, "url");
        const rawTag = tagNode ? tagNode.textContent.trim() : (actionNode.getAttribute("tag") || actionNode.getAttribute("url") || "");
        const tag = this.interpolate(rawTag, context);
        this.revalidateApi(tag);
    }

    _handleSetTitleAction(actionNode, context = {}) {
        const valNode = this.getChild(actionNode, "value") || this.getChild(actionNode, "title");
        const rawVal = valNode ? valNode.textContent.trim() : (actionNode.getAttribute("value") || actionNode.getAttribute("title") || "");
        const title = this.interpolate(rawVal, context);
        if (typeof document !== "undefined") {
            document.title = title;
        }
    }

    _handleThrowAction(actionNode, context = {}) {
        const msg = actionNode.getAttribute("message") || actionNode.getAttribute("msg") || this.getChild(actionNode, "message")?.textContent || "Explicit throw triggered";
        const code = actionNode.getAttribute("code") || "ACTION_EXECUTION_ERROR";
        const interpolatedMsg = this.interpolate(msg, context);
        throw new EUIXStructuredError({
            message: interpolatedMsg,
            code,
            originatingAction: "THROW",
            component: context._componentName
        });
    }

    _handleRethrowAction(actionNode, context = {}) {
        const errToThrow = context.err || context.error || context._lastError || new EUIXStructuredError({ message: "Explicit rethrow triggered", code: "ACTION_EXECUTION_ERROR" });
        throw errToThrow;
    }

    _handleRunScriptAction(actionNode, context = {}) {
        const code = actionNode.textContent.trim() || actionNode.getAttribute("code") || actionNode.getAttribute("script") || "";
        if (!code) return;
        const decodedCode = code
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, "\"")
            .replace(/&apos;/g, "'")
            .replace(/&amp;/g, "&");
        const interpolatedCode = decodedCode.replace(/\{(?:data|props|state|constants|const|vars|args|params|result)\.([a-zA-Z0-9_\.]+)\}/g, (match, p1) => {
            const val = this.resolveValueFromPath(match.slice(1, -1), context);
            return val !== undefined ? JSON.stringify(val) : match;
        });
        const targetEl = context._targetEl || (actionNode.parentElement ? actionNode.parentElement : null);
        try {
            const isAsync = interpolatedCode.includes("await ");
            const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
            const fn = isAsync
                ? new AsyncFunction("$el", "$data", "$engine", "$evt", "$args", "$result", "$retry", "$cancellationSignal", "$newValue", "$prevValue", "$oldValue", "$path", "$err", interpolatedCode)
                : new Function("$el", "$data", "$engine", "$evt", "$args", "$result", "$retry", "$cancellationSignal", "$newValue", "$prevValue", "$oldValue", "$path", "$err", interpolatedCode);
            const nVal = context.$newValue !== undefined ? context.$newValue : context.newValue;
            const pVal = context.$prevValue !== undefined ? context.$prevValue : (context.prevValue !== undefined ? context.prevValue : context.oldValue);
            const oVal = context.$oldValue !== undefined ? context.$oldValue : context.oldValue;
            const pPath = context.$path || context.path || "";
            const errVal = context.err || context.error || context._lastError || null;
            return fn.call(targetEl, targetEl, this.state || this._proxyState, this, context._evt || null, context.args || {}, context.result, context.retry || context.$retry || null, context._cancellationSignal || null, nVal, pVal, oVal, pPath, errVal);
        } catch (err) {
            this.reportError(err, "Action Execution (RUN_SCRIPT)");
            throw err;
        }
    }

    _handleMutateStateAction(actionNode, context = {}) {
        const pathNode = this.getChild(actionNode, "path");
        const opNode = this.getChild(actionNode, "operation");
        const rawPath = trimStr(pathNode) || (actionNode.getAttribute("path") || "");
        const interpolatedPath = this.interpolate(rawPath, context);
        const path = this.parseBindPath(interpolatedPath);
        const operation = (trimStr(opNode) || actionNode.getAttribute("operation") || "").toUpperCase();

        if (!path || !operation) return;

        if (operation === "CLEAR" || operation === "EMPTY" || operation === "RESET") {
            this.batch(() => {
                this.setState(path, []);
                this.applyResets(actionNode);
            });
            return;
        }

        if (operation === "INCREMENT" || operation === "DECREMENT") {
            const rawVal = this.getState(path);
            if (!Array.isArray(rawVal)) {
                let num = parseInt(rawVal ?? "0", 10);
                if (isNaN(num)) num = 0;
                num = operation === "INCREMENT" ? num + 1 : num - 1;
                this.setState(path, String(num));
                return;
            }

            const idxNode = this.getChild(actionNode, "index");
            const fieldNode = this.getChild(actionNode, "field");
            const rawIdx = idxNode ? idxNode.textContent.trim() : (actionNode.getAttribute("index") || "");
            const fieldName = fieldNode ? fieldNode.textContent.trim() : (actionNode.getAttribute("field") || "quantity");
            const index = parseInt(this.interpolate(rawIdx, context), 10);

            const currentList = Array.isArray(this._rawState[path]) ? [...this._rawState[path]] : [];
            if (!isNaN(index) && index >= 0 && index < currentList.length) {
                const item = { ...currentList[index] };
                let currVal = parseInt(item[fieldName] || 1, 10);
                if (operation === "INCREMENT") {
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

        if (operation === "PUSH" || operation === "UNSHIFT" || operation === "PREPEND") {
            const valNode = this.getChild(actionNode, "value");
            const valItem = (valNode && this.getChild(valNode, "item")) || this.getChild(actionNode, "item") || valNode;
            const rawText = valItem ? ((typeof valItem.getAttribute === "function" && valItem.getAttribute("text")) || valItem.textContent?.trim() || "") : "";
            const textValue = this.interpolate(rawText, context);

            let parsedObj = null;
            if (textValue && textValue.startsWith("{") && textValue.endsWith("}")) {
                try { parsedObj = JSON.parse(textValue); } catch (e) {}
            }

            const itemId = (valItem && typeof valItem.getAttribute === "function" && valItem.getAttribute("id")) || (parsedObj && parsedObj.id) || `task-${Date.now()}`;
            const newItem = parsedObj && typeof parsedObj === "object" ? { id: itemId, ...parsedObj } : { id: itemId };
            if (valItem && valItem.attributes) {
                Array.from(valItem.attributes).forEach(attr => {
                    const interpolatedVal = this.interpolate(attr.value, context);
                    if (interpolatedVal !== undefined && interpolatedVal !== null && !interpolatedVal.includes("undefined")) {
                        newItem[attr.name] = interpolatedVal;
                    }
                });
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

            const hasCustomAttributes = Object.keys(newItem).some(k => k !== "id" && k !== "quantity" && String(newItem[k]).trim() !== "");
            const titleVal = newItem.title || newItem.text || newItem.name || (hasCustomAttributes ? "valid" : "");
            if (!String(titleVal).trim()) return;

            const whereNode = this.getChild(actionNode, "where");
            const rawWhereEquals = whereNode ? whereNode.getAttribute("equals") : null;
            const targetId = rawWhereEquals ? this.interpolate(rawWhereEquals, context) : newItem.id;

            const currentList = Array.isArray(this._rawState[path]) ? [...this._rawState[path]] : [];
            const existingIdx = currentList.findIndex(it => String(it.id) === String(targetId));

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
                const currentList = Array.isArray(this._rawState[path]) ? [...this._rawState[path]] : [];
                if (operation === "UNSHIFT" || operation === "PREPEND") {
                    this.setState(path, [newItem, ...currentList]);
                } else {
                    this.setState(path, [...currentList, newItem]);
                }
                this.applyResets(actionNode);
                if (!this.getChild(actionNode, "reset") && "new_todo_input" in this._rawState) {
                    this.setState("new_todo_input", "", { silent: true });
                }
            });
            return;
        }

        if (operation === "REMOVE") {
            const indexNode = this.getChild(actionNode, "index");
            const whereNode = this.getChild(actionNode, "where");
            const list = Array.isArray(this._rawState[path]) ? [...this._rawState[path]] : [];

            if (indexNode) {
                const rawIdx = indexNode.textContent.trim();
                const interpolatedIdx = this.interpolate(rawIdx, context);
                const idx = parseInt(interpolatedIdx, 10);
                if (!isNaN(idx) && idx >= 0 && idx < list.length) {
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
                    const nextList = list.filter(item => String(item[field]) !== String(matchValue));
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

        if (operation === "MOVE_UP" || operation === "MOVE_DOWN") {
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
                targetIdx = list.findIndex(item => String(item[field]) === String(expected));
            }

            if (targetIdx !== -1) {
                const swapIdx = operation === "MOVE_UP" ? targetIdx - 1 : targetIdx + 1;
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

        if (operation === "SWAP") {
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

                const idx1 = list.findIndex(item => String(item[field1]) === String(id1));
                const idx2 = list.findIndex(item => String(item[field2]) === String(id2));

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

        if (operation === "UPDATE") {
            const whereNode = this.getChild(actionNode, "where");
            const fieldsNode = this.getChild(actionNode, "fields") || this.getChild(actionNode, "item") || this.getChild(actionNode, "value") || actionNode;
            if (!fieldsNode) return;

            const list = Array.isArray(this._rawState[path]) ? this._rawState[path] : [];
            const updates = {};
            Array.from(fieldsNode.attributes).forEach(attr => {
                updates[attr.name] = this.interpolate(attr.value, context);
            });

            if (updates.text !== undefined && !String(updates.text).trim()) return;

            const matchesWhere = (item) => {
                if (!whereNode) return true;
                const field = whereNode.getAttribute("field") || "id";
                const op = (whereNode.getAttribute("op") || "eq").toLowerCase();
                const rawMatch = whereNode.getAttribute("equals")
                    ?? whereNode.getAttribute("value")
                    ?? whereNode.textContent.trim();
                const expected = this.interpolate(rawMatch, context);
                const actual = item[field];

                if (op === "neq" || op === "!=" || op === "ne") {
                    return String(actual) !== String(expected);
                }
                return String(actual) === String(expected);
            };

            const touchedIds = [];
            this.batch(() => {
                const nextList = list.map(item => {
                    if (!matchesWhere(item)) return item;
                    touchedIds.push(item.id);
                    return { ...item, ...updates };
                });
                this.setState(path, nextList);
                this.applyResets(actionNode);

                if (
                    touchedIds.length === 1 &&
                    String(this._rawState.editing_id) === String(touchedIds[0])
                ) {
                    if ("editing_id" in this._rawState) this.setState("editing_id", "", { silent: true });
                    if ("edit_todo_input" in this._rawState) this.setState("edit_todo_input", "", { silent: true });
                }
            });
        }
    }

    _executeActionInternalBody(actionNode, context = {}) {
        const actionAttr = actionNode.getAttribute ? actionNode.getAttribute("action") : null;
        const tagNameLower = actionNode.tagName ? actionNode.tagName.toLowerCase() : "";

        if (this._devtools && this._devtools.enabled) {
            const pathNode = this.getChild(actionNode, "path");
            const opNode = this.getChild(actionNode, "operation");
            this._devtools.logAction(actionAttr || actionNode.tagName, {
                path: pathNode ? pathNode.textContent.trim() : "",
                operation: opNode ? opNode.textContent.trim() : ""
            });
        }

        if (["watch", "on_mount", "on_unmount", "on_state_change", "on_click", "if", "else", "step"].includes(tagNameLower) && !actionAttr) {
            const steps = Array.from(actionNode.children || []).filter(c => c.nodeType === 1);
            if (steps.length > 0) {
                let lastResult;
                for (const step of steps) {
                    if (step.tagName && step.tagName.toLowerCase() === "else") continue;
                    lastResult = this._handleActionInternal(step, context);
                }
                return lastResult;
            }
        }

        if (tagNameLower === "catch" || tagNameLower === "finally") {
            const err = new EUIXStructuredError({
                message: `Orphan <${tagNameLower}> tag encountered without a parent <try> block`,
                code: "VALIDATION_ERROR",
                originatingAction: tagNameLower.toUpperCase(),
                component: context._componentName
            });
            this.reportError(err, "Syntax Validation");
            throw err;
        }

        const primaryKey = (actionAttr || tagNameLower).toUpperCase();

        // 1. Direct O(1) Action Dispatch via Table
        const handlerName = ACTION_DISPATCH_TABLE[primaryKey];
        if (handlerName && typeof this[handlerName] === "function") {
            return this[handlerName](actionNode, context);
        }

        // 2. Action Composer Subroutine Resolution
        const isComposedCallTag = ["execute_action", "call_action", "run_workflow", "action", "step"].includes(tagNameLower);
        const isComposedCallAttr = actionAttr === "EXECUTE_ACTION" || actionAttr === "CALL_ACTION" || actionAttr === "RUN_WORKFLOW";
        const targetComposedName = (isComposedCallAttr || isComposedCallTag)
            ? (actionNode.getAttribute("name") || actionNode.getAttribute("action_name") || actionNode.getAttribute("target") || this.getChild(actionNode, "name")?.textContent.trim() || actionAttr)
            : (actionAttr || tagNameLower);

        if (targetComposedName && this.hasActionDef(targetComposedName)) {
            const actionDef = this.getActionDef(targetComposedName);
            const args = this._extractActionArgs(actionNode, context);
            return EUIXActionComposer.execute(actionDef, args, this, context);
        }

        // 3. Custom Action Handlers
        const customHandler = (actionAttr && this._customActions.get(actionAttr)) ||
            (actionAttr && EUIXEngineCore._globalActionHandlers && EUIXEngineCore._globalActionHandlers.get(actionAttr.toUpperCase())) ||
            (tagNameLower && EUIXEngineCore._globalActionHandlers && EUIXEngineCore._globalActionHandlers.get(tagNameLower.toUpperCase()));

        if (customHandler) {
            return customHandler.call(this, actionNode, context, this);
        }
    }

    render() {
        if (!this.container || !this.xmlDoc) return;

        this._bindings = new Map();
        this.refs = {};
        const root = this.getChild(this.xmlDoc, "uid_spec") || this.xmlDoc.querySelector("uid_spec") || this.xmlDoc;
        const metadataTags = ["data_model", "imports", "import", "constants", "vars", "variables", "component_def", "actions", "action_def", "workflow_def", "api_config", "api_endpoint", "endpoint", "api", "persistence", "on_mount", "on_unmount", "on_interval", "on_state_change", "use_script", "use_style", "animations", "animation_def", "watch", "computed", "head", "helmet", "title"];
        
        if (isFn(this.parseHeadMetadata)) {
            this.parseHeadMetadata(root);
        }

        let layout = Array.from(root.children || []).find(c => c.tagName && !metadataTags.includes(c.tagName.toLowerCase()));
        if (!layout) {
            layout = Array.from(root.querySelectorAll("*")).find(c => c.tagName && !metadataTags.includes(c.tagName.toLowerCase()) && !c.closest("component_def"));
        }
        if (!layout) {
            layout = root;
        }

        if (layout) {
            const dom = this.createHTMLElement(layout);
            if (dom && this.container) {
                this.container.innerHTML = "";
                this.container.appendChild(dom);
            }
        }

        const autofocusEl = this.container.querySelector("[data-euix-autofocus='true']");
        if (autofocusEl && typeof autofocusEl.focus === "function") {
            autofocusEl.focus();
        }
    }
}

EUIXEngineCore.EUIXExpressionParser = EUIXExpressionParser;
EUIXEngineCore.EUIXStructuredError = EUIXStructuredError;
EUIXEngineCore.EUIXXMLParseError = EUIXXMLParseError;

if (typeof window !== "undefined" && typeof document !== "undefined") {
    window.EUIXExpressionParser = EUIXExpressionParser;
    window.EUIXStructuredError = EUIXStructuredError;
    window.EUIXXMLParseError = EUIXXMLParseError;
    window.EUIXEngineCore = EUIXEngineCore;
    window.EUIXEngine = EUIXEngineCore;
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => EUIXEngineCore.autoInit());
    } else {
        EUIXEngineCore.autoInit();
    }
}

export { EUIXEngineCore, EUIXEngineCore as EUIXEngine, EUIXExpressionParser, EUIXStructuredError, EUIXXMLParseError };
export default EUIXEngineCore;
