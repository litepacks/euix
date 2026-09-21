/**
 * packages/core/src/prepare/resolver/index.js
 * Main entry point for symbol, import, and route resolution.
 */

import { collectScopes, isStateAccessible } from "./scopeResolver.js";
import { resolveImports, normalizeImportPath } from "./importResolver.js";

/**
 * Normalizes a route definition object into a standard structure.
 *
 * @param {object|string|null} route
 * @returns {{ path: string, params: string[], name: string|null, meta: object }|null}
 */
export function normalizeRoute(route) {
    if (!route) return null;
    const pathStr = typeof route === "string" ? route : route.path;
    if (!pathStr || typeof pathStr !== "string") return null;

    // Extract route param names: /users/:id/:tab -> ["id", "tab"]
    const params = [];
    const segments = pathStr.split("/");
    for (const segment of segments) {
        if (segment.startsWith(":")) {
            const paramName = segment.slice(1).replace(/[^a-zA-Z0-9_]/g, "");
            if (paramName) params.push(paramName);
        }
    }

    return {
        path: pathStr,
        params,
        name: typeof route === "object" ? route.name || null : null,
        meta: typeof route === "object" && route.meta ? { ...route.meta } : {},
    };
}

/**
 * Resolve all scopes, imports, routes, and component links for a source document.
 *
 * @param {object} source
 * @param {object} [options={}]
 * @returns {Promise<{ scope: import('./scopeResolver.js').ResolvedScope, route: object|null, resolvedComponents: Map<string, object>, diagnostics: Array<import('../validator/diagnostics.js').Diagnostic> }>}
 */
export async function resolveSource(source, options = {}) {
    const scope = collectScopes(source);
    const route = normalizeRoute(source.route);
    const { resolvedComponents, diagnostics } = await resolveImports(source, options);

    return {
        scope,
        route,
        resolvedComponents,
        diagnostics,
    };
}

export { collectScopes, isStateAccessible, resolveImports, normalizeImportPath };
