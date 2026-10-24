import { safeParse, toInt, DEFAULT_TIMEOUTS, safeFetchWithTimeout, isFn } from "../core/utils/constants.js";
const getApiStore = (type) => {
    const s = String(type || "").toLowerCase();
    if (s === "session" || s === "sessionstorage") return typeof sessionStorage !== "undefined" ? sessionStorage : null;
    if (s === "local" || s === "localstorage" || s === "true" || s === "indexeddb")
        return typeof localStorage !== "undefined" ? localStorage : null;
    return null;
};

export const EUIXApiPlugin = {
    name: "api",
    install(engineClass) {
        if (engineClass.hooks && isFn(engineClass.hooks.on)) {
            engineClass.hooks.on("engine:init", (engine) => {
                if (!engine._apiConfig && isFn(engine.configureApi)) {
                    engine.configureApi();
                }
                if (isFn(engine._initRevalidationListeners)) {
                    engine._initRevalidationListeners();
                }
            });
        }

        const proto = engineClass.prototype;

        proto.configureApi = function (options = {}) {
            if (!this._apiConfig) {
                this._apiConfig = {
                    baseUrl: "",
                    credentials: undefined,
                    headers: new Map(),
                    timeout: DEFAULT_TIMEOUTS.API_REQUEST,
                    onRequest: null,
                    onResponse: null,
                    revalidateFocus: false,
                    revalidateOnline: false,
                    persist: null,
                    queueOffline: false,
                };
            }
            if (options.baseUrl !== undefined) this._apiConfig.baseUrl = options.baseUrl;
            if (options.credentials !== undefined) this._apiConfig.credentials = options.credentials;
            if (options.revalidateFocus !== undefined)
                this._apiConfig.revalidateFocus = Boolean(options.revalidateFocus);
            if (options.revalidateOnline !== undefined)
                this._apiConfig.revalidateOnline = Boolean(options.revalidateOnline);
            if (options.persist !== undefined) this._apiConfig.persist = options.persist;
            if (options.queueOffline !== undefined) this._apiConfig.queueOffline = Boolean(options.queueOffline);
            if (options.timeout !== undefined) this._apiConfig.timeout = toInt(options.timeout, DEFAULT_TIMEOUTS.API_REQUEST);
            if (isFn(options.onRequest)) this._apiConfig.onRequest = options.onRequest;
            if (isFn(options.onResponse)) this._apiConfig.onResponse = options.onResponse;

            if (options.headers && typeof options.headers === "object") {
                Object.entries(options.headers).forEach(([k, v]) => {
                    this.setApiHeader(k, v);
                });
            }
            return this;
        };

        proto.setApiHeader = function (name, value) {
            if (!name) return this;
            if (!this._apiConfig) this.configureApi();
            this._apiConfig.headers.set(String(name).trim(), String(value !== undefined ? value : "").trim());
            return this;
        };

        proto.removeApiHeader = function (name) {
            if (!name) return this;
            if (!this._apiConfig) this.configureApi();
            this._apiConfig.headers.delete(String(name).trim());
            return this;
        };

        proto._readPersistentApiCache = (storageKey, storageType, ttlMs) => {
            const store = getApiStore(storageType);
            if (!store) return null;
            const entry = safeParse(store.getItem(storageKey));
            if (entry && entry.timestamp) {
                if (ttlMs > 0 && Date.now() - entry.timestamp > ttlMs) {
                    store.removeItem(storageKey);
                    return null;
                }
                return entry;
            }
            return null;
        };

        proto._writePersistentApiCache = (storageKey, storageType, data) => {
            const store = getApiStore(storageType);
            if (!store) return;
            try {
                store.setItem(storageKey, JSON.stringify({ data, timestamp: Date.now() }));
            } catch (_) {}
        };

        proto._removePersistentApiCache = (storageKey, storageType) => {
            const store = getApiStore(storageType);
            if (store) {
                try {
                    store.removeItem(storageKey);
                } catch (_) {}
            }
        };

        proto._enqueueOfflineMutation = (mutationOptions) => {
            const queueKey = "euix_api_offline_queue";
            const store = typeof localStorage !== "undefined" ? localStorage : null;
            if (!store) return;
            try {
                const queue = safeParse(store.getItem(queueKey), []);
                let plainHeaders = mutationOptions.headers;
                if (typeof Headers !== "undefined" && plainHeaders instanceof Headers) {
                    plainHeaders = Object.fromEntries(plainHeaders.entries());
                } else if (plainHeaders instanceof Map) {
                    plainHeaders = Object.fromEntries(plainHeaders.entries());
                }
                queue.push({
                    url: mutationOptions.url,
                    method: mutationOptions.method,
                    body: mutationOptions.body,
                    headers: plainHeaders,
                    timestamp: Date.now(),
                });
                store.setItem(queueKey, JSON.stringify(queue));
            } catch (_) {}
        };

        proto.flushOfflineQueue = async () => {
            const queueKey = "euix_api_offline_queue";
            const store = typeof localStorage !== "undefined" ? localStorage : null;
            if (!store) return [];
            try {
                const queue = safeParse(store.getItem(queueKey), []);
                if (!queue || queue.length === 0) return [];
                store.removeItem(queueKey);
                const results = [];
                for (const item of queue) {
                    try {
                        const res = await safeFetchWithTimeout(item.url, {
                            method: item.method,
                            headers: item.headers,
                            body: item.body,
                        }, DEFAULT_TIMEOUTS.API_REQUEST);
                        results.push({ url: item.url, success: res.ok });
                    } catch (err) {
                        results.push({ url: item.url, success: false, error: err.message });
                    }
                }
                return results;
            } catch (_) {
                return [];
            }
        };

        proto.clearApiCache = function (tagOrUrl) {
            if (this._xhrCache) {
                if (tagOrUrl) {
                    this._xhrCache.delete(tagOrUrl);
                } else {
                    this._xhrCache.clear();
                }
            }
            const stores = [];
            if (typeof localStorage !== "undefined") stores.push(localStorage);
            if (typeof sessionStorage !== "undefined") stores.push(sessionStorage);
            for (const store of stores) {
                try {
                    if (tagOrUrl) {
                        store.removeItem(`euix_api_${tagOrUrl}`);
                    } else {
                        for (let i = store.length - 1; i >= 0; i--) {
                            const k = store.key(i);
                            if (k && k.startsWith("euix_api_")) store.removeItem(k);
                        }
                    }
                } catch (_) {}
            }
            return this;
        };

        proto._initRevalidationListeners = function () {
            if (typeof window === "undefined" || this._revalidationBound) return;
            this._revalidationBound = true;

            const onRevalidateEvent = (evtType) => {
                if (this._isMounted === false) return;
                if (!this._registeredXhrs || this._registeredXhrs.size === 0) return;
                this._registeredXhrs.forEach((item) => {
                    const shouldFocus =
                        evtType === "focus" &&
                        (item.revalidateFocus || (this._apiConfig && this._apiConfig.revalidateFocus));
                    const shouldOnline =
                        evtType === "online" &&
                        (item.revalidateOnline || (this._apiConfig && this._apiConfig.revalidateOnline));

                    if ((item.method === "GET" || item.method === "HEAD") && (shouldFocus || shouldOnline)) {
                        if (this._xhrCache && item.url) {
                            this._xhrCache.delete(item.url);
                        }
                        this.handleXHR(item.actionNode, item.context);
                    }
                });
            };

            this._focusRevalidateHandler = () => onRevalidateEvent("focus");
            this._onlineRevalidateHandler = async () => {
                await this.flushOfflineQueue();
                onRevalidateEvent("online");
            };

            window.addEventListener("focus", this._focusRevalidateHandler);
            window.addEventListener("online", this._onlineRevalidateHandler);

            if (isFn(this.onUnmount)) {
                this.onUnmount(() => {
                    if (isFn(this.abortAllApiRequests)) {
                        this.abortAllApiRequests("unmounted");
                    }
                    if (typeof window !== "undefined") {
                        if (this._focusRevalidateHandler)
                            window.removeEventListener("focus", this._focusRevalidateHandler);
                        if (this._onlineRevalidateHandler)
                            window.removeEventListener("online", this._onlineRevalidateHandler);
                    }
                    this._revalidationBound = false;
                });
            }
        };

        proto.abortAllApiRequests = function (reason = "unmounted") {
            if (this._inFlightControllers && this._inFlightControllers.size > 0) {
                this._inFlightControllers.forEach((ctrl) => {
                    try {
                        ctrl.abort(reason);
                    } catch (_) {}
                });
                this._inFlightControllers.clear();
            }
            if (this._inFlightFetchPromises) {
                this._inFlightFetchPromises.clear();
            }
            if (this._apiSequenceCounters) {
                this._apiSequenceCounters.clear();
            }
            if (this._apiLatestResolvedSequence) {
                this._apiLatestResolvedSequence.clear();
            }
            return this;
        };

        proto.revalidateApi = async function (tagOrUrl = "") {
            const filter = String(tagOrUrl).trim();
            if (!this._registeredXhrs || this._registeredXhrs.size === 0) return this;

            try {
                const targets = [];
                this._registeredXhrs.forEach((item) => {
                    const isGetOrHead = item.method === "GET" || item.method === "HEAD";
                    if (!filter) {
                        if (isGetOrHead) targets.push(item);
                    } else {
                        const isExplicitUrlFilter = filter.includes("/");
                        const matchesTag = Boolean(item.tag && item.tag === filter);
                        const matchesUrl =
                            (isGetOrHead || isExplicitUrlFilter) && Boolean(item.url && item.url.includes(filter));
                        if (matchesTag || matchesUrl) {
                            targets.push(item);
                        }
                    }
                });

                const promises = targets.map((item) => {
                    if (this._xhrCache && item.url) {
                        this._xhrCache.delete(item.url);
                    }
                    return this.handleXHR(item.actionNode, item.context);
                });
                await Promise.all(promises);
            } catch (err) {
                this.reportError(err, "REVALIDATE_API");
            }

            return this;
        };

        proto.getApiStatus = function (endpointId) {
            if (!this._apiStatus) this._apiStatus = {};
            if (!this._apiStatus[endpointId]) {
                this._apiStatus[endpointId] = {
                    loading: false,
                    error: null,
                    status: null,
                    data: null,
                    timestamp: 0,
                };
            }
            return this._apiStatus[endpointId];
        };

        proto.getJsonPath = (obj, path) => {
            if (!path) return obj;
            return String(path)
                .split(".")
                .reduce((acc, key) => {
                    if (acc == null) return acc;
                    return acc[key];
                }, obj);
        };

        proto.mapResponseItems = function (items, itemMapNode) {
            if (!itemMapNode || !Array.isArray(items)) return items;

            const fieldNodes = this.getChildren
                ? this.getChildren(itemMapNode, "field")
                : Array.from(itemMapNode.querySelectorAll("field"));
            return items.map((raw) => {
                const mapped = {};
                const templates = [];

                fieldNodes.forEach((field) => {
                    const as = field.getAttribute("as");
                    if (!as) return;

                    const template = field.getAttribute("template");
                    if (template) {
                        templates.push({ as, template });
                        return;
                    }

                    const from = field.getAttribute("from") || as;
                    let value = raw[from];
                    const matchStr = field.getAttribute("match");
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
        };

        proto.handleXHR = function (actionNode, context = {}) {
            const compApiConfig = context._componentApiConfig || {};

            const methodNode = this.getChild(actionNode, "method");
            const method = (methodNode?.textContent || actionNode.getAttribute("method") || "GET").trim().toUpperCase();
            const urlNode = this.getChild(actionNode, "url");
            const rawUrlStr = urlNode ? urlNode.textContent.trim() : actionNode.getAttribute("url") || "";
            if (!rawUrlStr) return;

            const loadingNode = this.getChild(actionNode, "loading");
            const loadingPath = this.parseBindPath(
                loadingNode?.textContent || actionNode.getAttribute("loading") || "",
            );
            const errorNode = this.getChild(actionNode, "error");
            const errorPath = this.parseBindPath(errorNode?.textContent || actionNode.getAttribute("error") || "");

            const rawUrl = this.interpolate(rawUrlStr, context);

            // Security Guard: Block dangerous URL schemes (javascript:, vbscript:, data:)
            if (/^(javascript|vbscript|data):/i.test(rawUrl.trim())) {
                const err = new Error(`[EUIXEngine Security Guard] Blocked dangerous API URL scheme: ${rawUrl}`);
                this.reportError(err, "XHR Security Guard");
                if (loadingPath) this.setState(loadingPath, "false", { silent: true });
                if (errorPath) this.setState(errorPath, err.message);
                return;
            }

            let finalUrl = rawUrl;
            const explicitBaseUrl = actionNode.getAttribute("base_url");
            const effectiveBaseUrl =
                explicitBaseUrl !== null
                    ? explicitBaseUrl
                    : compApiConfig.baseUrl || (this._apiConfig && this._apiConfig.baseUrl) || "";

            // Ignore base_url if ignore_base_url="true", if base_url is explicitly "", or if rawUrl starts with "./" or "../"
            const ignoreBaseUrl =
                actionNode.getAttribute("ignore_base_url") === "true" ||
                explicitBaseUrl === "" ||
                rawUrl.startsWith("./") ||
                rawUrl.startsWith("../");

            if (effectiveBaseUrl && !ignoreBaseUrl && !/^https?:\/\//i.test(rawUrl)) {
                const base = effectiveBaseUrl.replace(/\/+$/, "");
                const relative = rawUrl.replace(/^\/+/, "");
                finalUrl = `${base}/${relative}`;
            }

            const targetNode = this.getChild(actionNode, "target") || this.getChild(actionNode, "bind_target");
            const targetStr = targetNode
                ? targetNode.textContent.trim()
                : actionNode.getAttribute("target") || actionNode.getAttribute("bind_target") || "";
            const target = targetStr ? this.parseBindPath(targetStr) : "";

            const selectNode = this.getChild(actionNode, "select");
            const select = selectNode?.textContent.trim() || actionNode.getAttribute("select") || "";
            const itemMapNode = this.getChild(actionNode, "item_map");
            const bodyNode = this.getChild(actionNode, "body");

            const targetOpNode = this.getChild(actionNode, "operation") || this.getChild(actionNode, "target_op");
            const targetNodeOp = targetNode ? targetNode.getAttribute("op") : null;
            const targetOp = targetOpNode
                ? targetOpNode.textContent.trim().toUpperCase()
                : (
                      targetNodeOp ||
                      actionNode.getAttribute("operation") ||
                      actionNode.getAttribute("target_op") ||
                      "SET"
                  ).toUpperCase();

            const idAttr = actionNode.getAttribute("id") || actionNode.getAttribute("name") || "";
            const tagAttr =
                actionNode.getAttribute("tag") ||
                this.getChild(actionNode, "tag")?.textContent.trim() ||
                idAttr ||
                compApiConfig.tag ||
                "";
            const revalidateFocus =
                actionNode.getAttribute("revalidate_focus") === "true" || compApiConfig.revalidateFocus === true;
            const revalidateOnline =
                actionNode.getAttribute("revalidate_online") === "true" || compApiConfig.revalidateOnline === true;
            const cacheTtlNode =
                this.getChild(actionNode, "cache_ttl") ||
                this.getChild(actionNode, "cache_ttl_ms") ||
                this.getChild(actionNode, "cache");
            const cacheTtlRaw = cacheTtlNode
                ? cacheTtlNode.textContent.trim()
                : actionNode.getAttribute("cache_ttl") ||
                  actionNode.getAttribute("cache_ttl_ms") ||
                  actionNode.getAttribute("cache") ||
                  compApiConfig.cacheTtl ||
                  0;
            const cacheTtlMs = toInt(cacheTtlRaw, 0);
            const epId = idAttr || tagAttr;
            const persistAttr =
                actionNode.getAttribute("persist") ||
                actionNode.getAttribute("persistent") ||
                this.getChild(actionNode, "persist")?.textContent.trim() ||
                this.getChild(actionNode, "persistent")?.textContent.trim() ||
                compApiConfig.persist ||
                (this._apiConfig && this._apiConfig.persist) ||
                null;
            const persistKey =
                actionNode.getAttribute("persist_key") ||
                this.getChild(actionNode, "persist_key")?.textContent.trim() ||
                `euix_api_${epId || finalUrl}`;
            const queueOffline =
                actionNode.getAttribute("queue_offline") === "true" ||
                this.getChild(actionNode, "queue_offline")?.textContent.trim() === "true" ||
                compApiConfig.queueOffline === true ||
                (this._apiConfig && this._apiConfig.queueOffline === true);

            if (!this._registeredXhrs) this._registeredXhrs = new Set();
            let existingEntry = null;
            for (const entry of this._registeredXhrs) {
                if (entry.actionNode === actionNode) {
                    existingEntry = entry;
                    break;
                }
            }
            if (!existingEntry) {
                existingEntry = {
                    actionNode,
                    context,
                    method,
                    url: finalUrl,
                    tag: tagAttr,
                    revalidateFocus,
                    revalidateOnline,
                };
                this._registeredXhrs.add(existingEntry);
            } else {
                existingEntry.url = finalUrl;
                existingEntry.context = context;
            }

            if (context && context._registerOnly) {
                delete context._registerOnly;
                return;
            }

            if (epId) {
                if (!this._apiStatus) this._apiStatus = {};
                this._apiStatus[epId] = {
                    loading: true,
                    error: null,
                    status: null,
                    data: this._apiStatus[epId]?.data || null,
                    timestamp: this._apiStatus[epId]?.timestamp || 0,
                    stale: false,
                    isOffline: false,
                };
                this.syncBindings(`api:${epId}:loading`, true);
                this.syncBindings(`api.${epId}.loading`, true);
                this.syncBindings(`api:${epId}`, this._apiStatus[epId]);
                this.syncBindings(`api.${epId}`, this._apiStatus[epId]);
            }

            // Stale-While-Revalidate & Persistent Caching Check
            let cached = null;
            if (this._xhrCache && this._xhrCache.has(finalUrl)) {
                cached = this._xhrCache.get(finalUrl);
            } else if (persistAttr) {
                cached = this._readPersistentApiCache(persistKey, persistAttr, cacheTtlMs);
                if (cached) {
                    if (!this._xhrCache) this._xhrCache = new Map();
                    this._xhrCache.set(finalUrl, cached);
                }
            }

            const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;

            if (cached && (method === "GET" || method === "HEAD")) {
                const now = Date.now();
                const isFresh = cacheTtlMs > 0 && now - cached.timestamp < cacheTtlMs;

                // Instantly render cached/stale data to UI
                this.batch(() => {
                    let data = cached.data;
                    if (select) data = this.getJsonPath(data, select);
                    if (Array.isArray(data)) {
                        data = this.mapResponseItems(data, itemMapNode);
                    }
                    if (target) this.setState(target, data, { operation: targetOp });
                    if (epId && this._apiStatus) {
                        this._apiStatus[epId] = {
                            loading: !isFresh && !isOffline,
                            error: null,
                            status: 200,
                            data: cached.data,
                            timestamp: cached.timestamp,
                            stale: !isFresh,
                            isOffline,
                        };
                        this.syncBindings(`api:${epId}`, this._apiStatus[epId]);
                        this.syncBindings(`api.${epId}`, this._apiStatus[epId]);
                    }
                });

                if (isFresh || isOffline) {
                    if (loadingPath) this.setState(loadingPath, "false", { silent: true });
                    return cached.data;
                }
            }

            if (loadingPath) this.setState(loadingPath, "true");
            if (errorPath) this.setState(errorPath, "", { silent: true });

            const headersObj = {};
            if (this._apiConfig && this._apiConfig.headers && this._apiConfig.headers.size > 0) {
                this._apiConfig.headers.forEach((val, name) => {
                    headersObj[name] = this.interpolate(val, context);
                });
            }
            if (compApiConfig.headers && compApiConfig.headers.size > 0) {
                compApiConfig.headers.forEach((val, name) => {
                    headersObj[name] = this.interpolate(val, context);
                });
            }

            this.getChildren(actionNode, "header").forEach((header) => {
                const name = header.getAttribute("name");
                if (name) headersObj[name] = this.interpolate(header.textContent.trim(), context);
            });

            const hasHeader = (hName) => Object.keys(headersObj).some((k) => k.toLowerCase() === hName.toLowerCase());

            // Security: Auto-inject Anti-CSRF Token if meta tag is present
            if (typeof document !== "undefined" && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
                const csrfMeta = document.querySelector('meta[name="csrf-token"], meta[name="xsrf-token"]');
                if (csrfMeta && csrfMeta.getAttribute("content") && !hasHeader("X-CSRF-Token")) {
                    headersObj["X-CSRF-Token"] = csrfMeta.getAttribute("content");
                }
            }

            const body = bodyNode ? this.interpolate(bodyNode.textContent.trim(), context) : null;
            const credentialsAttr =
                actionNode.getAttribute("credentials") ||
                compApiConfig.credentials ||
                (this._apiConfig && this._apiConfig.credentials);

            // Security: Auto-set Content-Type for JSON payload bodies
            if (["POST", "PUT", "PATCH"].includes(method) && body && typeof body === "string") {
                const trimmedBody = body.trim();
                if ((trimmedBody.startsWith("{") || trimmedBody.startsWith("[")) && !hasHeader("Content-Type")) {
                    headersObj["Content-Type"] = "application/json";
                }
            }

            const fetchOptions = {
                method,
                headers: headersObj,
            };
            if (credentialsAttr) {
                fetchOptions.credentials = credentialsAttr;
            }

            if (method !== "GET" && method !== "HEAD" && body !== null) {
                fetchOptions.body = body;
            }

            const raceKey =
                target ||
                epId ||
                (actionNode
                    ? actionNode.getAttribute("id") ||
                      actionNode.getAttribute("tag") ||
                      actionNode.getAttribute("url")
                    : "") ||
                finalUrl;

            if (!this._apiSequenceCounters) this._apiSequenceCounters = new Map();
            if (!this._apiLatestResolvedSequence) this._apiLatestResolvedSequence = new Map();

            const currentSeq = (this._apiSequenceCounters.get(raceKey) || 0) + 1;
            this._apiSequenceCounters.set(raceKey, currentSeq);

            if (!this._inFlightControllers) this._inFlightControllers = new Map();

            const isGetOrHead = method === "GET" || method === "HEAD";
            const dedupAttr = actionNode.getAttribute("deduplicate");
            const shouldDeduplicate = isGetOrHead && dedupAttr !== "false";
            const dedupKey = shouldDeduplicate ? `${method}:${finalUrl}` : null;

            const abortPreviousAttr = actionNode.getAttribute("abort_previous") || actionNode.getAttribute("abort_superseded");
            const shouldAbortPrevious =
                abortPreviousAttr === "true" ||
                (abortPreviousAttr !== "false" && isGetOrHead);

            if (shouldAbortPrevious && this._inFlightControllers.has(raceKey)) {
                const prevController = this._inFlightControllers.get(raceKey);
                try {
                    prevController.abort("superseded");
                } catch (_) {}
                this._inFlightControllers.delete(raceKey);
                if (dedupKey && this._inFlightFetchPromises) {
                    this._inFlightFetchPromises.delete(dedupKey);
                }
            }

            const cancellationSignal =
                context._cancellationSignal ||
                (this._currentActionContext && this._currentActionContext._cancellationSignal);
            if (cancellationSignal && cancellationSignal.isCancelled) {
                cancellationSignal.throwIfCancelled();
            }

            let timeoutId = null;
            let controller = null;
            const timeoutAttr = actionNode.getAttribute("timeout");
            const configTimeout = compApiConfig.timeout !== undefined ? compApiConfig.timeout : (this._apiConfig && this._apiConfig.timeout);
            const timeoutMs = timeoutAttr !== null 
                ? toInt(timeoutAttr, DEFAULT_TIMEOUTS.API_REQUEST)
                : configTimeout !== undefined
                  ? toInt(configTimeout, DEFAULT_TIMEOUTS.API_REQUEST)
                  : DEFAULT_TIMEOUTS.API_REQUEST;
            if (typeof AbortController !== "undefined") {
                controller = new AbortController();
                fetchOptions.signal = controller.signal;
                if (timeoutMs > 0) {
                    timeoutId = setTimeout(() => {
                        try {
                            controller.abort("timeout");
                        } catch (_) {}
                    }, timeoutMs);
                }
                if (cancellationSignal) {
                    cancellationSignal.onCancel((reason) => {
                        try {
                            controller.abort(reason);
                        } catch (_) {}
                    });
                }
                this._inFlightControllers.set(raceKey, controller);
            }

            if (this._apiConfig && isFn(this._apiConfig.onRequest)) {
                try {
                    this._apiConfig.onRequest({ url: finalUrl, options: fetchOptions });
                } catch (_) {}
            }
            let fetchPromise;
            if (shouldDeduplicate && this._inFlightFetchPromises && this._inFlightFetchPromises.has(dedupKey)) {
                fetchPromise = this._inFlightFetchPromises.get(dedupKey);
            } else {
                fetchPromise = fetch(finalUrl, fetchOptions).then(async (response) => {
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = null;
                    }
                    if (this._apiConfig && isFn(this._apiConfig.onResponse)) {
                        try {
                            this._apiConfig.onResponse(response);
                        } catch (_) {}
                    }
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}`);
                    }
                    const contentType =
                        (response.headers && isFn(response.headers.get)
                            ? response.headers.get("content-type")
                            : "") || "";
                    let data;
                    if (contentType.includes("application/json") || isFn(response.json)) {
                        try {
                            data = await response.json();
                        } catch (_) {
                            const textData = isFn(response.text) ? await response.text() : "";
                            data = safeParse(textData, textData);
                        }
                    } else {
                        const textData = isFn(response.text) ? await response.text() : "";
                        data = safeParse(textData, textData);
                    }
                    return data;
                });

                if (shouldDeduplicate) {
                    if (!this._inFlightFetchPromises) this._inFlightFetchPromises = new Map();
                    this._inFlightFetchPromises.set(dedupKey, fetchPromise);
                    const cleanUpDedup = () => {
                        if (this._inFlightFetchPromises && this._inFlightFetchPromises.get(dedupKey) === fetchPromise) {
                            this._inFlightFetchPromises.delete(dedupKey);
                        }
                    };
                    fetchPromise.then(cleanUpDedup, cleanUpDedup);
                }
            }

            return fetchPromise
                .then((data) => {
                    if (this._isMounted === false) {
                        return null;
                    }
                    if (cancellationSignal && cancellationSignal.isCancelled) {
                        return null;
                    }

                    // Monotonic sequence verification: Out-of-Order / Superseded Response Discard
                    const latestResolved = this._apiLatestResolvedSequence?.get(raceKey) || 0;
                    if (currentSeq < latestResolved) {
                        // Out-of-order response: a newer request already resolved and updated the UI!
                        return null;
                    }

                    const discardStale = actionNode.getAttribute("discard_stale") !== "false";
                    const highestSeq = this._apiSequenceCounters?.get(raceKey) || 0;
                    if (discardStale && currentSeq < highestSeq && shouldAbortPrevious) {
                        // Superseded response: a newer request was dispatched while this was in flight.
                        return null;
                    }

                    if (this._apiLatestResolvedSequence) {
                        this._apiLatestResolvedSequence.set(raceKey, currentSeq);
                    }

                    this.batch(() => {
                        if (loadingPath) this.setState(loadingPath, "false", { silent: true });
                        if (epId) {
                            if (!this._apiStatus) this._apiStatus = {};
                            this._apiStatus[epId] = {
                                loading: false,
                                error: null,
                                status: 200,
                                data,
                                timestamp: Date.now(),
                            };
                            this.syncBindings(`api:${epId}:loading`, false);
                            this.syncBindings(`api.${epId}.loading`, false);
                            this.syncBindings(`api:${epId}:status`, 200);
                            this.syncBindings(`api.${epId}.status`, 200);
                            this.syncBindings(`api:${epId}:data`, data);
                            this.syncBindings(`api.${epId}.data`, data);
                            this.syncBindings(`api:${epId}`, this._apiStatus[epId]);
                            this.syncBindings(`api.${epId}`, this._apiStatus[epId]);
                        }
                        if (select) data = this.getJsonPath(data, select);
                        if (Array.isArray(data)) {
                            data = this.mapResponseItems(data, itemMapNode);
                        } else if (typeof data === "number") {
                            // Preserve native number type and precision
                        } else if (
                            typeof data === "string" &&
                            target &&
                            typeof this._rawState?.[target] === "number" &&
                            !Number.isNaN(parseFloat(data)) &&
                            /^-?\d+(\.\d+)?$/.test(String(data).trim())
                        ) {
                            data = parseFloat(data);
                        }

                        if (target) {
                            const rawTarget = this.getState
                                ? this.getState(target)
                                : this._rawState
                                  ? this._rawState[target]
                                  : null;
                            if (targetOp === "UNSHIFT" || targetOp === "PREPEND") {
                                const currentList = Array.isArray(rawTarget) ? [...rawTarget] : [];
                                const newItem =
                                    typeof data === "object" && data !== null && (data.id || data.title)
                                        ? data
                                        : { id: Date.now(), ...data };
                                currentList.unshift(newItem);
                                this.setState(target, currentList);
                            } else if (targetOp === "PUSH" || targetOp === "APPEND") {
                                const currentList = Array.isArray(rawTarget) ? [...rawTarget] : [];
                                const newItem =
                                    typeof data === "object" && data !== null && (data.id || data.title)
                                        ? data
                                        : { id: Date.now(), ...data };
                                currentList.push(newItem);
                                this.setState(target, currentList);
                            } else if (targetOp === "REMOVE" || targetOp === "DELETE") {
                                const whereNode = this.getChild(actionNode, "where");
                                const rawEquals = whereNode
                                    ? whereNode.getAttribute("equals") || whereNode.textContent.trim()
                                    : "";
                                const removeId = rawEquals ? this.interpolate(rawEquals, context) : context.id;
                                const currentList = Array.isArray(rawTarget) ? [...rawTarget] : [];
                                const nextList = currentList.filter((item) => String(item.id) !== String(removeId));
                                this.setState(target, nextList);
                            } else if (targetOp === "UPDATE") {
                                const whereNode = this.getChild(actionNode, "where");
                                const rawEquals = whereNode
                                    ? whereNode.getAttribute("equals") || whereNode.textContent.trim()
                                    : "";
                                const updateId = rawEquals ? this.interpolate(rawEquals, context) : context.id;
                                const currentList = Array.isArray(rawTarget) ? [...rawTarget] : [];
                                const nextList = currentList.map((item) =>
                                    String(item.id) === String(updateId) ? { ...item, ...data } : item,
                                );
                                this.setState(target, nextList);
                            } else {
                                this.setState(target, data);
                            }
                        }

                        if (cacheTtlMs > 0 && (method === "GET" || method === "HEAD")) {
                            if (!this._xhrCache) this._xhrCache = new Map();
                            this._xhrCache.set(finalUrl, { data, timestamp: Date.now() });
                        }
                        if (persistAttr && (method === "GET" || method === "HEAD")) {
                            this._writePersistentApiCache(persistKey, persistAttr, data);
                        }

                        if (this.applyResets) this.applyResets(actionNode);
                        if (errorPath) this.setState(errorPath, "", { silent: true });

                        const revalidateNode =
                            this.getChild(actionNode, "revalidate") || this.getChild(actionNode, "revalidate_tag");
                        const rawRevalidateTag = revalidateNode
                            ? revalidateNode.textContent.trim()
                            : actionNode.getAttribute("revalidate") || actionNode.getAttribute("revalidate_tag") || "";

                        if (rawRevalidateTag) {
                            const revalidateTag = this.interpolate(rawRevalidateTag, context);
                            this.revalidateApi(revalidateTag);
                        }
                    });
                    return data;
                })
                .catch((err) => {
                    const isAborted =
                        err.name === "AbortError" ||
                        (controller && controller.signal && controller.signal.aborted) ||
                        (cancellationSignal && cancellationSignal.isCancelled) ||
                        String(err.message || "").toLowerCase().includes("aborted");

                    if (isAborted) {
                        if (this._isMounted !== false) {
                            const highestSeq = this._apiSequenceCounters?.get(raceKey) || 0;
                            if (currentSeq >= highestSeq) {
                                if (loadingPath) this.setState(loadingPath, "false", { silent: true });
                                if (epId && this._apiStatus && this._apiStatus[epId]) {
                                    this._apiStatus[epId].loading = false;
                                    this.syncBindings(`api:${epId}:loading`, false);
                                    this.syncBindings(`api.${epId}.loading`, false);
                                }
                            }
                        }
                        return null;
                    }

                    if (this._isMounted === false) {
                        return null;
                    }

                    const status =
                        err.status ||
                        (err.message && err.message.match(/HTTP (\d+)/) ? toInt(err.message.match(/HTTP (\d+)/)[1], null) : null);
                    const isOfflineNow = (typeof navigator !== "undefined" && navigator.onLine === false) || !status;
                    if (isOfflineNow && queueOffline && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
                        this._enqueueOfflineMutation({ url: finalUrl, method, body, headers: headersObj });
                    }

                    const StructuredErrorClass =
                        engineClass.EUIXStructuredError ||
                        (typeof window !== "undefined" && window.EUIXStructuredError);
                    const structuredErr = StructuredErrorClass
                        ? StructuredErrorClass.from(err, {
                              originatingAction: "XHR",
                              code: status ? "API_HTTP_ERROR" : "API_NETWORK_ERROR",
                              status,
                              request: { url: finalUrl, method },
                          })
                        : err;

                    this.batch(() => {
                        if (loadingPath) this.setState(loadingPath, "false", { silent: true });
                        if (errorPath)
                            this.setState(errorPath, structuredErr.message || "Network error", { silent: true });
                        if (epId) {
                            if (!this._apiStatus) this._apiStatus = {};
                            this._apiStatus[epId] = {
                                loading: false,
                                error: structuredErr.message || "Network error",
                                status: status || 0,
                                data: this._apiStatus[epId]?.data || null,
                                timestamp: Date.now(),
                                stale: Boolean(this._apiStatus[epId]?.data),
                                isOffline: isOfflineNow,
                            };
                            this.syncBindings(`api:${epId}:loading`, false);
                            this.syncBindings(`api.${epId}.loading`, false);
                            this.syncBindings(`api:${epId}:error`, structuredErr.message || "Network error");
                            this.syncBindings(`api.${epId}.error`, structuredErr.message || "Network error");
                            this.syncBindings(`api:${epId}:status`, status || 0);
                            this.syncBindings(`api.${epId}.status`, status || 0);
                            this.syncBindings(`api:${epId}`, this._apiStatus[epId]);
                            this.syncBindings(`api.${epId}`, this._apiStatus[epId]);
                        }
                    });
                    const inTryScope =
                        context._inTryScope || (this._currentActionContext && this._currentActionContext._inTryScope);
                    if (inTryScope) {
                        throw structuredErr;
                    }
                    return null;
                })
                .finally(() => {
                    if (timeoutId) {
                        clearTimeout(timeoutId);
                        timeoutId = null;
                    }
                    if (this._inFlightControllers && this._inFlightControllers.get(raceKey) === controller) {
                        this._inFlightControllers.delete(raceKey);
                    }
                });
        };

        // Register XHR Action Handler
        engineClass.registerAction("XHR", async function (actionNode, context) {
            return this.handleXHR(actionNode, context);
        });

        // Register REVALIDATE_API Action Handler
        engineClass.registerAction("REVALIDATE_API", async function (actionNode, context) {
            const tagNode =
                this.getChild(actionNode, "tag") ||
                this.getChild(actionNode, "url") ||
                this.getChild(actionNode, "revalidate");
            const rawTag = tagNode
                ? tagNode.textContent.trim()
                : actionNode.getAttribute("tag") ||
                  actionNode.getAttribute("url") ||
                  actionNode.getAttribute("revalidate") ||
                  "";
            const tag = this.interpolate(rawTag, context);
            return this.revalidateApi(tag);
        });
        engineClass.registerAction("REVALIDATE", async function (actionNode, context) {
            const tagNode =
                this.getChild(actionNode, "tag") ||
                this.getChild(actionNode, "url") ||
                this.getChild(actionNode, "revalidate");
            const rawTag = tagNode
                ? tagNode.textContent.trim()
                : actionNode.getAttribute("tag") ||
                  actionNode.getAttribute("url") ||
                  actionNode.getAttribute("revalidate") ||
                  "";
            const tag = this.interpolate(rawTag, context);
            return this.revalidateApi(tag);
        });
    },
};

export default EUIXApiPlugin;
