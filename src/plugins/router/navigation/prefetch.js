/**
 * src/plugins/router/navigation/prefetch.js
 * Smart prefetching for route XML components and loader data with cache deduplication.
 */

import { createLocation } from "../core/location.js";

export class RoutePrefetchManager {
    constructor({ router, engine, cache } = {}) {
        this.router = router;
        this.engine = engine;
        this.cache = cache;
        this._inFlightPrefetches = new Set();
    }

    /**
     * Prefetches route assets (XML components, modules, loader data).
     * @param {string} targetPath 
     */
    async prefetch(targetPath) {
        if (!targetPath || this._inFlightPrefetches.has(targetPath)) return;

        this._inFlightPrefetches.add(targetPath);

        try {
            const loc = createLocation(targetPath);
            const matches = this.router.matcher.match(loc.pathname);
            if (!matches || matches.length === 0) return;

            for (const match of matches) {
                // 1. Prefetch XML component file if specified
                const targetSpec = match.layout || match.component;
                if (typeof targetSpec === "string" && (targetSpec.endsWith(".xml") || targetSpec.startsWith("./") || targetSpec.startsWith("/"))) {
                    if (this.engine?.constructor?.loadComponent) {
                        this.engine.constructor.loadComponent(match.id || targetSpec, targetSpec).catch(() => {});
                    }
                }

                // 2. Prefetch Lazy JS Module
                if (match.route.module) {
                    try {
                        const dynamicImport = new Function('url', 'return import(url)');
                        dynamicImport(match.route.module).catch(() => {});
                    } catch (_) {}
                }

                // 3. Prefetch loader data if dataEngine is active
                if (this.router.dataEngine && (match.loader || match.route.loader || match.route.loaderNode)) {
                    if (!this.cache || !this.cache.has(match.id, loc.pathname, loc.search)) {
                        this.router.dataEngine.loaderManager.executeLoader({
                            match,
                            location: loc,
                            signal: new AbortController().signal,
                            context: this.router.context || {}
                        }).catch(() => {});
                    }
                }
            }
        } finally {
            this._inFlightPrefetches.delete(targetPath);
        }
    }
}
