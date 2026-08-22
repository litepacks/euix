/**
 * EUIXStoragePlugin.js
 * State Persistence & Storage Plugin for EUIX Engine.
 * Supports localStorage and sessionStorage sync for reactive state variables.
 */

const getStore = (type) => {
    const s = String(type || "").toLowerCase();
    if (s === "session") return typeof sessionStorage !== "undefined" ? sessionStorage : null;
    if (s === "local") return typeof localStorage !== "undefined" ? localStorage : null;
    return null;
};

export const EUIXStoragePlugin = {
    name: "storage",
    install(engineClass) {
        const proto = engineClass.prototype;

        proto._setupStorageListener = function () {
            if (typeof window === "undefined" || !window.addEventListener || this._storageListenerBound) return;
            this._storageListenerBound = true;

            this._storageHandler = (event) => {
                if (!event.key || !this._rawState || !this._persistenceConfig) return;
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
            };

            window.addEventListener("storage", this._storageHandler);

            if (typeof this.onUnmount === "function") {
                this.onUnmount(() => {
                    if (typeof window !== "undefined" && this._storageHandler) {
                        window.removeEventListener("storage", this._storageHandler);
                    }
                    this._storageListenerBound = false;
                });
            }
        };

        proto.persist = function (key, { storage = "local", key: customKey = null } = {}) {
            if (!key) return this;
            const parsedKey = this.parseBindPath(key);
            const storageKey = customKey || `euix_state_${parsedKey}`;
            const storageType = String(storage).toLowerCase();
            this._persistenceConfig.set(parsedKey, { storage: storageType, storageKey });

            const store = getStore(storageType);
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

        proto.clearPersistedState = function (key) {
            if (!key) return this;
            const parsedKey = this.parseBindPath(key);
            const config = this._persistenceConfig.get(parsedKey);
            if (config) {
                const store = getStore(config.storage);
                if (store) store.removeItem(config.storageKey);
            }
            return this;
        };

        proto._savePersistedState = function (key, value) {
            const config = this._persistenceConfig.get(key);
            if (!config) return;
            try {
                const store = getStore(config.storage);
                if (!store) return;
                const valToStore = JSON.stringify(value !== undefined ? value : "");
                store.setItem(config.storageKey, valToStore);
            } catch (err) {
                this.reportError(err, `Error persisting state key "${key}"`);
            }
        };
    },
};

export default EUIXStoragePlugin;
