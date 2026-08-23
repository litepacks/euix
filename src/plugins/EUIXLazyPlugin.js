/**
 * src/plugins/EUIXLazyPlugin.js
 * EUIX XML Component & Route Lazy Loading Plugin.
 *
 * Provides declarative on-demand asynchronous loading for modular XML components
 * (<import lazy="true" />) and Web Router routes (<route lazy_src="..." />).
 */

export function EUIXLazyPlugin(EngineClass) {
    if (!EngineClass._lazyRegistry) {
        EngineClass._lazyRegistry = new Map();
    }
    if (!EngineClass._lazyPromises) {
        EngineClass._lazyPromises = new Map();
    }

    // Static registration API
    EngineClass.registerLazyComponent = (name, src, options) => {
        const key = (name || "").toLowerCase();
        const fallback = typeof options === "string" ? options : options?.fallback || null;
        const observer = typeof options === "object" ? Boolean(options?.observer || options?.viewport) : false;
        const rootMargin = typeof options === "object" ? options?.rootMargin || "200px" : "200px";

        EngineClass._lazyRegistry.set(key, {
            name: key,
            src,
            fallback,
            observer,
            rootMargin,
            loaded: false,
        });
    };

    // Static load API with caching & deduplication
    EngineClass.loadLazyComponent = async (name, options = {}) => {
        const key = (name || "").toLowerCase();
        const entry = EngineClass._lazyRegistry.get(key);
        if (!entry) return null;

        if (entry.loaded && EngineClass._globalComponentSpecs && EngineClass._globalComponentSpecs.has(key)) {
            return EngineClass._globalComponentSpecs.get(key);
        }

        if (EngineClass._lazyPromises.has(key)) {
            return EngineClass._lazyPromises.get(key);
        }

        const fetchPromise = (async () => {
            try {
                const loadedSpec = await EngineClass.loadComponent(key, entry.src, options);
                entry.loaded = true;
                return loadedSpec;
            } catch (err) {
                console.error(`[EUIXLazyPlugin] Error loading lazy component '${key}' from '${entry.src}':`, err);
                throw err;
            } finally {
                EngineClass._lazyPromises.delete(key);
            }
        })();

        EngineClass._lazyPromises.set(key, fetchPromise);
        return fetchPromise;
    };

    // Instance methods
    EngineClass.prototype.registerLazyComponent = (name, src, options) => {
        EngineClass.registerLazyComponent(name, src, options);
    };

    EngineClass.prototype.loadLazyComponent = async (name) => EngineClass.loadLazyComponent(name);

    // Intercept createHTMLElement to handle lazy component placeholders & hydration
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
                placeholder.className = "euix-lazy-placeholder animate-pulse";
                placeholder.setAttribute("data-euix-lazy-component", targetKey);

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

                // Trigger load and hydration function
                const triggerLoadAndHydrate = () => {
                    EngineClass.loadLazyComponent(targetKey)
                        .then(() => {
                            const specNode =
                                (this._componentSpecs && this._componentSpecs.get(targetKey)) ||
                                (EngineClass._globalComponentSpecs && EngineClass._globalComponentSpecs.get(targetKey));
                            if (specNode && placeholder.parentNode) {
                                const realDom = this.renderComponentSpec(specNode, xmlNode, context);
                                if (realDom) {
                                    this.applyRef(realDom, xmlNode, context);
                                    placeholder.replaceWith(realDom);
                                    if (typeof this.syncAllBindings === "function") {
                                        this.syncAllBindings();
                                    }
                                    if (window.lucide && typeof window.lucide.createIcons === "function") {
                                        window.lucide.createIcons();
                                    }
                                }
                            }
                        })
                        .catch((err) => {
                            placeholder.innerHTML = `<div class="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl font-mono">Failed to load ${targetKey}: ${err.message}</div>`;
                        });
                };

                // Use IntersectionObserver if requested or viewport lazy loading is supported
                const useObserver = (entry.observer || entry.viewport) && typeof window !== "undefined" && typeof window.IntersectionObserver === "function";

                if (useObserver) {
                    let hasTriggered = false;
                    const io = new window.IntersectionObserver((entries) => {
                        for (const ioEntry of entries) {
                            if (ioEntry.isIntersecting && !hasTriggered) {
                                hasTriggered = true;
                                io.unobserve(placeholder);
                                io.disconnect();
                                triggerLoadAndHydrate();
                                break;
                            }
                        }
                    }, { rootMargin: entry.rootMargin || "200px" });

                    queueMicrotask(() => {
                        if (placeholder.isConnected || placeholder.parentNode) {
                            io.observe(placeholder);
                        } else {
                            triggerLoadAndHydrate();
                        }
                    });
                } else {
                    triggerLoadAndHydrate();
                }

                return placeholder;
            }
        }

        return originalCreateHTMLElement.call(this, xmlNode, context);
    };
}

EUIXLazyPlugin.install = EUIXLazyPlugin;

export default EUIXLazyPlugin;
