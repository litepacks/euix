/**
 * src/core/lifecycle/Lifecycle.js
 * Mount lifecycle orchestration, external script/style loaders, data model parsing, and teardown hooks for EUIX Engine.
 */

import {
    getNow,
    isElem,
    isFn,
    isScoped,
    isObj,
    isStr,
    getAttr,
    hasDoc,
    hasWindow,
    queryAll,
    safeParse,
    toInt,
    DEFAULT_TIMEOUTS,
    safeFetchWithTimeout,
} from "../utils/constants.js";
import { parseStateValue } from "../state/ReactiveStore.js";
import { autoInit as declarativeAutoInit } from "./DeclarativeLoader.js";

export function mount(engine, appXmlString, options = {}) {
    const mountStart = getNow();
    engine._mountOptions = options;
    if (options.props && typeof options.props === "object") {
        engine.props = { ...(engine.props || {}), ...options.props };
    }
    if (isObj(appXmlString)) {
        if (appXmlString.nodeType) {
            engine.xmlDoc = appXmlString;
        } else if (appXmlString.irVersion || appXmlString.ir) {
            const irAdapter =
                engine.constructor?.irAdapter ||
                (typeof globalThis !== "undefined" ? globalThis.__EUIX_IR_ADAPTER__ : null);
            if (isFn(irAdapter)) {
                const xmlStr = irAdapter(appXmlString.ir || appXmlString);
                engine.xmlDoc = engine.constructor.parseXmlToAst(xmlStr, { ...options, silent: true });
            } else {
                const errMsg =
                    "[EUIX Lifecycle] Mounting a Runtime IR object requires an IR adapter. Please import 'euixjs/prepare' or register an adapter via EUIXEngineCore.registerIrAdapter(fn).";
                engine.reportError(errMsg, "Runtime IR Adapter Missing");
                throw new Error(errMsg);
            }
        } else if (isFn(engine.constructor.deserializeAst)) {
            engine.xmlDoc = engine.constructor.deserializeAst(appXmlString);
        } else {
            engine.xmlDoc = appXmlString;
        }
    } else {
        engine.xmlDoc = engine.constructor.parseXmlToAst(appXmlString, { ...options, silent: true });
    }

    const parserError =
        engine.xmlDoc && engine.xmlDoc.querySelector ? engine.xmlDoc.querySelector("parsererror") : null;
    if (parserError) {
        const errorText = parserError.textContent.trim();
        const lineMatch = errorText.match(/line\s+(\d+)/i) || errorText.match(/:(\d+):/);
        const colMatch = errorText.match(/column\s+(\d+)/i) || errorText.match(/:(\d+):(\d+)/);
        const line = lineMatch ? toInt(lineMatch[1], 1) : 1;
        const col = colMatch ? toInt(colMatch[colMatch.length - 1], 1) : 1;
        const codeFrame = engine.constructor.generateCodeFrame(appXmlString, line, col);
        const errMsg = `[EUIX XML Parse Error] at line ${line}, column ${col}:\n${codeFrame || errorText}`;
        engine.reportError(errMsg, "XML Parse Error");
        const shouldShowError =
            options.showError !== false &&
            engine.options?.showError !== false &&
            engine.constructor.config?.showMountErrors !== false &&
            (typeof window === "undefined" || window.__EUIX_SHOW_MOUNT_ERRORS__ !== false);

        if (engine.container && shouldShowError) {
            engine.container.innerHTML = `
                <div class="euix-mount-error" style="padding:16px;background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;color:#991b1b;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">
                    <h3 style="margin:0 0 8px 0;font-size:14px;font-weight:bold;">⚠️ EUIXEngine XML Parse Error (Line ${line}, Col ${col})</h3>
                    <pre style="margin:0;font-size:12px;white-space:pre-wrap;line-height:1.4;">${engine.escapeHtml(codeFrame || errorText)}</pre>
                </div>
            `;
        }
        return engine;
    }

    if (!engine.xmlDoc || !isFn(engine.xmlDoc.querySelectorAll)) {
        return engine;
    }

    const defNodes = engine.xmlDoc._cachedDefNodes || (engine.xmlDoc._cachedDefNodes = queryAll(engine.xmlDoc, "component_def"));
    defNodes.forEach((def) => {
        const name = getAttr(def, "name", "id");
        if (name) {
            engine.registerComponentSpec(name, def);
        }
    });

    engine._pendingAsyncLoads = [];
    engine.initConstants();
    engine.initDataModel();
    if (isFn(engine.initActionRegistry)) engine.initActionRegistry();

    const importNodes = engine.xmlDoc._cachedImportNodes || (engine.xmlDoc._cachedImportNodes = queryAll(engine.xmlDoc, "import"));
    if (importNodes.length > 0 && typeof fetch !== "undefined") {
        importNodes.forEach((imp) => {
            const src = imp.getAttribute("src");
            const name = getAttr(imp, "name", "as");
            const lazyAttr = imp.getAttribute("lazy");
            const preloadAttr = imp.getAttribute("preload");
            const isLazy =
                lazyAttr === "true" ||
                imp.getAttribute("mode") === "lazy" ||
                lazyAttr === "viewport" ||
                lazyAttr === "hover" ||
                lazyAttr === "idle" ||
                Boolean(preloadAttr) ||
                imp.getAttribute("viewport") === "true";
            const isViewport =
                imp.getAttribute("viewport") === "true" ||
                imp.getAttribute("observer") === "true" ||
                lazyAttr === "viewport" ||
                (isLazy && lazyAttr !== "hover" && lazyAttr !== "idle" && !preloadAttr);
            const rootMargin = imp.getAttribute("root_margin") || imp.getAttribute("rootMargin") || "300px";
            if (src && name) {
                if (isLazy) {
                    if (isFn(engine.constructor.registerLazyComponent)) {
                        engine.constructor.registerLazyComponent(name, src, {
                            fallback: imp.getAttribute("fallback"),
                            preload:
                                preloadAttr || (lazyAttr === "hover" ? "hover" : lazyAttr === "idle" ? "idle" : null),
                            viewport: isViewport,
                            observer: isViewport,
                            rootMargin: rootMargin,
                            minHeight: getAttr(imp, "min_height", "minHeight"),
                            aspectRatio: getAttr(imp, "aspect_ratio", "aspectRatio"),
                            placeholderClass:
                                getAttr(imp, "placeholder_class", "placeholderClass"),
                            retries: imp.getAttribute("retries"),
                            retryDelay: getAttr(imp, "retry_delay", "retryDelay"),
                        });
                    }
                } else {
                    engine._pendingAsyncLoads.push(engine.loadComponentFile(name, src));
                }
            }
        });
    }

    if (engine._pendingAsyncLoads.length > 0) {
        const pendingPromises = [...engine._pendingAsyncLoads];
        engine._pendingAsyncLoads = [];
        engine._mountPromise = Promise.all(pendingPromises).then(() => {
            engine.initConstants();
            engine.initDataModel();
            engine.render();
            engine._isMounted = true;
            engine.runMountActions();
        });
        return engine;
    }

    engine.render();
    engine._isMounted = true;
    engine.runMountActions();
    const mountEnd = getNow();
    engine._mountDuration = parseFloat((mountEnd - mountStart).toFixed(2));
    return engine;
}

export function runMountActions(engine) {
    const root = engine.getChild(engine.xmlDoc, "uid_spec") || engine.xmlDoc.querySelector("uid_spec");
    if (!root) return;
    const rootDom = engine.container ? engine.container.firstElementChild || engine.container : null;
    if (rootDom) {
        engine.processLifecycleHooks(root, rootDom, {});
    } else {
        engine.getChildren(root, "on_mount").forEach((node) => {
            engine.handleAction(node, {});
        });
    }
}

export function processLifecycleHooks(engine, xmlNode, domEl, context = {}) {
    if (!xmlNode || !isElem(domEl)) return;

    const rawChildren = xmlNode.children || xmlNode.childNodes;
    if (!rawChildren || rawChildren.length === 0) return;

    let onChangeNodes = null;
    let onMountNodes = null;
    let onIntervalNodes = null;
    let onVisibleNodes = null;
    let onUnmountNodes = null;

    const len = rawChildren.length;
    let hasHooks = false;

    for (let i = 0; i < len; i++) {
        const child = rawChildren[i];
        if (child.nodeType !== 1) continue;
        const tag = (child.tagName || "").toLowerCase();
        if (tag === "on_state_change" || tag === "on_change" || tag === "on_update" || tag === "watch") {
            if (!onChangeNodes) onChangeNodes = [];
            onChangeNodes.push(child);
            hasHooks = true;
        } else if (tag === "on_mount") {
            if (!onMountNodes) onMountNodes = [];
            onMountNodes.push(child);
            hasHooks = true;
        } else if (tag === "on_interval" || tag === "on_timer") {
            if (!onIntervalNodes) onIntervalNodes = [];
            onIntervalNodes.push(child);
            hasHooks = true;
        } else if (tag === "on_visible") {
            if (!onVisibleNodes) onVisibleNodes = [];
            onVisibleNodes.push(child);
            hasHooks = true;
        } else if (tag === "on_unmount" || tag === "on_destroy") {
            if (!onUnmountNodes) onUnmountNodes = [];
            onUnmountNodes.push(child);
            hasHooks = true;
        }
    }

    if (!hasHooks) return;

    const contextWithEl = { ...context, _targetEl: domEl };

    // 1. <on_state_change watch="..."> / <on_change watch="..."> / <watch path="...">
    if (onChangeNodes) {
        onChangeNodes.forEach((node) => {
            const rawWatch =
                getAttr(node, "watch", "path", "key", "bind");
            const watchPath = rawWatch ? engine.parseBindPath(rawWatch) : null;
            if (watchPath) {
                const unwatch = engine.watch(watchPath, (newValue, oldValue) => {
                    if (typeof document !== "undefined" && !document.body.contains(domEl)) {
                        unwatch();
                        return;
                    }
                    engine.handleAction(node, { ...contextWithEl, newValue, oldValue });
                });
            }
        });
    }

    // 2. <on_mount>
    if (onMountNodes) {
        onMountNodes.forEach((node) => {
            engine.handleAction(node, contextWithEl);
        });
    }

    // 3. <on_interval ms="5000"> / <on_timer ms="1000">
    if (onIntervalNodes) {
        onIntervalNodes.forEach((node) => {
            const ms = toInt(node.getAttribute("ms") || node.getAttribute("delay") || "5000", 0);
            if (ms > 0) {
                const intervalId = setInterval(() => {
                    if (typeof document !== "undefined" && !document.body.contains(domEl)) {
                        clearInterval(intervalId);
                        return;
                    }
                    const condAttr = getAttr(node, "if", "when", "condition");
                    if (condAttr) {
                        const evalCond = engine.evalCondition(condAttr, context);
                        if (!evalCond) return;
                    }
                    engine.handleAction(node, context);
                }, ms);
                if (engine._activeIntervals) engine._activeIntervals.push(intervalId);
                domEl.dataset.euixInterval = String(intervalId);
            }
        });
    }

    // 4. <on_visible> (IntersectionObserver)
    if (onVisibleNodes && typeof IntersectionObserver !== "undefined") {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    onVisibleNodes.forEach((node) => engine.handleAction(node, context));
                    if (onVisibleNodes.every((n) => n.getAttribute("once") !== "false")) {
                        observer.unobserve(domEl);
                    }
                }
            });
        });
        observer.observe(domEl);
    }

    // 5. <on_unmount> / <on_destroy> (Shared MutationObserver to prevent N observers on document.body)
    if (onUnmountNodes && typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
        registerUnmountCallback(engine, domEl, onUnmountNodes, context);
    }
}

export function registerUnmountCallback(engine, domEl, onUnmountNodes, context) {
    if (!engine._unmountTracked) {
        engine._unmountTracked = new Map();
    }
    engine._unmountTracked.set(domEl, { onUnmountNodes, context });

    if (!engine._sharedUnmountObserver && typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
        const rootTarget = document.body || engine.container;
        if (rootTarget) {
            engine._sharedUnmountObserver = new MutationObserver(() => {
                if (!engine._unmountTracked || engine._unmountTracked.size === 0) return;
                const toRemove = [];
                for (const [el, entry] of engine._unmountTracked.entries()) {
                    if (!document.body || !document.body.contains(el)) {
                        toRemove.push(el);
                        entry.onUnmountNodes.forEach((node) => engine.handleAction(node, entry.context));
                    }
                }
                toRemove.forEach((el) => engine._unmountTracked.delete(el));
                if (engine._unmountTracked.size === 0 && engine._sharedUnmountObserver) {
                    engine._sharedUnmountObserver.disconnect();
                    engine._sharedUnmountObserver = null;
                }
            });
            engine._sharedUnmountObserver.observe(rootTarget, { childList: true, subtree: true });
        }
    }
}

export function initConstants(engine) {
    if (!engine.constants) engine.constants = new Map();
    if (!engine.xmlDoc) return;

    if (engine.xmlDoc._cachedConstantsMap) {
        for (const [k, v] of engine.xmlDoc._cachedConstantsMap) {
            engine.constants.set(k, v);
        }
        return;
    }

    const containers = queryAll(engine.xmlDoc, "constants, vars, variables");
    containers.forEach((container) => {
        const src = getAttr(container, "src", "url");
        if (src && typeof fetch !== "undefined") {
            const interpolatedSrc = engine.interpolate(src);
            const p = engine.loadConstants(interpolatedSrc);
            if (engine._pendingAsyncLoads) engine._pendingAsyncLoads.push(p);
        }
    });

    const constsNodes = queryAll(engine.xmlDoc, "const, constant, var, variable");
    constsNodes.forEach((node) => {
        const id = getAttr(node, "id", "name", "key");
        const src = getAttr(node, "src", "url");
        if (src && typeof fetch !== "undefined") {
            const interpolatedSrc = engine.interpolate(src);
            const p = safeFetchWithTimeout(interpolatedSrc, undefined, DEFAULT_TIMEOUTS.RESOURCE_LOAD)
                .then((res) => res.json())
                .then((json) => {
                    if (isObj(json)) {
                        const val = json[id] !== undefined ? json[id] : json.value || json.text || JSON.stringify(json);
                        engine.registerConstant(id, String(val));
                    }
                })
                .catch((err) => engine.reportError(err, `Failed to load external constant '${id}' from '${src}'`));
            if (engine._pendingAsyncLoads) engine._pendingAsyncLoads.push(p);
        } else if (id) {
            engine.constants.set(id, node.textContent.trim());
        }
    });

    engine.xmlDoc._cachedConstantsMap = new Map(engine.constants);
}

export function initDataModel(engine) {
    const rawState = {};
    const pendingEndpoints = [];

    const collectStatesFromDoc = (doc, isMainDoc = false) => {
        if (!doc) return;
        const dataModelNode =
            engine.getChild(doc.querySelector("uid_spec") || doc, "data_model") || doc.querySelector("data_model");
        if (dataModelNode) {
            const src = getAttr(dataModelNode, "src", "url");
            if (src && isMainDoc && typeof fetch !== "undefined") {
                const interpolatedSrc = engine.interpolate(src);
                const p = engine.loadDataModel(interpolatedSrc);
                if (engine._pendingAsyncLoads) engine._pendingAsyncLoads.push(p);
            }
        }

        const isDocIsolated = !isMainDoc && (isScoped(doc) || isScoped(dataModelNode));

        if (!isDocIsolated && !isMainDoc && doc._cachedStateModel) {
            const cached = doc._cachedStateModel;
            for (const key in cached.rawState) {
                const val = cached.rawState[key];
                rawState[key] = Array.isArray(val) ? [...val] : (val && typeof val === "object") ? { ...val } : val;
            }
            if (cached.persistence) {
                if (!engine._persistenceConfig) engine._persistenceConfig = new Map();
                for (const [id, cfg] of cached.persistence) {
                    engine._persistenceConfig.set(id, cfg);
                }
            }
            if (cached.pendingEndpoints) {
                pendingEndpoints.push(...cached.pendingEndpoints);
            }
            if (engine.constructor?.hooks && isFn(engine.constructor.hooks.emit)) {
                engine.constructor.hooks.emit("lifecycle:datamodel", { engine, doc, isMainDoc, rawState, pendingEndpoints });
            }
            return;
        }

        const stateNodes = dataModelNode
            ? engine.getChildren(dataModelNode, "state")
            : queryAll(doc, "data_model > state");

        stateNodes.forEach((node) => {
            const id = node.getAttribute("id");
            if (!id) return;
            const scope = node.getAttribute("scope");
            const isStateIsolated = isDocIsolated || scope === "local" || scope === "isolated" || scope === "scoped";

            if (isStateIsolated && !isMainDoc && scope !== "global") {
                return;
            }

            const type = node.getAttribute("type");
            const src = getAttr(node, "src", "url");
            const persistAttr = getAttr(node, "persist", "storage");

            if (src && isMainDoc && typeof fetch !== "undefined") {
                const interpolatedSrc = engine.interpolate(src);
                const p = safeFetchWithTimeout(interpolatedSrc, undefined, DEFAULT_TIMEOUTS.RESOURCE_LOAD)
                    .then((res) => res.json())
                    .then((json) => {
                        engine.setState(id, json);
                    })
                    .catch((err) => engine.reportError(err, `Failed to load external state '${id}' from '${src}'`));
                if (engine._pendingAsyncLoads) engine._pendingAsyncLoads.push(p);
            } else {
                rawState[id] = parseStateValue(node, engine);
            }

            if (persistAttr) {
                if (!engine._persistenceConfig) engine._persistenceConfig = new Map();
                const customKey = getAttr(node, "storage_key", "key");
                engine._persistenceConfig.set(id, {
                    storage: String(persistAttr).toLowerCase(),
                    storageKey: customKey || `euix_state_${id}`,
                });
            }
        });

        const computedNodes = queryAll(doc, "computed");
        computedNodes.forEach((node) => {
            const id = getAttr(node, "id", "name");
            const deps = getAttr(node, "deps", "watch");
            const getter = node.textContent.trim() || node.getAttribute("value") || node.getAttribute("expr");
            if (id && isFn(engine.computed)) {
                engine.computed(id, getter, deps);
            }
        });

        const watchNodes = queryAll(doc, "watch");
        watchNodes.forEach((node) => {
            const path = getAttr(node, "path", "watch", "on");
            if (path && isFn(engine.watch)) {
                engine.watch(path, node);
            }
        });

        const animDefNodes = [
            ...Array.from(doc.getElementsByTagName("animation_def")),
            ...Array.from(doc.getElementsByTagName("keyframe_def")),
        ];
        animDefNodes.forEach((node) => {
            const name = getAttr(node, "name", "id");
            if (name && isFn(engine.registerAnimationDef)) {
                engine.registerAnimationDef(name, node);
            }
        });

        const persistenceNode = doc.querySelector("persistence");
        if (persistenceNode) {
            const defaultStorage = persistenceNode.getAttribute("storage") || "local";
            const prefix = persistenceNode.getAttribute("prefix") || "";
            const persistItems = queryAll(persistenceNode, "persist, item, key, persisted_key");
            persistItems.forEach((item) => {
                const key = item.getAttribute("key") || item.getAttribute("id") || item.textContent.trim();
                const itemStorage = item.getAttribute("storage") || defaultStorage;
                const customStorageKey = item.getAttribute("storage_key") || (prefix ? `${prefix}${key}` : null);
                if (key) {
                    if (!engine._persistenceConfig) engine._persistenceConfig = new Map();
                    engine._persistenceConfig.set(key, {
                        storage: String(itemStorage).toLowerCase(),
                        storageKey: customStorageKey || `euix_state_${key}`,
                    });
                }
            });
        }

        const apiConfigNode = doc.querySelector("api_config, api_client, api");
        if (apiConfigNode) {
            const baseUrl =
                getAttr(apiConfigNode, "base_url", "baseUrl", "url");
            const credentials = apiConfigNode.getAttribute("credentials");
            const timeout = apiConfigNode.getAttribute("timeout");

            if (isFn(engine.configureApi)) {
                engine.configureApi({
                    baseUrl: baseUrl ? baseUrl.trim() : undefined,
                    credentials: credentials ? credentials.trim() : undefined,
                    timeout: timeout ? toInt(timeout, DEFAULT_TIMEOUTS.API_REQUEST) : undefined,
                });
            } else {
                if (!engine._apiConfig) {
                    engine._apiConfig = {
                        baseUrl: "",
                        credentials: undefined,
                        headers: new Map(),
                        timeout: DEFAULT_TIMEOUTS.API_REQUEST,
                    };
                }
                if (baseUrl) engine._apiConfig.baseUrl = baseUrl.trim();
                if (credentials) engine._apiConfig.credentials = credentials.trim();
                if (timeout) engine._apiConfig.timeout = toInt(timeout, DEFAULT_TIMEOUTS.API_REQUEST);
            }

            const headerNodes = queryAll(apiConfigNode, "headers > header, header");
            headerNodes.forEach((h) => {
                const name = getAttr(h, "name", "key");
                const val = h.textContent.trim() || h.getAttribute("value") || "";
                if (name && isFn(engine.setApiHeader)) engine.setApiHeader(name, val);
            });
        }

        const apiEndpoints = queryAll(doc, "api_endpoint, endpoint");
        apiEndpoints.forEach((node) => {
            const autoFetchAttr = node.getAttribute("auto_fetch");
            const autoFetch = autoFetchAttr !== "false";
            pendingEndpoints.push({ node, autoFetch });
        });

        if (engine.constructor?.hooks && isFn(engine.constructor.hooks.emit)) {
            engine.constructor.hooks.emit("lifecycle:datamodel", { engine, doc, isMainDoc, rawState, pendingEndpoints });
        }

        const useScriptNodes = queryAll(doc, "use_script, script_loader, load_script");
        useScriptNodes.forEach((node) => {
            const src = getAttr(node, "src", "url");
            if (src) {
                engine.loadScript(src, {
                    async: node.getAttribute("async") !== "false",
                    timeout: node.getAttribute("timeout") || undefined,
                });
            }
        });

        const useStyleNodes = queryAll(doc, "use_style, style_loader, load_style");
        useStyleNodes.forEach((node) => {
            const href = getAttr(node, "src", "href", "url");
            if (href) engine.loadStyle(href);
        });

        if (!isDocIsolated && !isMainDoc && !doc._cachedStateModel) {
            doc._cachedStateModel = {
                rawState: { ...rawState },
                persistence: engine._persistenceConfig ? new Map(engine._persistenceConfig) : null,
                pendingEndpoints: [...pendingEndpoints],
            };
        }
    };

    if (engine.constructor._globalComponentSpecs) {
        engine.constructor._globalComponentSpecs.forEach((spec) => collectStatesFromDoc(spec, false));
    }
    if (engine._componentSpecs) {
        engine._componentSpecs.forEach((spec) => collectStatesFromDoc(spec, false));
    }

    if (engine.xmlDoc) {
        collectStatesFromDoc(engine.xmlDoc, true);
    }

    if (engine._persistenceConfig) {
        for (const [key, config] of engine._persistenceConfig.entries()) {
        const store =
            config.storage === "session"
                ? typeof sessionStorage !== "undefined"
                    ? sessionStorage
                    : null
                : typeof localStorage !== "undefined"
                  ? localStorage
                  : null;
        if (store) {
            const storedVal = store.getItem(config.storageKey);
            if (storedVal !== null) {
                rawState[key] = safeParse(storedVal, storedVal);
            } else if (rawState[key] !== undefined) {
                if (isFn(engine._savePersistedState)) engine._savePersistedState(key, rawState[key]);
            }
        }
        }
        if (isFn(engine._setupStorageListener)) {
            engine._setupStorageListener();
        }
    }

    if (engine._mountOptions?.state && typeof engine._mountOptions.state === "object") {
        for (const [k, v] of Object.entries(engine._mountOptions.state)) {
            rawState[k] = v;
        }
    }
    if (engine._mountOptions?.props && typeof engine._mountOptions.props === "object") {
        engine.props = { ...(engine.props || {}), ...engine._mountOptions.props };
    }
    if (engine.props) {
        rawState.$props = engine.props;
    }

    engine._rawState = rawState;
    const self = engine;
    const proxyCache = new WeakMap();

    function createDeepProxy(target, rootKey, currentPath) {
        if (!target || typeof target !== "object") {
            return target;
        }
        if (proxyCache.has(target)) {
            return proxyCache.get(target);
        }

        const isArray = Array.isArray(target);
        const proxy = new Proxy(target, {
            get(obj, prop, receiver) {
                if (isStr(prop)) {
                    if (!currentPath && self._computedRegistry?.has(prop)) {
                        return self.getComputed(prop);
                    }
                    if (isArray) {
                        const mutatingMethods = ["push", "pop", "shift", "unshift", "splice", "sort", "reverse"];
                        if (mutatingMethods.includes(prop)) {
                            return (...args) => {
                                const res = Array.prototype[prop].apply(obj, args);
                                if (isFn(self._savePersistedState)) {
                                    self._savePersistedState(rootKey, rawState[rootKey]);
                                }
                                self.setState(rootKey, rawState[rootKey], { mutated: true });
                                if (currentPath && currentPath !== rootKey) {
                                    self.syncBindings(currentPath, obj);
                                }
                                return res;
                            };
                        }
                    }
                }
                const val = Reflect.get(obj, prop, receiver);
                if (val && typeof val === "object" && isStr(prop) && prop !== "__proto__") {
                    const nextPath = currentPath ? `${currentPath}.${prop}` : prop;
                    const nextRoot = rootKey || prop;
                    return createDeepProxy(val, nextRoot, nextPath);
                }
                return val;
            },
            set(obj, prop, value) {
                if (Object.is(obj[prop], value)) {
                    return true;
                }
                const res = Reflect.set(obj, prop, value);
                if (isStr(prop) && prop !== "length" && !prop.startsWith("_")) {
                    const targetRoot = rootKey || prop;
                    const subPath = currentPath ? `${currentPath}.${prop}` : prop;
                    if (isFn(self._savePersistedState)) {
                        self._savePersistedState(targetRoot, rawState[targetRoot]);
                    }
                    self.syncBindings(targetRoot, rawState[targetRoot]);
                    if (subPath !== targetRoot) {
                        self.syncBindings(subPath, value);
                    }
                }
                return res;
            },
            deleteProperty(obj, prop) {
                const res = Reflect.deleteProperty(obj, prop);
                if (isStr(prop) && !prop.startsWith("_")) {
                    const targetRoot = rootKey || prop;
                    const subPath = currentPath ? `${currentPath}.${prop}` : prop;
                    if (isFn(self._savePersistedState)) {
                        self._savePersistedState(targetRoot, rawState[targetRoot]);
                    }
                    self.syncBindings(targetRoot, rawState[targetRoot]);
                    if (subPath !== targetRoot) {
                        self.syncBindings(subPath, undefined);
                    }
                }
                return res;
            },
        });

        proxyCache.set(target, proxy);
        return proxy;
    }

    engine.state = createDeepProxy(rawState, "", "");
    engine._proxyState = engine.state;

    if (engine._watchRegistry && engine._watchRegistry.size > 0) {
        engine._watchRegistry.forEach((wNode) => {
            if (isFn(wNode?.init)) {
                wNode.init();
            }
        });
    }

    if (isFn(engine.handleXHR) && pendingEndpoints.length > 0) {
        pendingEndpoints.forEach(({ node, autoFetch }) => {
            if (autoFetch) {
                engine.handleXHR(node);
            } else {
                engine.handleXHR(node, { _registerOnly: true });
            }
        });
    }

    return engine.state;
}

export function loadScript(engine, src, options = {}) {
    if (!hasDoc() || !src) return Promise.resolve();
    const cleanUrl = engine.interpolate(src, options.context || {});
    if (!cleanUrl) return Promise.resolve();

    const isJSDOM =
        hasWindow() &&
        window.navigator &&
        window.navigator.userAgent &&
        window.navigator.userAgent.includes("jsdom");

    const existing = document.querySelector(`script[src="${cleanUrl}"]`);
    if (existing) {
        if (existing.getAttribute("data-loaded") === "true") {
            return Promise.resolve();
        }
        return new Promise((resolve) => {
            const onDone = () => resolve();
            existing.addEventListener("load", onDone, { once: true });
            existing.addEventListener("error", onDone, { once: true });
            setTimeout(onDone, isJSDOM ? 10 : 500);
        });
    }

    return new Promise((resolve) => {
        const script = document.createElement("script");
        script.src = cleanUrl;
        script.async = options.async !== false;
        if (options.defer) script.defer = true;
        if (options.id) script.id = options.id;

        let settled = false;
        const done = () => {
            if (!settled) {
                settled = true;
                script.setAttribute("data-loaded", "true");
                resolve();
            }
        };

        script.onload = done;
        script.onerror = done;
        document.head.appendChild(script);

        const scriptTimeout = options.timeout
            ? toInt(options.timeout, DEFAULT_TIMEOUTS.SCRIPT_LOAD)
            : DEFAULT_TIMEOUTS.SCRIPT_LOAD;
        if (isJSDOM) {
            setTimeout(done, 10);
        } else {
            setTimeout(done, scriptTimeout);
        }
    });
}

export function loadStyle(engine, href, options = {}) {
    if (!hasDoc() || !href) return;
    const cleanUrl = engine.interpolate(href, options.context || {});
    if (!cleanUrl) return;

    if (document.querySelector(`link[href="${cleanUrl}"]`)) return;

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cleanUrl;
    if (options.id) link.id = options.id;
    document.head.appendChild(link);
}

export async function loadDataModel(engine, urlOrObj) {
    if (isStr(urlOrObj)) {
        try {
            if (typeof fetch === "undefined") return null;
            const res = await safeFetchWithTimeout(urlOrObj, undefined, DEFAULT_TIMEOUTS.RESOURCE_LOAD);
            const json = await res.json();
            if (isObj(json)) {
                engine.batch(() => {
                    Object.entries(json).forEach(([k, v]) => engine.setState(k, v));
                });
            }
            return json;
        } catch (err) {
            engine.reportError(err, `Failed to load data model from '${urlOrObj}'`);
            return null;
        }
    } else if (isObj(urlOrObj)) {
        engine.batch(() => {
            Object.entries(urlOrObj).forEach(([k, v]) => engine.setState(k, v));
        });
        return urlOrObj;
    }
}

export async function loadConstants(engine, urlOrObj) {
    if (isStr(urlOrObj)) {
        try {
            if (typeof fetch === "undefined") return null;
            const res = await safeFetchWithTimeout(urlOrObj, undefined, DEFAULT_TIMEOUTS.RESOURCE_LOAD);
            const json = await res.json();
            if (isObj(json)) {
                Object.entries(json).forEach(([k, v]) => engine.registerConstant(k, String(v)));
            }
            return json;
        } catch (err) {
            engine.reportError(err, `Failed to load constants from '${urlOrObj}'`);
            return null;
        }
    } else if (isObj(urlOrObj)) {
        Object.entries(urlOrObj).forEach(([k, v]) => engine.registerConstant(k, String(v)));
        return urlOrObj;
    }
}

export async function preloadAsyncResources(engine) {
    if (engine._mountPromise) {
        await engine._mountPromise;
    }
    if (engine._pendingAsyncLoads && engine._pendingAsyncLoads.length > 0) {
        await Promise.all(engine._pendingAsyncLoads);
        engine._pendingAsyncLoads = [];
    }
    return engine;
}

export function onUnmount(engine, callback) {
    if (isFn(callback)) {
        if (!engine._destroyHooks) engine._destroyHooks = [];
        engine._destroyHooks.push(callback);
    }
    return engine;
}

export function addGlobalListener(engine, target, eventType, handler, options) {
    if (!target || !isFn(target.addEventListener) || !eventType || !isFn(handler)) {
        return () => {};
    }
    if (engine._isMounted === false) {
        return () => {};
    }
    if (options !== undefined) {
        target.addEventListener(eventType, handler, options);
    } else {
        target.addEventListener(eventType, handler);
    }
    let removed = false;
    const cleanup = () => {
        if (removed) return;
        removed = true;
        try {
            if (options !== undefined) {
                target.removeEventListener(eventType, handler, options);
            } else {
                target.removeEventListener(eventType, handler);
            }
        } catch (_) {}
        if (engine._globalListeners) {
            engine._globalListeners.delete(cleanup);
        }
    };
    if (!engine._globalListeners) {
        engine._globalListeners = new Set();
    }
    engine._globalListeners.add(cleanup);
    return cleanup;
}

export function destroy(engine) {
    engine._isMounted = false;
    if (engine._pendingBatchChanges) {
        engine._pendingBatchChanges.clear();
    }
    engine._microtaskScheduled = false;
    engine._microtaskRecursionCount = 0;
    engine._isFlushing = false;
    if (engine._macrotaskResetTimer) {
        clearTimeout(engine._macrotaskResetTimer);
        engine._macrotaskResetTimer = null;
    }
    engine._macrotaskResetScheduled = false;
    if (engine._globalListeners && engine._globalListeners.size > 0) {
        engine._globalListeners.forEach((cleanup) => {
            try {
                cleanup();
            } catch (_) {}
        });
        engine._globalListeners.clear();
    }
    if (engine._devtools && isFn(engine._devtools.destroy)) {
        try {
            engine._devtools.destroy();
        } catch (_) {}
        engine._devtools = null;
    }
    if (isFn(engine._delegatedCleanup)) {
        try {
            engine._delegatedCleanup();
        } catch (_) {}
        engine._delegatedCleanup = null;
    }
    if (isFn(engine._storageCleanup)) {
        try {
            engine._storageCleanup();
        } catch (_) {}
        engine._storageCleanup = null;
    }
    if (isFn(engine._activePointerDragTeardown)) {
        try {
            engine._activePointerDragTeardown();
        } catch (_) {}
        engine._activePointerDragTeardown = null;
    }
    if (engine._destroyHooks && engine._destroyHooks.length > 0) {
        engine._destroyHooks.forEach((hook) => {
            try {
                hook();
            } catch (_) {}
        });
        engine._destroyHooks = [];
    }
    if (engine._activeIntervals && engine._activeIntervals.length > 0) {
        engine._activeIntervals.forEach((id) => clearInterval(id));
        engine._activeIntervals = [];
    }
    if (engine._sharedUnmountObserver) {
        engine._sharedUnmountObserver.disconnect();
        engine._sharedUnmountObserver = null;
    }
    if (engine._unmountTracked) {
        engine._unmountTracked.clear();
    }
    if (engine._bindings) {
        engine._bindings.clear();
    }
    if (engine._stateKeyBits) {
        engine._stateKeyBits.clear();
    }
    engine._nextStateBitIndex = 0;
    engine._dirtyBitmask = 0n;
    if (engine._stateWatchers) {
        engine._stateWatchers.clear();
    }
    if (engine._globalStateWatchers) {
        engine._globalStateWatchers = [];
    }
    if (engine._watchRegistry) {
        engine._watchRegistry.clear();
    }
    if (engine._computedRegistry) {
        engine._computedRegistry.clear();
    }
    if (engine._activeAnimations) {
        engine._activeAnimations.forEach((anim) => anim.cancel?.());
        engine._activeAnimations.clear();
    }
    if (engine._activeControllers) {
        engine._activeControllers.forEach((ctrl) => ctrl.cancel?.());
        engine._activeControllers.clear();
    }
    if (engine._externalResources) {
        engine._externalResources.forEach((res) => res.dispose?.());
        engine._externalResources.clear();
    }
    if (engine._injectedStyles) {
        engine._injectedStyles.forEach((styleEl) => {
            if (styleEl && styleEl.parentNode) {
                styleEl.parentNode.removeChild(styleEl);
            }
        });
        engine._injectedStyles.clear();
    }
    if (engine.refs) {
        engine.refs = {};
    }
    if (engine.container) {
        engine.container.innerHTML = "";
    }
    if (engine.constructor.instance === engine) {
        engine.constructor.instance = null;
    }
    return engine;
}

export function autoInit(EngineClass, options = {}) {
    return declarativeAutoInit(EngineClass, options);
}
