/**
 * src/plugins/router/index.js
 * Main EUIX Web Router Plugin and high-level router runtime.
 */

import { BrowserHistory, createHistory, HashHistory, MemoryHistory } from "./core/history.js";
import { createLinkRenderer } from "./core/links.js";
import { createLocation, parseSearchParams } from "./core/location.js";
import { compileRouteBranches, matchRoutes, RouteMatcher } from "./core/matcher.js";
import { NavigationController, RouterError, RouterRedirect } from "./core/navigation.js";
import { createOutletRenderer, createRouteContext } from "./core/outlet.js";
import { createPath, generatePath, matchPath, normalizePath, parsePath, resolvePath } from "./core/utils.js";
import { RouteActionManager } from "./data/action.js";
import { RouteDataCache } from "./data/cache.js";
import { RouteFetcherManager } from "./data/fetcher.js";
import { RouteLoaderManager } from "./data/loader.js";
import { RouteRevalidationManager } from "./data/revalidation.js";

import { NavigationBlockerManager } from "./navigation/blocker.js";
import { RoutePrefetchManager } from "./navigation/prefetch.js";
import { ScrollRestorationManager } from "./navigation/scroll.js";
import { ViewTransitionManager } from "./navigation/transitions.js";
import { getHydrationData, serializeHydrationState } from "./server/hydration.js";
import { createStaticRouter } from "./server/static-router.js";

/**
 * EUIX Router Runtime Instance
 */
export class EUIXRouter {
    constructor({
        routes = [],
        mode = "history",
        base = "/",
        scrollRestoration = true,
        viewTransitions = true,
        hydrationData = null,
        engine = null,
        history = null,
        initialEntries = ["/"],
        initialIndex = 0,
    } = {}) {
        this.engine = engine;
        this.routes = routes;
        this.base = base;
        this.mode = mode;

        // Core subsystems
        this.history = history || createHistory({ mode, base, initialEntries, initialIndex });
        this.matcher = new RouteMatcher(routes);
        this.cache = new RouteDataCache();

        // Data subsystems
        this.loaderManager = new RouteLoaderManager({ cache: this.cache, engine: this.engine });
        this.actionManager = new RouteActionManager();
        this.revalidationManager = new RouteRevalidationManager({
            loaderManager: this.loaderManager,
            cache: this.cache,
        });
        this.fetcherManager = new RouteFetcherManager({ router: this, dataEngine: this._getDataEngine() });

        // Navigation subsystems
        this.blockerManager = new NavigationBlockerManager({ engine: this.engine });
        this.scrollManager = new ScrollRestorationManager({ enabled: scrollRestoration !== false });
        this.transitionManager = new ViewTransitionManager({ enabled: viewTransitions !== false });
        this.prefetchManager = new RoutePrefetchManager({ router: this, engine: this.engine, cache: this.cache });

        // Navigation controller
        this.navigationController = new NavigationController({
            history: this.history,
            matcher: this.matcher,
            dataEngine: this._getDataEngine(),
            blockerManager: this.blockerManager,
            scrollManager: this.scrollManager,
            transitionManager: this.transitionManager,
        });

        // Hydration data seeding
        const initialHydration = hydrationData || getHydrationData();
        if (initialHydration && initialHydration.loaderData) {
            Object.entries(initialHydration.loaderData).forEach(([routeId, data]) => {
                this.cache.set(
                    routeId,
                    initialHydration.location?.pathname || "/",
                    initialHydration.location?.search || "",
                    data,
                );
            });
        }

        // Listen for internal routing changes to update engine state
        this.navigationController.on("route:match", ({ location, matches }) => {
            this._syncToEngineState(location, matches);
        });
        this.navigationController.on("navigation:start", () => {
            this._syncNavigationToEngineState();
        });
        this.navigationController.on("navigation:end", ({ location, matches }) => {
            this._syncToEngineState(location || this.location, matches || this.matches);
        });

        // Route link & outlet renderers
        this.renderOutlet = createOutletRenderer(this.engine, this);
        this.renderLink = createLinkRenderer(this.engine, this);
    }

    _getDataEngine() {
        return {
            loaderManager: this.loaderManager,
            actionManager: this.actionManager,
            revalidationManager: this.revalidationManager,
            resolveMatchesData: async ({ matches, location, signal, formData }) => {
                for (const match of matches) {
                    if (formData && (match.action || match.route.action)) {
                        const actionRes = await this.actionManager.executeAction({
                            match,
                            location,
                            formData,
                            signal,
                            context: this.engine ? this.engine.getState("data") : {},
                        });
                        match.actionData = actionRes;

                        // Revalidate other active loaders after successful action
                        await this.revalidationManager.revalidateMatches({
                            matches,
                            location,
                            signal,
                            actionResult: actionRes,
                            context: this.engine ? this.engine.getState("data") : {},
                        });
                    } else if (match.loader || match.route.loader || match.route.loaderNode) {
                        const data = await this.loaderManager.executeLoader({
                            match,
                            location,
                            signal,
                            context: this.engine ? this.engine.getState("data") : {},
                        });
                        match.data = data;
                    }
                }
            },
        };
    }

    get location() {
        return this.navigationController.location;
    }

    get search() {
        return parseSearchParams(this.location.search);
    }

    get params() {
        const matches = this.matches;
        if (!matches || matches.length === 0) return {};
        return matches[matches.length - 1].params || {};
    }

    get matches() {
        const rawMatches = this.navigationController.matches;
        if (!rawMatches) return [];
        return rawMatches.map((m) => {
            const routeId = m.id || (m.route && m.route.id);
            if (m.data === undefined && routeId) {
                const cachedData = this.cache.get(routeId, this.location.pathname, this.location.search);
                if (cachedData !== undefined) {
                    return { ...m, data: cachedData };
                }
            }
            return m;
        });
    }

    get navigation() {
        return this.navigationController.navigation;
    }

    get state() {
        return this.navigationController.state;
    }

    getRouteData(routeId) {
        const match = this.matches.find((m) => m.id === routeId || (m.route && m.route.id === routeId));
        if (match && match.data !== undefined) return match.data;
        return this.cache.get(routeId, this.location.pathname, this.location.search);
    }

    getRouteActionData(routeId) {
        const match = this.matches.find((m) => m.id === routeId);
        return match ? match.actionData : undefined;
    }

    getPublicContext() {
        return {
            state: this.state,
            location: this.location,
            params: this.params,
            search: this.search,
            matches: this.matches,
            navigation: this.navigation,
            navigate: this.navigate.bind(this),
            back: this.back.bind(this),
            forward: this.forward.bind(this),
            revalidate: this.revalidate.bind(this),
            setSearch: this.setSearch.bind(this),
        };
    }

    _syncToEngineState(location, matches) {
        if (!this.engine) return;

        const leafMatch = matches.length > 0 ? matches[matches.length - 1] : null;
        const routeCtx = leafMatch ? createRouteContext(leafMatch, this) : {};

        // Invalidate and sync reactive states
        this.engine.setState("$router", this.getPublicContext());
        this.engine.setState("$route", routeCtx);
    }

    _syncNavigationToEngineState() {
        if (!this.engine) return;
        this.engine.setState("$router", this.getPublicContext());
    }

    _notifyFetcherUpdate(fetcherId, data) {
        if (!this.engine) return;
        const currentFetchers = this.engine.getState("$fetcher") || {};
        this.engine.setState("$fetcher", {
            ...currentFetchers,
            [fetcherId]: data,
        });
    }

    // Public API
    async initialize() {
        if (this.navigationController && this.location) {
            return this.navigationController.navigate(this.location, { replace: true, fromHistory: true });
        }
    }

    async navigate(to, options = {}) {
        return this.navigationController.navigate(to, options);
    }

    back() {
        this.history.back();
    }

    forward() {
        this.history.forward();
    }

    go(delta) {
        this.history.go(delta);
    }

    reload() {
        return this.navigate(this.location, { replace: true });
    }

    setSearch(paramsObj, { replace = true } = {}) {
        const current = new URLSearchParams(this.location.search);
        Object.entries(paramsObj).forEach(([k, v]) => {
            if (v === null || v === undefined) {
                current.delete(k);
            } else {
                current.set(k, String(v));
            }
        });
        const nextSearch = current.toString();
        return this.navigate(
            {
                pathname: this.location.pathname,
                search: nextSearch ? `?${nextSearch}` : "",
                hash: this.location.hash,
            },
            { replace },
        );
    }

    prefetch(targetPath) {
        return this.prefetchManager.prefetch(targetPath);
    }

    fetcher(id) {
        return this.fetcherManager.getFetcher(id);
    }

    loader(name, fn) {
        this.loaderManager.registerLoader(name, fn);
        if (
            this.matches &&
            this.matches.some((m) => (m.route?.loader === name || m.loader === name) && m.data === undefined)
        ) {
            this.revalidate();
        }
        return this;
    }

    action(name, fn) {
        this.actionManager.registerAction(name, fn);
        return this;
    }

    guard(name, fn) {
        this.navigationController.registerGuard(name, fn);
        return this;
    }

    middleware(name, fn) {
        this.navigationController.registerMiddleware(name, fn);
        return this;
    }

    block(conditionOrFn) {
        return this.blockerManager.addBlocker(conditionOrFn);
    }

    async revalidate(routeId) {
        const signal = new AbortController().signal;
        await this.revalidationManager.revalidateMatches({
            matches: this.matches,
            location: this.location,
            signal,
            routeId,
            context: this.engine ? this.engine.getState("data") : {},
        });
        this._syncToEngineState(this.location, this.matches);
        this.navigationController.emit("route:match", { location: this.location, matches: this.matches });
    }

    shouldRevalidate(name, fn) {
        this.revalidationManager.registerPredicate(name, fn);
        return this;
    }

    path(routeName, params = {}) {
        const pattern = this.matcher.getNamedPath(routeName);
        if (!pattern) {
            throw new Error(`[EUIXRouter] Route name "${routeName}" not found.`);
        }
        return generatePath(pattern, params);
    }

    match(pathname) {
        return this.matcher.match(pathname);
    }

    redirect(to, options) {
        return new RouterRedirect(to, options);
    }

    error(status, messageOrObj) {
        return new RouterError(status, messageOrObj);
    }

    inspect() {
        return {
            location: this.location,
            matches: this.matches,
            navigation: this.navigation,
            state: this.state,
            history: this.history,
            routes: this.routes,
        };
    }

    on(eventType, callback) {
        return this.navigationController.on(eventType, callback);
    }

    destroy() {
        this.history.destroy();
        this.navigationController.destroy();
        this.blockerManager.destroy();
    }
}

/**
 * Creates an in-memory test router.
 */
export function createMemoryRouter({ initialEntries = ["/"], initialIndex = 0, routes = [] } = {}) {
    return new EUIXRouter({
        routes,
        mode: "memory",
        history: new MemoryHistory({ initialEntries, initialIndex }),
    });
}

/**
 * Parses XML route definition nodes into a structured route tree.
 */
export function parseXmlRoutes(xmlNode) {
    const routes = [];
    if (!xmlNode) return routes;

    const children = Array.from(xmlNode.children || xmlNode.childNodes || []).filter((c) => c.nodeType === 1);

    for (const child of children) {
        const tag = (child.tagName || "").toLowerCase();

        if (tag === "route" || tag === "index" || tag === "route-group") {
            const isIndex = tag === "index" || child.hasAttribute("index");
            const isGroup = tag === "route-group";

            const routeDef = {
                id: child.getAttribute("id") || null,
                path: isIndex ? "" : child.getAttribute("path") || "",
                index: isIndex,
                isGroup,
                layout: child.getAttribute("layout") || null,
                component: child.getAttribute("component") || child.getAttribute("src") || null,
                loader: child.getAttribute("loader") || null,
                action: child.getAttribute("action") || null,
                guard: child.getAttribute("guard") || child.getAttribute("guards") || null,
                middleware: child.getAttribute("middleware") || null,
                redirect: child.getAttribute("redirect") || null,
                key: child.getAttribute("key") || null,
                shouldRevalidate:
                    child.getAttribute("should-revalidate") || child.getAttribute("should_revalidate") || null,
                meta: {},
                children: [],
            };

            // Inspect nested children (declarative <loader>, <error>, <pending>, <route-meta>, or nested <route>)
            const subChildren = Array.from(child.children || child.childNodes || []).filter((c) => c.nodeType === 1);
            for (const sub of subChildren) {
                const subTag = (sub.tagName || "").toLowerCase();
                if (subTag === "loader") {
                    routeDef.loaderNode = sub;
                } else if (subTag === "error") {
                    routeDef.errorNode = sub;
                } else if (subTag === "pending") {
                    routeDef.pendingNode = sub;
                } else if (subTag === "route-meta" || subTag === "meta") {
                    const sAttrs = sub.attributes;
                    if (sAttrs) {
                        const saLen = sAttrs.length;
                        for (let saIdx = 0; saIdx < saLen; saIdx++) {
                            const attr = sAttrs[saIdx];
                            routeDef.meta[attr.name] = attr.value;
                        }
                    }
                } else if (subTag === "route" || subTag === "index" || subTag === "route-group") {
                    routeDef.children.push(...parseXmlRoutes(child));
                    break;
                }
            }

            routes.push(routeDef);
        }
    }

    return routes;
}

export const EUIXRouterPlugin = {
    name: "router",
    _registeredLoaders: new Map(),
    _registeredActions: new Map(),
    _registeredGuards: new Map(),
    _registeredMiddleware: new Map(),

    loader(name, fn) {
        EUIXRouterPlugin._registeredLoaders.set(name, fn);
        return EUIXRouterPlugin;
    },
    action(name, fn) {
        EUIXRouterPlugin._registeredActions.set(name, fn);
        return EUIXRouterPlugin;
    },
    guard(name, fn) {
        EUIXRouterPlugin._registeredGuards.set(name, fn);
        return EUIXRouterPlugin;
    },
    middleware(name, fn) {
        EUIXRouterPlugin._registeredMiddleware.set(name, fn);
        return EUIXRouterPlugin;
    },

    install(engineClass) {
        // 1. Tag Processor for <router>
        engineClass.prototype._processRouterTag = function (xmlNode) {
            if (!xmlNode) return;

            const mode = xmlNode.getAttribute("mode") || "history";
            const base = xmlNode.getAttribute("base") || "/";
            const scrollRestoration =
                xmlNode.getAttribute("scroll-restoration") !== "false" &&
                xmlNode.getAttribute("scroll_restoration") !== "false";
            const viewTransitions =
                xmlNode.getAttribute("view-transitions") !== "false" &&
                xmlNode.getAttribute("view_transitions") !== "false";

            const routes = parseXmlRoutes(xmlNode);

            this.initRouter({
                routes,
                mode,
                base,
                scrollRestoration,
                viewTransitions,
            });
        };

        // 2. Programmatic Router Initializer
        engineClass.prototype.initRouter = function (options = {}) {
            if (this.router) {
                this.router.destroy();
            }

            this.router = new EUIXRouter({
                ...options,
                engine: this,
            });

            // Seed pre-registered static loaders/actions/guards/middleware
            EUIXRouterPlugin._registeredLoaders.forEach((fn, name) => this.router.loader(name, fn));
            EUIXRouterPlugin._registeredActions.forEach((fn, name) => this.router.action(name, fn));
            EUIXRouterPlugin._registeredGuards.forEach((fn, name) => this.router.guard(name, fn));
            EUIXRouterPlugin._registeredMiddleware.forEach((fn, name) => this.router.middleware(name, fn));

            // Initialize default router state
            this.setState("$router", this.router.getPublicContext());
            this.setState("$route", {});
            this.setState("$fetcher", {});

            // Trigger initial navigation match
            this.router.navigate(this.router.location, { replace: true, fromHistory: true });

            this.onUnmount(() => {
                if (this.router) {
                    this.router.destroy();
                    this.router = null;
                }
            });

            return this.router;
        };

        // 3. Register Custom XML Layout Components
        // <router>
        const routerComponentHandler = function (xmlNode, context) {
            if (!this.router) {
                this._processRouterTag(xmlNode);
            }
            return this.router ? this.router.renderOutlet(xmlNode, context) : null;
        };
        engineClass.registerComponent("router", routerComponentHandler);

        // <outlet> and <router-outlet>
        const outletHandler = function (xmlNode, context) {
            if (!this.router) return null;
            return this.router.renderOutlet(xmlNode, context);
        };
        engineClass.registerComponent("outlet", outletHandler);
        engineClass.registerComponent("router-outlet", outletHandler);

        // <route-link>
        const linkHandler = function (xmlNode, context) {
            if (!this.router) return null;
            return this.router.renderLink(xmlNode, context);
        };
        engineClass.registerComponent("route-link", linkHandler);

        // <route-form> and <form route-action>
        const formHandler = function (xmlNode, context) {
            if (typeof document === "undefined") return null;

            const formEl = document.createElement("form");
            const baseClass = xmlNode.getAttribute("class") || "";
            if (baseClass) formEl.className = baseClass;

            const actionAttr = xmlNode.getAttribute("action") || "";
            const methodAttr = (xmlNode.getAttribute("method") || "post").toLowerCase();
            formEl.method = methodAttr;
            formEl.action = actionAttr || "#";

            // Render form children
            const fNodes = xmlNode.childNodes;
            if (fNodes) {
                const fLen = fNodes.length;
                for (let i = 0; i < fLen; i++) {
                    const childEl = this.createHTMLElement(fNodes[i], context);
                    if (childEl) formEl.appendChild(childEl);
                }
            }

            formEl.onsubmit = async (e) => {
                e.preventDefault();
                if (!this.router) return;

                const formData = new FormData(formEl);
                const targetAction = actionAttr ? this.interpolate(actionAttr, context) : this.router.location.pathname;

                await this.router.navigate(targetAction, {
                    formData,
                    replace: xmlNode.hasAttribute("replace"),
                });
            };

            return formEl;
        };
        engineClass.registerComponent("route-form", formHandler);

        // <route-fetcher>
        const fetcherComponentHandler = function (xmlNode, context) {
            if (typeof document === "undefined") return null;

            const container = document.createElement("div");
            container.className = "euix-route-fetcher";
            container.style.display = "contents";

            // Render children
            const cNodes = xmlNode.childNodes;
            if (cNodes) {
                const cLen = cNodes.length;
                for (let i = 0; i < cLen; i++) {
                    const childEl = this.createHTMLElement(cNodes[i], context);
                    if (childEl) container.appendChild(childEl);
                }
            }

            return container;
        };
        engineClass.registerComponent("route-fetcher", fetcherComponentHandler);

        // <route-block>
        const blockComponentHandler = function (xmlNode, context) {
            if (!this.router) return null;
            const whenExpr = xmlNode.getAttribute("when") || xmlNode.getAttribute("if");
            const message = xmlNode.getAttribute("message") || "Discard unsaved changes?";

            if (whenExpr) {
                this.router.block(() => {
                    const val = this.interpolate(`{${whenExpr}}`, context);
                    return this.isTruthy(val) ? message : false;
                });
            }

            return document.createComment("euix:route-block");
        };
        engineClass.registerComponent("route-block", blockComponentHandler);

        // 4. Register Declarative Event Actions
        const handleNavigate = async function (actionNode, context) {
            if (!this.router) return false;
            const toRaw =
                actionNode.getAttribute("to") ||
                actionNode.getAttribute("path") ||
                actionNode.getAttribute("href") ||
                "";
            const toNode = this.getChild(actionNode, "to") || this.getChild(actionNode, "path");
            const to = toNode ? this.interpolate(toNode.textContent, context) : this.interpolate(toRaw, context);
            const replace = actionNode.getAttribute("replace") === "true";

            return this.router.navigate(to, { replace });
        };
        engineClass.registerAction("NAVIGATE", handleNavigate);
        engineClass.registerAction("ROUTER_NAVIGATE", handleNavigate);

        const handleRevalidate = async function (actionNode, context) {
            if (!this.router) return false;
            const routeId = actionNode.getAttribute("route") || actionNode.getAttribute("id");
            await this.router.revalidate(routeId);
            return true;
        };
        engineClass.registerAction("REVALIDATE", handleRevalidate);
        engineClass.registerAction("ROUTER_REVALIDATE", handleRevalidate);

        engineClass.registerAction("ROUTER_BACK", function () {
            if (this.router) this.router.back();
            return true;
        });

        engineClass.registerAction("ROUTER_FORWARD", function () {
            if (this.router) this.router.forward();
            return true;
        });

        // 5. Hook into XML Parsing Lifecycle to parse <router>
        const originalInitDataModel = engineClass.prototype.initDataModel;
        if (typeof originalInitDataModel === "function") {
            engineClass.prototype.initDataModel = function (doc, isMainDoc) {
                const res = originalInitDataModel.call(this, doc, isMainDoc);
                const targetDoc = doc || this.xmlDoc;
                if (targetDoc) {
                    const routerTag = targetDoc.querySelector
                        ? targetDoc.querySelector("router")
                        : targetDoc.getElementsByTagName
                          ? targetDoc.getElementsByTagName("router")[0]
                          : null;
                    if (routerTag && typeof this._processRouterTag === "function") {
                        this._processRouterTag(routerTag);
                    }
                }
                return res;
            };
        }
    },
};

export {
    BrowserHistory,
    compileRouteBranches,
    createHistory,
    createLocation,
    createPath,
    createStaticRouter,
    generatePath,
    getHydrationData,
    HashHistory,
    MemoryHistory,
    matchPath,
    matchRoutes,
    normalizePath,
    parsePath,
    parseSearchParams,
    RouteMatcher,
    RouterError,
    RouterRedirect,
    resolvePath,
    serializeHydrationState,
};

export default EUIXRouterPlugin;
