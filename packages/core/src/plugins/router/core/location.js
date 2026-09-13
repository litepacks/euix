/**
 * src/plugins/router/core/location.js
 * Location representation and URLSearchParams utilities for EUIX Web Router.
 */

import { normalizePath, parsePath, resolvePath } from "./utils.js";

const _emptyParams = typeof URLSearchParams !== "undefined" ? new URLSearchParams() : null;

let _keyCounter = 0;
/**
 * Creates a fast unique location key.
 */
export function createKey() {
    return (++_keyCounter).toString(36) + Math.random().toString(36).substring(2, 6);
}

/**
 * Creates a normalized location object.
 *
 * @param {string|object} currentOrTo
 * @param {string|object} [to]
 * @param {any} [state=null]
 * @param {string} [key]
 * @returns {{ pathname: string, search: string, hash: string, state: any, key: string }}
 */
export function createLocation(currentOrTo, to, state = null, key) {
    let location;

    if (to !== undefined) {
        const fromPath = typeof currentOrTo === "string" ? currentOrTo : currentOrTo?.pathname || "/";
        const resolved = resolvePath(to, fromPath);
        const parsed = parsePath(resolved);
        location = {
            pathname: normalizePath(parsed.pathname),
            search: parsed.search,
            hash: parsed.hash,
            state: state !== undefined ? state : typeof to === "object" ? to.state : null,
            key: key || createKey(),
        };
    } else {
        const parsed = typeof currentOrTo === "string" ? parsePath(currentOrTo) : currentOrTo;
        location = {
            pathname: normalizePath(parsed.pathname || "/"),
            search: parsed.search || "",
            hash: parsed.hash || "",
            state: parsed.state !== undefined ? parsed.state : state || null,
            key: parsed.key || key || createKey(),
        };
    }

    return location;
}

/**
 * Parses search string into a structured reactive-friendly object and URLSearchParams instance.
 * @param {string} searchStr
 * @returns {Record<string, string> & { _params: URLSearchParams }}
 */
export function parseSearchParams(searchStr = "") {
    if (!searchStr || searchStr === "?") {
        const obj = {};
        if (_emptyParams) {
            Object.defineProperty(obj, "_params", {
                value: _emptyParams,
                enumerable: false,
                writable: true,
            });
        }
        return obj;
    }

    const raw = searchStr.startsWith("?") ? searchStr.slice(1) : searchStr;
    const params = new URLSearchParams(raw);
    const obj = {};

    for (const [key, value] of params.entries()) {
        if (obj[key] === undefined) {
            obj[key] = value;
        } else if (Array.isArray(obj[key])) {
            obj[key].push(value);
        } else {
            obj[key] = [obj[key], value];
        }
    }

    Object.defineProperty(obj, "_params", {
        value: params,
        enumerable: false,
        writable: true,
    });

    return obj;
}
