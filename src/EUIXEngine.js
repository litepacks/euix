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
            if ([">", "<", "!", "+", "-", "*", "/", "(", ")", ",", "?", ":"].includes(char)) {
                if (char === "(" || char === ")" || char === ",") {
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

    static parse(tokens) {
        let current = 0;

        function peek() { return tokens[current]; }
        function consume() { return tokens[current++]; }

        function parsePrimary() {
            const token = peek();
            if (!token) return { type: "Literal", value: undefined };

            if (token.type === "NUMBER" || token.type === "STRING" || token.type === "BOOLEAN" || token.type === "NULL") {
                consume();
                return { type: "Literal", value: token.value };
            }

            if (token.type === "(") {
                consume();
                const expr = parseExpression();
                if (peek() && peek().type === ")") consume();
                return expr;
            }

            if (token.type === "IDENTIFIER") {
                consume();
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
                    return { type: "CallExpression", callee: token.value, arguments: args };
                }
                return { type: "Identifier", name: token.value };
            }

            if (token.type === "OPERATOR" && token.value === "!") {
                consume();
                return { type: "UnaryExpression", operator: "!", argument: parseUnary() };
            }

            consume();
            return { type: "Literal", value: undefined };
        }

        function parseBinary(nextLevelParser, operators) {
            let left = nextLevelParser();
            while (peek() && peek().type === "OPERATOR" && operators.includes(peek().value)) {
                const op = consume().value;
                const right = nextLevelParser();
                left = { type: "BinaryExpression", operator: op, left, right };
            }
            return left;
        }

        function parseUnary() {
            if (peek() && peek().type === "OPERATOR" && (peek().value === "!" || peek().value === "-")) {
                const op = consume().value;
                return { type: "UnaryExpression", operator: op, argument: parseUnary() };
            }
            return parsePrimary();
        }

        function parseMultiplicative() { return parseBinary(parseUnary, ["*", "/"]); }
        function parseAdditive() { return parseBinary(parseMultiplicative, ["+", "-"]); }
        function parseRelational() { return parseBinary(parseAdditive, [">", "<", ">=", "<="]); }
        function parseEquality() { return parseBinary(parseRelational, ["==", "!="]); }
        function parseLogicalAnd() { return parseBinary(parseEquality, ["&&"]); }
        function parseLogicalOr() { return parseBinary(parseLogicalAnd, ["||"]); }

        function parseTernary() {
            let test = parseLogicalOr();
            if (peek() && peek().type === "OPERATOR" && peek().value === "?") {
                consume();
                let consequent = parseExpression();
                if (peek() && peek().type === "OPERATOR" && peek().value === ":") {
                    consume();
                    let alternate = parseExpression();
                    return { type: "ConditionalExpression", test, consequent, alternate };
                }
            }
            return test;
        }

        function parseExpression() { return parseTernary(); }

        return parseExpression();
    }

    static evaluate(ast, resolveValueFn) {
        if (!ast) return undefined;

        switch (ast.type) {
            case "Literal":
                return ast.value;

            case "UnaryExpression": {
                const arg = this.evaluate(ast.argument, resolveValueFn);
                if (ast.operator === "-") return -Number(arg);
                if (ast.operator === "!") return !arg;
                return arg;
            }

            case "ConditionalExpression": {
                const testVal = this.evaluate(ast.test, resolveValueFn);
                const isTrue = testVal !== false && testVal !== "false" && testVal !== 0 && testVal !== null && testVal !== undefined && testVal !== "";
                return isTrue ? this.evaluate(ast.consequent, resolveValueFn) : this.evaluate(ast.alternate, resolveValueFn);
            }

            case "Identifier": {
                const val = resolveValueFn(ast.name);
                return val !== undefined ? val : ast.name;
            }

            case "UnaryExpression": {
                const val = this.evaluate(ast.argument, resolveValueFn);
                if (ast.operator === "!") return !val || val === "false";
                if (ast.operator === "-") return -val;
                return val;
            }

            case "BinaryExpression": {
                const left = this.evaluate(ast.left, resolveValueFn);
                const right = this.evaluate(ast.right, resolveValueFn);

                switch (ast.operator) {
                    case "==": return String(left ?? "").trim() === String(right ?? "").trim();
                    case "!=": return String(left ?? "").trim() !== String(right ?? "").trim();
                    case ">": return Number(left) > Number(right);
                    case "<": return Number(left) < Number(right);
                    case ">=": return Number(left) >= Number(right);
                    case "<=": return Number(left) <= Number(right);
                    case "&&": return Boolean(left) && Boolean(right);
                    case "||": return Boolean(left) || Boolean(right);
                    case "+": return left + right;
                    case "-": return Number(left) - Number(right);
                    default: return false;
                }
            }

            case "CallExpression": {
                const args = ast.arguments.map(arg => this.evaluate(arg, resolveValueFn));
                const fnName = ast.callee.toLowerCase();

                if (fnName === "length") {
                    const target = args[0];
                    if (Array.isArray(target)) return target.length;
                    if (typeof target === "string") return target.length;
                    return 0;
                }
                if (fnName === "contains" || fnName === "includes") {
                    const target = args[0];
                    const search = args[1];
                    if (Array.isArray(target)) return target.includes(search);
                    if (typeof target === "string") return target.includes(String(search));
                    return false;
                }
                if (fnName === "not") {
                    return !args[0] || args[0] === "false";
                }
                return undefined;
            }
        }
        return undefined;
    }

    static eval(exprString, resolveValueFn) {
        if (!exprString || !exprString.trim()) return undefined;
        try {
            const tokens = this.tokenize(exprString);
            const ast = this.parse(tokens);
            return this.evaluate(ast, resolveValueFn);
        } catch (_) {
            return undefined;
        }
    }
}

const EVENT_TAGS = new Set(["event", "on", "on_click", "on_change", "on_submit", "on_keyup", "on_keydown", "on_mouseenter", "on_mouseleave"]);

const METADATA_AND_EVENT_TAGS = new Set([
    "event", "on", "on_click", "on_change", "on_submit", "on_keyup", "on_keydown", 
    "on_mouseenter", "on_mouseleave", "on_interval", "on_timer", "on_mount", 
    "on_state_change", "on_visible", "on_update", "watch", "api_config", "api", 
    "persistence", "data_model", "imports", "constants", "vars", "variables"
]);

class EUIXEngine {
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
            onResponse: null
        };
        if (!EUIXEngine._globalConstants) {
            EUIXEngine._globalConstants = new Map();
        }
        if (!EUIXEngine._globalComponentSpecs) {
            EUIXEngine._globalComponentSpecs = new Map();
        }
        this._setupStorageListener();
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
        if (this.refs) {
            this.refs = {};
        }
        if (this.container) {
            this.container.innerHTML = "";
        }
        if (EUIXEngine.instance === this) {
            EUIXEngine.instance = null;
        }
        return this;
    }

    configureApi(options = {}) {
        if (!options || typeof options !== "object") return this;
        if (options.baseUrl !== undefined) this._apiConfig.baseUrl = String(options.baseUrl).trim();
        if (options.credentials !== undefined) this._apiConfig.credentials = options.credentials;
        if (options.timeout !== undefined) this._apiConfig.timeout = parseInt(options.timeout, 10) || 0;
        if (typeof options.onRequest === "function") this._apiConfig.onRequest = options.onRequest;
        if (typeof options.onResponse === "function") this._apiConfig.onResponse = options.onResponse;
        
        if (options.headers && typeof options.headers === "object") {
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

    _setupStorageListener() {
        if (typeof window === "undefined" || !window.addEventListener) return;
        window.addEventListener("storage", (event) => {
            if (!event.key || !this._rawState) return;
            for (const [stateKey, config] of this._persistenceConfig.entries()) {
                if (config.storage === "local" && config.storageKey === event.key) {
                    try {
                        const parsed = event.newValue !== null ? JSON.parse(event.newValue) : "";
                        this.setState(stateKey, parsed, { silent: false });
                    } catch (_) {
                        this.setState(stateKey, event.newValue || "", { silent: false });
                    }
                }
            }
        });
    }

    persist(key, { storage = "local", key: customKey = null } = {}) {
        if (!key) return this;
        const parsedKey = this.parseBindPath(key);
        const storageKey = customKey || `euix_state_${parsedKey}`;
        this._persistenceConfig.set(parsedKey, { storage: String(storage).toLowerCase(), storageKey });

        const store = String(storage).toLowerCase() === "session" 
            ? (typeof sessionStorage !== "undefined" ? sessionStorage : null) 
            : (typeof localStorage !== "undefined" ? localStorage : null);

        if (store && this._rawState) {
            const existing = store.getItem(storageKey);
            if (existing !== null) {
                try {
                    this._rawState[parsedKey] = JSON.parse(existing);
                } catch (_) {
                    this._rawState[parsedKey] = existing;
                }
                this.syncBindings(parsedKey, this._rawState[parsedKey]);
            } else if (this._rawState[parsedKey] !== undefined) {
                this._savePersistedState(parsedKey, this._rawState[parsedKey]);
            }
        }
        return this;
    }

    clearPersistedState(key) {
        if (!key) return this;
        const parsedKey = this.parseBindPath(key);
        const config = this._persistenceConfig.get(parsedKey);
        if (config) {
            const store = config.storage === "session" 
                ? (typeof sessionStorage !== "undefined" ? sessionStorage : null) 
                : (typeof localStorage !== "undefined" ? localStorage : null);
            if (store) store.removeItem(config.storageKey);
        }
        return this;
    }

    _savePersistedState(key, value) {
        const config = this._persistenceConfig.get(key);
        if (!config) return;
        try {
            const store = config.storage === "session" 
                ? (typeof sessionStorage !== "undefined" ? sessionStorage : null) 
                : (typeof localStorage !== "undefined" ? localStorage : null);
            if (!store) return;
            const valToStore = JSON.stringify(value !== undefined ? value : "");
            store.setItem(config.storageKey, valToStore);
        } catch (err) {
            this.reportError(err, `Error persisting state key "${key}"`);
        }
    }

    watch(key, callback) {
        if (!key || typeof callback !== "function") return () => {};
        const parsedKey = this.parseBindPath(key);
        if (!this._stateWatchers.has(parsedKey)) this._stateWatchers.set(parsedKey, []);
        this._stateWatchers.get(parsedKey).push(callback);
        return () => {
            const list = this._stateWatchers.get(parsedKey) || [];
            this._stateWatchers.set(parsedKey, list.filter(cb => cb !== callback));
        };
    }

    onStateChange(callback) {
        if (typeof callback !== "function") return () => {};
        this._globalStateWatchers.push(callback);
        return () => {
            this._globalStateWatchers = this._globalStateWatchers.filter(cb => cb !== callback);
        };
    }

    triggerStateWatchers(key, newValue, oldValue) {
        if (this._globalStateWatchers && this._globalStateWatchers.length) {
            this._globalStateWatchers.forEach(cb => {
                try { cb(key, newValue, oldValue); } catch (err) { this.reportError(err, `onStateChange watcher error on "${key}"`); }
            });
        }
        if (this._stateWatchers && this._stateWatchers.has(key)) {
            const list = this._stateWatchers.get(key) || [];
            list.forEach(cb => {
                try { cb(newValue, oldValue, key); } catch (err) { this.reportError(err, `watch listener error on "${key}"`); }
            });
        }
    }

    enableDevTools() {
        if (typeof window !== "undefined") {
            import('./EUIXDevTools.js').then(({ EUIXDevTools }) => {
                const devtools = EUIXDevTools.init(this);
                if (devtools) devtools.toggle(true);
            }).catch(() => {});
        }
        return this;
    }

    static enableDevTools() {
        if (EUIXEngine.instance) {
            return EUIXEngine.instance.enableDevTools();
        }
        return null;
    }

    reportError(error, contextInfo = "") {
        const msg = error instanceof Error ? error.message : String(error);
        if (typeof console !== "undefined") {
            console.warn(`[EUIXEngine Fallback] ${contextInfo ? contextInfo + ": " : ""}${msg}`, error);
        }
        if (typeof this.onError === "function") {
            try {
                this.onError(error, contextInfo);
            } catch (_) {}
        }
    }

    static mount(xmlString, containerSelector = "#app") {
        const engine = new EUIXEngine(containerSelector);
        EUIXEngine.instance = engine;
        engine.mount(xmlString);
        return engine;
    }

    static async mountAsync(xmlString, containerSelector = "#app") {
        const engine = EUIXEngine.mount(xmlString, containerSelector);
        await engine.preloadAsyncResources();
        return engine;
    }

    static async loadComponent(name, url) {
        try {
            if (typeof fetch === "undefined") {
                console.error("[EUIXEngine] fetch is not available in this environment.");
                return null;
            }
            const res = await fetch(url);
            const xmlText = typeof res.text === "function" ? await res.text() : (typeof res === "string" ? res : String(res));
            
            const sanitizedXml = xmlText.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;");
            const parser = new DOMParser();
            const doc = parser.parseFromString(sanitizedXml, "text/xml");

            const nestedImports = Array.from(doc.querySelectorAll("import"));
            for (const imp of nestedImports) {
                const impSrc = imp.getAttribute("src");
                const impName = imp.getAttribute("name") || imp.getAttribute("as");
                if (impSrc && impName) {
                    await EUIXEngine.loadComponent(impName, impSrc);
                }
            }

            return EUIXEngine.registerComponentSpec(name, doc);
        } catch (err) {
            console.error(`[EUIXEngine] Failed to load component from file ('${name}' -> '${url}'):`, err);
            return null;
        }
    }

    static registerComponentSpec(name, xmlStringOrNode) {
        let node;
        if (typeof xmlStringOrNode === "string") {
            const sanitizedXml = xmlStringOrNode.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;");
            const parser = new DOMParser();
            const doc = parser.parseFromString(sanitizedXml, "text/xml");

            const nestedDefs = Array.from(doc.querySelectorAll("component_def"));
            nestedDefs.forEach(def => {
                const defName = def.getAttribute("name") || def.getAttribute("id");
                if (defName && defName.toLowerCase() !== (name || "").toLowerCase()) {
                    EUIXEngine.registerComponentSpec(defName, def);
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
                    EUIXEngine.registerComponentSpec(defName, def);
                }
            });
        } else {
            node = xmlStringOrNode;
        }

        const compName = (name || (node && node.getAttribute && node.getAttribute("name")) || (node && node.getAttribute && node.getAttribute("id")) || "").toLowerCase();
        if (compName && node) {
            if (!EUIXEngine._globalComponentSpecs) EUIXEngine._globalComponentSpecs = new Map();
            EUIXEngine._globalComponentSpecs.set(compName, node);
        }
        return compName;
    }

    async loadComponentFile(name, url) {
        const compName = await EUIXEngine.loadComponent(name, url);
        if (compName && EUIXEngine._globalComponentSpecs.has(compName)) {
            this._componentSpecs.set(compName, EUIXEngine._globalComponentSpecs.get(compName));
        }
        return compName;
    }

    registerComponentSpec(name, xmlStringOrNode) {
        const compName = EUIXEngine.registerComponentSpec(name, xmlStringOrNode);
        if (compName && EUIXEngine._globalComponentSpecs.has(compName)) {
            this._componentSpecs.set(compName, EUIXEngine._globalComponentSpecs.get(compName));
        }
        return compName;
    }

    static autoInit() {
        if (typeof document === "undefined") return;
        const scripts = document.querySelectorAll('script[type="application/euix"], script[type="text/euix"], script[data-euix-app], euix-app');
        scripts.forEach(script => {
            const targetSelector = script.getAttribute("target") || script.dataset?.target || "#app";
            const xml = (script.tagName.toLowerCase() === "euix-app" ) ? script.innerHTML.trim() : script.textContent.trim();
            if (xml) {
                const engine = EUIXEngine.mount(xml, targetSelector);
                if (engine) {
                    engine.enableDevTools();
                }
            }
        });
    }

    getChild(node, tagName) {
        if (!node) return null;
        const tag = tagName.toLowerCase();
        const list = (node.children && node.children.length > 0) 
            ? Array.from(node.children) 
            : Array.from(node.childNodes || []).filter(n => n.nodeType === 1);
        return list.find(c => c.tagName && c.tagName.toLowerCase() === tag) || null;
    }

    getChildren(node, tagName) {
        if (!node) return [];
        const list = (node.children && node.children.length > 0) 
            ? Array.from(node.children) 
            : Array.from(node.childNodes || []).filter(n => n.nodeType === 1);
        if (!tagName) return list;
        const tag = tagName.toLowerCase();
        return list.filter(c => c.tagName && c.tagName.toLowerCase() === tag);
    }

    registerComponent(type, handler) {
        if (typeof type === "string" && typeof handler === "function") {
            this._customComponents.set(type, handler);
        }
    }

    registerAction(actionType, handler) {
        if (typeof actionType === "string" && typeof handler === "function") {
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
        return EUIXEngine.escapeRegExp(str);
    }

    parseBindPath(expr) {
        if (!expr) return "";
        return String(expr)
            .trim()
            .replace(/^\{\s*data\.([a-zA-Z0-9_.]+)\s*\}$/, "$1")
            .replace(/^data\./, "")
            .replace(/^\{\s*|\s*\}$/g, "");
    }

    extractStateKeys(expr) {
        if (!expr) return [];
        const keys = new Set();
        const matches = expr.match(/data\.(\w+)/g) || [];
        matches.forEach(m => keys.add(m.replace(/^data\./, "")));
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
        if (!this._rawState) return undefined;
        let val = this._rawState[key];
        if (typeof val === "string" && /\d+\s*[><=?!+\-*/]/.test(val) && val.includes("?")) {
            const num = parseFloat(val);
            if (!isNaN(num)) return num;
        }
        return val;
    }

    setState(key, value, { silent = false, sourceEl = null } = {}) {
        if (!this._rawState) return;

        // Auto-sanitize expression strings if passed to setState
        if (typeof value === "string" && /\d+\s*[><=?!+\-*/]/.test(value) && value.includes("?")) {
            const num = parseFloat(value);
            if (!isNaN(num)) {
                value = num;
            }
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
            this._savePersistedState(key, value);
            if (this._devtools && this._devtools.enabled && !silent) {
                this._devtools.logAction("setState", { path: key, value });
            }
            this.syncBindings(key, value, sourceEl);
            if (!silent) {
                this.triggerStateWatchers(key, value, oldValue);
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

    registerBinding(path, el, kind, updateFn = null) {
        if (!path || !el) return;
        if (!this._bindings.has(path)) this._bindings.set(path, []);
        this._bindings.get(path).push({ el, kind, updateFn });
        el.dataset.xuiKey = path;
        el.dataset.xuiBind = kind;
    }

    syncBindings(path, value, sourceEl = null) {
        const list = this._bindings.get(path) || [];
        const text = value === undefined || value === null ? "" : String(value);

        list.forEach((item) => {
            const { el, kind, updateFn } = item;
            if (typeof updateFn === "function") {
                updateFn(value);
                return;
            }

            if (kind === "attribute" && updateFn && typeof updateFn === "object") {
                const { attrName, template } = updateFn;
                this.updateAttributeBinding(el, attrName, template);
                return;
            }

            if (!el || el === sourceEl) return;

            if (kind === "input") {
                if (el.value !== text) el.value = text;
                return;
            }

            if (kind === "checkbox") {
                el.checked = this.isTruthy(text);
                return;
            }

            if (kind === "radio") {
                el.checked = (String(el.value || "") === text);
                return;
            }

            if (kind === "multi_template") {
                const template = el.dataset.euixMultiTemplate;
                if (template) {
                    el.textContent = this.interpolate(template);
                }
                return;
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
        });
    }

    applyLayoutStyles(el, xmlNode, context) {
        const formatValue = (val) => {
            if (!val) return "";
            const interpolated = this.interpolate(val, context).trim();
            if (/^\d+$/.test(interpolated)) return interpolated + "px";
            return interpolated;
        };

        const alignMap = {
            start: "flex-start",
            end: "flex-end",
            center: "center",
            stretch: "stretch",
            baseline: "baseline"
        };

        const justifyMap = {
            start: "flex-start",
            end: "flex-end",
            center: "center",
            between: "space-between",
            around: "space-around",
            evenly: "space-evenly",
            stretch: "stretch"
        };

        const dir = xmlNode.getAttribute("direction") || xmlNode.getAttribute("dir");
        if (dir) {
            el.style.flexDirection = this.interpolate(dir, context).trim();
        }

        const align = xmlNode.getAttribute("align");
        if (align) {
            const val = this.interpolate(align, context).trim().toLowerCase();
            el.style.alignItems = alignMap[val] || val;
        }

        const justify = xmlNode.getAttribute("justify");
        if (justify) {
            const val = this.interpolate(justify, context).trim().toLowerCase();
            el.style.justifyContent = justifyMap[val] || val;
        }

        const gap = xmlNode.getAttribute("gap");
        if (gap) {
            el.style.gap = formatValue(gap);
        }

        const gapX = xmlNode.getAttribute("gap_x") || xmlNode.getAttribute("col_gap");
        if (gapX) {
            el.style.columnGap = formatValue(gapX);
        }

        const gapY = xmlNode.getAttribute("gap_y") || xmlNode.getAttribute("row_gap");
        if (gapY) {
            el.style.rowGap = formatValue(gapY);
        }

        const wrap = xmlNode.getAttribute("wrap");
        if (wrap) {
            const val = this.interpolate(wrap, context).trim();
            el.style.flexWrap = val === "true" ? "wrap" : val === "false" ? "nowrap" : val;
        }

        const cols = xmlNode.getAttribute("cols") || xmlNode.getAttribute("columns");
        if (cols) {
            const val = this.interpolate(cols, context).trim();
            if (/^\d+$/.test(val)) {
                el.style.gridTemplateColumns = `repeat(${val}, minmax(0, 1fr))`;
            } else {
                el.style.gridTemplateColumns = val;
            }
        }

        const rows = xmlNode.getAttribute("rows");
        if (rows) {
            const val = this.interpolate(rows, context).trim();
            if (/^\d+$/.test(val)) {
                el.style.gridTemplateRows = `repeat(${val}, minmax(0, 1fr))`;
            } else {
                el.style.gridTemplateRows = val;
            }
        }

        const customStyle = xmlNode.getAttribute("style");
        if (customStyle) {
            const styleStr = this.interpolate(customStyle, context).trim();
            if (styleStr) {
                el.style.cssText += ";" + styleStr;
            }
        }
    }

    applyItemChildStyles(childEl, childXmlNode, context) {
        if (!childEl || !childXmlNode || childXmlNode.nodeType !== Node.ELEMENT_NODE) return;

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

    mount(appXmlString) {
        const sanitizedXml = appXmlString.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;");
        const parser = new DOMParser();
        this.xmlDoc = parser.parseFromString(sanitizedXml, "text/xml");

        const parserError = this.xmlDoc.querySelector("parsererror");
        if (parserError) {
            const errMsg = parserError.textContent.trim();
            this.reportError(errMsg, "XML Parse Error");
            if (this.container) {
                this.container.innerHTML = `
                    <div class="euix-mount-error" style="padding:16px;background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;color:#991b1b;font-family:sans-serif;">
                        <h3 style="margin:0 0 8px 0;font-size:14px;font-weight:bold;">⚠️ EUIXEngine XML Parse Error</h3>
                        <pre style="margin:0;font-size:11px;white-space:pre-wrap;">${this.escapeHtml(errMsg)}</pre>
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
                this.runMountActions();
            });
            return this;
        }

        this.render();
        this.runMountActions();
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
        if (!xmlNode || !domEl || domEl.nodeType !== Node.ELEMENT_NODE) return;

        // 1. <on_mount>
        const onMountNodes = this.getChildren(xmlNode, "on_mount");
        onMountNodes.forEach(node => {
            this.handleAction(node, context);
        });

        // 2. <on_state_change watch="..."> / <on_change watch="..."> / <watch path="...">
        const onChangeNodes = [
            ...this.getChildren(xmlNode, "on_state_change"),
            ...this.getChildren(xmlNode, "on_change"),
            ...this.getChildren(xmlNode, "on_update"),
            ...this.getChildren(xmlNode, "watch")
        ];
        onChangeNodes.forEach(node => {
            const rawWatch = node.getAttribute("watch") || node.getAttribute("path") || node.getAttribute("bind");
            const watchPath = rawWatch ? this.parseBindPath(rawWatch) : null;
            if (watchPath) {
                const unwatch = this.watch(watchPath, (newValue, oldValue) => {
                    if (typeof document !== "undefined" && !document.body.contains(domEl)) {
                        unwatch();
                        return;
                    }
                    this.handleAction(node, { ...context, newValue, oldValue });
                });
            }
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
        const compApiConfig = context._componentApiConfig || {};

        const methodNode = this.getChild(actionNode, "method");
        const method = (methodNode?.textContent || "GET").trim().toUpperCase();
        const urlNode = this.getChild(actionNode, "url");
        const targetNode = this.getChild(actionNode, "target");
        if (!urlNode || !targetNode) return;

        const loadingNode = this.getChild(actionNode, "loading");
        const loadingPath = this.parseBindPath(loadingNode?.textContent || "");
        const errorNode = this.getChild(actionNode, "error");
        const errorPath = this.parseBindPath(errorNode?.textContent || "");

        let rawUrl = this.interpolate(urlNode.textContent.trim(), context);

        // Security Guard: Block dangerous URL schemes (javascript:, vbscript:, data:)
        if (/^(javascript|vbscript|data):/i.test(rawUrl.trim())) {
            const err = new Error(`[EUIXEngine Security Guard] Blocked dangerous API URL scheme: ${rawUrl}`);
            this.reportError(err, "XHR Security Guard");
            if (loadingPath) this.setState(loadingPath, "false", { silent: true });
            if (errorPath) this.setState(errorPath, err.message);
            return;
        }

        let finalUrl = rawUrl;
        const effectiveBaseUrl = actionNode.getAttribute("base_url") 
            || compApiConfig.baseUrl 
            || this._apiConfig.baseUrl 
            || "";

        if (effectiveBaseUrl && !/^https?:\/\//i.test(rawUrl)) {
            const base = effectiveBaseUrl.replace(/\/+$/, "");
            const relative = rawUrl.replace(/^\/+/, "");
            finalUrl = `${base}/${relative}`;
        }

        const target = this.parseBindPath(targetNode.textContent);
        const selectNode = this.getChild(actionNode, "select");
        const select = selectNode?.textContent.trim() || "";
        const itemMapNode = this.getChild(actionNode, "item_map");
        const bodyNode = this.getChild(actionNode, "body");

        const targetOpNode = this.getChild(actionNode, "operation") || this.getChild(actionNode, "target_op");
        const targetOp = targetOpNode ? targetOpNode.textContent.trim().toUpperCase() : "SET";

        if (loadingPath) this.setState(loadingPath, "true");
        if (errorPath) this.setState(errorPath, "", { silent: true });

        const headersObj = {};
        if (this._apiConfig.headers && this._apiConfig.headers.size > 0) {
            this._apiConfig.headers.forEach((val, name) => {
                headersObj[name] = this.interpolate(val, context);
            });
        }
        if (compApiConfig.headers && compApiConfig.headers.size > 0) {
            compApiConfig.headers.forEach((val, name) => {
                headersObj[name] = this.interpolate(val, context);
            });
        }

        this.getChildren(actionNode, "header").forEach(header => {
            const name = header.getAttribute("name");
            if (name) headersObj[name] = this.interpolate(header.textContent.trim(), context);
        });

        const hasHeader = (hName) => Object.keys(headersObj).some(k => k.toLowerCase() === hName.toLowerCase());

        // Security: Auto-inject Anti-CSRF Token if meta tag is present
        if (typeof document !== "undefined" && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
            const csrfMeta = document.querySelector('meta[name="csrf-token"], meta[name="xsrf-token"]');
            if (csrfMeta && csrfMeta.getAttribute("content") && !hasHeader("X-CSRF-Token")) {
                headersObj["X-CSRF-Token"] = csrfMeta.getAttribute("content");
            }
        }

        const body = bodyNode ? this.interpolate(bodyNode.textContent.trim(), context) : null;
        const credentialsAttr = actionNode.getAttribute("credentials") || compApiConfig.credentials || this._apiConfig.credentials;

        // Security: Auto-set Content-Type for JSON payload bodies
        if (["POST", "PUT", "PATCH"].includes(method) && body && typeof body === "string") {
            const trimmedBody = body.trim();
            if ((trimmedBody.startsWith("{") || trimmedBody.startsWith("[")) && !hasHeader("Content-Type")) {
                headersObj["Content-Type"] = "application/json";
            }
        }

        const fetchOptions = {
            method,
            headers: headersObj
        };
        if (credentialsAttr) {
            fetchOptions.credentials = credentialsAttr;
        }

        if (method !== "GET" && method !== "HEAD" && body !== null) {
            fetchOptions.body = body;
        }

        let timeoutId = null;
        const timeoutMs = parseInt(actionNode.getAttribute("timeout") || compApiConfig.timeout || this._apiConfig.timeout || 0, 10);
        if (timeoutMs > 0 && typeof AbortController !== "undefined") {
            const controller = new AbortController();
            fetchOptions.signal = controller.signal;
            timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        }

        if (typeof this._apiConfig.onRequest === "function") {
            try {
                this._apiConfig.onRequest({ url: finalUrl, options: fetchOptions });
            } catch (_) {}
        }

        fetch(finalUrl, fetchOptions)
            .then(async (response) => {
                if (timeoutId) clearTimeout(timeoutId);
                if (typeof this._apiConfig.onResponse === "function") {
                    try {
                        this._apiConfig.onResponse(response);
                    } catch (_) {}
                }
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const contentType = response.headers.get("content-type") || "";
                let data;
                if (contentType.includes("application/json")) {
                    data = await response.json();
                } else {
                    const textData = await response.text();
                    try { data = JSON.parse(textData); } catch (_) { data = textData; }
                }
                return data;
            })
            .then((data) => {
                this.batch(() => {
                    if (loadingPath) this.setState(loadingPath, "false", { silent: true });
                    if (select) data = this.getJsonPath(data, select);
                    if (Array.isArray(data)) {
                        data = this.mapResponseItems(data, itemMapNode);
                    } else if (typeof data === "number" || (typeof data === "string" && !isNaN(parseFloat(data)) && /^\d+(\.\d+)?$/.test(String(data).trim()))) {
                        const num = parseFloat(data);
                        data = Number.isInteger(num) ? String(num) : num.toFixed(2);
                    }

                    if (target) {
                        if (targetOp === "UNSHIFT" || targetOp === "PREPEND") {
                            const currentList = Array.isArray(this._rawState[target]) ? [...this._rawState[target]] : [];
                            const newItem = (typeof data === "object" && data !== null && (data.id || data.title)) ? data : { id: Date.now(), ...data };
                            currentList.unshift(newItem);
                            this.setState(target, currentList);
                        } else if (targetOp === "PUSH" || targetOp === "APPEND") {
                            const currentList = Array.isArray(this._rawState[target]) ? [...this._rawState[target]] : [];
                            const newItem = (typeof data === "object" && data !== null && (data.id || data.title)) ? data : { id: Date.now(), ...data };
                            currentList.push(newItem);
                            this.setState(target, currentList);
                        } else if (targetOp === "REMOVE" || targetOp === "DELETE") {
                            const whereNode = this.getChild(actionNode, "where");
                            const rawEquals = whereNode ? (whereNode.getAttribute("equals") || whereNode.textContent.trim()) : "";
                            const removeId = rawEquals ? this.interpolate(rawEquals, context) : context.id;
                            const currentList = Array.isArray(this._rawState[target]) ? [...this._rawState[target]] : [];
                            const nextList = currentList.filter(item => String(item.id) !== String(removeId));
                            this.setState(target, nextList);
                        } else if (targetOp === "UPDATE") {
                            const whereNode = this.getChild(actionNode, "where");
                            const rawEquals = whereNode ? (whereNode.getAttribute("equals") || whereNode.textContent.trim()) : "";
                            const updateId = rawEquals ? this.interpolate(rawEquals, context) : context.id;
                            const currentList = Array.isArray(this._rawState[target]) ? [...this._rawState[target]] : [];
                            const nextList = currentList.map(item => String(item.id) === String(updateId) ? { ...item, ...data } : item);
                            this.setState(target, nextList);
                        } else {
                            this.setState(target, data);
                        }
                    }

                    this.applyResets(actionNode);
                    if (errorPath) this.setState(errorPath, "", { silent: true });
                });
            })
            .catch((err) => {
                this.batch(() => {
                    if (loadingPath) this.setState(loadingPath, "false", { silent: true });
                    if (errorPath) this.setState(errorPath, err.message || "Ağ hatası", { silent: true });
                });
            });
    }

    static registerConstant(name, value) {
        if (!EUIXEngine._globalConstants) EUIXEngine._globalConstants = new Map();
        EUIXEngine._globalConstants.set(name, value);
    }

    registerConstant(name, value) {
        if (!this.constants) this.constants = new Map();
        this.constants.set(name, value);
    }

    getConstant(name) {
        if (this.constants && this.constants.has(name)) return this.constants.get(name);
        if (EUIXEngine._globalConstants && EUIXEngine._globalConstants.has(name)) return EUIXEngine._globalConstants.get(name);
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

        const collectStatesFromDoc = (doc) => {
            if (!doc) return;
            const dataModelNode = this.getChild(doc.querySelector("uid_spec") || doc, "data_model") || doc.querySelector("data_model");
            if (dataModelNode) {
                const src = dataModelNode.getAttribute("src") || dataModelNode.getAttribute("url");
                if (src && typeof fetch !== "undefined") {
                    const interpolatedSrc = this.interpolate(src);
                    const p = this.loadDataModel(interpolatedSrc);
                    if (this._pendingAsyncLoads) this._pendingAsyncLoads.push(p);
                }
            }

            const stateNodes = dataModelNode ? this.getChildren(dataModelNode, "state") : doc.querySelectorAll("data_model > state");

            stateNodes.forEach(node => {
                const id = node.getAttribute("id");
                if (!id) return;
                const type = node.getAttribute("type");
                const src = node.getAttribute("src") || node.getAttribute("url");
                const persistAttr = node.getAttribute("persist") || node.getAttribute("storage");

                if (src && typeof fetch !== "undefined") {
                    const interpolatedSrc = this.interpolate(src);
                    const p = fetch(interpolatedSrc)
                        .then(res => res.json())
                        .then(json => {
                            this.setState(id, json);
                        })
                        .catch(err => this.reportError(err, `Failed to load external state '${id}' from '${src}'`));
                    if (this._pendingAsyncLoads) this._pendingAsyncLoads.push(p);
                } else if (type === "array") {
                    const items = this.getChildren(node, "item").map(item => {
                        const obj = {};
                        Array.from(item.attributes).forEach(attr => obj[attr.name] = attr.value);
                        return obj;
                    });
                    rawState[id] = items;
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
        };

        if (EUIXEngine._globalComponentSpecs) {
            EUIXEngine._globalComponentSpecs.forEach(spec => collectStatesFromDoc(spec));
        }
        if (this._componentSpecs) {
            this._componentSpecs.forEach(spec => collectStatesFromDoc(spec));
        }

        if (this.xmlDoc) {
            collectStatesFromDoc(this.xmlDoc);
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
    }

    interpolate(text, context = {}) {
        if (!text) return "";

        let result = text;

        // 1. Resolve {const.name}, {var.name}, {constants.name}, {vars.name}
        result = result.replace(/\{(?:const|var|constant|variable|constants|vars)\.(\w+)\}/g, (match, name) => {
            if (context && context.constants && context.constants[name] !== undefined) {
                return context.constants[name];
            }
            if (this.constants && this.constants.has(name)) {
                return this.constants.get(name);
            }
            if (EUIXEngine._globalConstants && EUIXEngine._globalConstants.has(name)) {
                return EUIXEngine._globalConstants.get(name);
            }
            return match;
        });

        // 2. Resolve complex expressions or ternary inside {...}
        result = result.replace(/\{([^{}]+)\}/g, (match, innerExpr) => {
            const trimmed = innerExpr.trim();

            if (/^(?:const|var|constant|variable|constants|vars)\./.test(trimmed)) {
                return match;
            }

            if (/[?!=><+\-*/]/.test(trimmed) || trimmed.includes("data.")) {
                try {
                    const evaluated = EUIXExpressionParser.eval(trimmed, (name) => {
                        const cleanKey = name.replace(/^(?:parent\.)?data\./, "");
                        let val = this.getState(this.parseBindPath(cleanKey));
                        if (val === undefined && context[name] !== undefined) {
                            val = context[name];
                        }
                        if (val === undefined && name.includes(".")) {
                            const parts = name.split(".");
                            let curr = context[parts[0]];
                            for (let i = 1; i < parts.length && curr !== undefined && curr !== null; i++) {
                                curr = curr[parts[i]];
                            }
                            if (curr !== undefined) val = curr;
                        }
                        return val;
                    });
                    if (evaluated !== undefined && evaluated !== null) {
                        return String(evaluated);
                    }
                } catch (_) {}
            }

            if (/^(?:parent\.)?data\./.test(trimmed)) {
                const cleanKey = trimmed.replace(/^(?:parent\.)?data\./, "");
                const val = this.getState(this.parseBindPath(cleanKey));
                return val !== undefined && val !== null ? String(val) : "";
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
            if (name.startsWith("data.")) {
                return this.getState(name.slice(5));
            }
            const ctxMatch = name.match(/^(\w+)(?:\.(\w+))?$/);
            if (ctxMatch) {
                const [_, scope, prop] = ctxMatch;
                if (scope && context[scope] !== undefined) {
                    if (prop) return context[scope][prop];
                    return context[scope];
                }
            }
            return this.getState(name);
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
                activeIndex = newIndex;
                containerNode.innerHTML = "";
                if (newIndex !== -1) {
                    const fragment = document.createDocumentFragment();
                    this.appendChildren(fragment, branches[newIndex].nodes, context, {
                        skipTags: ["else", "else_if"]
                    });
                    containerNode.appendChild(fragment);
                }
            }
        };

        keys.forEach(k => this.registerBinding(k, containerNode, "conditional", updateFn));

        return containerNode;
    }

    renderCollapse(xmlNode, context = {}) {
        const rawBind = xmlNode.getAttribute("bind") || "";
        const interpolatedBind = this.interpolate(rawBind, context);
        const bindPath = this.parseBindPath(interpolatedBind);
        let open = bindPath ? this.isTruthy(this.getState(bindPath)) : true;

        const summaryNode = this.getChild(xmlNode, "summary");
        const titleAttr = xmlNode.getAttribute("title") || "";
        const title = summaryNode
            ? this.interpolate(summaryNode.textContent.trim(), context)
            : this.interpolate(titleAttr, context) || "Detay";

        const root = document.createElement("div");
        const extraClass = xmlNode.getAttribute("class") || "";

        const header = document.createElement("button");
        header.type = "button";
        header.className = xmlNode.getAttribute("header_class") || "euix-collapse-header";

        const chevron = document.createElement("span");
        chevron.className = "euix-collapse-chevron";

        const label = document.createElement("span");
        label.className = "euix-collapse-title";
        label.textContent = title;

        header.appendChild(chevron);
        header.appendChild(label);

        const body = document.createElement("div");
        body.className = xmlNode.getAttribute("body_class") || "euix-collapse-body";

        const renderBodyChildren = () => {
            body.innerHTML = "";
            Array.from(xmlNode.childNodes).forEach(child => {
                if (child.nodeType === Node.ELEMENT_NODE && child.tagName.toLowerCase() === "summary") return;
                const el = this.createHTMLElement(child, context);
                if (el) body.appendChild(el);
            });
        };

        const updateCollapseState = (isOpen) => {
            open = isOpen;
            root.className = ["euix-collapse", open ? "is-open" : "is-closed", extraClass].filter(Boolean).join(" ");
            header.setAttribute("aria-expanded", open ? "true" : "false");
            chevron.textContent = open ? "▼" : "▶";
            if (open) {
                if (!root.contains(body)) {
                    renderBodyChildren();
                    root.appendChild(body);
                }
            } else {
                if (root.contains(body)) root.removeChild(body);
            }
        };

        updateCollapseState(open);

        if (bindPath) {
            header.onclick = () => {
                const next = this.isTruthy(this.getState(bindPath)) ? "false" : "true";
                this.setState(bindPath, next);
            };
            this.registerBinding(bindPath, root, "collapse", (val) => {
                updateCollapseState(this.isTruthy(val));
            });
        }

        root.appendChild(header);
        if (open) root.appendChild(body);

        return root;
    }

    renderDialog(xmlNode, context = {}) {
        const rawBind = xmlNode.getAttribute("bind") || "";
        const interpolatedBind = this.interpolate(rawBind, context);
        const bindPath = this.parseBindPath(interpolatedBind);
        let open = bindPath ? this.isTruthy(this.getState(bindPath)) : false;

        const closeOnBackdrop = xmlNode.getAttribute("close_on_backdrop") !== "false";
        const summaryNode = this.getChild(xmlNode, "summary");
        const actionsNode = this.getChild(xmlNode, "actions");
        const titleAttr = xmlNode.getAttribute("title") || "";
        const title = summaryNode
            ? this.interpolate(summaryNode.textContent.trim(), context)
            : this.interpolate(titleAttr, context) || "Dialog";

        const close = () => {
            if (bindPath) this.setState(bindPath, "false");
        };

        const containerNode = document.createElement("div");
        containerNode.className = "euix-dialog-container";
        containerNode.style.display = "contents";

        const backdrop = document.createElement("div");
        const extraClass = xmlNode.getAttribute("class") || "";
        backdrop.className = xmlNode.getAttribute("backdrop_class") || ["dialog-backdrop fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4", extraClass].filter(Boolean).join(" ");
        backdrop.tabIndex = -1;
        backdrop.setAttribute("role", "presentation");

        backdrop.onclick = (e) => {
            if (closeOnBackdrop && e.target === backdrop) close();
        };
        backdrop.onkeydown = (e) => {
            if (e.key === "Escape") close();
        };

        const panel = document.createElement("div");
        panel.className = xmlNode.getAttribute("panel_class") || "dialog-panel bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden";
        panel.setAttribute("role", "dialog");
        panel.setAttribute("aria-modal", "true");
        panel.setAttribute("aria-label", title);

        const header = document.createElement("div");
        header.className = xmlNode.getAttribute("header_class") || "dialog-header p-4 border-b border-slate-100 flex items-center justify-between";

        const titleEl = document.createElement("h3");
        titleEl.className = "dialog-title text-base font-bold text-slate-800";
        titleEl.textContent = title;

        const closeBtn = document.createElement("button");
        closeBtn.type = "button";
        closeBtn.className = "dialog-close text-slate-400 hover:text-slate-700 text-lg font-bold px-2 py-1 rounded-md cursor-pointer";
        closeBtn.setAttribute("aria-label", "Kapat");
        closeBtn.textContent = "×";
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            close();
        };

        header.appendChild(titleEl);
        header.appendChild(closeBtn);

        const body = document.createElement("div");
        body.className = xmlNode.getAttribute("body_class") || "dialog-body p-5";
        Array.from(xmlNode.childNodes).forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE &&
                ["summary", "actions"].includes(child.tagName.toLowerCase())) {
                return;
            }
            const el = this.createHTMLElement(child, context);
            if (el) body.appendChild(el);
        });

        panel.appendChild(header);
        panel.appendChild(body);

        if (actionsNode) {
            const footer = document.createElement("div");
            footer.className = xmlNode.getAttribute("footer_class") || "dialog-actions";
            Array.from(actionsNode.childNodes).forEach(child => {
                const el = this.createHTMLElement(child, context);
                if (el) footer.appendChild(el);
            });
            panel.appendChild(footer);
        }

        panel.onclick = (e) => e.stopPropagation();
        backdrop.appendChild(panel);

        const updateDialogState = (isOpen) => {
            open = isOpen;
            if (open) {
                if (!containerNode.contains(backdrop)) {
                    containerNode.appendChild(backdrop);
                    if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
                    window.requestAnimationFrame(() => backdrop.focus());
                } else {
                    setTimeout(() => backdrop.focus(), 0);
                }
                }
            } else {
                if (containerNode.contains(backdrop)) {
                    containerNode.removeChild(backdrop);
                }
            }
        };

        updateDialogState(open);

        if (bindPath) {
            this.registerBinding(bindPath, containerNode, "dialog", (val) => {
                updateDialogState(this.isTruthy(val));
            });
        }

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

        const validationAttrs = ["required", "pattern", "minlength", "maxlength", "min", "max", "step", "title", "autocomplete", "disabled", "readonly", "autofocus"];

        Array.from(xmlNode.attributes).forEach(attr => {
            const attrName = attr.name;
            const attrValue = attr.value;
            if (!attrValue) return;

            if (attrName === "id") {
                el.id = this.interpolate(attrValue, context);
            }

            if (validationAttrs.includes(attrName)) {
                if (["required", "disabled", "readonly", "autofocus"].includes(attrName)) {
                    const isBoolTrue = this.isTruthy(attrValue) || attrValue === "" || attrValue.toLowerCase() === attrName;
                    if (isBoolTrue) {
                        el.setAttribute(attrName, "");
                        try { el[attrName] = true; } catch (_) {}
                    }
                } else if (!attrValue.includes("data.")) {
                    el.setAttribute(attrName, this.interpolate(attrValue, context));
                }
            }

            const matches = Array.from(attrValue.matchAll(/(?:parent\.)?data\.([a-zA-Z0-9_]+)/g));
            if (matches.length > 0) {
                const uniqueKeys = new Set(matches.map(m => m[1]));
                uniqueKeys.forEach(key => {
                    this.registerBinding(key, el, "attribute", { attrName, template: attrValue });
                });
                this.updateAttributeBinding(el, attrName, attrValue, context);
            }
        });
    }

    updateAttributeBinding(el, attrName, template, context = {}) {
        if (!el || !attrName || !template) return;
        const newAttrVal = this.interpolate(template, context);

        if (["disabled", "required", "readonly", "checked", "autofocus"].includes(attrName)) {
            const isBoolTrue = this.isTruthy(newAttrVal) && newAttrVal !== "false" && newAttrVal !== "0";
            if (isBoolTrue) {
                el.setAttribute(attrName, "");
                try { el[attrName] = true; } catch (_) {}
            } else {
                el.removeAttribute(attrName);
                try { el[attrName] = false; } catch (_) {}
            }
            return;
        }

        if (attrName === "value" && ("value" in el)) {
            el.value = newAttrVal;
        } else if (attrName === "class") {
            el.className = newAttrVal;
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

    createHTMLElement(xmlNode, context = {}) {
        if (!xmlNode) return null;
        try {
            const el = this._createHTMLElementInternal(xmlNode, context);
            if (el && el.nodeType === Node.ELEMENT_NODE) {
                this.processLifecycleHooks(xmlNode, el, context);
            }
            return el;
        } catch (err) {
            this.reportError(err, `Error rendering <${xmlNode.tagName || 'element'}>`);
            const fallback = document.createElement("div");
            fallback.className = "euix-error-fallback";
            fallback.style.cssText = "padding:4px 8px;margin:2px 0;background:#fff1f2;border:1px solid #fecdd3;border-radius:6px;color:#e11d48;font-size:11px;font-family:sans-serif;";
            fallback.textContent = `⚠️ Component Error: <${xmlNode.tagName || 'unknown'}>`;
            return fallback;
        }
    }

    _createHTMLElementInternal(xmlNode, context = {}) {
        if (xmlNode.nodeType === Node.TEXT_NODE) {
            const txt = xmlNode.textContent.trim();
            return txt ? document.createTextNode(this.interpolate(txt, context)) : null;
        }

        if (xmlNode.nodeType !== Node.ELEMENT_NODE) return null;

        const tagName = xmlNode.tagName.toLowerCase();
        if (METADATA_AND_EVENT_TAGS.has(tagName) || tagName.startsWith("on_")) {
            return null;
        }

        const typeAttr = (xmlNode.getAttribute("type") || "").toLowerCase();

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

        if (this._componentSpecs.has(tagName) || (EUIXEngine._globalComponentSpecs && EUIXEngine._globalComponentSpecs.has(tagName))) {
            const specNode = this._componentSpecs.get(tagName) || EUIXEngine._globalComponentSpecs.get(tagName);
            const res = this.renderComponentSpec(specNode, xmlNode, context);
            return this.applyRef(res, xmlNode, context);
        }

        if (typeAttr && (this._componentSpecs.has(typeAttr) || (EUIXEngine._globalComponentSpecs && EUIXEngine._globalComponentSpecs.has(typeAttr)))) {
            const specNode = this._componentSpecs.get(typeAttr) || EUIXEngine._globalComponentSpecs.get(typeAttr);
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
            this.applyNodeAttributes(el, xmlNode, context);
            this.bindEvents(xmlNode, el, context);

            Array.from(xmlNode.childNodes).forEach(child => {
                const childEl = this.createHTMLElement(child, context);
                if (childEl) {
                    this.applyItemChildStyles(childEl, child, context);
                    el.appendChild(childEl);
                }
            });

            return el;
        }

        if (tagName === "for_each") {
            const listContainer = document.createElement("div");
            listContainer.className = "euix-list-container";
            listContainer.style.display = "contents";

            const itemsAttr = xmlNode.getAttribute("items") || "";
            const itemsKey = this.parseBindPath(itemsAttr);
            const varName = xmlNode.getAttribute("var") || "item";

            const renderItems = () => {
                listContainer.innerHTML = "";
                const list = (this._rawState && this._rawState[itemsKey] && Array.isArray(this._rawState[itemsKey]))
                    ? this._rawState[itemsKey]
                    : [];

                list.forEach((item, idx) => {
                    if (typeof item === "object" && item !== null) {
                        try {
                            item._index = idx;
                            item.index = idx;
                        } catch (_) {}
                    }
                    Array.from(xmlNode.children).forEach(child => {
                        const childContext = { ...context, [varName]: item, _index: idx, index: idx, _parentStateKey: itemsKey };
                        const el = this.createHTMLElement(child, childContext);
                        if (el) {
                            this.applyItemChildStyles(el, child, context);
                            listContainer.appendChild(el);
                        }
                    });
                });
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
                sel.onchange = (e) => {
                    this.setState(bindPath, e.target.value);
                };
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
            return this.renderCollapse(xmlNode, context);
        }

        if (tagName === "dialog") {
            return this.renderDialog(xmlNode, context);
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
                } catch (_) {
                    el = document.createElement("div");
                }
            }

            const elClass = this.interpolate(xmlNode.getAttribute("class") || "", context);
            if (elClass && el) el.className = elClass;

            if (type === "text" && bindPath) {
                const templateNode = this.getChild(xmlNode, "template");
                const inlineTemplate = Array.from(xmlNode.childNodes)
                    .filter(n => n.nodeType === Node.TEXT_NODE)
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
                if (type === "text" && bindPath && child.nodeType === Node.TEXT_NODE) {
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

        const allowedTags = ["button", "input", "textarea", "select", "form", "a", "img", "option", "table", "tr", "td", "th", "div", "span", "strong", "em", "label", "p", "h1", "h2", "h3", "h4", "h5", "h6", "section", "article", "header", "footer", "nav", "aside", "main", "figure", "figcaption", "mark", "small", "sub", "sup", "code", "pre", "blockquote"];
        const elementTagName = allowedTags.includes(tagName) ? tagName : "div";
        const div = document.createElement(elementTagName);
        const xmlClass = this.interpolate(xmlNode.getAttribute("class") || "", context);
        if (xmlClass) div.className = xmlClass;

        if (tagName === "layout") {
            const layoutType = xmlNode.getAttribute("type") || "";
            div.className = [layoutType, xmlClass].filter(Boolean).join(" ");
            this.applyLayoutStyles(div, xmlNode, context);
        }

        this.bindEvents(xmlNode, div, context);

        Array.from(xmlNode.childNodes).forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE && EVENT_TAGS.has(child.tagName.toLowerCase())) {
                return;
            }
            const childEl = this.createHTMLElement(child, context);
            if (childEl) {
                this.applyItemChildStyles(childEl, child, context);
                div.appendChild(childEl);
            }
        });

        const childElementNodes = Array.from(xmlNode.childNodes).filter(n =>
            n.nodeType === Node.ELEMENT_NODE && !EVENT_TAGS.has(n.tagName.toLowerCase())
        );

        if (childElementNodes.length === 0 && !["input", "select", "textarea", "form"].includes(tagName) && !["text_input", "checkbox", "radio", "textarea", "number_input", "range_input", "date_input", "color_input", "file_input"].includes(typeAttr)) {
            const rawContent = xmlNode.textContent;
            const matches = Array.from(rawContent.matchAll(/(?:parent\.)?data\.([a-zA-Z0-9_]+)/g));
            if (matches.length > 0) {
                div.dataset.euixMultiTemplate = rawContent;
                const uniqueKeys = new Set(matches.map(m => m[1]));
                uniqueKeys.forEach(key => {
                    this.registerBinding(key, div, "multi_template");
                    this.syncBindings(key, this.getState(key));
                });
            } else {
                const genericBindPath = this.resolveBindPath(xmlNode);
                if (genericBindPath) {
                    const trimmed = rawContent.trim();
                    if (trimmed.includes("{value}")) {
                        div.dataset.euixTextTemplate = trimmed;
                    } else if (trimmed.includes(`{data.${genericBindPath}}`)) {
                        const escapedPath = this.escapeRegExp(genericBindPath);
                        div.dataset.euixTextTemplate = trimmed.replace(new RegExp(`\\{data\\.${escapedPath}\\}`, "g"), "{value}");
                    }
                    this.registerBinding(genericBindPath, div, "text");
                    this.syncBindings(genericBindPath, this.getState(genericBindPath));
                }
            }
        }

        return this.applyRef(div, xmlNode, context);
    }

    bindEvents(xmlNode, el, context = {}) {
        if (!el || xmlNode.nodeType !== Node.ELEMENT_NODE) return;

        const eventMap = new Map();

        const childNodes = Array.from(xmlNode.childNodes).filter(n => n.nodeType === Node.ELEMENT_NODE);

        childNodes.forEach(child => {
            const tagName = child.tagName.toLowerCase();
            let eventType = null;

            if (tagName === "on_click") eventType = "click";
            else if (tagName === "on_change") eventType = "change";
            else if (tagName === "on_submit") eventType = (el.tagName && el.tagName.toLowerCase() === "button") ? "click" : "submit";
            else if (tagName === "on_keyup") eventType = "keyup";
            else if (tagName === "on_keydown") eventType = "keydown";
            else if (tagName === "on_mouseenter") eventType = "mouseenter";
            else if (tagName === "on_mouseleave") eventType = "mouseleave";
            else if (tagName === "event" || tagName === "on") {
                eventType = (child.getAttribute("type") || child.getAttribute("name") || child.getAttribute("event") || "click").toLowerCase();
            }

            if (eventType) {
                if (!eventMap.has(eventType)) eventMap.set(eventType, []);
                eventMap.get(eventType).push(child);
            }
        });

        eventMap.forEach((handlerNodes, eventType) => {
            el.addEventListener(eventType, (e) => {
                if (eventType === "submit") {
                    e.preventDefault();
                    const formEl = el.tagName === "FORM" ? el : el.closest("form");
                    if (formEl && typeof formEl.checkValidity === "function") {
                        if (!formEl.checkValidity()) {
                            if (typeof formEl.reportValidity === "function") {
                                formEl.reportValidity();
                            }
                            return;
                        }
                    }
                }

                if (eventType === "click" && (el.type === "submit" || (el.tagName === "BUTTON" && el.closest("form")))) {
                    const formEl = el.closest("form");
                    if (formEl && typeof formEl.checkValidity === "function") {
                        if (!formEl.checkValidity()) {
                            if (typeof formEl.reportValidity === "function") {
                                formEl.reportValidity();
                            }
                            e.preventDefault();
                            return;
                        }
                    }
                }

                for (const node of handlerNodes) {
                    const targetKey = node.getAttribute("key") || node.getAttribute("code");
                    if (targetKey && e.key && e.key.toLowerCase() !== targetKey.toLowerCase()) {
                        continue;
                    }

                    if (!this.confirmAction(node, context)) continue;

                    if (node.getAttribute("action")) {
                        const actType = node.getAttribute("action");
                        if (actType === "XHR") this.handleXHR(node, context);
                        else this.batch(() => this.handleAction(node, context));
                    }

                    const childActions = Array.from(node.children).filter(c => c.tagName && c.tagName.toLowerCase() !== "confirm");
                    if (childActions.length) {
                        const syncActions = [];
                        const xhrActions = [];
                        childActions.forEach(act => {
                            if (act.getAttribute("action") === "XHR") xhrActions.push(act);
                            else syncActions.push(act);
                        });

                        if (syncActions.length) {
                            this.batch(() => {
                                syncActions.forEach(act => this.handleAction(act, context));
                            });
                        }
                        xhrActions.forEach(act => this.handleXHR(act, context));
                    }
                }
            });
        });
    }

    renderComponentSpec(specNode, usageNode, context = {}) {
        if (!specNode) return null;

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
        const compName = specNode.getAttribute("name") || specNode.getAttribute("id") || (usageNode.tagName ? usageNode.tagName.toLowerCase() : "component");
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
            const baseUrl = apiNode.getAttribute("base_url") || apiNode.getAttribute("baseUrl") || apiNode.getAttribute("url") || "";
            const credentials = apiNode.getAttribute("credentials") || undefined;
            const timeout = parseInt(apiNode.getAttribute("timeout") || "0", 10) || 0;
            const headers = new Map(componentApiConfig?.headers || []);
            
            const headersNode = this.getChild(apiNode, "headers");
            if (headersNode) {
                this.getChildren(headersNode, "header").forEach(h => {
                    const name = h.getAttribute("name");
                    if (name) headers.set(name, h.textContent.trim());
                });
            }

            componentApiConfig = { baseUrl, credentials, timeout, headers };
        }

        const childContext = {
            ...context,
            parent: context,
            $parent: context,
            props,
            ...props,
            _compDepth: compDepth,
            _componentApiConfig: componentApiConfig,
            constants: {
                ...(context.constants || {}),
                ...compConstants
            }
        };

        const metadataTags = ["props", "data_model", "imports", "import", "constants", "vars", "variables"];
        const templateNode = this.getChild(specNode, "template") ||
            this.getChild(specNode, "flex") ||
            this.getChild(specNode, "grid") ||
            this.getChild(specNode, "layout") ||
            this.getChild(specNode, "collapse") ||
            this.getChild(specNode, "dialog") ||
            Array.from(specNode.children || []).find(c => c.tagName && !metadataTags.includes(c.tagName.toLowerCase())) ||
            specNode;

        const rendered = this.createHTMLElement(templateNode, childContext);
        if (rendered && rendered.nodeType === Node.ELEMENT_NODE) {
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
            return window.confirm(message || "Emin misiniz?");
        }

        return window.confirm(this.interpolate(confirmAttr, context) || "Emin misiniz?");
    }

    handleAction(actionNode, context) {
        if (!actionNode) return;
        try {
            this._handleActionInternal(actionNode, context);
        } catch (err) {
            const actName = actionNode.getAttribute ? actionNode.getAttribute("action") : "unknown";
            this.reportError(err, `Action Execution Fallback (${actName})`);
        }
    }

    _handleActionInternal(actionNode, context) {
        const actionType = actionNode.getAttribute("action");

        if (this._devtools && this._devtools.enabled) {
            const pathNode = this.getChild(actionNode, "path");
            const opNode = this.getChild(actionNode, "operation");
            this._devtools.logAction(actionType || actionNode.tagName, {
                path: pathNode ? pathNode.textContent.trim() : "",
                operation: opNode ? opNode.textContent.trim() : ""
            });
        }

        if (this._customActions.has(actionType)) {
            const handler = this._customActions.get(actionType);
            handler(actionNode, context, this);
            return;
        }

        if (actionType === "XHR") {
            this.handleXHR(actionNode, context);
            return;
        }

        if (actionType === "SET_STATE") {
            const pathNode = this.getChild(actionNode, "path");
            const valueNode = this.getChild(actionNode, "value");
            if (!pathNode) return;

            const rawPath = pathNode ? pathNode.textContent.trim() : "";
            const interpolatedPath = this.interpolate(rawPath, context);
            const path = this.parseBindPath(interpolatedPath);

            const rawValue = valueNode ? valueNode.textContent.trim() : "";
            let nextValue = "";

            const evalGetter = (key) => {
                const cleanKey = this.parseBindPath(key);
                const val = this.getState(cleanKey);
                const num = parseFloat(val);
                return (!isNaN(num) && val !== "" && val !== null) ? num : (val ?? 0);
            };

            const cleanExpr = rawValue.replace(/\{\s*(data\.\w+|\w+)\s*\}/g, "$1").replace(/^\{\s*|\s*\}$/g, "").trim();

            if (rawValue.includes("?") || /[\+\-\*\/]/.test(rawValue)) {
                try {
                    const evaluated = EUIXExpressionParser.eval(cleanExpr, evalGetter);
                    if (evaluated !== undefined && typeof evaluated === "number" && !isNaN(evaluated)) {
                        nextValue = String(evaluated);
                    }
                } catch (_) {}
            }

            if (!nextValue) {
                nextValue = this.interpolate(rawValue, context);
            }

            this.setState(path, nextValue);

            const focusNode = this.getChild(actionNode, "focus");
            if (focusNode) {
                const targetStr = focusNode.textContent.trim();
                const resolved = this.interpolate(targetStr, context).replace(/^ref:/, '');
                if (this.refs[resolved] && typeof this.refs[resolved].focus === "function") {
                    this.refs[resolved].focus();
                } else {
                    this._pendingFocusKey = this.parseBindPath(targetStr);
                }
            }
            return;
        }

        if (actionType === "FOCUS") {
            const target = actionNode.getAttribute("target") || actionNode.getAttribute("ref") || this.getChild(actionNode, "target")?.textContent || this.getChild(actionNode, "ref")?.textContent;
            if (target) {
                const resolved = this.interpolate(target, context).replace(/^ref:/, '');
                if (this.refs[resolved] && typeof this.refs[resolved].focus === "function") {
                    this.refs[resolved].focus();
                } else {
                    const el = document.querySelector(`[data-euix-ref="${resolved}"], #${resolved}`);
                    if (el && typeof el.focus === "function") el.focus();
                }
            }
            return;
        }

        if (actionType === "MUTATE_STATE") {
            const pathNode = this.getChild(actionNode, "path");
            const opNode = this.getChild(actionNode, "operation");
            const rawPath = pathNode ? pathNode.textContent.trim() : (actionNode.getAttribute("path") || "");
            const interpolatedPath = this.interpolate(rawPath, context);
            const path = this.parseBindPath(interpolatedPath);
            const operation = (opNode ? opNode.textContent.trim() : actionNode.getAttribute("operation") || "").toUpperCase();

            if (!path || !operation) return;

            if (operation === "CLEAR" || operation === "EMPTY" || operation === "RESET") {
                this.batch(() => {
                    this.setState(path, []);
                    this.applyResets(actionNode);
                });
            }

            if (operation === "PUSH" || operation === "UNSHIFT" || operation === "PREPEND") {
                const valNode = this.getChild(actionNode, "value");
                const valItem = (valNode && this.getChild(valNode, "item")) || this.getChild(actionNode, "item") || valNode;
                const rawText = valItem ? (valItem.getAttribute("text") || valItem.textContent.trim()) : "";
                const textValue = this.interpolate(rawText, context);

                if (!valItem && !textValue.trim()) return;

                const newItem = { id: Date.now().toString() };
                if (valItem && valItem.attributes) {
                    Array.from(valItem.attributes).forEach(attr => {
                        newItem[attr.name] = this.interpolate(attr.value, context);
                    });
                }
                if (!newItem.text && textValue) newItem.text = textValue;
                if (newItem.completed === undefined) newItem.completed = "false";

                this.batch(() => {
                    const currentList = Array.isArray(this._rawState[path]) ? this._rawState[path] : [];
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
            }

            if (operation === "UPDATE") {
                const whereNode = this.getChild(actionNode, "where");
                const fieldsNode = this.getChild(actionNode, "fields") || this.getChild(actionNode, "item");
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
    }

    render() {
        if (!this.container || !this.xmlDoc) return;

        this._bindings = new Map();
        this.refs = {};
        const root = this.getChild(this.xmlDoc, "uid_spec") || this.xmlDoc.querySelector("uid_spec") || this.xmlDoc;
        let layout = this.getChild(root, "layout") || this.getChild(root, "flex") || this.getChild(root, "grid") || this.getChild(root, "form");
        if (!layout) {
            layout = root.querySelector("layout, flex, grid, form, collapse");
        }
        if (!layout) {
            layout = Array.from(root.children || []).find(c => c.tagName && !["data_model", "imports", "constants", "vars", "variables", "component_def"].includes(c.tagName.toLowerCase())) || root;
        }

        if (layout) {
            const dom = this.createHTMLElement(layout);
            if (dom) this.container.appendChild(dom);
        }

        const autofocusEl = this.container.querySelector("[data-euix-autofocus='true']");
        if (autofocusEl && typeof autofocusEl.focus === "function") {
            autofocusEl.focus();
        }
    }
}

EUIXEngine.EUIXExpressionParser = EUIXExpressionParser;

if (typeof window !== "undefined" && typeof document !== "undefined") {
    window.EUIXExpressionParser = EUIXExpressionParser;
    window.EUIXEngine = EUIXEngine;
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => EUIXEngine.autoInit());
    } else {
        EUIXEngine.autoInit();
    }
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { EUIXEngine, EUIXExpressionParser, default: EUIXEngine };
}

export { EUIXEngine, EUIXExpressionParser };
export default EUIXEngine;
