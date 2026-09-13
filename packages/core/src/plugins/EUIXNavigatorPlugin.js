/**
 * EUIXNavigatorPlugin.js
 * Browser Navigator & Device Capabilities Plugin for EUIX Engine.
 *
 * Provides declarative access to:
 * - Network status & connection info (online/offline, effectiveType, downlink, rtt, saveData)
 * - Battery status (level, charging, chargingTime, dischargingTime)
 * - Hardware capabilities (CPU cores, device RAM memory, touch screen)
 * - Locale and language info
 * - Declarative Actions:
 *   - CLIPBOARD_COPY / COPY_TO_CLIPBOARD
 *   - CLIPBOARD_READ / READ_CLIPBOARD
 *   - WEB_SHARE / SHARE
 *   - VIBRATE
 *   - WAKE_LOCK
 *   - SET_APP_BADGE / CLEAR_APP_BADGE
 *   - GET_GEOLOCATION / GEOLOCATION_WATCH
 */

export const EUIXNavigatorPlugin = {
    name: "navigator",
    install(engineClass) {
        // 1. Tag Pre-Processor: <navigator_config> / <device_config>
        engineClass.prototype._processNavigatorTag = function (xmlNode) {
            if (!xmlNode) return;
            const target =
                xmlNode.getAttribute("bind_target") ||
                xmlNode.getAttribute("target") ||
                xmlNode.getAttribute("bind") ||
                "navigator";
            const trackNetwork = xmlNode.getAttribute("track_network") !== "false";
            const trackBattery = xmlNode.getAttribute("track_battery") === "true";
            const trackGeo =
                xmlNode.getAttribute("track_geolocation") === "true" || xmlNode.getAttribute("track_geo") === "true";

            this.initNavigatorState(target, { trackNetwork, trackBattery, trackGeo });
        };

        // 2. Programmatic & Declarative State Initializer with $device reactive bridge
        engineClass.prototype.initNavigatorState = function (targetKey = "navigator", options = {}) {
            if (typeof window === "undefined" && typeof navigator === "undefined") {
                return;
            }

            const nav =
                typeof navigator !== "undefined" ? navigator : typeof window !== "undefined" ? window.navigator : null;
            if (!nav) return;

            const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

            const getPrefersDark = () => {
                try {
                    return (
                        typeof window !== "undefined" &&
                        window.matchMedia &&
                        window.matchMedia("(prefers-color-scheme: dark)").matches
                    );
                } catch (_) {
                    return true;
                }
            };

            const getReducedMotion = () => {
                try {
                    return (
                        typeof window !== "undefined" &&
                        window.matchMedia &&
                        window.matchMedia("(prefers-reduced-motion: reduce)").matches
                    );
                } catch (_) {
                    return false;
                }
            };

            const readNetworkInfo = () => ({
                online: typeof nav.onLine === "boolean" ? nav.onLine : true,
                effectiveType: (conn && conn.effectiveType) || (nav.onLine ? "4g" : "none"),
                downlink: (conn && conn.downlink) || 10,
                rtt: (conn && conn.rtt) || 50,
                saveData: (conn && !!conn.saveData) || false,
            });

            const readHardwareInfo = () => ({
                cores: Number(nav.hardwareConcurrency) || 8,
                hardwareConcurrency: Number(nav.hardwareConcurrency) || 8,
                memory: Number(nav.deviceMemory) || 8,
                deviceMemory: Number(nav.deviceMemory) || 8,
                touch: (nav.maxTouchPoints || 0) > 0,
                language: String(nav.language || "en"),
                languages: Array.isArray(nav.languages) ? Array.from(nav.languages) : [String(nav.language || "en")],
                cookieEnabled: !!nav.cookieEnabled,
                pdfViewerEnabled: !!nav.pdfViewerEnabled,
                prefersDark: getPrefersDark(),
                reducedMotion: getReducedMotion(),
            });

            const current = this.getState(targetKey) || {};
            const net = readNetworkInfo();
            const hw = readHardwareInfo();
            const nextState = {
                ...current,
                ...net,
                ...hw,
                batteryLevel: 1,
                batteryCharging: false,
                batteryChargingTime: "Instant",
                network: net,
                hardware: hw,
            };

            const setDeviceState = (updated) => {
                if (typeof this.batch === "function") {
                    this.batch(() => {
                        if (this._rawState) {
                            this._rawState[targetKey] = updated;
                            this._rawState.$device = updated;
                            this._rawState.device = updated;
                        }
                        this.setState(targetKey, updated);
                        this.setState("$device", updated);
                        this.setState("device", updated);
                    });
                } else {
                    if (this._rawState) {
                        this._rawState[targetKey] = updated;
                        this._rawState.$device = updated;
                        this._rawState.device = updated;
                    }
                    this.setState(targetKey, updated);
                    this.setState("$device", updated);
                    this.setState("device", updated);
                }
                this.$device = updated;
                this.device = updated;
            };

            setDeviceState(nextState);

            // Network Change Tracking
            if (options.trackNetwork !== false) {
                const updateNetwork = () => {
                    const latest = this.getState("$device") || {};
                    const newNet = readNetworkInfo();
                    const updated = {
                        ...latest,
                        ...newNet,
                        network: newNet,
                    };
                    setDeviceState(updated);
                };

                window.addEventListener("online", updateNetwork);
                window.addEventListener("offline", updateNetwork);
                if (conn && conn.addEventListener) {
                    conn.addEventListener("change", updateNetwork);
                }

                if (typeof this.onUnmount === "function") {
                    this.onUnmount(() => {
                        window.removeEventListener("online", updateNetwork);
                        window.removeEventListener("offline", updateNetwork);
                        if (conn && conn.removeEventListener) {
                            conn.removeEventListener("change", updateNetwork);
                        }
                    });
                }
            }

            // Battery Change Tracking
            if (typeof nav.getBattery === "function") {
                try {
                    const batteryPromise = nav.getBattery();
                    if (batteryPromise && typeof batteryPromise.then === "function") {
                        batteryPromise
                            .then((battery) => {
                                if (!battery) return;
                                const updateBattery = () => {
                                    const latest = this.getState("$device") || {};
                                    const batLevel = battery.level !== undefined ? battery.level : 1;
                                    const updated = {
                                        ...latest,
                                        batteryLevel: batLevel,
                                        batteryCharging: !!battery.charging,
                                        batteryChargingTime:
                                            battery.chargingTime && battery.chargingTime !== Infinity
                                                ? `${Math.round(battery.chargingTime / 60)} min`
                                                : "Instant",
                                        battery: {
                                            level: Math.round(batLevel * 100),
                                            charging: !!battery.charging,
                                            chargingTime: battery.chargingTime || 0,
                                            dischargingTime: battery.dischargingTime || Infinity,
                                        },
                                    };
                                    setDeviceState(updated);
                                };

                                updateBattery();

                                battery.addEventListener("levelchange", updateBattery);
                                battery.addEventListener("chargingchange", updateBattery);

                                if (typeof this.onUnmount === "function") {
                                    this.onUnmount(() => {
                                        battery.removeEventListener("levelchange", updateBattery);
                                        battery.removeEventListener("chargingchange", updateBattery);
                                    });
                                }
                            })
                            .catch(() => {});
                    }
                } catch (_) {}
            }

            // Geolocation Watch Tracking
            if (options.trackGeo && nav.geolocation && typeof nav.geolocation.watchPosition === "function") {
                const watchId = nav.geolocation.watchPosition(
                    (pos) => {
                        const latest = this.getState("$device") || {};
                        const coords = {
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude,
                            accuracy: pos.coords.accuracy,
                            altitude: pos.coords.altitude,
                            heading: pos.coords.heading,
                            speed: pos.coords.speed,
                            timestamp: pos.timestamp,
                        };
                        const updated = {
                            ...latest,
                            geolocation: coords,
                            coords,
                        };
                        this.setState(targetKey, updated);
                        this.setState("$device", updated);
                        this.setState("device", updated);
                    },
                    (err) => {
                        const latest = this.getState("$device") || {};
                        this.setState("$device", { ...latest, geolocationError: err.message });
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
                );

                if (typeof this.onUnmount === "function") {
                    this.onUnmount(() => {
                        if (typeof nav.geolocation.clearWatch === "function") {
                            nav.geolocation.clearWatch(watchId);
                        }
                    });
                }
            }
        };

        // 3. Declarative Actions
        // Action: CLIPBOARD_COPY / CLIPBOARD_WRITE / COPY_TO_CLIPBOARD
        const handleClipboardCopy = async function (actionNode, context) {
            const rawText = actionNode.getAttribute("text") || actionNode.getAttribute("value") || "";
            const textNode = this.getChild(actionNode, "text") || this.getChild(actionNode, "value");
            const text = textNode
                ? this.interpolate(textNode.textContent, context)
                : this.interpolate(rawText, context);

            if (
                typeof navigator !== "undefined" &&
                navigator.clipboard &&
                typeof navigator.clipboard.writeText === "function"
            ) {
                await navigator.clipboard.writeText(text);
            } else if (typeof document !== "undefined") {
                const textArea = document.createElement("textarea");
                textArea.value = text;
                textArea.style.position = "fixed";
                textArea.style.opacity = "0";
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand("copy");
                } finally {
                    document.body.removeChild(textArea);
                }
            }
            return text;
        };
        engineClass.registerAction("CLIPBOARD_COPY", handleClipboardCopy);
        engineClass.registerAction("CLIPBOARD_WRITE", handleClipboardCopy);
        engineClass.registerAction("WRITE_CLIPBOARD", handleClipboardCopy);
        engineClass.registerAction("COPY_TO_CLIPBOARD", handleClipboardCopy);

        // Action: CLIPBOARD_READ / READ_CLIPBOARD
        const handleClipboardRead = async function (actionNode, context) {
            const targetPath = actionNode.getAttribute("target") || actionNode.getAttribute("path") || "";
            let text = "";
            if (
                typeof navigator !== "undefined" &&
                navigator.clipboard &&
                typeof navigator.clipboard.readText === "function"
            ) {
                text = await navigator.clipboard.readText();
            }
            if (targetPath) {
                this.setState(this.parseBindPath(targetPath), text);
            }
            return text;
        };
        engineClass.registerAction("CLIPBOARD_READ", handleClipboardRead);
        engineClass.registerAction("READ_CLIPBOARD", handleClipboardRead);

        // Action: WEB_SHARE / SHARE
        const handleWebShare = async function (actionNode, context) {
            const titleNode = this.getChild(actionNode, "title");
            const textNode = this.getChild(actionNode, "text");
            const urlNode = this.getChild(actionNode, "url");

            const shareData = {
                title: titleNode
                    ? this.interpolate(titleNode.textContent, context)
                    : this.interpolate(actionNode.getAttribute("title") || "", context),
                text: textNode
                    ? this.interpolate(textNode.textContent, context)
                    : this.interpolate(actionNode.getAttribute("text") || "", context),
                url: urlNode
                    ? this.interpolate(urlNode.textContent, context)
                    : this.interpolate(actionNode.getAttribute("url") || "", context),
            };

            if (
                typeof navigator !== "undefined" &&
                navigator.share &&
                (!navigator.canShare || navigator.canShare(shareData))
            ) {
                await navigator.share(shareData);
                return true;
            }
            return false;
        };
        engineClass.registerAction("WEB_SHARE", handleWebShare);
        engineClass.registerAction("SHARE", handleWebShare);

        // Action: VIBRATE
        engineClass.registerAction("VIBRATE", function (actionNode, context) {
            const rawPattern = actionNode.getAttribute("pattern") || actionNode.getAttribute("duration") || "50";
            const patternNode = this.getChild(actionNode, "pattern") || this.getChild(actionNode, "duration");
            const patternStr = patternNode
                ? this.interpolate(patternNode.textContent, context)
                : this.interpolate(rawPattern, context);

            let pattern;
            try {
                pattern = JSON.parse(patternStr);
            } catch (_) {
                pattern = parseInt(patternStr, 10) || 50;
            }

            if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
                navigator.vibrate(pattern);
                return true;
            }
            return false;
        });

        // Action: WAKE_LOCK
        engineClass.registerAction("WAKE_LOCK", async function (actionNode, context) {
            const op = (
                actionNode.getAttribute("type") ||
                actionNode.getAttribute("mode") ||
                actionNode.getAttribute("op") ||
                (actionNode.getAttribute("action") !== "WAKE_LOCK" ? actionNode.getAttribute("action") : null) ||
                "request"
            ).toLowerCase();
            if (typeof navigator === "undefined" || !navigator.wakeLock) return false;

            if (op === "request") {
                try {
                    this._screenWakeLock = await navigator.wakeLock.request("screen");
                    this.onUnmount(() => {
                        if (this._screenWakeLock && !this._screenWakeLock.released) {
                            this._screenWakeLock.release().catch(() => {});
                        }
                    });
                    return true;
                } catch (_) {
                    return false;
                }
            } else if (op === "release") {
                if (this._screenWakeLock && !this._screenWakeLock.released) {
                    await this._screenWakeLock.release();
                    this._screenWakeLock = null;
                    return true;
                }
            }
            return false;
        });

        // Action: SET_APP_BADGE / CLEAR_APP_BADGE
        engineClass.registerAction("SET_APP_BADGE", async function (actionNode, context) {
            const rawVal = actionNode.getAttribute("value") || actionNode.getAttribute("count") || "";
            const valNode = this.getChild(actionNode, "value") || this.getChild(actionNode, "count");
            const valStr = valNode ? this.interpolate(valNode.textContent, context) : this.interpolate(rawVal, context);
            const count = parseInt(valStr, 10);

            if (typeof navigator !== "undefined" && typeof navigator.setAppBadge === "function") {
                if (!Number.isNaN(count) && count > 0) {
                    await navigator.setAppBadge(count);
                } else {
                    await navigator.clearAppBadge();
                }
                return true;
            }
            return false;
        });
        engineClass.registerAction("CLEAR_APP_BADGE", async () => {
            if (typeof navigator !== "undefined" && typeof navigator.clearAppBadge === "function") {
                await navigator.clearAppBadge();
                return true;
            }
            return false;
        });

        // Action: GET_GEOLOCATION
        engineClass.registerAction("GET_GEOLOCATION", function (actionNode, context) {
            const targetPath = actionNode.getAttribute("target") || actionNode.getAttribute("path") || "geolocation";
            return new Promise((resolve, reject) => {
                if (typeof navigator === "undefined" || !navigator.geolocation) {
                    return resolve(null);
                }
                navigator.geolocation.getCurrentPosition(
                    (pos) => {
                        const coords = {
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude,
                            accuracy: pos.coords.accuracy,
                            altitude: pos.coords.altitude,
                            heading: pos.coords.heading,
                            speed: pos.coords.speed,
                            timestamp: pos.timestamp,
                        };
                        this.setState(this.parseBindPath(targetPath), coords);
                        resolve(coords);
                    },
                    (err) => {
                        this.setState(this.parseBindPath(`${targetPath}_error`), err.message);
                        resolve(null);
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
                );
            });
        });

        // Auto-initialize navigator state on engine data model boot
        const originalInitDataModel = engineClass.prototype.initDataModel;
        if (typeof originalInitDataModel === "function") {
            engineClass.prototype.initDataModel = function (doc, isMainDoc) {
                const res = originalInitDataModel.call(this, doc, isMainDoc);
                const targetDoc = doc || this.xmlDoc;
                if (targetDoc) {
                    const navConfig =
                        (targetDoc.getElementsByTagName
                            ? targetDoc.getElementsByTagName("navigator_config")[0] ||
                              targetDoc.getElementsByTagName("device_config")[0] ||
                              targetDoc.getElementsByTagName("navigator")[0] ||
                              targetDoc.getElementsByTagName("device")[0]
                            : null) ||
                        (targetDoc.querySelector
                            ? targetDoc.querySelector("navigator_config, device_config, navigator, device")
                            : null);
                    if (navConfig && typeof this._processNavigatorTag === "function") {
                        this._processNavigatorTag(navConfig);
                    } else if (typeof this.initNavigatorState === "function") {
                        this.initNavigatorState("$device");
                    }
                } else if (typeof this.initNavigatorState === "function") {
                    this.initNavigatorState("$device");
                }
                return res;
            };
        }
    },
};

export default EUIXNavigatorPlugin;
