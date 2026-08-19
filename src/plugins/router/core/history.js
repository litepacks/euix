/**
 * src/plugins/router/core/history.js
 * Browser, Hash, and Memory History implementations for EUIX Web Router.
 */

import { parsePath, createPath, normalizePath } from "./utils.js";
import { createLocation, createKey } from "./location.js";

/**
 * Base History abstraction managing listeners.
 */
class BaseHistory {
    constructor(base = "/") {
        this.base = normalizePath(base);
        this.listeners = new Set();
        this.action = "POP";
    }

    listen(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    notify(location, action) {
        this.action = action;
        this.listeners.forEach(fn => {
            try {
                fn({ location, action });
            } catch (err) {
                console.error("[EUIXRouter] Error in history listener:", err);
            }
        });
    }

    stripBase(pathname) {
        if (this.base === "/" || !pathname.startsWith(this.base)) {
            return pathname || "/";
        }
        const stripped = pathname.slice(this.base.length);
        return stripped.startsWith("/") ? stripped : "/" + stripped;
    }

    prependBase(pathname) {
        if (this.base === "/" || pathname.startsWith(this.base)) {
            return pathname || "/";
        }
        return normalizePath(`${this.base}/${pathname}`);
    }

    createHref(to) {
        const path = typeof to === "string" ? to : createPath(to);
        return this.prependBase(path);
    }
}

/**
 * HTML5 History API implementation.
 */
export class BrowserHistory extends BaseHistory {
    constructor({ base = "/" } = {}) {
        super(base);
        this._handlePopState = this._handlePopState.bind(this);

        if (typeof window !== "undefined") {
            window.addEventListener("popstate", this._handlePopState);
        }
    }

    get location() {
        if (typeof window === "undefined") {
            return createLocation("/");
        }
        const { pathname, search, hash } = window.location;
        const state = window.history.state;
        return createLocation({
            pathname: this.stripBase(pathname),
            search,
            hash,
            state: state?._usr !== undefined ? state._usr : state,
            key: state?._key || createKey()
        });
    }

    _handlePopState(event) {
        const location = this.location;
        this.notify(location, "POP");
    }

    push(to, state = null) {
        const nextLoc = createLocation(this.location, to, state, createKey());
        const fullPath = this.prependBase(createPath(nextLoc));

        if (typeof window !== "undefined") {
            window.history.pushState({ _usr: nextLoc.state, _key: nextLoc.key }, "", fullPath);
        }
        this.notify(nextLoc, "PUSH");
    }

    replace(to, state = null) {
        const nextLoc = createLocation(this.location, to, state, this.location.key);
        const fullPath = this.prependBase(createPath(nextLoc));

        if (typeof window !== "undefined") {
            window.history.replaceState({ _usr: nextLoc.state, _key: nextLoc.key }, "", fullPath);
        }
        this.notify(nextLoc, "REPLACE");
    }

    go(delta) {
        if (typeof window !== "undefined") {
            window.history.go(delta);
        }
    }

    back() {
        this.go(-1);
    }

    forward() {
        this.go(1);
    }

    destroy() {
        if (typeof window !== "undefined") {
            window.removeEventListener("popstate", this._handlePopState);
        }
        this.listeners.clear();
    }
}

/**
 * Hash History implementation (#/path).
 */
export class HashHistory extends BaseHistory {
    constructor({ base = "/" } = {}) {
        super(base);
        this._ignoreHashChange = false;
        this._handleHashChange = this._handleHashChange.bind(this);

        if (typeof window !== "undefined") {
            window.addEventListener("hashchange", this._handleHashChange);
            // Ensure hash exists
            if (!window.location.hash) {
                window.location.hash = "#/";
            }
        }
    }

    get location() {
        if (typeof window === "undefined") {
            return createLocation("/");
        }
        const hash = window.location.hash || "#/";
        const hashPath = hash.slice(1) || "/";
        const parsed = parsePath(hashPath);
        return createLocation({
            pathname: this.stripBase(parsed.pathname),
            search: parsed.search,
            hash: parsed.hash,
            state: null,
            key: createKey()
        });
    }

    createHref(to) {
        const path = typeof to === "string" ? to : createPath(to);
        const fullPath = this.prependBase(path);
        return "#" + (fullPath.startsWith("/") ? fullPath : "/" + fullPath);
    }

    _handleHashChange() {
        if (this._ignoreHashChange) {
            this._ignoreHashChange = false;
            return;
        }
        const location = this.location;
        this.notify(location, "POP");
    }

    push(to, state = null) {
        const nextLoc = createLocation(this.location, to, state, createKey());
        const fullPath = this.prependBase(createPath(nextLoc));

        if (typeof window !== "undefined") {
            this._ignoreHashChange = true;
            window.location.hash = fullPath.startsWith("/") ? fullPath : "/" + fullPath;
        }
        this.notify(nextLoc, "PUSH");
    }

    replace(to, state = null) {
        const nextLoc = createLocation(this.location, to, state, this.location.key);
        const fullPath = this.prependBase(createPath(nextLoc));

        if (typeof window !== "undefined") {
            this._ignoreHashChange = true;
            const url = new URL(window.location.href);
            url.hash = fullPath.startsWith("/") ? fullPath : "/" + fullPath;
            window.location.replace(url.href);
        }
        this.notify(nextLoc, "REPLACE");
    }

    go(delta) {
        if (typeof window !== "undefined") {
            window.history.go(delta);
        }
    }

    back() {
        this.go(-1);
    }

    forward() {
        this.go(1);
    }

    destroy() {
        if (typeof window !== "undefined") {
            window.removeEventListener("hashchange", this._handleHashChange);
        }
        this.listeners.clear();
    }
}

/**
 * In-Memory History implementation for SSR, testing, and isolated widgets.
 */
export class MemoryHistory extends BaseHistory {
    constructor({ base = "/", initialEntries = ["/"], initialIndex = 0 } = {}) {
        super(base);
        this.entries = initialEntries.map(entry => createLocation(entry));
        this.index = Math.min(Math.max(0, initialIndex), this.entries.length - 1);
    }

    get location() {
        return this.entries[this.index] || createLocation("/");
    }

    push(to, state = null) {
        const nextLoc = createLocation(this.location, to, state, createKey());
        this.entries = this.entries.slice(0, this.index + 1);
        this.entries.push(nextLoc);
        this.index = this.entries.length - 1;
        this.notify(nextLoc, "PUSH");
    }

    replace(to, state = null) {
        const nextLoc = createLocation(this.location, to, state, this.location.key);
        this.entries[this.index] = nextLoc;
        this.notify(nextLoc, "REPLACE");
    }

    go(delta) {
        const nextIndex = this.index + delta;
        if (nextIndex >= 0 && nextIndex < this.entries.length) {
            this.index = nextIndex;
            this.notify(this.location, "POP");
        }
    }

    back() {
        this.go(-1);
    }

    forward() {
        this.go(1);
    }

    destroy() {
        this.listeners.clear();
    }
}

/**
 * Factory to instantiate the appropriate history instance.
 * 
 * @param {{ mode?: 'history'|'hash'|'memory', base?: string, initialEntries?: string[], initialIndex?: number }} options 
 * @returns {BrowserHistory | HashHistory | MemoryHistory}
 */
export function createHistory(options = {}) {
    const mode = options.mode || "history";
    if (mode === "hash") {
        return new HashHistory(options);
    } else if (mode === "memory" || typeof window === "undefined") {
        return new MemoryHistory(options);
    }
    return new BrowserHistory(options);
}
