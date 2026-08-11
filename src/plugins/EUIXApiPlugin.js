/**
 * EUIXApiPlugin.js
 * SWR REST API Engine & HTTP Data Fetching Plugin for EUIX Engine.
 * Provides REST XHR fetching, SWR caching, Anti-CSRF token injection, and revalidation.
 */

export const EUIXApiPlugin = {
    name: "api",
    install(engineClass) {
        const proto = engineClass.prototype;

        proto.handleXHR = function(actionNode, context = {}) {
            const compApiConfig = context._componentApiConfig || {};

            const methodNode = this.getChild(actionNode, "method");
            const method = (methodNode?.textContent || actionNode.getAttribute("method") || "GET").trim().toUpperCase();
            const urlNode = this.getChild(actionNode, "url");
            const rawUrlStr = urlNode ? urlNode.textContent.trim() : (actionNode.getAttribute("url") || "");
            if (!rawUrlStr) return;

            const loadingNode = this.getChild(actionNode, "loading");
            const loadingPath = this.parseBindPath(loadingNode?.textContent || actionNode.getAttribute("loading") || "");
            const errorNode = this.getChild(actionNode, "error");
            const errorPath = this.parseBindPath(errorNode?.textContent || actionNode.getAttribute("error") || "");

            let rawUrl = this.interpolate(rawUrlStr, context);

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
            const effectiveBaseUrl = (explicitBaseUrl !== null) ? explicitBaseUrl : (compApiConfig.baseUrl || this._apiConfig.baseUrl || "");

            // Ignore base_url if ignore_base_url="true", if base_url is explicitly "", or if rawUrl starts with "./" or "../"
            const ignoreBaseUrl = actionNode.getAttribute("ignore_base_url") === "true" 
                || explicitBaseUrl === "" 
                || rawUrl.startsWith("./") 
                || rawUrl.startsWith("../");

            if (effectiveBaseUrl && !ignoreBaseUrl && !/^https?:\/\//i.test(rawUrl)) {
                const base = effectiveBaseUrl.replace(/\/+$/, "");
                const relative = rawUrl.replace(/^\/+/, "");
                finalUrl = `${base}/${relative}`;
            }

            const targetNode = this.getChild(actionNode, "target") || this.getChild(actionNode, "bind_target");
            const targetStr = targetNode ? targetNode.textContent.trim() : (actionNode.getAttribute("target") || actionNode.getAttribute("bind_target") || "");
            const target = targetStr ? this.parseBindPath(targetStr) : "";

            const selectNode = this.getChild(actionNode, "select");
            const select = selectNode?.textContent.trim() || actionNode.getAttribute("select") || "";
            const itemMapNode = this.getChild(actionNode, "item_map");
            const bodyNode = this.getChild(actionNode, "body");

            const targetOpNode = this.getChild(actionNode, "operation") || this.getChild(actionNode, "target_op");
            const targetOp = targetOpNode ? targetOpNode.textContent.trim().toUpperCase() : (actionNode.getAttribute("operation") || actionNode.getAttribute("target_op") || "SET").toUpperCase();

            const idAttr = actionNode.getAttribute("id") || actionNode.getAttribute("name") || "";
            const tagAttr = actionNode.getAttribute("tag") || this.getChild(actionNode, "tag")?.textContent.trim() || idAttr || compApiConfig.tag || "";
            const revalidateFocus = actionNode.getAttribute("revalidate_focus") === "true" || compApiConfig.revalidateFocus === true;
            const revalidateOnline = actionNode.getAttribute("revalidate_online") === "true" || compApiConfig.revalidateOnline === true;
            const cacheTtlMs = parseInt(actionNode.getAttribute("cache_ttl") || actionNode.getAttribute("cache") || compApiConfig.cacheTtl || 0, 10);

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
                    revalidateOnline
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

            // Stale-While-Revalidate Caching Check
            if (cacheTtlMs > 0 && (method === "GET" || method === "HEAD")) {
                if (!this._xhrCache) this._xhrCache = new Map();
                const cached = this._xhrCache.get(finalUrl);
                const now = Date.now();
                if (cached && (now - cached.timestamp < cacheTtlMs)) {
                    this.batch(() => {
                        if (loadingPath) this.setState(loadingPath, "false", { silent: true });
                        let data = cached.data;
                        if (select) data = this.getJsonPath(data, select);
                        if (Array.isArray(data)) {
                            data = this.mapResponseItems(data, itemMapNode);
                        }
                        if (target) this.setState(target, data, { operation: targetOp });
                    });
                    return;
                }
            }

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

            const cancellationSignal = context._cancellationSignal || (this._currentActionContext && this._currentActionContext._cancellationSignal);
            if (cancellationSignal && cancellationSignal.isCancelled) {
                cancellationSignal.throwIfCancelled();
            }

            let timeoutId = null;
            const timeoutMs = parseInt(actionNode.getAttribute("timeout") || compApiConfig.timeout || this._apiConfig.timeout || 0, 10);
            if (typeof AbortController !== "undefined") {
                const controller = new AbortController();
                fetchOptions.signal = controller.signal;
                if (timeoutMs > 0) {
                    timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                }
                if (cancellationSignal) {
                    cancellationSignal.onCancel((reason) => {
                        try { controller.abort(reason); } catch (_) {}
                    });
                }
            }

            if (typeof this._apiConfig.onRequest === "function") {
                try {
                    this._apiConfig.onRequest({ url: finalUrl, options: fetchOptions });
                } catch (_) {}
            }

            return fetch(finalUrl, fetchOptions)
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
                    if (cancellationSignal && cancellationSignal.isCancelled) {
                        return null;
                    }
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

                        if (cacheTtlMs > 0 && (method === "GET" || method === "HEAD")) {
                            if (!this._xhrCache) this._xhrCache = new Map();
                            this._xhrCache.set(finalUrl, { data, timestamp: Date.now() });
                        }

                        this.applyResets(actionNode);
                        if (errorPath) this.setState(errorPath, "", { silent: true });

                        const revalidateNode = this.getChild(actionNode, "revalidate") || this.getChild(actionNode, "revalidate_tag");
                        const rawRevalidateTag = revalidateNode ? revalidateNode.textContent.trim() : (actionNode.getAttribute("revalidate") || actionNode.getAttribute("revalidate_tag") || "");

                        if (rawRevalidateTag) {
                            const revalidateTag = this.interpolate(rawRevalidateTag, context);
                            this.revalidateApi(revalidateTag);
                        }
                    });
                    return data;
                })
                .catch((err) => {
                    const status = err.status || (err.message && err.message.match(/HTTP (\d+)/) ? parseInt(err.message.match(/HTTP (\d+)/)[1], 10) : null);
                    const StructuredErrorClass = engineClass.EUIXStructuredError || (typeof window !== "undefined" && window.EUIXStructuredError);
                    const structuredErr = StructuredErrorClass
                        ? StructuredErrorClass.from(err, {
                            originatingAction: "XHR",
                            code: status ? "API_HTTP_ERROR" : "API_NETWORK_ERROR",
                            status,
                            request: { url: finalUrl, method }
                        })
                        : err;

                    this.batch(() => {
                        if (loadingPath) this.setState(loadingPath, "false", { silent: true });
                        if (errorPath) this.setState(errorPath, structuredErr.message || "Ağ hatası", { silent: true });
                    });
                    const inTryScope = context._inTryScope || (this._currentActionContext && this._currentActionContext._inTryScope);
                    if (inTryScope) {
                        throw structuredErr;
                    }
                    return null;
                });
        };

        // Register XHR Action Handler
        engineClass.registerAction("XHR", async function(actionNode, context) {
            return this.handleXHR(actionNode, context);
        });

        // Register REVALIDATE_API Action Handler
        engineClass.registerAction("REVALIDATE_API", async function(actionNode, context) {
            const tagNode = this.getChild(actionNode, "tag") || this.getChild(actionNode, "url") || this.getChild(actionNode, "revalidate");
            const rawTag = tagNode ? tagNode.textContent.trim() : (actionNode.getAttribute("tag") || actionNode.getAttribute("url") || actionNode.getAttribute("revalidate") || "");
            const tag = this.interpolate(rawTag, context);
            return this.revalidateApi(tag);
        });
    }
};

export default EUIXApiPlugin;
