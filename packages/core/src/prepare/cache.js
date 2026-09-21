/**
 * packages/core/src/prepare/cache.js
 * In-memory LRU hash cache for prepared EUIX sources.
 */

/**
 * 64-bit FNV-1a fast string hash.
 *
 * @param {string} str
 * @returns {string} Hexadecimal hash string
 */
export function hashString(str) {
    let h1 = 0x811c9dc5;
    let h2 = 0x84222325;
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ code, 0x01000193);
        h2 = Math.imul(h2 ^ (code >>> 8), 0x01000193);
    }
    return (h1 >>> 0).toString(16) + (h2 >>> 0).toString(16);
}

/**
 * Generates a stable cache key for source and options.
 *
 * @param {any} source
 * @param {object} [options={}]
 * @returns {string}
 */
export function createCacheKey(source, options = {}) {
    const raw = typeof source === "string" ? source : JSON.stringify(source);
    const optsStr = options ? JSON.stringify(options) : "";
    return hashString(raw + "::" + optsStr);
}

export class PrepareMemoryCache {
    /**
     * @param {number} [maxSize=500]
     */
    constructor(maxSize = 500) {
        this.maxSize = maxSize;
        this.cache = new Map();
        this.stats = { hits: 0, misses: 0 };
    }

    get size() {
        return this.cache.size;
    }

    /**
     * @param {any} source
     * @param {object} [options]
     * @returns {any|null}
     */
    get(source, options) {
        const key = createCacheKey(source, options);
        if (this.cache.has(key)) {
            this.stats.hits++;
            const val = this.cache.get(key);
            // Refresh LRU position
            this.cache.delete(key);
            this.cache.set(key, val);
            return val;
        }
        this.stats.misses++;
        return null;
    }

    /**
     * @param {any} source
     * @param {object} [options]
     * @param {any} result
     */
    set(source, options, result) {
        const key = createCacheKey(source, options);
        if (this.cache.size >= this.maxSize) {
            const oldestKey = this.cache.keys().next().value;
            if (oldestKey) this.cache.delete(oldestKey);
        }
        this.cache.set(key, result);
    }

    /**
     * @param {any} source
     * @param {object} [options]
     * @returns {boolean}
     */
    has(source, options) {
        return this.cache.has(createCacheKey(source, options));
    }

    clear() {
        this.cache.clear();
        this.stats.hits = 0;
        this.stats.misses = 0;
    }
}

export const globalPrepareCache = new PrepareMemoryCache(500);
