/**
 * src/plugins/router/data/cache.js
 * Minimal keyed cache for loader deduplication, navigation, and prefetching.
 */

export class RouteDataCache {
    constructor({ maxEntries = 100 } = {}) {
        this.maxEntries = maxEntries;
        this._entries = new Map();
    }

    _makeKey(routeId, pathname, search = "") {
        return `${routeId}:${pathname}:${search}`;
    }

    get(routeId, pathname, search = "") {
        const key = this._makeKey(routeId, pathname, search);
        const entry = this._entries.get(key);
        if (!entry) return undefined;
        return entry.data;
    }

    has(routeId, pathname, search = "") {
        const key = this._makeKey(routeId, pathname, search);
        return this._entries.has(key);
    }

    set(routeId, pathname, search = "", data) {
        const key = this._makeKey(routeId, pathname, search);
        if (this._entries.size >= this.maxEntries) {
            const firstKey = this._entries.keys().next().value;
            this._entries.delete(firstKey);
        }
        this._entries.set(key, {
            data,
            timestamp: Date.now(),
            stale: false
        });
    }

    invalidate(routeId) {
        if (!routeId) {
            this._entries.clear();
            return;
        }
        for (const [key, entry] of this._entries.entries()) {
            if (key.startsWith(`${routeId}:`)) {
                entry.stale = true;
                this._entries.delete(key);
            }
        }
    }

    clear() {
        this._entries.clear();
    }
}
