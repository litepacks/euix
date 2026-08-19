/**
 * src/plugins/EUIXRouterPlugin.js
 * Web Router Plugin for EUIX Engine.
 * 
 * Provides declarative and programmatic client-side routing, data loaders,
 * route actions, nested outlets with branch layout preservation, View Transitions,
 * scroll restoration, and navigation blocking.
 */

import {
    EUIXRouter,
    RouteMatcher,
    compileRouteBranches,
    parseXmlRoutes,
    RouterRedirect,
    RouterError,
    matchPath,
    matchRoutes,
    generatePath,
    resolvePath,
    createPath,
    parsePath,
    createMemoryRouter,
    createStaticRouter,
    serializeHydrationState,
    getHydrationData,
    createHistory,
    BrowserHistory,
    HashHistory,
    MemoryHistory
} from "./router/index.js";

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
        engineClass.prototype._processRouterTag = function(xmlNode) {
            if (!xmlNode) return;

            const mode = xmlNode.getAttribute("mode") || "history";
            const base = xmlNode.getAttribute("base") || "/";
            const scrollRestoration = xmlNode.getAttribute("scroll-restoration") !== "false" && xmlNode.getAttribute("scroll_restoration") !== "false";
            const viewTransitions = xmlNode.getAttribute("view-transitions") !== "false" && xmlNode.getAttribute("view_transitions") !== "false";

            const routes = parseXmlRoutes(xmlNode);

            this.initRouter({
                routes,
                mode,
                base,
                scrollRestoration,
                viewTransitions
            });
        };

        // 2. Programmatic Router Initializer
        engineClass.prototype.initRouter = function(options = {}) {
            if (this.router) {
                this.router.destroy();
            }

            this.router = new EUIXRouter({
                ...options,
                engine: this
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
        const routerComponentHandler = function(xmlNode, context) {
            if (!this.router) {
                this._processRouterTag(xmlNode);
            }
            return this.router ? this.router.renderOutlet(xmlNode, context) : null;
        };
        engineClass.registerComponent("router", routerComponentHandler);

        // <outlet> and <router-outlet>
        const outletHandler = function(xmlNode, context) {
            if (!this.router) return null;
            return this.router.renderOutlet(xmlNode, context);
        };
        engineClass.registerComponent("outlet", outletHandler);
        engineClass.registerComponent("router-outlet", outletHandler);

        // <route-link>
        const linkHandler = function(xmlNode, context) {
            if (!this.router) return null;
            return this.router.renderLink(xmlNode, context);
        };
        engineClass.registerComponent("route-link", linkHandler);

        // <route-form> and <form route-action>
        const formHandler = function(xmlNode, context) {
            if (typeof document === "undefined") return null;

            const formEl = document.createElement("form");
            const baseClass = xmlNode.getAttribute("class") || "";
            if (baseClass) formEl.className = baseClass;

            const actionAttr = xmlNode.getAttribute("action") || "";
            const methodAttr = (xmlNode.getAttribute("method") || "post").toLowerCase();
            formEl.method = methodAttr;
            formEl.action = actionAttr || "#";

            // Render form children
            Array.from(xmlNode.childNodes).forEach(child => {
                const childEl = this.createHTMLElement(child, context);
                if (childEl) formEl.appendChild(childEl);
            });

            formEl.onsubmit = async (e) => {
                e.preventDefault();
                if (!this.router) return;

                const formData = new FormData(formEl);
                const targetAction = actionAttr ? this.interpolate(actionAttr, context) : this.router.location.pathname;

                await this.router.navigate(targetAction, {
                    formData,
                    replace: xmlNode.hasAttribute("replace")
                });
            };

            return formEl;
        };
        engineClass.registerComponent("route-form", formHandler);

        // <route-fetcher>
        const fetcherComponentHandler = function(xmlNode, context) {
            if (typeof document === "undefined") return null;

            const container = document.createElement("div");
            container.className = "euix-route-fetcher";
            container.style.display = "contents";

            const fetcherId = xmlNode.getAttribute("id") || "default";
            const targetAction = xmlNode.getAttribute("action") || "";
            const method = (xmlNode.getAttribute("method") || "POST").toUpperCase();

            // Render children
            Array.from(xmlNode.childNodes).forEach(child => {
                const childEl = this.createHTMLElement(child, context);
                if (childEl) container.appendChild(childEl);
            });

            return container;
        };
        engineClass.registerComponent("route-fetcher", fetcherComponentHandler);

        // <route-block>
        const blockComponentHandler = function(xmlNode, context) {
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
        // Action: NAVIGATE / ROUTER_NAVIGATE
        engineClass.registerAction("NAVIGATE", async function(actionNode, context) {
            if (!this.router) return false;
            const toRaw = actionNode.getAttribute("to") || actionNode.getAttribute("path") || actionNode.getAttribute("href") || "";
            const toNode = this.getChild(actionNode, "to") || this.getChild(actionNode, "path");
            const to = toNode ? this.interpolate(toNode.textContent, context) : this.interpolate(toRaw, context);
            const replace = actionNode.getAttribute("replace") === "true";

            return this.router.navigate(to, { replace });
        });
        engineClass.registerAction("ROUTER_NAVIGATE", function(actionNode, context) {
            return this.executeAction("NAVIGATE", actionNode, context);
        });

        // Action: REVALIDATE / ROUTER_REVALIDATE
        engineClass.registerAction("REVALIDATE", async function(actionNode, context) {
            if (!this.router) return false;
            const routeId = actionNode.getAttribute("route") || actionNode.getAttribute("id");
            await this.router.revalidate(routeId);
            return true;
        });
        engineClass.registerAction("ROUTER_REVALIDATE", function(actionNode, context) {
            return this.executeAction("REVALIDATE", actionNode, context);
        });

        // Action: ROUTER_BACK
        engineClass.registerAction("ROUTER_BACK", function() {
            if (this.router) this.router.back();
            return true;
        });

        // Action: ROUTER_FORWARD
        engineClass.registerAction("ROUTER_FORWARD", function() {
            if (this.router) this.router.forward();
            return true;
        });

        // 5. Hook into XML Parsing Lifecycle to parse <router>
        const originalInitDataModel = engineClass.prototype.initDataModel;
        if (typeof originalInitDataModel === "function") {
            engineClass.prototype.initDataModel = function(doc, isMainDoc) {
                const res = originalInitDataModel.call(this, doc, isMainDoc);
                const targetDoc = doc || this.xmlDoc;
                if (targetDoc) {
                    const routerTag = targetDoc.querySelector ? targetDoc.querySelector("router") : (targetDoc.getElementsByTagName ? targetDoc.getElementsByTagName("router")[0] : null);
                    if (routerTag && typeof this._processRouterTag === "function") {
                        this._processRouterTag(routerTag);
                    }
                }
                return res;
            };
        }
    }
};

export {
    EUIXRouter,
    RouteMatcher,
    compileRouteBranches,
    parseXmlRoutes,
    RouterRedirect,
    RouterError,
    matchPath,
    matchRoutes,
    generatePath,
    resolvePath,
    createPath,
    parsePath,
    createMemoryRouter,
    createStaticRouter,
    serializeHydrationState,
    getHydrationData,
    createHistory,
    BrowserHistory,
    HashHistory,
    MemoryHistory
};

export default EUIXRouterPlugin;
