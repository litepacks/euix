/**
 * src/plugins/router/server/static-router.js
 * Headless Static Router for Server-Side Rendering (Node.js, Cloudflare, Deno, Bun).
 */

import { MemoryHistory } from "../core/history.js";
import { RouteMatcher } from "../core/matcher.js";
import { RouterRedirect } from "../core/navigation.js";
import { RouteDataCache } from "../data/cache.js";
import { RouteLoaderManager } from "../data/loader.js";
import { serializeHydrationState } from "./hydration.js";

/**
 * Creates and resolves a static router for SSR execution.
 *
 * @param {object} options
 * @returns {Promise<{ matches: Array, location: object, loaderData: Record<string, any>, errors: Record<string, any>, redirect?: string, html?: string, scriptTag: string }>}
 */
export async function createStaticRouter({ url = "/", routes = [], request, context = {}, engine } = {}) {
    const history = new MemoryHistory({ initialEntries: [url] });
    const location = history.location;
    const matcher = new RouteMatcher(routes);
    const matches = matcher.match(location.pathname) || [];

    const cache = new RouteDataCache();
    const loaderManager = new RouteLoaderManager({ cache, engine });

    const loaderData = {};
    const errors = {};
    let redirectUrl = null;

    const signal = new AbortController().signal;

    for (const match of matches) {
        if (match.redirect) {
            redirectUrl = match.redirect;
            break;
        }

        if (match.loader || match.route.loader || match.route.loaderNode) {
            try {
                const data = await loaderManager.executeLoader({
                    match,
                    location,
                    signal,
                    context,
                });
                match.data = data;
                loaderData[match.id] = data;
            } catch (err) {
                if (err instanceof RouterRedirect) {
                    redirectUrl = err.to;
                    break;
                }
                match.error = err;
                errors[match.id] = {
                    message: err.message || String(err),
                    status: err.status || 500,
                };
            }
        }
    }

    const hydrationData = {
        location,
        matches: matches.map((m) => ({ id: m.id, pathname: m.pathname, params: m.params })),
        loaderData,
        errors,
    };

    return {
        location,
        matches,
        loaderData,
        errors,
        redirect: redirectUrl,
        hydrationData,
        scriptTag: serializeHydrationState(hydrationData),
    };
}
