/**
 * src/plugins/router/core/matcher.js
 * High-performance route compiler, ranking engine, and matcher for EUIX Web Router.
 */

import { compilePath, normalizePath, generatePath, fastDecode } from "./utils.js";

/**
 * Normalizes and flattens a nested route tree into a list of ranked route branches.
 * Each branch represents the full hierarchy path from root to leaf.
 * 
 * @param {Array<object>} routes 
 * @param {Array<object>} parentBranch 
 * @param {string} parentPath 
 * @returns {Array<RouteBranch>}
 */
export function compileRouteBranches(routes, parentBranch = [], parentPath = "") {
    const branches = [];

    for (let i = 0; i < routes.length; i++) {
        const route = routes[i];
        const isIndex = !!route.index;
        const isGroup = !!route.isGroup;
        const isPathless = !isIndex && !route.path;

        let fullPath = parentPath;
        if (route.path) {
            if (route.path.startsWith("/") && parentPath) {
                // Absolute nested path overrides parent path
                fullPath = normalizePath(route.path);
            } else {
                fullPath = normalizePath(`${parentPath}/${route.path}`);
            }
        }

        const currentBranch = [
            ...parentBranch,
            {
                route,
                path: route.path || (isIndex ? "" : "/"),
                fullPath,
                isIndex,
                isPathless,
                isGroup
            }
        ];

        if (route.children && route.children.length > 0) {
            const childBranches = compileRouteBranches(route.children, currentBranch, fullPath);
            branches.push(...childBranches);
        }

        // If it's a leaf route or can match on its own (has component/layout/index)
        if (!isGroup && (route.component || route.layout || isIndex || route.redirect || !route.children || route.children.length === 0)) {
            const compiled = compileBranch(currentBranch, fullPath, isIndex);
            branches.push(compiled);
        }
    }

    // Rank branches: highest score first
    return branches.sort((a, b) => {
        if (b.score !== a.score) {
            return b.score - a.score;
        }
        // If scores are equal, prefer the one with more specific segments
        if (b.depth !== a.depth) {
            return b.depth - a.depth;
        }
        return a.index - b.index;
    });
}

/**
 * Compiles a single route branch hierarchy and computes its matching score and templates.
 */
function compileBranch(branchHierarchy, fullPath, isIndex) {
    const pattern = fullPath || "/";
    const compiled = compilePath(pattern, true);

    let score = compiled.score;
    if (isIndex) {
        score += 20; // Index route gets a precision boost
    }

    const depth = pattern.split("/").filter(Boolean).length;
    const isStatic = compiled.keys.length === 0 && pattern.indexOf("*") === -1;

    // Pre-calculate template matches for the hierarchy
    const templateHierarchy = [];
    let accumPath = "";

    for (let h = 0; h < branchHierarchy.length; h++) {
        const node = branchHierarchy[h];
        if (node.isGroup) continue;

        const route = node.route;
        if (route.path) {
            accumPath = node.fullPath;
        }

        const stepPattern = accumPath || "/";
        const hasParams = stepPattern.indexOf(":") !== -1 || stepPattern.indexOf("*") !== -1;

        templateHierarchy.push({
            id: route.id || `route_${h}`,
            route,
            pathname: hasParams ? stepPattern : stepPattern,
            pattern: stepPattern,
            hasParams,
            layout: route.layout,
            component: route.component,
            loader: route.loader,
            action: route.action,
            guard: route.guard || route.guards,
            middleware: route.middleware,
            redirect: route.redirect,
            meta: route.meta,
            key: route.key
        });
    }

    return {
        pattern,
        regex: compiled.regex,
        keys: compiled.keys,
        score,
        depth,
        isIndex,
        isStatic,
        templateHierarchy,
        hierarchy: branchHierarchy
    };
}

/**
 * Route Matcher class with compilation caching and static match acceleration.
 */
export class RouteMatcher {
    constructor(routes = []) {
        this.routes = routes;
        this._branches = null;
        this._staticBranches = new Map();
        this._namedRoutes = new Map();
        this._matchCache = new Map();
        this._compile();
    }

    _compile() {
        this._branches = compileRouteBranches(this.routes);
        this._staticBranches.clear();
        this._namedRoutes.clear();
        this._matchCache.clear();

        // Index static branches for instant O(1) matching
        for (let i = 0; i < this._branches.length; i++) {
            const branch = this._branches[i];
            if (branch.isStatic && !this._staticBranches.has(branch.pattern)) {
                this._staticBranches.set(branch.pattern, branch);
            }
        }

        this._indexNamedRoutes(this.routes, "");
    }

    _indexNamedRoutes(routes, parentPath) {
        for (let i = 0; i < routes.length; i++) {
            const route = routes[i];
            let fullPath = parentPath;
            if (route.path) {
                fullPath = route.path.startsWith("/") ? normalizePath(route.path) : normalizePath(`${parentPath}/${route.path}`);
            }
            if (route.id) {
                this._namedRoutes.set(route.id, {
                    id: route.id,
                    path: fullPath || "/",
                    route
                });
            }
            if (route.children) {
                this._indexNamedRoutes(route.children, fullPath);
            }
        }
    }

    /**
     * Finds a named route pattern.
     * @param {string} name 
     * @returns {string|null}
     */
    getNamedPath(name) {
        const found = this._namedRoutes.get(name);
        return found ? found.path : null;
    }

    /**
     * Matches a given pathname against compiled route branches.
     * @param {string} pathname 
     * @returns {Array<RouteMatch>|null}
     */
    match(pathname = "/") {
        const normalized = normalizePath(pathname);

        // 1. Fast path: Static branch exact hit
        const staticBranch = this._staticBranches.get(normalized);
        if (staticBranch) {
            return this._buildMatches(staticBranch.templateHierarchy, {}, normalized);
        }

        // 2. Regular matching across compiled ranked branches
        const branches = this._branches;
        const bLen = branches.length;

        for (let i = 0; i < bLen; i++) {
            const branch = branches[i];
            const match = branch.regex.exec(normalized);

            if (match) {
                const params = {};
                const keys = branch.keys;
                const kLen = keys.length;

                for (let k = 0; k < kLen; k++) {
                    const capture = match[k + 1];
                    if (capture !== undefined) {
                        params[keys[k]] = fastDecode(capture);
                    }
                }

                return this._buildMatches(branch.templateHierarchy, params, normalized);
            }
        }

        return null;
    }

    _buildMatches(templateHierarchy, params, currentPathname) {
        const len = templateHierarchy.length;
        const matches = new Array(len);

        for (let h = 0; h < len; h++) {
            const tm = templateHierarchy[h];
            let interpolatedPath = tm.pattern;
            if (tm.hasParams) {
                try {
                    interpolatedPath = generatePath(tm.pattern, params);
                } catch (_) {
                    interpolatedPath = currentPathname;
                }
            }

            matches[h] = {
                id: tm.id,
                route: tm.route,
                pathname: interpolatedPath,
                pattern: tm.pattern,
                params: { ...params }, // Cloned parameters per match
                data: undefined,
                actionData: undefined,
                error: null,
                layout: tm.layout,
                component: tm.component,
                loader: tm.loader,
                action: tm.action,
                guard: tm.guard,
                middleware: tm.middleware,
                redirect: tm.redirect,
                meta: tm.meta,
                key: tm.key
            };
        }

        return matches;
    }
}

/**
 * Standalone matchRoutes function.
 * @param {Array<object>} routes 
 * @param {string} pathname 
 * @returns {Array<RouteMatch>|null}
 */
export function matchRoutes(routes, pathname = "/") {
    const matcher = new RouteMatcher(routes);
    return matcher.match(pathname);
}
