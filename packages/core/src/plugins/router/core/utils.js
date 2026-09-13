/**
 * src/plugins/router/core/utils.js
 * High-performance framework-independent router utilities for EUIX Web Router.
 */

const _compilePathCache = new Map();

/**
 * Fast-path URI component decoder avoiding V8 native C++ transitions if '%' is absent.
 * @param {string} str
 * @returns {string}
 */
export function fastDecode(str) {
    if (!str) return "";
    if (str.indexOf("%") === -1) return str;
    try {
        return decodeURIComponent(str);
    } catch (_) {
        return str;
    }
}

/**
 * Parses a string URL or path into pathname, search, and hash components.
 * @param {string} urlOrPath
 * @returns {{ pathname: string, search: string, hash: string }}
 */
export function parsePath(urlOrPath = "") {
    let pathname = "";
    let search = "";
    let hash = "";

    if (!urlOrPath) {
        return { pathname: "/", search: "", hash: "" };
    }

    const hashIndex = urlOrPath.indexOf("#");
    if (hashIndex >= 0) {
        hash = urlOrPath.slice(hashIndex);
        urlOrPath = urlOrPath.slice(0, hashIndex);
    }

    const searchIndex = urlOrPath.indexOf("?");
    if (searchIndex >= 0) {
        search = urlOrPath.slice(searchIndex);
        urlOrPath = urlOrPath.slice(0, searchIndex);
    }

    if (urlOrPath) {
        pathname = urlOrPath;
    }

    return {
        pathname: pathname || "/",
        search: search === "?" ? "" : search,
        hash: hash === "#" ? "" : hash,
    };
}

/**
 * Creates a normalized URL path string from path components.
 * @param {{ pathname?: string, search?: string, hash?: string }} param0
 * @returns {string}
 */
export function createPath({ pathname = "/", search = "", hash = "" } = {}) {
    let path = pathname || "/";
    if (search && search !== "?") {
        path += search.startsWith("?") ? search : `?${search}`;
    }
    if (hash && hash !== "#") {
        path += hash.startsWith("#") ? hash : `#${hash}`;
    }
    return path;
}

/**
 * Normalizes slashes in a pathname with fast-path for already canonical paths.
 * @param {string} path
 * @returns {string}
 */
export function normalizePath(path = "") {
    if (!path || path === "/") return "/";

    // Fast path: canonical absolute path without duplicate slashes or trailing slash
    if (path.charCodeAt(0) === 47 /* '/' */ && path.indexOf("//") === -1) {
        if (!path.endsWith("/")) return path;
        if (path.length === 1) return "/";
        return path.slice(0, -1);
    }

    let normalized = path.replace(/\/+/g, "/");
    if (normalized.length > 1 && normalized.endsWith("/")) {
        normalized = normalized.slice(0, -1);
    }
    if (!normalized.startsWith("/") && !normalized.startsWith(".")) {
        normalized = `/${normalized}`;
    }
    return normalized;
}

/**
 * Resolves a relative target path against a current base path.
 * Supports '.', '..', and relative subpaths.
 * @param {string|{ pathname?: string, search?: string, hash?: string }} to
 * @param {string} fromPath
 * @returns {string}
 */
export function resolvePath(to, fromPath = "/") {
    const toParsed = typeof to === "string" ? parsePath(to) : to;
    const toPath = toParsed.pathname || "";

    // Fast-path absolute path
    if (toPath.charCodeAt(0) === 47 /* '/' */) {
        return createPath({
            pathname: normalizePath(toPath),
            search: toParsed.search,
            hash: toParsed.hash,
        });
    }

    // Fast-path simple subpath (no '.' or '..')
    if (toPath.indexOf(".") === -1) {
        const base = normalizePath(fromPath);
        const resolved = base === "/" ? `/${toPath}` : `${base}/${toPath}`;
        return createPath({
            pathname: normalizePath(resolved),
            search: toParsed.search,
            hash: toParsed.hash,
        });
    }

    const fromSegments = fromPath.split("/").filter(Boolean);
    const toSegments = toPath.split("/").filter(Boolean);

    const resultSegments = [...fromSegments];

    for (let i = 0; i < toSegments.length; i++) {
        const seg = toSegments[i];
        if (seg === ".") {
        } else if (seg === "..") {
            resultSegments.pop();
        } else {
            resultSegments.push(seg);
        }
    }

    const resolvedPath = `/${resultSegments.join("/")}`;
    return createPath({
        pathname: normalizePath(resolvedPath),
        search: toParsed.search,
        hash: toParsed.hash,
    });
}

/**
 * Interpolates parameters into a parameterized path pattern.
 * Single-pass regex with static path fast-path.
 * @param {string} pattern
 * @param {Record<string, any>} params
 * @returns {string}
 */
export function generatePath(pattern = "/", params = {}) {
    if (!pattern) return "/";

    const safeParams = params || {};

    // Fast path: if pattern has no dynamic parameters or wildcards
    if (pattern.indexOf(":") === -1 && pattern.indexOf("*") === -1) {
        return normalizePath(pattern);
    }

    let path = pattern.replace(/:([a-zA-Z0-9_]+)(\?)?/g, (_, key, optional) => {
        const val = safeParams[key];
        if (val !== undefined && val !== null) {
            return encodeURIComponent(String(val));
        }
        if (optional) {
            return "";
        }
        throw new Error(`[EUIXRouter] Missing required param "${key}" for path "${pattern}"`);
    });

    if (path.indexOf("*") !== -1) {
        path = path.replace(/(\/)?\*$/, (_, slash) => {
            const splat = safeParams["*"];
            if (splat !== undefined && splat !== null) {
                let cleanSplat = String(splat).replace(/^\//, "");
                try {
                    cleanSplat = encodeURI(cleanSplat);
                } catch (_) {}
                return slash ? `/${cleanSplat}` : cleanSplat;
            }
            return "";
        });
    }

    return normalizePath(path);
}

/**
 * Compiles a single route pattern into a regex and param names with memoization.
 * @param {string} pattern
 * @param {boolean} end - Whether match must be exact end-of-string
 * @returns {{ regex: RegExp, keys: string[], score: number }}
 */
export function compilePath(pattern = "/", end = true) {
    const cacheKey = `${pattern}|${end}`;
    const cached = _compilePathCache.get(cacheKey);
    if (cached) return cached;

    const keys = [];
    let score = 0;

    let regexStr = "^";
    if (pattern === "*" || pattern === "/*") {
        score = -100;
        regexStr += "(?:\\/(.*))?";
        keys.push("*");
    } else {
        const segments = pattern.split("/").filter(Boolean);
        for (let i = 0; i < segments.length; i++) {
            const seg = segments[i];
            if (seg === "*") {
                score -= 50;
                regexStr += "(?:\\/(.*))?";
                keys.push("*");
            } else if (seg.startsWith(":") && seg.endsWith("?")) {
                const paramName = seg.slice(1, -1);
                keys.push(paramName);
                score += 5; // Optional dynamic param
                regexStr += "(?:\\/([^\\/]+))?";
            } else if (seg.startsWith(":")) {
                const paramName = seg.slice(1);
                keys.push(paramName);
                score += 10; // Dynamic param
                regexStr += "\\/([^\\/]+)";
            } else {
                score += 100; // Static segment (highest priority)
                regexStr += `\\/${escapeRegex(seg)}`;
            }
        }
    }

    if (regexStr === "^") {
        regexStr += "\\/?";
        score += 1;
    }

    if (end) {
        regexStr += "\\/?$";
    } else {
        regexStr += "(?:\\/.*)?$";
    }

    const compiled = {
        regex: new RegExp(regexStr),
        keys,
        score,
    };

    if (_compilePathCache.size < 512) {
        _compilePathCache.set(cacheKey, compiled);
    }

    return compiled;
}

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Matches a pattern against a pathname.
 * @param {string|{ regex: RegExp, keys: string[] }} pattern
 * @param {string} pathname
 * @param {{ end?: boolean }} options
 * @returns {{ path: string, pathname: string, params: Record<string, string>, isExact: boolean } | null}
 */
export function matchPath(pattern, pathname, { end = true } = {}) {
    const compiled = typeof pattern === "string" ? compilePath(pattern, end) : pattern;
    const match = compiled.regex.exec(pathname);

    if (!match) return null;

    const matchedPathname = match[0];
    const params = {};
    const keys = compiled.keys;
    const keyLen = keys.length;

    for (let i = 0; i < keyLen; i++) {
        const capture = match[i + 1];
        if (capture !== undefined) {
            params[keys[i]] = fastDecode(capture);
        }
    }

    return {
        path: typeof pattern === "string" ? pattern : pattern.path || "",
        pathname: matchedPathname,
        params,
        isExact: pathname === matchedPathname || pathname.replace(/\/$/, "") === matchedPathname.replace(/\/$/, ""),
    };
}
