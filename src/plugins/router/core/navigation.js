/**
 * src/plugins/router/core/navigation.js
 * Navigation lifecycle coordinator, AbortController manager, and state machine.
 */

import { parsePath, createPath, normalizePath, resolvePath } from "./utils.js";
import { createLocation } from "./location.js";

/**
 * Custom Navigation Error / Redirect Carrier
 */
export class RouterRedirect {
    constructor(to, { status = 302, replace = true, revalidate = true } = {}) {
        this.to = to;
        this.status = status;
        this.replace = replace;
        this.revalidate = revalidate;
        this.isRedirect = true;
    }
}

export class RouterError extends Error {
    constructor(status, messageOrObj) {
        const msg = typeof messageOrObj === "string" ? messageOrObj : (messageOrObj?.message || `Router Error ${status}`);
        super(msg);
        this.status = status;
        this.data = typeof messageOrObj === "object" ? messageOrObj : { message: msg };
        this.isRouterError = true;
    }
}

/**
 * Navigation Coordinator
 */
export class NavigationController extends EventTarget {
    constructor({ history, matcher, dataEngine, blockerManager, scrollManager, transitionManager } = {}) {
        super();
        this.history = history;
        this.matcher = matcher;
        this.dataEngine = dataEngine || null;
        this.blockerManager = blockerManager || null;
        this.scrollManager = scrollManager || null;
        this.transitionManager = transitionManager || null;

        this._navigationId = 0;
        this._currentAbortController = null;

        this.state = "idle"; // 'idle' | 'loading' | 'submitting'
        this.location = this.history ? this.history.location : createLocation("/");
        this.matches = this.matcher ? (this.matcher.match(this.location.pathname) || []) : [];
        this.navigation = {
            state: "idle",
            location: null,
            formData: null
        };

        this._registeredGuards = new Map();
        this._registeredMiddleware = new Map();
        this._unlistenHistory = null;

        if (this.history) {
            this._unlistenHistory = this.history.listen(this._handleHistoryChange.bind(this));
        }
    }

    on(eventType, callback) {
        const listener = (event) => callback(event.detail);
        this.addEventListener(eventType, listener);
        return () => this.removeEventListener(eventType, listener);
    }

    emit(eventType, detail = {}) {
        this.dispatchEvent(new CustomEvent(eventType, { detail }));
    }

    registerGuard(name, fn) {
        this._registeredGuards.set(name, fn);
    }

    registerMiddleware(name, fn) {
        this._registeredMiddleware.set(name, fn);
    }

    async _handleHistoryChange({ location, action }) {
        if (action === "POP") {
            await this.navigate(location, { replace: true, fromHistory: true, historyAction: action });
        }
    }

    /**
     * Imperative navigation method.
     * 
     * @param {string|object} to 
     * @param {{ replace?: boolean, state?: any, formData?: FormData, preserveScroll?: boolean, fromHistory?: boolean, viewTransition?: boolean }} options 
     */
    async navigate(to, options = {}) {
        const nextLoc = createLocation(this.location, to, options.state);
        const nextUrl = createPath(nextLoc);

        // 1. Navigation Blocker Check
        if (this.blockerManager && !options.fromHistory) {
            const blocked = await this.blockerManager.shouldBlock({
                currentLocation: this.location,
                nextLocation: nextLoc,
                historyAction: options.replace ? "REPLACE" : "PUSH"
            });
            if (blocked) return false;
        }

        // 2. Match Routes
        const matches = this.matcher.match(nextLoc.pathname);
        if (!matches) {
            console.warn(`[EUIXRouter] No route matched for pathname: "${nextLoc.pathname}"`);
        }

        // 3. Abort previous in-flight navigation (Latest-Navigation-Wins)
        if (this._currentAbortController) {
            this._currentAbortController.abort();
        }
        const navigationId = ++this._navigationId;
        const abortController = new AbortController();
        this._currentAbortController = abortController;
        const signal = abortController.signal;

        this.state = options.formData ? "submitting" : "loading";
        this.navigation = {
            state: this.state,
            location: nextLoc,
            formData: options.formData || null
        };
        this.emit("navigation:start", { location: nextLoc, matches, navigationId });

        try {
            // 4. Run Composable Middleware Pipeline (Onion Model: parent -> child)
            if (matches && matches.length > 0) {
                const middlewareFns = [];
                for (const match of matches) {
                    if (match.middleware) {
                        const mList = String(match.middleware).split(",").map(s => s.trim()).filter(Boolean);
                        for (const mName of mList) {
                            const mFn = this._registeredMiddleware.get(mName);
                            if (mFn) {
                                middlewareFns.push((ctx, next) => mFn({
                                    ...ctx,
                                    params: match.params,
                                    route: match.route
                                }, next));
                            }
                        }
                    }
                }

                if (middlewareFns.length > 0) {
                    let mIndex = -1;
                    const dispatch = async (i) => {
                        if (signal.aborted || this._navigationId !== navigationId) return false;
                        if (i <= mIndex) throw new Error("[EUIXRouter] next() called multiple times");
                        mIndex = i;
                        const fn = middlewareFns[i];
                        if (i === middlewareFns.length) return Promise.resolve();
                        if (!fn) return Promise.resolve();
                        return fn({ location: nextLoc, signal }, () => dispatch(i + 1));
                    };

                    const mRes = await dispatch(0);
                    if (mRes instanceof RouterRedirect) {
                        return this.navigate(mRes.to, { replace: mRes.replace });
                    }
                }
            }

            // 5. Run Route Guards
            if (matches && matches.length > 0) {
                for (const match of matches) {
                    if (signal.aborted || this._navigationId !== navigationId) return false;
                    if (match.guard) {
                        const gList = String(match.guard).split(",").map(s => s.trim()).filter(Boolean);
                        for (const gName of gList) {
                            const gFn = this._registeredGuards.get(gName);
                            if (gFn) {
                                const gRes = await gFn({
                                    location: nextLoc,
                                    params: match.params,
                                    route: match.route,
                                    signal,
                                    context: this.context || {}
                                });

                                if (gRes instanceof RouterRedirect) {
                                    return this.navigate(gRes.to, { replace: gRes.replace });
                                }
                                if (gRes === false) {
                                    this._resetNavigationState();
                                    return false;
                                }
                            }
                        }
                    }
                }
            }

            // 6. Redirect Route Attribute
            if (matches && matches.length > 0) {
                const leaf = matches[matches.length - 1];
                if (leaf.redirect) {
                    let targetRedirect = leaf.redirect;
                    // Interpolate params into dynamic redirect if needed
                    Object.keys(leaf.params).forEach(k => {
                        targetRedirect = targetRedirect.replace(`:${k}`, leaf.params[k]);
                    });
                    return this.navigate(targetRedirect, { replace: true });
                }
            }

            // 7. Execute Data Loaders / Actions if Data Engine is active
            if (this.dataEngine && matches && matches.length > 0) {
                this.emit("loader:start", { location: nextLoc, matches });
                try {
                    await this.dataEngine.resolveMatchesData({
                        matches,
                        location: nextLoc,
                        signal,
                        formData: options.formData
                    });
                    this.emit("loader:end", { location: nextLoc, matches });
                } catch (dataErr) {
                    if (dataErr instanceof RouterRedirect) {
                        return this.navigate(dataErr.to, { replace: dataErr.replace });
                    }
                    // Find closest error boundary in match hierarchy
                    this._attachErrorToMatches(matches, dataErr);
                    this.emit("error", { error: dataErr, location: nextLoc });
                }
            }

            // Check if superseded
            if (signal.aborted || this._navigationId !== navigationId) {
                return false;
            }

            // 8. Update History if not triggered by popstate
            if (!options.fromHistory && this.history) {
                if (options.replace) {
                    this.history.replace(nextUrl, nextLoc.state);
                } else {
                    this.history.push(nextUrl, nextLoc.state);
                }
            }

            // 9. Update View Transitions & Outlets
            const updateDOM = () => {
                this.location = nextLoc;
                this.matches = matches || [];
                this.emit("route:match", { location: nextLoc, matches: this.matches });
            };

            if (this.transitionManager && options.viewTransition !== false) {
                await this.transitionManager.runTransition(updateDOM);
            } else {
                updateDOM();
            }

            // 10. Scroll Restoration / Scroll Reset
            if (this.scrollManager) {
                this.scrollManager.handleNavigation({
                    location: nextLoc,
                    preserveScroll: options.preserveScroll,
                    isPop: options.fromHistory && options.historyAction === "POP"
                });
            }

            this._resetNavigationState();
            this.emit("navigation:end", { location: nextLoc, matches: this.matches, navigationId });
            return true;

        } catch (err) {
            if (signal.aborted || this._navigationId !== navigationId) {
                return false;
            }
            if (err instanceof RouterRedirect) {
                return this.navigate(err.to, { replace: err.replace });
            }

            console.error("[EUIXRouter] Unhandled Navigation Error:", err);
            this.emit("error", { error: err, location: nextLoc });
            this._resetNavigationState();
            return false;
        }
    }

    _attachErrorToMatches(matches, err) {
        let attached = false;
        for (let i = matches.length - 1; i >= 0; i--) {
            const m = matches[i];
            if (m.route.error || m.route.errorComponent || i === 0) {
                m.error = err instanceof RouterError ? err : new RouterError(500, err.message || err);
                attached = true;
                break;
            }
        }
        if (!attached && matches.length > 0) {
            matches[0].error = err instanceof RouterError ? err : new RouterError(500, err.message || err);
        }
    }

    _resetNavigationState() {
        this.state = "idle";
        this.navigation = {
            state: "idle",
            location: null,
            formData: null
        };
    }

    destroy() {
        if (this._unlistenHistory) {
            this._unlistenHistory();
        }
        if (this._currentAbortController) {
            this._currentAbortController.abort();
        }
    }
}
