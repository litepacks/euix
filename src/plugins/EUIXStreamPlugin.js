/**
 * src/plugins/EUIXStreamPlugin.js
 * Declarative WebSocket & Server-Sent Events (SSE) Real-Time Streaming Engine for EUIX Engine.
 */

export const EUIXStreamPlugin = {
    name: "stream",
    install(engineClass) {
        const proto = engineClass.prototype;

        proto._initStreamEngine = function () {
            if (!this._streamConfigs) {
                this._streamConfigs = new Map();
                this._activeStreams = new Map();
                this._streamStatus = {};
            }
            if (this._streamConfigs.size === 0 && this.xmlDoc && !this._isParsingStreams) {
                this._isParsingStreams = true;
                this._parseStreamsFromDoc(this.xmlDoc);
                this._isParsingStreams = false;
            }
        };

        proto.registerStream = function (streamId, config = {}) {
            this._initStreamEngine();
            this._streamConfigs.set(streamId, { ...config });
            if (!this._streamStatus[streamId]) {
                this._updateStreamStatus(streamId, {
                    status: "disconnected",
                    connected: false,
                    lastMessage: null,
                    error: null,
                    reconnectCount: 0,
                });
            }
            return this;
        };

        proto._updateStreamStatus = function (streamId, updates) {
            this._initStreamEngine();
            const current = this._streamStatus[streamId] || {
                status: "disconnected",
                connected: false,
                lastMessage: null,
                error: null,
                reconnectCount: 0,
            };
            const next = { ...current, ...updates };
            this._streamStatus[streamId] = next;

            this.syncBindings(`stream.${streamId}.status`, next.status);
            this.syncBindings(`$stream.${streamId}.status`, next.status);
            this.syncBindings(`stream.${streamId}.connected`, next.connected);
            this.syncBindings(`$stream.${streamId}.connected`, next.connected);
            this.syncBindings(`stream.${streamId}.error`, next.error);
            this.syncBindings(`$stream.${streamId}.error`, next.error);
            this.syncBindings(`stream.${streamId}.lastMessage`, next.lastMessage);
            this.syncBindings(`$stream.${streamId}.lastMessage`, next.lastMessage);
            this.syncBindings(`stream.${streamId}`, next);
            this.syncBindings(`$stream.${streamId}`, next);
        };

        proto.getStreamStatus = function (streamId) {
            this._initStreamEngine();
            return this._streamStatus[streamId] || {
                status: "disconnected",
                connected: false,
                lastMessage: null,
                error: null,
                reconnectCount: 0,
            };
        };

        proto.connectStream = function (streamId) {
            this._initStreamEngine();
            const config = this._streamConfigs.get(streamId);
            if (!config) {
                this.reportError(`Stream "${streamId}" not found in registered stream configs`);
                return;
            }

            // Close any existing connection for this stream
            this.disconnectStream(streamId);

            let url = this.interpolate(config.url || "", {});
            if (config.baseUrl && !url.startsWith("ws://") && !url.startsWith("wss://") && !url.startsWith("http://") && !url.startsWith("https://")) {
                const base = config.baseUrl.replace(/\/+$/, "");
                const cleanUrl = url.replace(/^\/+/, "");
                url = `${base}/${cleanUrl}`;
            }

            const type = (config.type || (url.startsWith("ws://") || url.startsWith("wss://") ? "websocket" : "sse")).toLowerCase();

            this._updateStreamStatus(streamId, {
                status: "connecting",
                connected: false,
                error: null,
            });

            if (type === "websocket" || type === "ws") {
                this._connectWebSocket(streamId, url, config);
            } else {
                this._connectSSE(streamId, url, config);
            }
        };

        proto._connectWebSocket = function (streamId, url, config) {
            const WSClass = typeof WebSocket !== "undefined" ? WebSocket : (typeof window !== "undefined" ? window.WebSocket : null);
            if (!WSClass) {
                this._updateStreamStatus(streamId, {
                    status: "error",
                    connected: false,
                    error: "WebSocket is not supported in this environment",
                });
                return;
            }

            try {
                const protocols = config.protocols ? (Array.isArray(config.protocols) ? config.protocols : [config.protocols]) : undefined;
                const socket = protocols ? new WSClass(url, protocols) : new WSClass(url);
                const streamEntry = {
                    type: "websocket",
                    socket,
                    config,
                    reconnectTimer: null,
                    explicitlyClosed: false,
                };
                this._activeStreams.set(streamId, streamEntry);

                socket.onopen = (evt) => {
                    this._updateStreamStatus(streamId, {
                        status: "connected",
                        connected: true,
                        error: null,
                        reconnectCount: 0,
                    });
                    if (config.onOpenAction) {
                        this.executeAction(config.onOpenAction, { streamId, event: evt });
                    }
                };

                socket.onmessage = (evt) => {
                    this._handleIncomingStreamMessage(streamId, evt.data, config, evt);
                };

                socket.onerror = (evt) => {
                    const errMsg = evt?.message || "WebSocket connection error";
                    this._updateStreamStatus(streamId, {
                        status: "error",
                        connected: false,
                        error: errMsg,
                    });
                    if (config.onErrorAction) {
                        this.executeAction(config.onErrorAction, { streamId, error: errMsg, event: evt });
                    }
                };

                socket.onclose = (evt) => {
                    this._updateStreamStatus(streamId, {
                        status: "disconnected",
                        connected: false,
                    });
                    if (config.onCloseAction) {
                        this.executeAction(config.onCloseAction, { streamId, event: evt });
                    }
                    if (!streamEntry.explicitlyClosed && config.reconnect !== false && config.reconnect !== "false") {
                        this._scheduleReconnect(streamId, config);
                    }
                };
            } catch (err) {
                this._updateStreamStatus(streamId, {
                    status: "error",
                    connected: false,
                    error: err.message || "Failed to initialize WebSocket",
                });
            }
        };

        proto._connectSSE = function (streamId, url, config) {
            const EventSourceClass = typeof EventSource !== "undefined" ? EventSource : (typeof window !== "undefined" ? window.EventSource : null);
            if (!EventSourceClass) {
                this._updateStreamStatus(streamId, {
                    status: "error",
                    connected: false,
                    error: "EventSource is not supported in this environment",
                });
                return;
            }

            try {
                const sse = new EventSourceClass(url, { withCredentials: config.withCredentials === true || config.withCredentials === "true" });
                const streamEntry = {
                    type: "sse",
                    socket: sse,
                    config,
                    reconnectTimer: null,
                    explicitlyClosed: false,
                };
                this._activeStreams.set(streamId, streamEntry);

                sse.onopen = (evt) => {
                    this._updateStreamStatus(streamId, {
                        status: "connected",
                        connected: true,
                        error: null,
                        reconnectCount: 0,
                    });
                    if (config.onOpenAction) {
                        this.executeAction(config.onOpenAction, { streamId, event: evt });
                    }
                };

                const messageHandler = (evt) => {
                    this._handleIncomingStreamMessage(streamId, evt.data, config, evt);
                };

                if (config.eventName) {
                    sse.addEventListener(config.eventName, messageHandler);
                } else {
                    sse.onmessage = messageHandler;
                }

                sse.onerror = (evt) => {
                    this._updateStreamStatus(streamId, {
                        status: "error",
                        connected: false,
                        error: "SSE stream connection error",
                    });
                    if (config.onErrorAction) {
                        this.executeAction(config.onErrorAction, { streamId, event: evt });
                    }
                };
            } catch (err) {
                this._updateStreamStatus(streamId, {
                    status: "error",
                    connected: false,
                    error: err.message || "Failed to initialize EventSource",
                });
            }
        };

        proto._handleIncomingStreamMessage = function (streamId, rawData, config, rawEvt) {
            let parsedData = rawData;
            if (typeof rawData === "string") {
                try {
                    parsedData = JSON.parse(rawData);
                } catch (_) {}
            }

            this._updateStreamStatus(streamId, {
                lastMessage: parsedData,
            });

            // Target state binding
            if (config.target || config.bindTarget) {
                const targetKey = config.target || config.bindTarget;
                const op = (config.operation || "REPLACE").toUpperCase();
                if (op === "PUSH" || op === "APPEND") {
                    this.mutateState(targetKey, "PUSH", parsedData);
                } else if (op === "UNSHIFT" || op === "PREPEND") {
                    this.mutateState(targetKey, "UNSHIFT", parsedData);
                } else {
                    this.setState(targetKey, parsedData);
                }
            }

            // Execute custom on_message action if registered
            if (config.onMessageAction) {
                this.executeAction(config.onMessageAction, {
                    streamId,
                    data: parsedData,
                    raw: rawData,
                    event: rawEvt,
                });
            }
        };

        proto._scheduleReconnect = function (streamId, config) {
            const current = this._streamStatus[streamId] || {};
            const count = (current.reconnectCount || 0) + 1;
            const maxAttempts = parseInt(config.reconnectAttempts || config.maxAttempts || 10, 10);

            if (count > maxAttempts) {
                this._updateStreamStatus(streamId, {
                    status: "disconnected",
                    error: `Max reconnection attempts (${maxAttempts}) reached`,
                });
                return;
            }

            const interval = parseInt(config.reconnectInterval || config.interval || 3000, 10);
            this._updateStreamStatus(streamId, {
                status: "connecting",
                reconnectCount: count,
            });

            const streamEntry = this._activeStreams.get(streamId);
            if (streamEntry) {
                clearTimeout(streamEntry.reconnectTimer);
                streamEntry.reconnectTimer = setTimeout(() => {
                    if (!streamEntry.explicitlyClosed) {
                        this.connectStream(streamId);
                    }
                }, interval);
            }
        };

        proto.sendStreamMessage = function (streamId, payload) {
            this._initStreamEngine();
            const streamEntry = this._activeStreams.get(streamId);
            if (!streamEntry || !streamEntry.socket || streamEntry.type !== "websocket") {
                this.reportError(`Cannot send message: WebSocket stream "${streamId}" is not connected`);
                return false;
            }

            const socket = streamEntry.socket;
            if (socket.readyState !== (typeof WebSocket !== "undefined" ? WebSocket.OPEN : 1)) {
                this.reportError(`WebSocket "${streamId}" is not in OPEN state (readyState: ${socket.readyState})`);
                return false;
            }

            let msgString = payload;
            if (typeof payload === "object" && payload !== null) {
                msgString = JSON.stringify(payload);
            } else {
                msgString = String(payload);
            }

            socket.send(msgString);
            return true;
        };

        proto.disconnectStream = function (streamId) {
            this._initStreamEngine();
            const streamEntry = this._activeStreams.get(streamId);
            if (streamEntry) {
                streamEntry.explicitlyClosed = true;
                if (streamEntry.reconnectTimer) clearTimeout(streamEntry.reconnectTimer);
                if (streamEntry.socket) {
                    try {
                        streamEntry.socket.close();
                    } catch (_) {}
                }
                this._activeStreams.delete(streamId);
            }

            this._updateStreamStatus(streamId, {
                status: "disconnected",
                connected: false,
            });
        };

        proto.disconnectAllStreams = function () {
            if (this._activeStreams) {
                for (const streamId of this._activeStreams.keys()) {
                    this.disconnectStream(streamId);
                }
            }
        };

        // Extract declarative <api_stream>, <websocket>, <sse> tags from XML Document
        proto._parseStreamsFromDoc = function (doc) {
            if (!doc || typeof doc.getElementsByTagName !== "function") return;
            const apiConfigNodes = doc.getElementsByTagName("api_config");
            const baseUrl = apiConfigNodes.length > 0 ? apiConfigNodes[0].getAttribute("base_url") || "" : "";

            const streamTagNames = ["api_stream", "websocket", "ws", "sse", "stream"];
            streamTagNames.forEach((tagName) => {
                const nodes = doc.getElementsByTagName(tagName);
                for (let i = 0; i < nodes.length; i++) {
                    const node = nodes[i];
                    const id =
                        node.getAttribute("id") ||
                        node.getAttribute("name") ||
                        node.getAttribute("tag") ||
                        node.getAttribute("stream");
                    if (id) {
                        const autoConnect = node.getAttribute("auto_connect") !== "false" && node.getAttribute("autoconnect") !== "false";
                        this.registerStream(id, {
                            id,
                            baseUrl,
                            url: node.getAttribute("url") || node.getAttribute("src") || "",
                            type: node.getAttribute("type") || (tagName === "sse" ? "sse" : "websocket"),
                            target: node.getAttribute("target") || node.getAttribute("bind_target"),
                            operation: node.getAttribute("operation") || "REPLACE",
                            eventName: node.getAttribute("event_name") || node.getAttribute("event"),
                            reconnect: node.getAttribute("reconnect") !== "false",
                            reconnectInterval: node.getAttribute("reconnect_interval") || 3000,
                            reconnectAttempts: node.getAttribute("reconnect_attempts") || 10,
                            onMessageAction: node.getAttribute("on_message") || node.getAttribute("on_message_action"),
                            onOpenAction: node.getAttribute("on_open") || node.getAttribute("on_open_action"),
                            onCloseAction: node.getAttribute("on_close") || node.getAttribute("on_close_action"),
                            onErrorAction: node.getAttribute("on_error") || node.getAttribute("on_error_action"),
                            autoConnect,
                        });

                        if (autoConnect) {
                            setTimeout(() => {
                                if (this._isMounted !== false) {
                                    this.connectStream(id);
                                }
                            }, 0);
                        }
                    }
                }
            });
        };

        // Teardown on unmount
        if (proto.onUnmount) {
            proto.onUnmount(function () {
                this.disconnectAllStreams();
            });
        }

        // Register Declarative Action Handlers
        engineClass.registerAction("STREAM_SEND", function (actionNode, context) {
            const streamId =
                (actionNode?.getAttribute && (actionNode.getAttribute("stream") || actionNode.getAttribute("id"))) ||
                (this.getChild && this.getChild(actionNode, "stream")?.textContent?.trim()) ||
                context?.streamId ||
                "";
            const valueNode = this.getChild ? this.getChild(actionNode, "value") || this.getChild(actionNode, "message") || this.getChild(actionNode, "body") : null;
            let payload = valueNode ? valueNode.textContent.trim() : (actionNode?.getAttribute && (actionNode.getAttribute("value") || actionNode.getAttribute("message")));
            if (!payload && actionNode && actionNode.textContent) {
                payload = actionNode.textContent.trim();
            }
            if (payload) {
                payload = this.interpolate(payload, context);
            }
            if (streamId) {
                return this.sendStreamMessage(streamId, payload);
            }
            return false;
        });

        engineClass.registerAction("STREAM_CONNECT", function (actionNode, context) {
            const streamId =
                (actionNode?.getAttribute && (actionNode.getAttribute("stream") || actionNode.getAttribute("id"))) ||
                context?.streamId ||
                "";
            if (streamId) {
                this.connectStream(streamId);
                return true;
            }
            return false;
        });

        engineClass.registerAction("STREAM_DISCONNECT", function (actionNode, context) {
            const streamId =
                (actionNode?.getAttribute && (actionNode.getAttribute("stream") || actionNode.getAttribute("id"))) ||
                context?.streamId ||
                "";
            if (streamId) {
                this.disconnectStream(streamId);
                return true;
            }
            return false;
        });
    }
};
