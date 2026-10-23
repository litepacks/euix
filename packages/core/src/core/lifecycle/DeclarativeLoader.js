/**
 * src/core/lifecycle/DeclarativeLoader.js
 * Drop-in declarative component auto-mount & data-attribute engine for EUIX.
 * Enables zero-boilerplate usage in any HTML page or existing project:
 *
 *   <script src="dist/EUIXEngine.umd.js" euix></script>
 *   <div data-euix="/counter.xml"></div>
 *
 * Features:
 * - Auto-detects [data-euix], [data-euix-src], [data-euix-component], and <euix-component>
 * - Supports remote URL, inline XML, or <template #id> sources
 * - Automatic props extraction via data-props='{...}' and data-prop-* attributes
 * - Automatic state extraction via data-state='{...}' and data-state-* attributes
 * - Smart type coercion (numbers, booleans, JSON objects/arrays)
 * - Loading indicator state (.euix-loading, data-loading placeholder)
 * - MutationObserver support for dynamically injected elements (AJAX / HTMX / SPAs)
 * - Multi-instance island architecture with automatic unmounting on DOM removal
 * - Global window.euix namespace for clean developer ergonomics
 */

import { isFn, isStr, isObj, getAttr, queryAll, safeParse } from "../utils/constants.js";

/**
 * Safely coerce attribute string value into appropriate JS primitive or object.
 */
export function coerceAttributeValue(val) {
    if (!isStr(val)) return val;
    const trimmed = val.trim();
    if (trimmed === "true") return true;
    if (trimmed === "false") return false;
    if (trimmed === "null") return null;
    if (trimmed === "undefined") return undefined;

    // Check for valid numbers (excluding empty strings or hex hashes)
    if (!isNaN(Number(trimmed)) && trimmed !== "" && !trimmed.startsWith("0x")) {
        return Number(trimmed);
    }

    // Try parsing JSON array or object
    if (
        (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
        (trimmed.startsWith("[") && trimmed.endsWith("]"))
    ) {
        return safeParse(trimmed, val);
    }

    return val;
}

/**
 * Extract props and state from element data attributes.
 */
export function extractPropsAndState(element) {
    const props = {};
    const state = {};

    if (!element || !element.attributes) {
        return { props, state };
    }

    // 1. JSON blobs
    if (element.hasAttribute("data-props")) {
        const parsed = safeParse(element.getAttribute("data-props"));
        if (isObj(parsed)) {
            Object.assign(props, parsed);
        }
    }

    if (element.hasAttribute("data-state")) {
        const parsed = safeParse(element.getAttribute("data-state"));
        if (isObj(parsed)) {
            Object.assign(state, parsed);
        }
    }

    // 2. Individual data-prop-* and data-state-* attributes
    for (let i = 0; i < element.attributes.length; i++) {
        const attr = element.attributes[i];
        const name = attr.name.toLowerCase();

        if (name.startsWith("data-prop-")) {
            const key = name.slice(10); // e.g. "count", "user-name"
            const val = coerceAttributeValue(attr.value);
            const camelKey = key.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
            const snakeKey = key.replace(/-/g, "_");
            props[key] = val;
            props[camelKey] = val;
            props[snakeKey] = val;
        } else if (name.startsWith("data-state-")) {
            const key = name.slice(11); // e.g. "count", "user-name"
            const val = coerceAttributeValue(attr.value);
            const camelKey = key.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
            const snakeKey = key.replace(/-/g, "_");
            state[key] = val;
            state[camelKey] = val;
            state[snakeKey] = val;
        }
    }

    return { props, state };
}

/**
 * Normalizes raw XML: wraps isolated component_def or naked tags in uid_spec.
 */
export function normalizeXml(rawXml, targetComponent = null) {
    let xml = (rawXml || "").trim();
    if (!xml) return "";

    const hasUidSpec = xml.includes("<uid_spec") || xml.includes("<uid_spec>");
    const hasCompDef = xml.includes("<component_def");

    if (hasCompDef && !hasUidSpec) {
        // Extract component name from first component_def or targetComponent
        let compName = targetComponent;
        if (!compName) {
            const match = xml.match(/<component_def[^>]+(?:name|id)=["']([^"']+)["']/i);
            compName = match ? match[1] : null;
        }
        if (compName) {
            return `<uid_spec>\n${xml}\n<component name="${compName}" />\n</uid_spec>`;
        }
    }

    if (!hasUidSpec) {
        return `<uid_spec>\n${xml}\n</uid_spec>`;
    }

    return xml;
}

/**
 * Resolves XML source string from attribute, template, or remote URL fetch.
 */
export async function resolveXmlSource(element, options = {}, EngineClass) {
    let src =
        element.getAttribute("data-euix") ||
        element.getAttribute("data-euix-src") ||
        element.getAttribute("src") ||
        "";
    src = src.trim();

    // 1. If empty, check child script or innerHTML
    if (!src) {
        const childScript = element.querySelector(
            'script[type="application/euix"], script[type="text/euix"], template'
        );
        if (childScript) {
            return (childScript.content ? childScript.innerHTML : childScript.textContent || childScript.innerHTML).trim();
        }
        if (element.innerHTML && (element.innerHTML.includes("<uid_spec>") || element.innerHTML.includes("<component_def>"))) {
            const xml = element.innerHTML.trim();
            element.innerHTML = "";
            return xml;
        }
        return null;
    }

    // 2. Direct inline XML
    if (src.startsWith("<")) {
        return src;
    }

    // 3. Template selector (#my-template)
    if (src.startsWith("#")) {
        const targetEl = document.querySelector(src);
        if (targetEl) {
            return (targetEl.content ? targetEl.innerHTML : targetEl.textContent || targetEl.innerHTML).trim();
        }
        throw new Error(`[EUIX] Template element not found for selector '${src}'`);
    }

    // 4. Remote URL / file path
    const basePath = options.basePath || EngineClass._basePath || "";
    let finalUrl = src;
    if (
        basePath &&
        !finalUrl.startsWith("/") &&
        !finalUrl.startsWith("http://") &&
        !finalUrl.startsWith("https://")
    ) {
        finalUrl = `${basePath.replace(/\/$/, "")}/${finalUrl}`;
    }

    if (!EngineClass._xmlFetchCache) {
        EngineClass._xmlFetchCache = new Map();
    }

    if (EngineClass._xmlFetchCache.has(finalUrl)) {
        return await EngineClass._xmlFetchCache.get(finalUrl);
    }

    const fetchPromise = (async () => {
        if (typeof fetch === "undefined") {
            throw new Error("[EUIX] fetch is not available in this environment.");
        }
        const isDev =
            typeof window !== "undefined" &&
            (window.location?.hostname === "localhost" || window.location?.hostname === "127.0.0.1");
        const res = await fetch(finalUrl, isDev ? { cache: "no-cache" } : undefined);
        if (!res.ok) {
            throw new Error(`[EUIX] Failed to fetch component from '${finalUrl}': ${res.status} ${res.statusText}`);
        }
        const text = await res.text();
        const contentType = res.headers?.get?.("content-type") || "";
        const trimmed = text.trim();
        if (
            finalUrl.endsWith(".xml") &&
            (contentType.includes("text/html") || trimmed.toLowerCase().startsWith("<!doctype html")) &&
            !trimmed.includes("<uid_spec") &&
            !trimmed.includes("<component_def")
        ) {
            throw new Error(`[EUIX] Expected XML component at '${finalUrl}', but received HTML document (SPA fallback).`);
        }
        return text;
    })();

    EngineClass._xmlFetchCache.set(finalUrl, fetchPromise);
    try {
        return await fetchPromise;
    } catch (err) {
        EngineClass._xmlFetchCache.delete(finalUrl);
        throw err;
    }
}

/**
 * Mounts an EUIX component into a given DOM element.
 */
export async function mountElement(EngineClass, element, options = {}) {
    if (isStr(element)) {
        element = document.querySelector(element);
    }
    if (!element || !element.nodeType) return null;

    // Skip already mounted elements or ignored containers
    if (element._euixEngine) return element._euixEngine;
    if (element.dataset?.euixMounted === "true") return null;
    if (element.closest?.("code, pre, [data-euix-example], .no-auto-init")) return null;

    element.dataset.euixMounted = "true";
    element.classList.add("euix-loading");

    const loadingText = getAttr(element, "data-loading", "data-euix-loading");
    let prevContent = null;
    if (loadingText) {
        prevContent = element.innerHTML;
        element.innerHTML = loadingText;
    }

    try {
        const targetComponent = getAttr(element, "data-component", "data-euix-component");
        const rawXml = await resolveXmlSource(element, options, EngineClass);
        if (!rawXml) {
            element.classList.remove("euix-loading");
            delete element.dataset.euixMounted;
            return null;
        }

        const xml = normalizeXml(rawXml, targetComponent);
        const { props, state } = extractPropsAndState(element);

        const mergedProps = { ...props, ...(options.props || {}) };
        const mergedState = { ...state, ...(options.state || {}) };

        // Clean container before mounting
        element.innerHTML = "";

        const mountOptions = {
            ...options,
            props: mergedProps,
            state: mergedState,
        };

        const engine = new EngineClass(element);
        engine.mount(xml, mountOptions);

        element._euixEngine = engine;
        element.classList.remove("euix-loading");
        element.classList.add("euix-mounted");
        element.setAttribute("data-euix-initialized", "true");

        if (!EngineClass.instances) EngineClass.instances = new Set();
        EngineClass.instances.add(engine);

        if (!EngineClass.elements) EngineClass.elements = new WeakMap();
        EngineClass.elements.set(element, engine);

        if (typeof CustomEvent !== "undefined") {
            element.dispatchEvent(
                new CustomEvent("euix:mounted", {
                    bubbles: true,
                    detail: { engine, props: mergedProps, state: mergedState },
                })
            );
        }

        return engine;
    } catch (err) {
        element.classList.remove("euix-loading");
        element.classList.add("euix-error");
        delete element.dataset.euixMounted;
        if (prevContent !== null) element.innerHTML = prevContent;

        const errDiv = document.createElement("div");
        errDiv.className = "euix-mount-error";
        errDiv.style.cssText =
            "padding:12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;color:#991b1b;font-size:12px;font-family:monospace;";
        errDiv.textContent = `[EUIX Mount Error] ${err.message}`;
        element.appendChild(errDiv);

        if (typeof CustomEvent !== "undefined") {
            element.dispatchEvent(
                new CustomEvent("euix:error", {
                    bubbles: true,
                    detail: { error: err },
                })
            );
        }
        console.error(err);
        return null;
    }
}

/**
 * Cleanly unmounts an element's EUIX instance and frees resources.
 */
export function unmountElement(EngineClass, element) {
    if (isStr(element)) {
        element = document.querySelector(element);
    }
    if (!element) return;

    const engine = element._euixEngine || (EngineClass.elements && EngineClass.elements.get(element));
    if (engine) {
        if (isFn(engine.destroy)) {
            engine.destroy();
        } else if (isFn(engine.unmount)) {
            engine.unmount();
        }
        if (EngineClass.instances) EngineClass.instances.delete(engine);
        if (EngineClass.elements) EngineClass.elements.delete(element);
        element._euixEngine = null;
    }

    if (element.dataset) {
        delete element.dataset.euixMounted;
        delete element.dataset.euixInitialized;
    }
    if (element.removeAttribute) {
        element.removeAttribute("data-euix-mounted");
        element.removeAttribute("data-euix-initialized");
    }
    if (element.classList) {
        element.classList.remove("euix-mounted", "euix-loading", "euix-error");
    }

    if (typeof CustomEvent !== "undefined" && isFn(element.dispatchEvent)) {
        element.dispatchEvent(new CustomEvent("euix:unmounted", { bubbles: true }));
    }
}

/**
 * Scans a container (or document) and mounts all matching elements.
 */
export async function scan(EngineClass, rootElement = document, options = {}) {
    if (typeof document === "undefined") return [];
    const root = isStr(rootElement) ? document.querySelector(rootElement) : (rootElement || document);
    if (!root) return [];

    const selector = "[data-euix], [data-euix-src], [data-euix-component], euix-component";
    const elements = queryAll(root, selector);
    if (root.matches && root.matches(selector)) {
        elements.unshift(root);
    }

    const engines = [];
    for (const el of elements) {
        try {
            const engine = await mountElement(EngineClass, el, options);
            if (engine) engines.push(engine);
        } catch (e) {
            console.error("[EUIX AutoMount Error]", e);
        }
    }
    return engines;
}

/**
 * Inspect script tags for global configuration (<script euix base-path="..." base-url="...">).
 */
export function getScriptConfig(EngineClass) {
    if (typeof document === "undefined") return { isAuto: true };
    const script =
        document.currentScript ||
        document.querySelector(
            "script[euix], script[data-euix], script[data-euix-app], script[src*='EUIXEngine'], script[src*='euix']"
        );
    if (!script) return { isAuto: true };

    const basePath =
        script.getAttribute("base-path") ||
        script.getAttribute("data-base-path") ||
        "";
    const baseUrl =
        script.getAttribute("base-url") ||
        script.getAttribute("data-base-url") ||
        "";
    const autoAttr =
        getAttr(script, "auto", "data-auto", "data-euix-auto");
    const devtoolsAttr =
        getAttr(script, "devtools", "data-devtools");

    if (basePath) EngineClass._basePath = basePath;
    if (baseUrl) EngineClass._defaultApiBaseUrl = baseUrl;

    return {
        script,
        basePath,
        baseUrl,
        isAuto: autoAttr !== "false",
        devtools: devtoolsAttr,
    };
}

/**
 * Observe DOM mutations to auto-mount dynamically inserted components.
 */
export function setupMutationObserver(EngineClass, options = {}) {
    if (typeof MutationObserver === "undefined" || typeof document === "undefined") return;
    if (EngineClass._observerStarted) return;
    EngineClass._observerStarted = true;

    const selector = "[data-euix], [data-euix-src], [data-euix-component], euix-component";

    const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType === 1) {
                    if (node.matches && node.matches(selector)) {
                        mountElement(EngineClass, node, options);
                    } else if (node.querySelectorAll) {
                        scan(EngineClass, node, options);
                    }
                }
            }
            for (const node of m.removedNodes) {
                if (node.nodeType === 1) {
                    if (node._euixEngine) {
                        unmountElement(EngineClass, node);
                    } else if (node.querySelectorAll) {
                        const childMounted = node.querySelectorAll(
                            "[data-euix-mounted='true'], [data-euix-initialized='true']"
                        );
                        childMounted.forEach((el) => unmountElement(EngineClass, el));
                    }
                }
            }
        }
    });

    const target = document.body || document.documentElement;
    if (target) {
        observer.observe(target, { childList: true, subtree: true });
    }
    EngineClass._domObserver = observer;
}

/**
 * Register <euix-component src="..."> Custom Element.
 */
export function registerCustomElement(EngineClass) {
    if (typeof window === "undefined" || typeof customElements === "undefined") return;
    if (customElements.get("euix-component")) return;

    class EUIXComponentElement extends HTMLElement {
        connectedCallback() {
            mountElement(EngineClass, this);
        }
        disconnectedCallback() {
            unmountElement(EngineClass, this);
        }
    }
    customElements.define("euix-component", EUIXComponentElement);
}

/**
 * Initializes the global `window.euix` and `window.EUIX` helpers.
 */
export function initGlobalEuix(EngineClass) {
    if (typeof window === "undefined") return;
    if (!EngineClass.instances) EngineClass.instances = new Set();
    const euixApi = {
        mount: (xml, container, opts) => EngineClass.mount(xml, container, opts),
        mountAsync: (xml, container, opts) => EngineClass.mountAsync(xml, container, opts),
        mountElement: (el, opts) => mountElement(EngineClass, el, opts),
        unmount: (el) => unmountElement(EngineClass, el),
        scan: (root, opts) => scan(EngineClass, root, opts),
        get: (elOrSel) => EngineClass.getEngine(elOrSel),
        get instances() {
            return EngineClass.instances || (EngineClass.instances = new Set());
        },
        version: "0.3.78",
    };
    window.euix = euixApi;
    window.EUIX = euixApi;
}

/**
 * Main autoInit entry point called on DOM ready.
 */
export function autoInit(EngineClass, options = {}) {
    if (typeof document === "undefined") return;

    const config = getScriptConfig(EngineClass);
    if (config.isAuto === false || (typeof window !== "undefined" && window.__EUIX_NO_AUTO__ === true)) {
        return;
    }

    // 1. Process legacy script[type="application/euix"] and euix-app (100% backward compatible)
    const legacyScripts = document.querySelectorAll(
        'script[type="application/euix"], script[type="text/euix"], script[data-euix-app], euix-app'
    );
    legacyScripts.forEach((script) => {
        if (script.closest?.("code, pre, [data-euix-example], .no-auto-init")) return;
        if (script.dataset?.euixAutoInitialized) return;
        if (script.dataset) script.dataset.euixAutoInitialized = "true";
        const targetSelector = script.getAttribute("target") || script.dataset?.target || "#app";
        const targetEl = typeof targetSelector === "string" ? document.querySelector(targetSelector) : targetSelector;
        if (targetEl && (targetEl._euixMounted || targetEl.__euixEngine)) return;
        const xml = script.tagName.toLowerCase() === "euix-app" ? script.innerHTML.trim() : script.textContent.trim();
        if (xml) {
            const engine = EngineClass.mount(xml, targetSelector);
            if (engine) {
                engine.enableDevTools(false);
            }
        }
    });

    // 2. Scan declarative [data-euix] elements
    scan(EngineClass, document, options);

    // 3. Register custom element
    registerCustomElement(EngineClass);

    // 4. Setup MutationObserver for dynamic DOM insertions
    setupMutationObserver(EngineClass, options);

    // 5. Expose window.euix
    initGlobalEuix(EngineClass);

    // 6. Launch DevTools if requested
    if ((config.devtools === "true" || config.devtools === "open") && typeof window !== "undefined") {
        if (window.EUIXDevTools && isFn(window.EUIXDevTools.init)) {
            window.EUIXDevTools.init();
        }
    }
}
