/**
 * EUIXStoragePlugin.js
 * State Persistence & Storage Plugin for EUIX Engine.
 * Supports localStorage and sessionStorage sync for reactive state variables.
 */

export const EUIXStoragePlugin = {
    name: "storage",
    install(engineClass) {
        const proto = engineClass.prototype;

        proto._setupStorageListener = function() {
            if (typeof window === "undefined" || !window.addEventListener) return;
            window.addEventListener("storage", (event) => {
                if (!event.key || !this._rawState) return;
                for (const [stateKey, config] of this._persistenceConfig.entries()) {
                    if (config.storage === "local" && config.storageKey === event.key) {
                        try {
                            const parsed = event.newValue !== null ? JSON.parse(event.newValue) : "";
                            this.setState(stateKey, parsed, { silent: false });
                        } catch (_) {
                            this.setState(stateKey, event.newValue || "", { silent: false });
                        }
                    }
                }
            });
        };

        proto.persist = function(key, { storage = "local", key: customKey = null } = {}) {
            if (!key) return this;
            const parsedKey = this.parseBindPath(key);
            const storageKey = customKey || `euix_state_${parsedKey}`;
            this._persistenceConfig.set(parsedKey, { storage: String(storage).toLowerCase(), storageKey });

            const store = String(storage).toLowerCase() === "session" 
                ? (typeof sessionStorage !== "undefined" ? sessionStorage : null) 
                : (typeof localStorage !== "undefined" ? localStorage : null);

            if (store && this._rawState) {
                const existing = store.getItem(storageKey);
                if (existing !== null) {
                    try {
                        this._rawState[parsedKey] = JSON.parse(existing);
                    } catch (_) {
                        this._rawState[parsedKey] = existing;
                    }
                    this.syncBindings(parsedKey, this._rawState[parsedKey]);
                } else if (this._rawState[parsedKey] !== undefined) {
                    this._savePersistedState(parsedKey, this._rawState[parsedKey]);
                }
            }
            return this;
        };

        proto.clearPersistedState = function(key) {
            if (!key) return this;
            const parsedKey = this.parseBindPath(key);
            const config = this._persistenceConfig.get(parsedKey);
            if (config) {
                const store = config.storage === "session" 
                    ? (typeof sessionStorage !== "undefined" ? sessionStorage : null) 
                    : (typeof localStorage !== "undefined" ? localStorage : null);
                if (store) store.removeItem(config.storageKey);
            }
            return this;
        };

        proto._savePersistedState = function(key, value) {
            const config = this._persistenceConfig.get(key);
            if (!config) return;
            try {
                const store = config.storage === "session" 
                    ? (typeof sessionStorage !== "undefined" ? sessionStorage : null) 
                    : (typeof localStorage !== "undefined" ? localStorage : null);
                if (!store) return;
                const valToStore = JSON.stringify(value !== undefined ? value : "");
                store.setItem(config.storageKey, valToStore);
            } catch (err) {
                this.reportError(err, `Error persisting state key "${key}"`);
            }
        };
    }
};

export default EUIXStoragePlugin;
