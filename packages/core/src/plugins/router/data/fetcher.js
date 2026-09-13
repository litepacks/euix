/**
 * src/plugins/router/data/fetcher.js
 * Independent non-navigating route fetchers with optimistic UI support.
 */

import { createLocation } from "../core/location.js";

export class FetcherInstance extends EventTarget {
    constructor(id, { router, dataEngine } = {}) {
        super();
        this.id = id;
        this.router = router;
        this.dataEngine = dataEngine;

        this.state = "idle"; // 'idle' | 'loading' | 'submitting'
        this.data = undefined;
        this.error = null;
        this.formData = null;
        this._abortController = null;
    }

    _notifyChange() {
        this.dispatchEvent(
            new CustomEvent("change", {
                detail: {
                    id: this.id,
                    state: this.state,
                    data: this.data,
                    error: this.error,
                    formData: this.formData,
                },
            }),
        );
        if (this.router) {
            this.router._notifyFetcherUpdate(this.id, {
                state: this.state,
                data: this.data,
                error: this.error,
                formData: this.formData,
            });
        }
    }

    /**
     * Loads data from a route URL without navigation.
     * @param {string} href
     */
    async load(href) {
        if (this._abortController) {
            this._abortController.abort();
        }
        this._abortController = new AbortController();
        const signal = this._abortController.signal;

        this.state = "loading";
        this.formData = null;
        this.error = null;
        this._notifyChange();

        try {
            const loc = createLocation(href);
            const matches = this.router.matcher.match(loc.pathname);

            if (!matches || matches.length === 0) {
                throw new Error(`[EUIXFetcher] No route match for fetcher url "${href}"`);
            }

            const leaf = matches[matches.length - 1];
            const data = await this.dataEngine.loaderManager.executeLoader({
                match: leaf,
                location: loc,
                signal,
                context: this.router.context || {},
            });

            if (!signal.aborted) {
                this.data = data;
                this.state = "idle";
                this._notifyChange();
            }
            return data;
        } catch (err) {
            if (!signal.aborted) {
                this.error = err;
                this.state = "idle";
                this._notifyChange();
            }
            throw err;
        }
    }

    /**
     * Submits form data to a route action without navigation.
     * @param {FormData|object} data
     * @param {{ method?: string, action?: string }} options
     */
    async submit(data, { method = "POST", action = "/" } = {}) {
        if (this._abortController) {
            this._abortController.abort();
        }
        this._abortController = new AbortController();
        const signal = this._abortController.signal;

        let formData;
        if (typeof FormData !== "undefined" && data instanceof FormData) {
            formData = data;
        } else {
            formData = new FormData();
            if (data && typeof data === "object") {
                Object.keys(data).forEach((k) => {
                    formData.append(k, data[k]);
                });
            }
        }

        this.state = "submitting";
        this.formData = formData;
        this.error = null;
        this._notifyChange();

        try {
            const loc = createLocation(action);
            const matches = this.router.matcher.match(loc.pathname);

            if (!matches || matches.length === 0) {
                throw new Error(`[EUIXFetcher] No route match for action url "${action}"`);
            }

            // Find nearest matching route with action
            let targetMatch = null;
            for (let i = matches.length - 1; i >= 0; i--) {
                if (matches[i].action || matches[i].route.action) {
                    targetMatch = matches[i];
                    break;
                }
            }

            if (!targetMatch) {
                targetMatch = matches[matches.length - 1];
            }

            const result = await this.dataEngine.actionManager.executeAction({
                match: targetMatch,
                location: loc,
                formData,
                signal,
                context: this.router.context || {},
            });

            if (!signal.aborted) {
                this.data = result;
                this.state = "idle";
                this.formData = null;
                this._notifyChange();

                // Revalidate active application loaders
                await this.router.revalidate();
            }
            return result;
        } catch (err) {
            if (!signal.aborted) {
                this.error = err;
                this.state = "idle";
                this.formData = null;
                this._notifyChange();
            }
            throw err;
        }
    }
}

export class RouteFetcherManager {
    constructor({ router, dataEngine } = {}) {
        this.router = router;
        this.dataEngine = dataEngine;
        this._fetchers = new Map();
    }

    getFetcher(id) {
        if (!this._fetchers.has(id)) {
            const fetcher = new FetcherInstance(id, {
                router: this.router,
                dataEngine: this.dataEngine,
            });
            this._fetchers.set(id, fetcher);
        }
        return this._fetchers.get(id);
    }
}
