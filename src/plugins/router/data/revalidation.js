/**
 * src/plugins/router/data/revalidation.js
 * Automatic and manual data revalidation system for EUIX Web Router.
 */

export class RouteRevalidationManager {
    constructor({ loaderManager, cache } = {}) {
        this.loaderManager = loaderManager;
        this.cache = cache;
        this._shouldRevalidatePredicates = new Map();
    }

    registerPredicate(name, fn) {
        this._shouldRevalidatePredicates.set(name, fn);
    }

    /**
     * Determines whether a route match should revalidate.
     */
    shouldRevalidateMatch({ match, currentUrl, nextUrl, actionResult }) {
        const route = match.route;
        const predicateName = route.shouldRevalidate || route["should-revalidate"];

        if (typeof predicateName === "function") {
            return predicateName({
                currentUrl,
                nextUrl,
                actionResult,
                params: match.params,
                defaultShouldRevalidate: true
            });
        }

        if (typeof predicateName === "string" && this._shouldRevalidatePredicates.has(predicateName)) {
            const fn = this._shouldRevalidatePredicates.get(predicateName);
            return fn({
                currentUrl,
                nextUrl,
                actionResult,
                params: match.params,
                defaultShouldRevalidate: true
            });
        }

        return true; // Default: revalidate all active matches after an action
    }

    /**
     * Invalidate caches and re-execute loaders for active matches.
     */
    async revalidateMatches({ matches, location, signal, routeId, actionResult, context }) {
        if (!matches || matches.length === 0) return;

        for (const match of matches) {
            if (routeId && match.id !== routeId) continue;

            const shouldRun = this.shouldRevalidateMatch({
                match,
                currentUrl: location.pathname,
                nextUrl: location.pathname,
                actionResult
            });

            if (shouldRun) {
                if (this.cache) {
                    this.cache.invalidate(match.id);
                }
                if (match.loader || match.route.loader || match.route.loaderNode) {
                    const data = await this.loaderManager.executeLoader({
                        match,
                        location,
                        signal,
                        context
                    });
                    match.data = data;
                }
            }
        }
    }
}
