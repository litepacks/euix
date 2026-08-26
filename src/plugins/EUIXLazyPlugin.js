/**
 * src/plugins/EUIXLazyPlugin.js
 * EUIX XML Component & Route Lazy Loading Plugin.
 *
 * Provides declarative on-demand asynchronous loading for modular XML components
 * (<import lazy="true" />) and Web Router routes (<route lazy_src="..." />).
 *
 * Comprehensive Edge-Case Protection:
 * - Circular Import Cycle Detection (CIRCULAR_LAZY_DEPENDENCY)
 * - Multi-Instance Concurrent Hydration on Same Page
 * - Slot / Projected Children & Attribute Preservation
 * - Hidden Container Visibility Re-check (Tab/Accordion/Intersection Mutation)
 * - Predictive Preloading (Hover, Focus, requestIdleCallback, Network Awareness)
 * - Zero CLS Layout Reservation (min_height, aspect_ratio, placeholder styling)
 * - AbortController & Detached DOM Lifecycle Cleanup
 * - Interactive Error Fallback with Retry Button & Auto-Retry with Exponential Backoff
 * - DevTools Telemetry Metrics Tracking
 */

function isSaveDataOrSlowNetwork() {
    if (typeof navigator === "undefined") return false;
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    if (!conn) return false;
    if (conn.saveData) return true;
    if (conn.effectiveType === "slow-2g" || conn.effectiveType === "2g") return true;
    return false;
}

export function EUIXLazyPlugin(EngineClass) {
    if (!EngineClass._lazyRegistry) {
        EngineClass._lazyRegistry = new Map();
    }
    if (!EngineClass._lazyPromises) {
        EngineClass._lazyPromises = new Map();
    }
    if (!EngineClass._loadingStack) {
        EngineClass._loadingStack = new Set();
    }
    if (!EngineClass._lazyActivePlaceholders) {
        EngineClass._lazyActivePlaceholders = new Map(); // componentName -> Set<PlaceholderHydrateFn>
    }

    // Static registration API
    EngineClass.registerLazyComponent = (name, src, options = {}) => {
        const key = (name || "").toLowerCase();
        const fallback = typeof options === "string" ? options : options?.fallback || null;
        const preload = options?.preload || (options?.hover ? "hover" : options?.idle ? "idle" : null);
        const observer = typeof options === "object" ? Boolean(options?.observer || options?.viewport) : false;
        const rootMargin =
            typeof options === "object" ? options?.rootMargin || options?.root_margin || "200px" : "200px";
        const minHeight = options?.minHeight || options?.min_height || null;
        const aspectRatio = options?.aspectRatio || options?.aspect_ratio || null;
        const placeholderClass = options?.placeholderClass || options?.placeholder_class || null;
        const retries =
            typeof options?.retries === "number" ? options.retries : Number.parseInt(options?.retries || 0, 10) || 0;
        const retryDelay =
            typeof options?.retryDelay === "number"
                ? options.retryDelay
                : Number.parseInt(options?.retryDelay || options?.retry_delay || 500, 10) || 500;

        EngineClass._lazyRegistry.set(key, {
            name: key,
            src,
            fallback,
            preload,
            observer: preload === "hover" || preload === "idle" ? false : observer,
            rootMargin,
            minHeight,
            aspectRatio,
            placeholderClass,
            retries,
            retryDelay,
            loaded: false,
        });

        // Setup idle preloading if specified and network conditions permit
        if (preload === "idle" && !isSaveDataOrSlowNetwork() && typeof window !== "undefined") {
            const scheduleIdle = window.requestIdleCallback || ((cb) => setTimeout(cb, 1200));
            scheduleIdle(() => {
                EngineClass.preloadLazyComponent(key, { trigger: "idle" });
            });
        }
    };

    // Static Preload API
    EngineClass.preloadLazyComponent = async (name, options = {}) => {
        const key = (name || "").toLowerCase();
        if (isSaveDataOrSlowNetwork() && options.trigger === "idle") {
            return null; // Skip speculative preloading on slow/metered connection
        }
        return EngineClass.loadLazyComponent(key, { ...options, trigger: options.trigger || "preload" });
    };

    // Static load API with circular check, caching, retries, deduplication & DevTools metrics
    EngineClass.loadLazyComponent = async (name, options = {}) => {
        const key = (name || "").toLowerCase();
        const entry = EngineClass._lazyRegistry.get(key);
        if (!entry) return null;

        const parentStack = options.parentStack || entry.parentStack || [];

        // Circular lazy import deadlock detection in ancestor parent stack
        if (parentStack.includes(key)) {
            const cyclePath = [...parentStack, key].join(" -> ");
            const cycleErr = new Error(
                `[EUIXLazyPlugin] CIRCULAR_LAZY_DEPENDENCY: Circular lazy component import cycle detected: ${cyclePath}`,
            );
            cycleErr.code = "CIRCULAR_LAZY_DEPENDENCY";
            throw cycleErr;
        }

        if (entry.loaded && EngineClass._globalComponentSpecs && EngineClass._globalComponentSpecs.has(key)) {
            return EngineClass._globalComponentSpecs.get(key);
        }

        if (EngineClass._lazyPromises.has(key)) {
            return EngineClass._lazyPromises.get(key);
        }

        const maxRetries = typeof options.retries === "number" ? options.retries : entry.retries || 0;
        const retryDelay = typeof options.retryDelay === "number" ? options.retryDelay : entry.retryDelay || 500;
        const triggerType = options.trigger || (entry.preload ? entry.preload : entry.observer ? "viewport" : "eager");
        const startTime = Date.now();
        const currentStack = [...parentStack, key];

        EngineClass._loadingStack.add(key);

        const isForeground = triggerType !== "idle";

        const fetchPromise = (async () => {
            if (typeof window !== "undefined" && isForeground) {
                if (typeof EngineClass.updateDevToolsStatus === "function") {
                    EngineClass.updateDevToolsStatus(EngineClass, "pendingLoaders", 1);
                } else if (window.__EUIX_DEVTOOLS__) {
                    window.__EUIX_DEVTOOLS__.pendingLoaders = (window.__EUIX_DEVTOOLS__.pendingLoaders || 0) + 1;
                }
                if (window.__EUIX_DEVTOOLS__) {
                    if (!window.__EUIX_DEVTOOLS__.metrics) {
                        window.__EUIX_DEVTOOLS__.metrics = {};
                    }
                    if (!window.__EUIX_DEVTOOLS__.metrics.lazyLoads) {
                        window.__EUIX_DEVTOOLS__.metrics.lazyLoads = [];
                    }
                }
            }

            let lastError = null;
            let loadedSpec = null;

            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    if (attempt > 0) {
                        const backoff = retryDelay * 1.5 ** (attempt - 1);
                        await new Promise((r) => setTimeout(r, backoff));
                    }
                    loadedSpec = await EngineClass.loadComponent(key, entry.src, {
                        ...options,
                        parentStack: currentStack,
                    });
                    if (!loadedSpec) {
                        throw new Error(`Failed to load component '${key}' from '${entry.src}'`);
                    }
                    entry.loaded = true;
                    lastError = null;
                    break;
                } catch (err) {
                    lastError = err;
                    if (err.code === "CIRCULAR_LAZY_DEPENDENCY" || err.message?.includes("CIRCULAR_LAZY_DEPENDENCY")) {
                        break;
                    }
                    if (attempt < maxRetries) {
                        console.warn(`[EUIXLazyPlugin] Retry ${attempt + 1}/${maxRetries} for '${key}'...`);
                    }
                }
            }

            const duration = Date.now() - startTime;

            // Record DevTools metrics
            if (
                typeof window !== "undefined" &&
                window.__EUIX_DEVTOOLS__ &&
                window.__EUIX_DEVTOOLS__.metrics?.lazyLoads
            ) {
                window.__EUIX_DEVTOOLS__.metrics.lazyLoads.push({
                    name: key,
                    src: entry.src,
                    trigger: triggerType,
                    duration,
                    timestamp: Date.now(),
                    success: !lastError,
                    error: lastError ? lastError.message : null,
                });
            }

            if (lastError) {
                console.error(`[EUIXLazyPlugin] Error loading lazy component '${key}' from '${entry.src}':`, lastError);
                throw lastError;
            }

            // Broadcast to all active waiting placeholders of this component
            const subscribers = EngineClass._lazyActivePlaceholders.get(key);
            if (subscribers && subscribers.size > 0) {
                for (const hydrateFn of subscribers) {
                    try {
                        hydrateFn();
                    } catch (e) {
                        console.error(`[EUIXLazyPlugin] Hydration error for '${key}':`, e);
                    }
                }
            }

            return loadedSpec;
        })().finally(() => {
            EngineClass._loadingStack.delete(key);
            if (typeof window !== "undefined" && isForeground) {
                if (typeof EngineClass.updateDevToolsStatus === "function") {
                    EngineClass.updateDevToolsStatus(EngineClass, "pendingLoaders", -1);
                } else if (window.__EUIX_DEVTOOLS__) {
                    window.__EUIX_DEVTOOLS__.pendingLoaders = Math.max(
                        0,
                        (window.__EUIX_DEVTOOLS__.pendingLoaders || 0) - 1,
                    );
                    window.__EUIX_DEVTOOLS__.ready =
                        (window.__EUIX_DEVTOOLS__.pendingActions || 0) === 0 &&
                        window.__EUIX_DEVTOOLS__.pendingLoaders === 0 &&
                        (window.__EUIX_DEVTOOLS__.pendingRevalidations || 0) === 0 &&
                        !window.__EUIX_DEVTOOLS__.routeTransition;
                }
            }
            EngineClass._lazyPromises.delete(key);
        });

        EngineClass._lazyPromises.set(key, fetchPromise);
        return fetchPromise;
    };

    // Instance methods
    EngineClass.prototype.registerLazyComponent = (name, src, options) => {
        EngineClass.registerLazyComponent(name, src, options);
    };

    EngineClass.prototype.preloadLazyComponent = async (name, options) => {
        return EngineClass.preloadLazyComponent(name, options);
    };

    EngineClass.prototype.loadLazyComponent = async (name, options) => {
        return EngineClass.loadLazyComponent(name, options);
    };

    // Intercept createHTMLElement to handle lazy component placeholders, CLS, abort controllers & hydration
    const originalCreateHTMLElement = EngineClass.prototype.createHTMLElement;
    EngineClass.prototype.createHTMLElement = function (xmlNode, context = {}) {
        if (!xmlNode || xmlNode.nodeType !== 1) {
            return originalCreateHTMLElement.call(this, xmlNode, context);
        }

        const tagName = (xmlNode.tagName || "").toLowerCase();
        const nameAttr = (xmlNode.getAttribute("name") || "").toLowerCase();
        const targetKey = EngineClass._lazyRegistry.has(tagName)
            ? tagName
            : EngineClass._lazyRegistry.has(nameAttr)
              ? nameAttr
              : null;

        // Check if this tag is a registered lazy component and NOT yet loaded
        if (targetKey && EngineClass._lazyRegistry.has(targetKey)) {
            const isLoaded =
                (this._componentSpecs && this._componentSpecs.has(targetKey)) ||
                (EngineClass._globalComponentSpecs && EngineClass._globalComponentSpecs.has(targetKey));

            if (!isLoaded) {
                const entry = EngineClass._lazyRegistry.get(targetKey);
                const placeholder = document.createElement("div");
                placeholder.className = `euix-lazy-placeholder ${entry.placeholderClass || "animate-pulse"}`;
                placeholder.setAttribute("data-euix-lazy-component", targetKey);

                // CLS Layout Reservation
                const minHeight =
                    xmlNode.getAttribute("min_height") || xmlNode.getAttribute("minHeight") || entry.minHeight;
                const aspectRatio =
                    xmlNode.getAttribute("aspect_ratio") || xmlNode.getAttribute("aspectRatio") || entry.aspectRatio;
                if (minHeight) {
                    placeholder.style.minHeight = minHeight;
                }
                if (aspectRatio) {
                    placeholder.style.aspectRatio = aspectRatio;
                }

                // If a fallback component is specified, render it
                if (entry.fallback) {
                    const fallbackKey = entry.fallback.toLowerCase();
                    const fallbackSpec =
                        (this._componentSpecs && this._componentSpecs.get(fallbackKey)) ||
                        (EngineClass._globalComponentSpecs && EngineClass._globalComponentSpecs.get(fallbackKey));
                    if (fallbackSpec) {
                        const fallbackDom = this.renderComponentSpec(fallbackSpec, xmlNode, context);
                        if (fallbackDom) placeholder.appendChild(fallbackDom);
                    } else {
                        placeholder.innerHTML = `<div class="p-6 text-center text-xs text-slate-400 font-mono">Loading ${targetKey}...</div>`;
                    }
                } else {
                    placeholder.innerHTML = `<div class="p-6 text-center text-xs text-slate-500 font-mono">Loading ${targetKey}...</div>`;
                }

                // AbortController for detached unmount cleanup
                const abortController = new AbortController();
                let ioRef = null;

                // Cleanup subscriber & observer helper
                const cleanup = () => {
                    const subs = EngineClass._lazyActivePlaceholders.get(targetKey);
                    if (subs) {
                        subs.delete(performHydration);
                        if (subs.size === 0) EngineClass._lazyActivePlaceholders.delete(targetKey);
                    }
                    if (ioRef) {
                        try {
                            ioRef.unobserve(placeholder);
                            ioRef.disconnect();
                        } catch (_) {}
                        ioRef = null;
                    }
                };

                // Actual DOM replacement / hydration routine
                const performHydration = () => {
                    if (abortController.signal.aborted) return;

                    const specNode =
                        (this._componentSpecs && this._componentSpecs.get(targetKey)) ||
                        (EngineClass._globalComponentSpecs && EngineClass._globalComponentSpecs.get(targetKey));

                    if (!specNode) return;

                    if (!placeholder.parentNode && !placeholder.isConnected) {
                        // Placeholder is not yet attached to DOM parent; defer hydration to microtask
                        queueMicrotask(() => {
                            if (
                                !abortController.signal.aborted &&
                                (placeholder.parentNode || placeholder.isConnected)
                            ) {
                                performHydration();
                            }
                        });
                        return;
                    }

                    cleanup();
                    const realDom = this.renderComponentSpec(specNode, xmlNode, context);
                    if (realDom && placeholder.parentNode) {
                        this.applyRef(realDom, xmlNode, context);

                        // Smooth enter transition
                        realDom.classList.add("euix-lazy-enter");
                        placeholder.replaceWith(realDom);

                        if (typeof this.syncAllBindings === "function") {
                            this.syncAllBindings();
                        }
                        if (window.lucide && typeof window.lucide.createIcons === "function") {
                            window.lucide.createIcons();
                        }
                    }
                };

                // Register placeholder hydration subscriber for multi-instance sync
                if (!EngineClass._lazyActivePlaceholders.has(targetKey)) {
                    EngineClass._lazyActivePlaceholders.set(targetKey, new Set());
                }
                EngineClass._lazyActivePlaceholders.get(targetKey).add(performHydration);

                // Trigger load and hydration function with interactive retry support
                const triggerLoadAndHydrate = (trigger = "viewport") => {
                    if (abortController.signal.aborted) return;

                    EngineClass.loadLazyComponent(targetKey, { trigger })
                        .then(() => {
                            performHydration();
                        })
                        .catch((err) => {
                            if (abortController.signal.aborted) return;
                            if (!placeholder.isConnected && !placeholder.parentNode) return;

                            // Interactive Retry UI
                            placeholder.className = "euix-lazy-placeholder euix-lazy-error";
                            placeholder.innerHTML = `
                                <div class="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-mono flex items-center justify-between gap-3">
                                    <span>Failed to load ${targetKey}: ${err.message}</span>
                                    <button type="button" class="euix-lazy-retry-btn px-2.5 py-1 bg-rose-500 hover:bg-rose-600 text-white rounded font-sans font-medium text-xs transition cursor-pointer">Retry</button>
                                </div>
                            `;
                            const retryBtn = placeholder.querySelector(".euix-lazy-retry-btn");
                            if (retryBtn) {
                                retryBtn.onclick = (e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    placeholder.className = `euix-lazy-placeholder ${entry.placeholderClass || "animate-pulse"}`;
                                    placeholder.innerHTML = `<div class="p-6 text-center text-xs text-slate-500 font-mono">Retrying ${targetKey}...</div>`;
                                    triggerLoadAndHydrate("retry");
                                };
                            }
                        });
                };

                // Hover / Focus Preloading Listeners
                if (entry.preload === "hover") {
                    const handleHover = () => {
                        placeholder.removeEventListener("mouseenter", handleHover);
                        placeholder.removeEventListener("focusin", handleHover);
                        triggerLoadAndHydrate("hover");
                    };
                    placeholder.addEventListener("mouseenter", handleHover, { once: true });
                    placeholder.addEventListener("focusin", handleHover, { once: true });
                }

                // IntersectionObserver for viewport lazy loading
                const useObserver =
                    (entry.observer || entry.viewport) &&
                    entry.preload !== "hover" &&
                    typeof window !== "undefined" &&
                    typeof window.IntersectionObserver === "function";

                if (useObserver) {
                    let hasTriggered = false;
                    const io = new window.IntersectionObserver(
                        (entries) => {
                            for (const ioEntry of entries) {
                                if (ioEntry.isIntersecting && !hasTriggered) {
                                    hasTriggered = true;
                                    cleanup();
                                    triggerLoadAndHydrate("viewport");
                                    break;
                                }
                            }
                        },
                        { rootMargin: entry.rootMargin || "200px" },
                    );
                    ioRef = io;

                    queueMicrotask(() => {
                        if (placeholder.isConnected || placeholder.parentNode) {
                            io.observe(placeholder);
                        } else {
                            triggerLoadAndHydrate("immediate");
                        }
                    });
                } else if (entry.preload !== "hover") {
                    queueMicrotask(() => {
                        triggerLoadAndHydrate("immediate");
                    });
                }

                return placeholder;
            }
        }

        return originalCreateHTMLElement.call(this, xmlNode, context);
    };
}

EUIXLazyPlugin.install = EUIXLazyPlugin;

export default EUIXLazyPlugin;
