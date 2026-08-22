/**
 * src/plugins/router/data/action.js
 * Route action manager for handling data mutations and form submissions.
 */

import { RouterRedirect } from "../core/navigation.js";

export class RouteActionManager {
    constructor() {
        this._registeredActions = new Map();
    }

    registerAction(name, fn) {
        this._registeredActions.set(name, fn);
    }

    /**
     * Executes an action for a matched route.
     *
     * @param {object} param0
     * @returns {Promise<any>}
     */
    async executeAction({ match, location, formData, signal, context = {} }) {
        const route = match.route || {};
        const pathname = location.pathname || "/";
        const hasValidOrigin =
            typeof window !== "undefined" &&
            window.location &&
            typeof window.location.origin === "string" &&
            window.location.origin.startsWith("http");
        const originUrl = hasValidOrigin ? window.location.origin : "http://localhost";
        const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
        const fullUrl = `${originUrl}${normalizedPath}${location.search || ""}`;

        let request;
        try {
            request =
                typeof Request !== "undefined"
                    ? new Request(fullUrl, {
                          method: "POST",
                          body: formData,
                          signal,
                      })
                    : { url: fullUrl, method: "POST", body: formData, signal };
        } catch (_) {
            request = { url: fullUrl, method: "POST", body: formData, signal };
        }

        const actionContext = {
            request,
            params: match.params,
            formData,
            signal,
            route,
            location,
            context,
        };

        let result;

        if (typeof route.action === "function") {
            result = await route.action(actionContext);
        } else if (typeof route.action === "string" && this._registeredActions.has(route.action)) {
            const actionFn = this._registeredActions.get(route.action);
            result = await actionFn(actionContext);
        }

        // Handle Redirects
        if (result instanceof RouterRedirect) {
            throw result;
        }
        if (result instanceof Response && result.status >= 300 && result.status < 400) {
            const redirectUrl = result.headers.get("Location") || "/";
            throw new RouterRedirect(redirectUrl);
        }

        return result;
    }
}
