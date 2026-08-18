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
        engineClass.prototype._processNavigatorTag = function(xmlNode) {
            if (!xmlNode) return;
            const target = xmlNode.getAttribute("bind_target") || xmlNode.getAttribute("target") || "navigator";
            const trackNetwork = xmlNode.getAttribute("track_network") !== "false";
            const trackBattery = xmlNode.getAttribute("track_battery") === "true";
            const trackGeo = xmlNode.getAttribute("track_geolocation") === "true";

            this.initNavigatorState(target, { trackNetwork, trackBattery, trackGeo });
        };

        // 2. Programmatic & Declarative State Initializer
        engineClass.prototype.initNavigatorState = function(targetKey = "navigator", options = {}) {
            if (typeof window === "undefined" || typeof navigator === "undefined") {
                return;
            }

            const nav = navigator;
            const conn = nav.connection || nav.mozConnection || nav.webkitConnection;

            const readNetworkInfo = () => ({
                online: !!nav.onLine,
                effectiveType: (conn && conn.effectiveType) || (nav.onLine ? "4g" : "none"),
                downlink: (conn && conn.downlink) || 10,
                rtt: (conn && conn.rtt) || 50,
                saveData: (conn && !!conn.saveData) || false
            });

            const readHardwareInfo = () => ({
                cores: nav.hardwareConcurrency || 4,
                memory: nav.deviceMemory || 8,
                touch: (nav.maxTouchPoints || 0) > 0,
                language: nav.language || "en",
                languages: Array.from(nav.languages || [nav.language || "en"]),
                cookieEnabled: !!nav.cookieEnabled,
                pdfViewerEnabled: !!nav.pdfViewerEnabled
            });

            const current = this.getState(targetKey) || {};
            const nextState = {
                ...current,
                network: readNetworkInfo(),
                hardware: readHardwareInfo()
            };

            this.setState(targetKey, nextState);

            // Network Change Tracking
            if (options.trackNetwork !== false) {
                const updateNetwork = () => {
                    const latest = this.getState(targetKey) || {};
                    this.setState(targetKey, {
                        ...latest,
                        network: readNetworkInfo()
                    });
                };

                window.addEventListener("online", updateNetwork);
                window.addEventListener("offline", updateNetwork);
                if (conn && conn.addEventListener) {
                    conn.addEventListener("change", updateNetwork);
                }

                this.onUnmount(() => {
                    window.removeEventListener("online", updateNetwork);
                    window.removeEventListener("offline", updateNetwork);
                    if (conn && conn.removeEventListener) {
                        conn.removeEventListener("change", updateNetwork);
                    }
                });
            }

            // Battery Change Tracking
            if (options.trackBattery && typeof nav.getBattery === "function") {
                nav.getBattery().then(battery => {
                    const updateBattery = () => {
                        const latest = this.getState(targetKey) || {};
                        this.setState(targetKey, {
                            ...latest,
                            battery: {
                                level: Math.round((battery.level || 1) * 100),
                                charging: !!battery.charging,
                                chargingTime: battery.chargingTime || 0,
                                dischargingTime: battery.dischargingTime || Infinity
                            }
                        });
                    };

                    updateBattery();

                    battery.addEventListener("levelchange", updateBattery);
                    battery.addEventListener("chargingchange", updateBattery);

                    this.onUnmount(() => {
                        battery.removeEventListener("levelchange", updateBattery);
                        battery.removeEventListener("chargingchange", updateBattery);
                    });
                }).catch(() => {});
            }

            // Geolocation Watch Tracking
            if (options.trackGeo && nav.geolocation && typeof nav.geolocation.watchPosition === "function") {
                const watchId = nav.geolocation.watchPosition(
                    pos => {
                        const latest = this.getState(targetKey) || {};
                        this.setState(targetKey, {
                            ...latest,
                            geolocation: {
                                latitude: pos.coords.latitude,
                                longitude: pos.coords.longitude,
                                accuracy: pos.coords.accuracy,
                                altitude: pos.coords.altitude,
                                heading: pos.coords.heading,
                                speed: pos.coords.speed,
                                timestamp: pos.timestamp
                            }
                        });
                    },
                    err => {
                        const latest = this.getState(targetKey) || {};
                        this.setState(targetKey, {
                            ...latest,
                            geolocationError: err.message
                        });
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );

                this.onUnmount(() => {
                    nav.geolocation.clearWatch(watchId);
                });
            }
        };

        // 3. Declarative Actions
        // Action: CLIPBOARD_COPY / COPY_TO_CLIPBOARD
        engineClass.registerAction("CLIPBOARD_COPY", async function(actionNode, context) {
            const rawText = actionNode.getAttribute("text") || actionNode.getAttribute("value") || "";
            const textNode = this.getChild(actionNode, "text") || this.getChild(actionNode, "value");
            const text = textNode ? this.interpolate(textNode.textContent, context) : this.interpolate(rawText, context);

            if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
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
        });
        engineClass.registerAction("COPY_TO_CLIPBOARD", function(actionNode, context) {
            return this.executeAction("CLIPBOARD_COPY", actionNode, context);
        });

        // Action: CLIPBOARD_READ / READ_CLIPBOARD
        engineClass.registerAction("CLIPBOARD_READ", async function(actionNode, context) {
            const targetPath = actionNode.getAttribute("target") || actionNode.getAttribute("path") || "";
            let text = "";
            if (typeof navigator !== "undefined" && navigator.clipboard && typeof navigator.clipboard.readText === "function") {
                text = await navigator.clipboard.readText();
            }
            if (targetPath) {
                this.setState(this.parseBindPath(targetPath), text);
            }
            return text;
        });
        engineClass.registerAction("READ_CLIPBOARD", function(actionNode, context) {
            return this.executeAction("CLIPBOARD_READ", actionNode, context);
        });

        // Action: WEB_SHARE / SHARE
        engineClass.registerAction("WEB_SHARE", async function(actionNode, context) {
            const titleNode = this.getChild(actionNode, "title");
            const textNode = this.getChild(actionNode, "text");
            const urlNode = this.getChild(actionNode, "url");

            const shareData = {
                title: titleNode ? this.interpolate(titleNode.textContent, context) : this.interpolate(actionNode.getAttribute("title") || "", context),
                text: textNode ? this.interpolate(textNode.textContent, context) : this.interpolate(actionNode.getAttribute("text") || "", context),
                url: urlNode ? this.interpolate(urlNode.textContent, context) : this.interpolate(actionNode.getAttribute("url") || "", context)
            };

            if (typeof navigator !== "undefined" && navigator.share && (!navigator.canShare || navigator.canShare(shareData))) {
                await navigator.share(shareData);
                return true;
            }
            return false;
        });
        engineClass.registerAction("SHARE", function(actionNode, context) {
            return this.executeAction("WEB_SHARE", actionNode, context);
        });

        // Action: VIBRATE
        engineClass.registerAction("VIBRATE", function(actionNode, context) {
            const rawPattern = actionNode.getAttribute("pattern") || actionNode.getAttribute("duration") || "50";
            const patternNode = this.getChild(actionNode, "pattern") || this.getChild(actionNode, "duration");
            const patternStr = patternNode ? this.interpolate(patternNode.textContent, context) : this.interpolate(rawPattern, context);

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
        engineClass.registerAction("WAKE_LOCK", async function(actionNode, context) {
            const op = (actionNode.getAttribute("action") || actionNode.getAttribute("type") || "request").toLowerCase();
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
        engineClass.registerAction("SET_APP_BADGE", async function(actionNode, context) {
            const rawVal = actionNode.getAttribute("value") || actionNode.getAttribute("count") || "";
            const valNode = this.getChild(actionNode, "value") || this.getChild(actionNode, "count");
            const valStr = valNode ? this.interpolate(valNode.textContent, context) : this.interpolate(rawVal, context);
            const count = parseInt(valStr, 10);

            if (typeof navigator !== "undefined" && typeof navigator.setAppBadge === "function") {
                if (!isNaN(count) && count > 0) {
                    await navigator.setAppBadge(count);
                } else {
                    await navigator.clearAppBadge();
                }
                return true;
            }
            return false;
        });
        engineClass.registerAction("CLEAR_APP_BADGE", async function() {
            if (typeof navigator !== "undefined" && typeof navigator.clearAppBadge === "function") {
                await navigator.clearAppBadge();
                return true;
            }
            return false;
        });

        // Action: GET_GEOLOCATION
        engineClass.registerAction("GET_GEOLOCATION", function(actionNode, context) {
            const targetPath = actionNode.getAttribute("target") || actionNode.getAttribute("path") || "geolocation";
            return new Promise((resolve, reject) => {
                if (typeof navigator === "undefined" || !navigator.geolocation) {
                    return resolve(null);
                }
                navigator.geolocation.getCurrentPosition(
                    pos => {
                        const coords = {
                            latitude: pos.coords.latitude,
                            longitude: pos.coords.longitude,
                            accuracy: pos.coords.accuracy,
                            altitude: pos.coords.altitude,
                            heading: pos.coords.heading,
                            speed: pos.coords.speed,
                            timestamp: pos.timestamp
                        };
                        this.setState(this.parseBindPath(targetPath), coords);
                        resolve(coords);
                    },
                    err => {
                        this.setState(this.parseBindPath(targetPath + "_error"), err.message);
                        resolve(null);
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            });
        });

        // Register custom XML tag parser for <navigator_config> and <device_config>
        const originalInitDataModel = engineClass.prototype.initDataModel;
        if (typeof originalInitDataModel === "function") {
            engineClass.prototype.initDataModel = function(doc, isMainDoc) {
                const res = originalInitDataModel.call(this, doc, isMainDoc);
                const targetDoc = doc || this.xmlDoc;
                if (targetDoc) {
                    const navConfig = targetDoc.querySelector ? targetDoc.querySelector("navigator_config, device_config") : (targetDoc.getElementsByTagName ? (targetDoc.getElementsByTagName("navigator_config")[0] || targetDoc.getElementsByTagName("device_config")[0]) : null);
                    if (navConfig && typeof this._processNavigatorTag === "function") {
                        this._processNavigatorTag(navConfig);
                    }
                }
                return res;
            };
        }
    }
};

export default EUIXNavigatorPlugin;
