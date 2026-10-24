import { isFn, safeParse, safeStringify } from "../core/utils/constants.js";
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
        if (engineClass.hooks && isFn(engineClass.hooks.on)) {
            engineClass.hooks.on("engine:init", (engine) => {
                if (isFn(engine._setupStorageListener)) {
                    engine._setupStorageListener();
                }
            });
        }

        const proto = engineClass.prototype;

        proto._setupStorageListener = function () {
            if (typeof window === "undefined" || !window.addEventListener || this._storageListenerBound) return;
            this._storageListenerBound = true;

            this._storageHandler = (event) => {
                const isCustom = event.type === "euix:storage";
                const key = isCustom ? event.detail?.key : event.key;
                const newValue = isCustom ? event.detail?.newValue : event.newValue;
                const sourceEngine = isCustom ? event.detail?.sourceEngine : null;

                if (!key || !this._rawState || !this._persistenceConfig) return;
                if (sourceEngine === this) return;

                for (const [stateKey, config] of this._persistenceConfig.entries()) {
                    if (config.storage === "local" && config.storageKey === key) {
                        const parsed =
                            newValue !== null && newValue !== undefined
                                ? safeParse(newValue, newValue || "")
                                : "";
                        if (this._rawState[stateKey] !== parsed) {
                            this.setState(stateKey, parsed, { silent: false });
                        }
                    }
                }
            };

            window.addEventListener("storage", this._storageHandler);
            window.addEventListener("euix:storage", this._storageHandler);

            if (isFn(this.onUnmount)) {
                this.onUnmount(() => {
                    if (typeof window !== "undefined" && this._storageHandler) {
                        window.removeEventListener("storage", this._storageHandler);
                        window.removeEventListener("euix:storage", this._storageHandler);
                    }
                    this._storageListenerBound = false;
                });
            }
        };

        proto.persist = function (key, { storage = "local", key: customKey = null } = {}) {
            if (!key) return this;
            if (!this._persistenceConfig) this._persistenceConfig = new Map();
            if (!this._storageListenerBound && isFn(this._setupStorageListener)) {
                this._setupStorageListener();
            }
            const parsedKey = this.parseBindPath(key);
            const storageKey = customKey || `euix_state_${parsedKey}`;
            const storageType = String(storage).toLowerCase();
            this._persistenceConfig.set(parsedKey, { storage: storageType, storageKey });

            const store = getStore(storageType);
            if (store && this._rawState) {
                const existing = store.getItem(storageKey);
                if (existing !== null) {
                    this._rawState[parsedKey] = safeParse(existing, existing);
                    this.syncBindings(parsedKey, this._rawState[parsedKey]);
                } else if (this._rawState[parsedKey] !== undefined) {
                    this._savePersistedState(parsedKey, this._rawState[parsedKey]);
                }
            }
            return this;
        };

        proto.clearPersistedState = function (key) {
            if (!key || !this._persistenceConfig) return this;
            const parsedKey = this.parseBindPath(key);
            const config = this._persistenceConfig.get(parsedKey);
            if (config) {
                const store = getStore(config.storage);
                if (store) store.removeItem(config.storageKey);
                if (typeof window !== "undefined" && isFn(window.dispatchEvent)) {
                    try {
                        window.dispatchEvent(
                            new CustomEvent("euix:storage", {
                                detail: {
                                    key: config.storageKey,
                                    newValue: null,
                                    sourceEngine: this,
                                    storage: config.storage,
                                },
                            })
                        );
                    } catch (_) {}
                }
            }
            return this;
        };

        proto._savePersistedState = function (key, value) {
            if (!this._persistenceConfig) return;
            const config = this._persistenceConfig.get(key);
            if (!config) return;
            try {
                const store = getStore(config.storage);
                if (!store) return;
                let valToStore;
                try {
                    valToStore = JSON.stringify(value !== undefined ? value : "");
                } catch (_) {
                    valToStore = safeStringify(value !== undefined ? value : "");
                }
                store.setItem(config.storageKey, valToStore);
                if (typeof window !== "undefined" && isFn(window.dispatchEvent)) {
                    try {
                        window.dispatchEvent(
                            new CustomEvent("euix:storage", {
                                detail: {
                                    key: config.storageKey,
                                    newValue: valToStore,
                                    sourceEngine: this,
                                    storage: config.storage,
                                },
                            })
                        );
                    } catch (_) {}
                }
            } catch (err) {
                this.reportError(err, `Error persisting state key "${key}"`);
            }
        };
    },
};

export default EUIXStoragePlugin;
