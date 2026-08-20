/**
 * src/plugins/router/data/loader.js
 * Programmatic and declarative data loaders with AbortSignal cancellation.
 */

import { RouterRedirect, RouterError } from "../core/navigation.js";
import { parseSearchParams } from "../core/location.js";

export class RouteLoaderManager {
    constructor({ cache, engine } = {}) {
        this.cache = cache;
        this.engine = engine;
        this._registeredLoaders = new Map();
    }

    registerLoader(name, fn) {
        this._registeredLoaders.set(name, fn);
    }

    /**
     * Executes a loader for a specific route match.
     * 
     * @param {object} param0 
     * @returns {Promise<any>}
     */
    async executeLoader({ match, location, signal, context = {} }) {
        const route = match.route || {};
        const routeId = match.id || route.id;
        const pathname = location.pathname;
        const search = location.search;

        // Check Cache first if not explicitly invalidated
        if (this.cache && routeId && this.cache.has(routeId, pathname, search)) {
            return this.cache.get(routeId, pathname, search);
        }

        const searchParams = parseSearchParams(search);
        const hasValidOrigin = typeof window !== "undefined" && window.location && typeof window.location.origin === "string" && window.location.origin.startsWith("http");
        const originUrl = hasValidOrigin ? window.location.origin : "http://localhost";
        const normalizedPath = pathname ? (pathname.startsWith("/") ? pathname : "/" + pathname) : "/";
        const fullUrl = `${originUrl}${normalizedPath}${search || ""}`;

        let request;
        try {
            request = typeof Request !== "undefined"
                ? new Request(fullUrl, { signal })
                : { url: fullUrl, signal };
        } catch (_) {
            request = { url: fullUrl, signal };
        }

        const loaderContext = {
            request,
            params: match.params || {},
            search: searchParams,
            signal,
            route,
            location,
            context
        };

        let result = undefined;

        // 1. Programmatic Loader
        const loaderCandidate = match.loader || route.loader;
        if (typeof loaderCandidate === "function") {
            result = await loaderCandidate(loaderContext);
        } else if (typeof loaderCandidate === "string" && this._registeredLoaders.has(loaderCandidate)) {
            const loaderFn = this._registeredLoaders.get(loaderCandidate);
            result = await loaderFn(loaderContext);
        } else if (route.loaderNode) {
            // 2. Declarative XML Loader: <loader request="/api/..." method="GET" as="key" />
            result = await this._executeDeclarativeLoader(route.loaderNode, loaderContext);
        }

        // Handle Redirects
        if (result instanceof RouterRedirect) {
            throw result;
        }
        if (result instanceof Response && (result.status >= 300 && result.status < 400)) {
            const redirectUrl = result.headers.get("Location") || "/";
            throw new RouterRedirect(redirectUrl);
        }

        // Store in cache
        if (this.cache && routeId && result !== undefined) {
            this.cache.set(routeId, pathname, search, result);
        }

        return result;
    }

    async _executeDeclarativeLoader(xmlNode, { params, signal }) {
        let requestUrl = xmlNode.getAttribute("request") || xmlNode.getAttribute("url") || "";
        const method = (xmlNode.getAttribute("method") || "GET").toUpperCase();
        const asKey = xmlNode.getAttribute("as");

        // Interpolate params into request URL
        Object.keys(params).forEach(k => {
            requestUrl = requestUrl.replace(`{{ params.${k} }}`, params[k]).replace(`{params.${k}}`, params[k]);
        });

        if (typeof fetch === "undefined") return null;

        const res = await fetch(requestUrl, { method, signal });
        if (!res.ok) {
            throw new RouterError(res.status, `Failed to load declarative loader (${res.status})`);
        }

        const data = await res.json();
        return asKey ? { [asKey]: data } : data;
    }
}
