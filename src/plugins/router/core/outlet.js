/**
 * src/plugins/router/core/outlet.js
 * Hierarchical nested <outlet> and <router-outlet> component with layout preservation.
 */

/**
 * Renders an <outlet> at a specific hierarchy depth level.
 * 
 * @param {object} engine - EUIXEngine instance
 * @param {Element} xmlNode - XML node for <outlet> or <router-outlet>
 * @param {object} context - Component execution context
 * @param {number} level - Depth level in the route matches array (default 0 for root outlet)
 * @returns {HTMLElement}
 */
export function createOutletRenderer(engine, routerInstance) {
    return function renderOutlet(xmlNode, context = {}, level = 0) {
        if (typeof document === "undefined") return null;

        const currentLevel = context._routeDepth !== undefined ? context._routeDepth : level;
        const container = document.createElement("div");
        container.className = "euix-router-outlet";
        container.style.display = "contents";

        let currentRenderedMatch = null;
        let currentRenderedKey = null;
        let currentChildEl = null;
        let pendingTimer = null;

        const updateOutletContent = () => {
            const matches = routerInstance.matches || [];
            const match = matches[currentLevel];

            if (!match) {
                // No match for this level, clear container
                if (currentChildEl && currentChildEl.parentNode === container) {
                    container.removeChild(currentChildEl);
                }
                currentRenderedMatch = null;
                currentRenderedKey = null;
                currentChildEl = null;
                return;
            }

            // Determine route key for component identity / remounting
            let routeKey = match.pathname;
            if (match.key) {
                if (match.key.startsWith("params.")) {
                    const pKey = match.key.slice(7);
                    routeKey = match.params[pKey] || match.pathname;
                } else {
                    routeKey = match.params[match.key] || match.pathname;
                }
            }

            // Check if match and key are unchanged: preserve existing layout/DOM
            if (currentRenderedMatch === match.route && currentRenderedKey === routeKey && currentChildEl) {
                return; // Ancestor layout preserved without recreation!
            }

            // Clean up previous child
            if (currentChildEl && currentChildEl.parentNode === container) {
                container.removeChild(currentChildEl);
                currentChildEl = null;
            }

            // Check for error on this match
            if (match.error && (match.route.errorNode || match.route.errorComponent)) {
                const errorContext = {
                    ...context,
                    _routeDepth: currentLevel + 1,
                    $route: createRouteContext(match, routerInstance),
                    $router: routerInstance.getPublicContext()
                };

                let errorEl;
                if (match.route.errorNode) {
                    errorEl = engine.createHTMLElement(match.route.errorNode, errorContext);
                } else if (match.route.errorComponent) {
                    errorEl = engine.renderComponentSpec(match.route.errorComponent, xmlNode, errorContext);
                }

                if (errorEl) {
                    currentChildEl = errorEl;
                    container.appendChild(errorEl);
                    currentRenderedMatch = match.route;
                    currentRenderedKey = routeKey;
                    return;
                }
            }

            // Prepare child context
            const childContext = {
                ...context,
                _routeDepth: currentLevel + 1,
                $route: createRouteContext(match, routerInstance),
                $router: routerInstance.getPublicContext()
            };

            // Render Layout or Component
            let targetSpec = match.layout || match.component || match.route.componentNode;
            let el = null;

            if (targetSpec) {
                if (typeof targetSpec === "string") {
                    const lowerSpec = targetSpec.toLowerCase();
                    const specNode = engine._componentSpecs?.get(targetSpec) || 
                                     engine._componentSpecs?.get(lowerSpec) || 
                                     engine.constructor._globalComponentSpecs?.get(targetSpec) || 
                                     engine.constructor._globalComponentSpecs?.get(lowerSpec);

                    if (specNode) {
                        el = engine.renderComponentSpec(specNode, xmlNode, childContext);
                    } else if (engine._customComponents?.has(lowerSpec) || engine.constructor._globalCustomComponents?.has(lowerSpec)) {
                        const handler = engine._customComponents?.get(lowerSpec) || engine.constructor._globalCustomComponents?.get(lowerSpec);
                        el = handler.call(engine, xmlNode, childContext, engine);
                    } else if (targetSpec.endsWith(".xml") || targetSpec.startsWith("./") || targetSpec.startsWith("/")) {
                        // Async / Lazy XML component loading
                        const placeholder = document.createElement("div");
                        placeholder.className = "euix-outlet-loading";
                        placeholder.style.display = "contents";

                        // Handle <pending delay="150">
                        if (match.route.pendingNode) {
                            const delay = parseInt(match.route.pendingNode.getAttribute("delay") || "0", 10);
                            if (delay > 0) {
                                pendingTimer = setTimeout(() => {
                                    if (placeholder.parentNode === container) {
                                        placeholder.innerHTML = "";
                                        const pendingEl = engine.createHTMLElement(match.route.pendingNode, childContext);
                                        if (pendingEl) placeholder.appendChild(pendingEl);
                                    }
                                }, delay);
                            } else {
                                const pendingEl = engine.createHTMLElement(match.route.pendingNode, childContext);
                                if (pendingEl) placeholder.appendChild(pendingEl);
                            }
                        }

                        el = placeholder;

                        engine.constructor.loadComponent(match.id || targetSpec, targetSpec).then(specDoc => {
                            if (pendingTimer) clearTimeout(pendingTimer);
                            if (specDoc && placeholder.parentNode === container) {
                                const rendered = engine.renderComponentSpec(specDoc, xmlNode, childContext);
                                if (rendered) {
                                    container.replaceChild(rendered, placeholder);
                                    currentChildEl = rendered;
                                }
                            }
                        }).catch(err => {
                            if (pendingTimer) clearTimeout(pendingTimer);
                            console.error(`[EUIXRouter] Failed to load lazy route component (${targetSpec}):`, err);
                        });
                    }
                } else if (targetSpec.nodeType === 1) {
                    // Inline XML node template
                    el = engine.createHTMLElement(targetSpec, childContext);
                }
            }

            if (el) {
                currentChildEl = el;
                container.appendChild(el);
                currentRenderedMatch = match.route;
                currentRenderedKey = routeKey;
            }
        };

        // Initial render
        updateOutletContent();

        // Subscribe to route match updates
        const unlisten = routerInstance.on("route:match", updateOutletContent);
        if (typeof engine.onUnmount === "function") {
            engine.onUnmount(() => {
                if (pendingTimer) clearTimeout(pendingTimer);
                unlisten();
            });
        }

        return container;
    };
}

/**
 * Creates the reactive $route context object for a matched route.
 */
export function createRouteContext(match, routerInstance) {
    const loc = routerInstance.location;
    let routeData = match.data !== undefined ? match.data : routerInstance.getRouteData(match.id);
    if (routeData === undefined && routerInstance.matches) {
        for (let i = routerInstance.matches.length - 1; i >= 0; i--) {
            const m = routerInstance.matches[i];
            const d = m.data !== undefined ? m.data : routerInstance.getRouteData(m.id);
            if (d !== undefined) {
                routeData = d;
                break;
            }
        }
    }

    return {
        id: match.id,
        path: match.route.path || match.pathname,
        pathname: loc.pathname || match.pathname,
        params: match.params || {},
        search: routerInstance.search || {},
        hash: loc.hash || "",
        location: loc,
        data: routeData,
        actionData: match.actionData !== undefined ? match.actionData : (typeof routerInstance.getRouteActionData === "function" ? routerInstance.getRouteActionData(match.id) : undefined),
        error: match.error,
        matches: routerInstance.matches,
        navigation: routerInstance.navigation
    };
}
