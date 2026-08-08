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

            const target = this.parseBindPath(targetNode.textContent);
            const selectNode = this.getChild(actionNode, "select");
            const select = selectNode?.textContent.trim() || "";
            const itemMapNode = this.getChild(actionNode, "item_map");
            const bodyNode = this.getChild(actionNode, "body");

            const targetOpNode = this.getChild(actionNode, "operation") || this.getChild(actionNode, "target_op");
            const targetOp = targetOpNode ? targetOpNode.textContent.trim().toUpperCase() : "SET";

            const tagAttr = actionNode.getAttribute("tag") || this.getChild(actionNode, "tag")?.textContent.trim() || compApiConfig.tag || "";
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
                        const revalidateTag = revalidateNode ? revalidateNode.textContent.trim() : (actionNode.getAttribute("revalidate") || actionNode.getAttribute("revalidate_tag") || "");

                        if (revalidateTag) {
                            this.revalidateApi(revalidateTag);
                        }
                    });
                    return data;
                })
                .catch((err) => {
                    this.batch(() => {
                        if (loadingPath) this.setState(loadingPath, "false", { silent: true });
                        if (errorPath) this.setState(errorPath, err.message || "Ağ hatası", { silent: true });
                    });
                });
        };

        // Register XHR Action Handler
        engineClass.registerAction("XHR", async function(actionNode, context) {
            return this.handleXHR(actionNode, context);
        });

        // Register REVALIDATE_API Action Handler
        engineClass.registerAction("REVALIDATE_API", async function(actionNode, context) {
            const tagAttr = actionNode.getAttribute("tag") || this.getChild(actionNode, "tag")?.textContent.trim();
            if (tagAttr) {
                return this.revalidateApi(tagAttr);
            }
        });
    }
};

export default EUIXApiPlugin;
