/**
 * src/core/lifecycle/Lifecycle.js
 * Mount lifecycle orchestration, external script/style loaders, data model parsing, and teardown hooks for EUIX Engine.
 */

import { getNow, isElem, isFn, isScoped } from "../utils/constants.js";

export function mount(engine, appXmlString, options = {}) {
    const mountStart = getNow();
    if (typeof appXmlString === "object" && appXmlString !== null) {
        if (appXmlString.nodeType) {
            engine.xmlDoc = appXmlString;
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
        const line = lineMatch ? parseInt(lineMatch[1], 10) : 1;
        const col = colMatch ? parseInt(colMatch[colMatch.length - 1], 10) : 1;
        const codeFrame = engine.constructor.generateCodeFrame(appXmlString, line, col);
        const errMsg = `[EUIX XML Parse Error] at line ${line}, column ${col}:\n${codeFrame || errorText}`;
        engine.reportError(errMsg, "XML Parse Error");
        if (engine.container) {
            engine.container.innerHTML = `
                <div class="euix-mount-error" style="padding:16px;background:#fef2f2;border:1px solid #fca5a5;border-radius:12px;color:#991b1b;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;">
                    <h3 style="margin:0 0 8px 0;font-size:14px;font-weight:bold;">⚠️ EUIXEngine XML Parse Error (Line ${line}, Col ${col})</h3>
                    <pre style="margin:0;font-size:12px;white-space:pre-wrap;line-height:1.4;">${engine.escapeHtml(codeFrame || errorText)}</pre>
                </div>
            `;
        }
        return engine;
    }

    const defNodes = Array.from(engine.xmlDoc.querySelectorAll("component_def"));
    defNodes.forEach((def) => {
        const name = def.getAttribute("name") || def.getAttribute("id");
        if (name) {
            engine.registerComponentSpec(name, def);
        }
    });

    engine._pendingAsyncLoads = [];
    engine.initConstants();
    engine.initDataModel();
    if (isFn(engine.initActionRegistry)) engine.initActionRegistry();

    const importNodes = Array.from(engine.xmlDoc.querySelectorAll("import"));
    if (importNodes.length > 0 && typeof fetch !== "undefined") {
        importNodes.forEach((imp) => {
            const src = imp.getAttribute("src");
            const name = imp.getAttribute("name") || imp.getAttribute("as");
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
                    if (typeof engine.constructor.registerLazyComponent === "function") {
                        engine.constructor.registerLazyComponent(name, src, {
                            fallback: imp.getAttribute("fallback"),
                            preload:
                                preloadAttr || (lazyAttr === "hover" ? "hover" : lazyAttr === "idle" ? "idle" : null),
                            viewport: isViewport,
                            observer: isViewport,
                            rootMargin: rootMargin,
                            minHeight: imp.getAttribute("min_height") || imp.getAttribute("minHeight"),
                            aspectRatio: imp.getAttribute("aspect_ratio") || imp.getAttribute("aspectRatio"),
                            placeholderClass:
                                imp.getAttribute("placeholder_class") || imp.getAttribute("placeholderClass"),
                            retries: imp.getAttribute("retries"),
                            retryDelay: imp.getAttribute("retry_delay") || imp.getAttribute("retryDelay"),
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
    const contextWithEl = { ...context, _targetEl: domEl };

    // 1. <on_state_change watch="..."> / <on_change watch="..."> / <watch path="...">
    const onChangeNodes = [
        ...engine.getChildren(xmlNode, "on_state_change"),
        ...engine.getChildren(xmlNode, "on_change"),
        ...engine.getChildren(xmlNode, "on_update"),
        ...engine.getChildren(xmlNode, "watch"),
    ];
    onChangeNodes.forEach((node) => {
        const rawWatch =
            node.getAttribute("watch") ||
            node.getAttribute("path") ||
            node.getAttribute("key") ||
            node.getAttribute("bind");
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

    // 2. <on_mount>
    const onMountNodes = engine.getChildren(xmlNode, "on_mount");
    onMountNodes.forEach((node) => {
        engine.handleAction(node, contextWithEl);
    });

    // 3. <on_interval ms="5000"> / <on_timer ms="1000">
    const onIntervalNodes = [...engine.getChildren(xmlNode, "on_interval"), ...engine.getChildren(xmlNode, "on_timer")];
    onIntervalNodes.forEach((node) => {
        const ms = parseInt(node.getAttribute("ms") || node.getAttribute("delay") || "5000", 10);
        if (ms > 0) {
            const intervalId = setInterval(() => {
                if (typeof document !== "undefined" && !document.body.contains(domEl)) {
                    clearInterval(intervalId);
                    return;
                }
                const condAttr = node.getAttribute("if") || node.getAttribute("when") || node.getAttribute("condition");
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

    // 4. <on_visible> (IntersectionObserver)
    const onVisibleNodes = engine.getChildren(xmlNode, "on_visible");
    if (onVisibleNodes.length && typeof IntersectionObserver !== "undefined") {
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
    const onUnmountNodes = [...engine.getChildren(xmlNode, "on_unmount"), ...engine.getChildren(xmlNode, "on_destroy")];
    if (onUnmountNodes.length && typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
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

    const containers = Array.from(engine.xmlDoc.querySelectorAll("constants, vars, variables"));
    containers.forEach((container) => {
        const src = container.getAttribute("src") || container.getAttribute("url");
        if (src && typeof fetch !== "undefined") {
            const interpolatedSrc = engine.interpolate(src);
            const p = engine.loadConstants(interpolatedSrc);
            if (engine._pendingAsyncLoads) engine._pendingAsyncLoads.push(p);
        }
    });

    const constsNodes = Array.from(engine.xmlDoc.querySelectorAll("const, constant, var, variable"));
    constsNodes.forEach((node) => {
        const id = node.getAttribute("id") || node.getAttribute("name") || node.getAttribute("key");
        const src = node.getAttribute("src") || node.getAttribute("url");
        if (src && typeof fetch !== "undefined") {
            const interpolatedSrc = engine.interpolate(src);
            const p = fetch(interpolatedSrc)
                .then((res) => res.json())
                .then((json) => {
                    if (typeof json === "object" && json !== null) {
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
}

export function initDataModel(engine) {
    const rawState = {};
    const pendingEndpoints = [];

    const collectStatesFromDoc = (doc, isMainDoc = false) => {
        if (!doc) return;
        const dataModelNode =
            engine.getChild(doc.querySelector("uid_spec") || doc, "data_model") || doc.querySelector("data_model");
        if (dataModelNode) {
            const src = dataModelNode.getAttribute("src") || dataModelNode.getAttribute("url");
            if (src && isMainDoc && typeof fetch !== "undefined") {
                const interpolatedSrc = engine.interpolate(src);
                const p = engine.loadDataModel(interpolatedSrc);
                if (engine._pendingAsyncLoads) engine._pendingAsyncLoads.push(p);
            }
        }

        const isDocIsolated = !isMainDoc && (isScoped(doc) || isScoped(dataModelNode));

        const stateNodes = dataModelNode
            ? engine.getChildren(dataModelNode, "state")
            : doc.querySelectorAll
              ? Array.from(doc.querySelectorAll("data_model > state"))
              : [];

        stateNodes.forEach((node) => {
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
                const interpolatedSrc = engine.interpolate(src);
                const p = fetch(interpolatedSrc)
                    .then((res) => res.json())
                    .then((json) => {
                        engine.setState(id, json);
                    })
                    .catch((err) => engine.reportError(err, `Failed to load external state '${id}' from '${src}'`));
                if (engine._pendingAsyncLoads) engine._pendingAsyncLoads.push(p);
            } else if (type === "array") {
                const childItems = engine.getChildren(node, "item");
                const ciLen = childItems ? childItems.length : 0;
                if (ciLen > 0) {
                    const items = new Array(ciLen);
                    for (let ci = 0; ci < ciLen; ci++) {
                        const item = childItems[ci];
                        const obj = {};
                        const iAttrs = item.attributes;
                        if (iAttrs) {
                            const iaLen = iAttrs.length;
                            for (let ia = 0; ia < iaLen; ia++) {
                                const attr = iAttrs[ia];
                                obj[attr.name] = attr.value;
                            }
                        }
                        items[ci] = obj;
                    }
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
                engine._persistenceConfig.set(id, {
                    storage: String(persistAttr).toLowerCase(),
                    storageKey: customKey || `euix_state_${id}`,
                });
            }
        });

        const computedNodes = doc.querySelectorAll
            ? Array.from(doc.querySelectorAll("computed"))
            : Array.from(doc.getElementsByTagName("computed"));
        computedNodes.forEach((node) => {
            const id = node.getAttribute("id") || node.getAttribute("name");
            const deps = node.getAttribute("deps") || node.getAttribute("watch");
            const getter = node.textContent.trim() || node.getAttribute("value") || node.getAttribute("expr");
            if (id && isFn(engine.computed)) {
                engine.computed(id, getter, deps);
            }
        });

        const watchNodes = doc.querySelectorAll
            ? Array.from(doc.querySelectorAll("watch"))
            : Array.from(doc.getElementsByTagName("watch"));
        watchNodes.forEach((node) => {
            const path = node.getAttribute("path") || node.getAttribute("watch") || node.getAttribute("on");
            if (path && isFn(engine.watch)) {
                engine.watch(path, node);
            }
        });

        const animDefNodes = [
            ...Array.from(doc.getElementsByTagName("animation_def")),
            ...Array.from(doc.getElementsByTagName("keyframe_def")),
        ];
        animDefNodes.forEach((node) => {
            const name = node.getAttribute("name") || node.getAttribute("id");
            if (name && isFn(engine.registerAnimationDef)) {
                engine.registerAnimationDef(name, node);
            }
        });

        const persistenceNode = doc.querySelector("persistence");
        if (persistenceNode) {
            const defaultStorage = persistenceNode.getAttribute("storage") || "local";
            const prefix = persistenceNode.getAttribute("prefix") || "";
            const persistItems = Array.from(persistenceNode.querySelectorAll("persist, item, key, persisted_key"));
            persistItems.forEach((item) => {
                const key = item.getAttribute("key") || item.getAttribute("id") || item.textContent.trim();
                const itemStorage = item.getAttribute("storage") || defaultStorage;
                const customStorageKey = item.getAttribute("storage_key") || (prefix ? `${prefix}${key}` : null);
                if (key) {
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
                apiConfigNode.getAttribute("base_url") ||
                apiConfigNode.getAttribute("baseUrl") ||
                apiConfigNode.getAttribute("url");
            if (baseUrl) engine._apiConfig.baseUrl = baseUrl.trim();

            const credentials = apiConfigNode.getAttribute("credentials");
            if (credentials) engine._apiConfig.credentials = credentials.trim();

            const timeout = apiConfigNode.getAttribute("timeout");
            if (timeout) engine._apiConfig.timeout = parseInt(timeout, 10) || 0;

            const headerNodes = Array.from(apiConfigNode.querySelectorAll("headers > header, header"));
            headerNodes.forEach((h) => {
                const name = h.getAttribute("name") || h.getAttribute("key");
                const val = h.textContent.trim() || h.getAttribute("value") || "";
                if (name) engine.setApiHeader(name, val);
            });
        }

        const apiEndpoints = doc.querySelectorAll
            ? Array.from(doc.querySelectorAll("api_endpoint, endpoint"))
            : Array.from(doc.getElementsByTagName("api_endpoint")).concat(
                  Array.from(doc.getElementsByTagName("endpoint")),
              );
        apiEndpoints.forEach((node) => {
            const autoFetchAttr = node.getAttribute("auto_fetch");
            const autoFetch = autoFetchAttr !== "false";
            pendingEndpoints.push({ node, autoFetch });
        });

        const useScriptNodes = Array.from(
            doc.querySelectorAll
                ? doc.querySelectorAll("use_script, script_loader, load_script")
                : doc.getElementsByTagName
                  ? doc.getElementsByTagName("use_script")
                  : [],
        );
        useScriptNodes.forEach((node) => {
            const src = node.getAttribute("src") || node.getAttribute("url");
            if (src) {
                engine.loadScript(src, { async: node.getAttribute("async") !== "false" });
            }
        });

        const useStyleNodes = Array.from(
            doc.querySelectorAll
                ? doc.querySelectorAll("use_style, style_loader, load_style")
                : doc.getElementsByTagName
                  ? doc.getElementsByTagName("use_style")
                  : [],
        );
        useStyleNodes.forEach((node) => {
            const href = node.getAttribute("src") || node.getAttribute("href") || node.getAttribute("url");
            if (href) engine.loadStyle(href);
        });
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
                try {
                    rawState[key] = JSON.parse(storedVal);
                } catch (_) {
                    rawState[key] = storedVal;
                }
            } else if (rawState[key] !== undefined) {
                if (isFn(engine._savePersistedState)) engine._savePersistedState(key, rawState[key]);
            }
        }
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
                if (typeof prop === "string") {
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
                                self.setState(rootKey, rawState[rootKey]);
                                if (currentPath && currentPath !== rootKey) {
                                    self.syncBindings(currentPath, obj);
                                }
                                return res;
                            };
                        }
                    }
                }
                const val = Reflect.get(obj, prop, receiver);
                if (val && typeof val === "object" && typeof prop === "string" && prop !== "__proto__") {
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
                if (typeof prop === "string" && prop !== "length" && !prop.startsWith("_")) {
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
                if (typeof prop === "string" && !prop.startsWith("_")) {
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
    if (typeof document === "undefined" || !src) return Promise.resolve();
    const cleanUrl = engine.interpolate(src, options.context || {});
    if (!cleanUrl) return Promise.resolve();

    const isJSDOM =
        typeof window !== "undefined" &&
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

        if (isJSDOM) {
            setTimeout(done, 10);
        } else {
            setTimeout(done, 5000);
        }
    });
}

export function loadStyle(engine, href, options = {}) {
    if (typeof document === "undefined" || !href) return;
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
    if (typeof urlOrObj === "string") {
        try {
            if (typeof fetch === "undefined") return null;
            const res = await fetch(urlOrObj);
            const json = await res.json();
            if (typeof json === "object" && json !== null) {
                engine.batch(() => {
                    Object.entries(json).forEach(([k, v]) => engine.setState(k, v));
                });
            }
            return json;
        } catch (err) {
            engine.reportError(err, `Failed to load data model from '${urlOrObj}'`);
            return null;
        }
    } else if (typeof urlOrObj === "object" && urlOrObj !== null) {
        engine.batch(() => {
            Object.entries(urlOrObj).forEach(([k, v]) => engine.setState(k, v));
        });
        return urlOrObj;
    }
}

export async function loadConstants(engine, urlOrObj) {
    if (typeof urlOrObj === "string") {
        try {
            if (typeof fetch === "undefined") return null;
            const res = await fetch(urlOrObj);
            const json = await res.json();
            if (typeof json === "object" && json !== null) {
                Object.entries(json).forEach(([k, v]) => engine.registerConstant(k, String(v)));
            }
            return json;
        } catch (err) {
            engine.reportError(err, `Failed to load constants from '${urlOrObj}'`);
            return null;
        }
    } else if (typeof urlOrObj === "object" && urlOrObj !== null) {
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

export function destroy(engine) {
    engine._isMounted = false;
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

export function autoInit(EngineClass) {
    if (typeof document === "undefined") return;
    const scripts = document.querySelectorAll(
        'script[type="application/euix"], script[type="text/euix"], script[data-euix-app], euix-app',
    );
    scripts.forEach((script) => {
        if (script.closest?.("code, pre, [data-euix-example], .no-auto-init")) return;
        if (script.dataset?.euixAutoInitialized) return;
        if (script.dataset) script.dataset.euixAutoInitialized = "true";
        const targetSelector = script.getAttribute("target") || script.dataset?.target || "#app";
        const xml = script.tagName.toLowerCase() === "euix-app" ? script.innerHTML.trim() : script.textContent.trim();
        if (xml) {
            const engine = EngineClass.mount(xml, targetSelector);
            if (engine) {
                engine.enableDevTools(false);
            }
        }
    });
}
