/**
 * EUIXLeafletPlugin.js
 * Declarative Leaflet Interactive Maps & Spatial Tooling Plugin for EUIX Engine.
 *
 * Provides pure, modular Leaflet map primitives:
 * - <leaflet_map id="..." lat="..." lng="..." zoom="..." bind="data.selections" draw="true">
 * - <tile_layer url="..." attribution="..." />
 * - <draw_control position="topleft" polygon="true" edit="true" remove="true" />
 * - <marker lat="..." lng="..." title="..." popup="..." />
 * - <polygon points="..." color="..." fill_color="..." />
 * - Declarative Actions: FLY_TO, PAN_TO, SET_VIEW, FIT_BOUNDS, CLEAR_MAP, REMOVE_LAYER, INVALIDATE_MAP_SIZE, ADD_MARKER
 */

/**
 * Geodesic Polygon Area Calculation in square meters (m²)
 */
export function calculatePolygonArea(latLngs) {
    if (!latLngs || latLngs.length < 3) return 0;
    const points = latLngs.map((pt) => (Array.isArray(pt) ? { lat: pt[0], lng: pt[1] } : pt));
    const radius = 6378137; // Earth radius in meters
    let total = 0;
    const len = points.length;

    for (let i = 0; i < len; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % len];
        const lat1 = (p1.lat * Math.PI) / 180;
        const lat2 = (p2.lat * Math.PI) / 180;
        const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
        total += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
    }

    const area = Math.abs((total * radius * radius) / 2);
    return Math.round(area * 100) / 100;
}

/**
 * Metric Area Formatter (m², ha, km²)
 */
export function formatMetricArea(areaM2, locale = "en-US") {
    const area = Number(areaM2) || 0;
    if (area >= 1000000) {
        return `${(area / 1000000).toLocaleString(locale, { maximumFractionDigits: 2 })} km²`;
    }
    if (area >= 10000) {
        return `${(area / 10000).toLocaleString(locale, { maximumFractionDigits: 2 })} ha`;
    }
    return `${area.toLocaleString(locale, { maximumFractionDigits: 0 })} m²`;
}

export const EUIXLeafletPlugin = {
    name: "leaflet",
    install(engineClass) {
        const proto = engineClass.prototype;

        const renderLeafletMapHandler = function (xmlNode, context = {}, engine = null) {
            const eng = engine || this;
            return eng.renderLeafletMap(xmlNode, context);
        };

        if (typeof engineClass.registerComponent === "function") {
            engineClass.registerComponent("leaflet_map", renderLeafletMapHandler);
            engineClass.registerComponent("map_view", renderLeafletMapHandler);
            engineClass.registerComponent("leaflet", renderLeafletMapHandler);
        }

        /**
         * Render Declarative Leaflet Map Element
         */
        proto.renderLeafletMap = function (xmlNode, context = {}) {
            if (!this._leafletMaps) this._leafletMaps = new Map();
            if (!this._leafletLayers) this._leafletLayers = new Map();

            const mapId =
                xmlNode.getAttribute("id") || `leaflet_map_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
            const rawLat = xmlNode.getAttribute("lat") || xmlNode.getAttribute("latitude") || "51.5074";
            const rawLng = xmlNode.getAttribute("lng") || xmlNode.getAttribute("longitude") || "-0.1278";
            const rawZoom = xmlNode.getAttribute("zoom") || "13";
            const centerAttr = xmlNode.getAttribute("center");

            let initialLat = Number(this.interpolate(rawLat, context)) || 51.5074;
            let initialLng = Number(this.interpolate(rawLng, context)) || -0.1278;
            const initialZoom = Number(this.interpolate(rawZoom, context)) || 13;

            if (centerAttr) {
                const parts = this.interpolate(centerAttr, context)
                    .split(",")
                    .map((s) => Number(s.trim()));
                if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
                    initialLat = parts[0];
                    initialLng = parts[1];
                }
            }

            const rawBind = xmlNode.getAttribute("bind") || xmlNode.getAttribute("bind_group") || "";
            const bindPath = rawBind ? this.parseBindPath(this.interpolate(rawBind, context)) : null;

            const bindCenter = xmlNode.getAttribute("bind_center")
                ? this.parseBindPath(this.interpolate(xmlNode.getAttribute("bind_center"), context))
                : null;
            const bindZoom = xmlNode.getAttribute("bind_zoom")
                ? this.parseBindPath(this.interpolate(xmlNode.getAttribute("bind_zoom"), context))
                : null;

            const enableDraw =
                xmlNode.getAttribute("draw") === "true" || xmlNode.getAttribute("enable_draw") === "true";
            const minZoom = xmlNode.getAttribute("min_zoom") ? Number(xmlNode.getAttribute("min_zoom")) : 2;
            const maxZoom = xmlNode.getAttribute("max_zoom") ? Number(xmlNode.getAttribute("max_zoom")) : 19;

            const container = document.createElement("div");
            container.id = mapId;
            container.className = ["euix-leaflet-map", xmlNode.getAttribute("class") || ""].filter(Boolean).join(" ");
            container.style.width = xmlNode.getAttribute("width") || "100%";
            container.style.height = xmlNode.getAttribute("height") || "100%";
            container.style.minHeight = xmlNode.getAttribute("min_height") || "350px";
            container.style.position = "relative";

            let retryCount = 0;
            const maxRetries =
                xmlNode.getAttribute("retry_timeout") !== null
                    ? Number(xmlNode.getAttribute("retry_timeout"))
                    : typeof window !== "undefined" && window.__EUIX_LEAFLET_MAX_RETRIES !== undefined
                      ? window.__EUIX_LEAFLET_MAX_RETRIES
                      : 25;

            const initMapInstance = () => {
                const L = typeof window !== "undefined" ? window.L : null;
                if (!L || !L.map) {
                    if (retryCount < maxRetries) {
                        retryCount++;
                        setTimeout(initMapInstance, 80);
                        return;
                    }
                    container.innerHTML = `<div class="p-4 text-xs text-amber-700 bg-amber-50 rounded border border-amber-200">⚠️ Leaflet.js library is not loaded. Add &lt;script src=".../leaflet.js"&gt;&lt;/script&gt; or include Leaflet CDN in &lt;head&gt;.</div>`;
                    return;
                }

                if (L.Icon && L.Icon.Default && L.Icon.Default.mergeOptions) {
                    L.Icon.Default.mergeOptions({
                        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
                        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
                        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
                    });
                }

                // Destroy any existing map instance on this id
                if (this._leafletMaps.has(mapId)) {
                    try {
                        this._leafletMaps.get(mapId).remove();
                    } catch (_) {}
                    this._leafletMaps.delete(mapId);
                }

                const mapOptions = {
                    center: [initialLat, initialLng],
                    zoom: initialZoom,
                    minZoom,
                    maxZoom,
                    zoomControl: xmlNode.getAttribute("zoom_control") !== "false",
                };

                const map = L.map(container, mapOptions);
                map._layersMap = new Map();
                map._bindPath = bindPath;

                this._leafletMaps.set(mapId, map);
                this._leafletLayers.set(mapId, map._layersMap);

                const cleanupMap = () => {
                    try {
                        if (map && typeof map.remove === "function") {
                            map.remove();
                        }
                    } catch (_) {}
                    if (this._leafletMaps) this._leafletMaps.delete(mapId);
                    if (this._leafletLayers) this._leafletLayers.delete(mapId);
                };
                if (typeof this.onUnmount === "function") {
                    this.onUnmount(cleanupMap);
                } else {
                    (this._destroyHooks = this._destroyHooks || []).push(cleanupMap);
                }

                // 1. Tile Layer
                const tileNode = this.getChild(xmlNode, "tile_layer") || this.getChild(xmlNode, "tile");
                const tileUrl =
                    tileNode?.getAttribute("url") ||
                    xmlNode.getAttribute("tile_layer") ||
                    "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
                const tileAttr =
                    tileNode?.getAttribute("attribution") ||
                    xmlNode.getAttribute("tile_attribution") ||
                    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

                L.tileLayer(tileUrl, {
                    attribution: tileAttr,
                    maxZoom: tileNode?.getAttribute("max_zoom") ? Number(tileNode.getAttribute("max_zoom")) : maxZoom,
                }).addTo(map);

                // 2. Feature Group for Layer Management
                const drawnItems = new L.FeatureGroup();
                map.addLayer(drawnItems);
                map._drawnItems = drawnItems;

                // Sync internal layers to EUIX state array
                const syncToState = (statusMsg = null) => {
                    if (!bindPath) return;
                    const items = [];
                    const i = 1;

                    drawnItems.eachLayer((layer) => {
                        let areaM2 = 0;
                        let points = [];
                        if (layer.getLatLngs) {
                            const raw = layer.getLatLngs();
                            const flat = Array.isArray(raw[0]) ? raw[0] : raw;
                            points = flat.map((p) => [p.lat, p.lng]);
                            areaM2 = calculatePolygonArea(flat.map((p) => ({ lat: p.lat, lng: p.lng })));
                        } else if (layer.getLatLng) {
                            const p = layer.getLatLng();
                            points = [[p.lat, p.lng]];
                        }

                        const id =
                            layer._areaId ||
                            (layer._leaflet_id ? `layer_${layer._leaflet_id}` : `poly_${Date.now().toString(36)}_${i}`);
                        layer._areaId = id;
                        map._layersMap.set(id, layer);

                        const displayArea = formatMetricArea(areaM2, xmlNode.getAttribute("locale") || "en-US");
                        const item = {
                            id,
                            name: layer._customName || "Measured Area",
                            areaM2: Math.round(areaM2 * 100) / 100,
                            displayArea,
                            points,
                            latLngs: points.map((pt) => ({ lat: pt[0], lng: pt[1] })),
                            createdAt:
                                layer._createdAt ||
                                new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
                        };
                        layer._createdAt = item.createdAt;
                        items.push(item);
                    });

                    this.setState(bindPath, items);
                    if (statusMsg) {
                        const statusPath = this.parseBindPath("data.status");
                        if (statusPath) this.setState(statusPath, statusMsg);
                    }
                };

                const shapeOptions = {
                    color: xmlNode.getAttribute("draw_color") || "#286247",
                    fillColor: xmlNode.getAttribute("draw_fill_color") || "#d9ef62",
                    fillOpacity: Number(xmlNode.getAttribute("draw_fill_opacity") || 0.34),
                    weight: 3,
                };

                const syncLayersFromState = (items) => {
                    if (!Array.isArray(items) || !L) return;
                    const validIds = new Set(items.map((it) => String(it.id)));

                    // 1. Remove deleted layers
                    for (const [id, layer] of map._layersMap.entries()) {
                        if (!validIds.has(String(id))) {
                            if (drawnItems && drawnItems.hasLayer(layer)) {
                                try {
                                    drawnItems.removeLayer(layer);
                                } catch (_) {}
                            }
                            map._layersMap.delete(id);
                        }
                    }

                    // 2. Add new layers from state
                    items.forEach((item, idx) => {
                        const id = item.id || `poly_${idx}`;
                        if (map._layersMap.has(id)) return;

                        const rawPoints = item.points || item.latlngs || item.latLngs || item.coordinates;
                        let points = null;
                        if (typeof rawPoints === "string") {
                            try {
                                points = JSON.parse(rawPoints);
                            } catch (_) {}
                        } else if (Array.isArray(rawPoints)) {
                            if (Array.isArray(rawPoints[0])) {
                                points = rawPoints;
                            } else if (rawPoints[0] && typeof rawPoints[0] === "object") {
                                points = rawPoints.map((p) => [p.lat, p.lng]);
                            }
                        }

                        if (points && points.length >= 3) {
                            const poly = L.polygon(points, {
                                color: item.color || shapeOptions.color,
                                weight: 3,
                                fillColor: item.fillColor || item.fill_color || shapeOptions.fillColor,
                                fillOpacity: Number(item.fillOpacity || item.fill_opacity || shapeOptions.fillOpacity),
                            });
                            poly._areaId = id;
                            poly._customName = item.name;
                            const areaText =
                                item.displayArea ||
                                item.display_area ||
                                formatMetricArea(item.areaM2 || item.area_sq_m || item.area || 0);
                            poly.bindPopup(
                                `<strong>${item.name || `Area-${id ? id.slice(-4) : "poly"}`}</strong><br>${areaText}`,
                            );
                            drawnItems.addLayer(poly);
                            map._layersMap.set(id, poly);
                        }
                    });
                };
                map._syncLayersFromState = syncLayersFromState;

                // Load initial saved items from state if present & subscribe to reactive state changes
                if (bindPath) {
                    const rawKey = this.parseBindPath(bindPath);
                    syncLayersFromState(this.getState(rawKey) || []);
                    if (this._bindings) {
                        if (!this._bindings.has(rawKey)) this._bindings.set(rawKey, []);
                        this._bindings.get(rawKey).push({
                            el: container,
                            kind: "custom",
                            updateFn: (newItems) => {
                                syncLayersFromState(newItems);
                            },
                        });
                        if (rawKey !== bindPath) {
                            if (!this._bindings.has(bindPath)) this._bindings.set(bindPath, []);
                            this._bindings.get(bindPath).push({
                                el: container,
                                kind: "custom",
                                updateFn: (newItems) => {
                                    syncLayersFromState(newItems);
                                },
                            });
                        }
                    }
                }

                // 3. Leaflet Draw Control Toolbar
                const drawControlNode = this.getChild(xmlNode, "draw_control") || this.getChild(xmlNode, "draw");
                if (enableDraw || drawControlNode) {
                    if (L.Control && L.Control.Draw) {
                        // Ensure tooltip never blocks clicks to underlying vertex markers
                        if (typeof document !== "undefined" && !document.getElementById("euix-leaflet-draw-fix")) {
                            const style = document.createElement("style");
                            style.id = "euix-leaflet-draw-fix";
                            style.textContent = `
                                .leaflet-draw-tooltip { pointer-events: none !important; user-select: none !important; }
                                .leaflet-draw-guide-dash { pointer-events: none !important; }
                                .leaflet-editing-icon { width: 16px !important; height: 16px !important; margin-left: -8px !important; margin-top: -8px !important; cursor: pointer !important; z-index: 2000 !important; }
                            `;
                            document.head.appendChild(style);
                        }

                        const drawPolygon = drawControlNode
                            ? drawControlNode.getAttribute("polygon") !== "false"
                            : true;

                        const drawControl = new L.Control.Draw({
                            position: drawControlNode?.getAttribute("position") || "topleft",
                            draw: {
                                polygon: drawPolygon
                                    ? {
                                          allowIntersection: false,
                                          showArea: true,
                                          repeatMode: false,
                                          guidelineDistance: 10,
                                          shapeOptions,
                                      }
                                    : false,
                                rectangle: false,
                                circle: false,
                                marker: false,
                                polyline: false,
                                circlemarker: false,
                            },
                            edit: {
                                featureGroup: drawnItems,
                                edit: true,
                                remove: true,
                            },
                        });
                        map.addControl(drawControl);

                        const disableDrawToolbar = () => {
                            try {
                                if (drawControl && drawControl._toolbars && drawControl._toolbars.draw) {
                                    drawControl._toolbars.draw.disable();
                                    const modes = drawControl._toolbars.draw._modes;
                                    for (const key in modes) {
                                        if (modes[key]?.handler?.disable) {
                                            modes[key].handler.disable();
                                        }
                                    }
                                }
                            } catch (_) {}
                        };

                        // Global ESC listener to cancel active drawing anytime
                        if (typeof window !== "undefined") {
                            const escKeyHandler = (e) => {
                                if (e.key === "Escape" || e.keyCode === 27) {
                                    disableDrawToolbar();
                                }
                            };
                            window.addEventListener("keydown", escKeyHandler);
                            if (typeof this.onUnmount === "function") {
                                this.onUnmount(() => {
                                    if (typeof window !== "undefined") {
                                        window.removeEventListener("keydown", escKeyHandler);
                                    }
                                });
                            }
                            if (map && typeof map.on === "function") {
                                map.on("unload", () => {
                                    if (typeof window !== "undefined") {
                                        window.removeEventListener("keydown", escKeyHandler);
                                    }
                                });
                            }
                        }

                        // Allow double clicking to finish polygon immediately
                        map.on("dblclick", () => {
                            if (drawControl && drawControl._toolbars && drawControl._toolbars.draw) {
                                const polyMode = drawControl._toolbars.draw._modes.polygon;
                                if (
                                    polyMode &&
                                    polyMode.handler &&
                                    polyMode.handler.enabled &&
                                    polyMode.handler.enabled()
                                ) {
                                    try {
                                        if (typeof polyMode.handler._finishShape === "function") {
                                            polyMode.handler._finishShape();
                                        } else if (typeof polyMode.handler.completeShape === "function") {
                                            polyMode.handler.completeShape();
                                        }
                                    } catch (_) {}
                                }
                            }
                        });

                        const onDrawCreatedNodes = this.getChildren(xmlNode, "on_draw_created");
                        const onDrawEditedNodes = this.getChildren(xmlNode, "on_draw_edited");
                        const onDrawDeletedNodes = this.getChildren(xmlNode, "on_draw_deleted");

                        map.on(L.Draw.Event.CREATED, (event) => {
                            const layer = event.layer;
                            if (layer.setStyle) {
                                layer.setStyle(shapeOptions);
                            }
                            drawnItems.addLayer(layer);
                            syncToState("New area measured and saved.");

                            const items = this.getState(bindPath) || [];
                            const latest = items[items.length - 1];
                            if (latest && layer.bindPopup) {
                                layer.bindPopup(`<strong>${latest.name}</strong><br>${latest.displayArea}`).openPopup();
                            }

                            // Trigger declarative <on_draw_created> actions
                            const eventContext = { ...context, _evt: event, latest };
                            onDrawCreatedNodes.forEach((node) => {
                                this.handleAction(node, eventContext);
                            });

                            // Cleanly ensure toolbar is disarmed
                            setTimeout(disableDrawToolbar, 10);
                        });

                        map.on(L.Draw.Event.EDITED, (event) => {
                            syncToState("Area boundaries updated.");
                            const eventContext = { ...context, _evt: event };
                            onDrawEditedNodes.forEach((node) => this.handleAction(node, eventContext));
                        });
                        map.on(L.Draw.Event.DELETED, (event) => {
                            syncToState("Area removed from map.");
                            const eventContext = { ...context, _evt: event };
                            onDrawDeletedNodes.forEach((node) => this.handleAction(node, eventContext));
                        });
                    }
                }

                // Render child declarative markers & polygons
                const lChildren = xmlNode.children;
                const lcLen = lChildren ? lChildren.length : 0;
                for (let i = 0; i < lcLen; i++) {
                    const child = lChildren[i];
                    const tag = child.tagName ? child.tagName.toLowerCase() : "";
                    if (tag === "marker") {
                        const mLat = Number(this.interpolate(child.getAttribute("lat"), context));
                        const mLng = Number(this.interpolate(child.getAttribute("lng"), context));
                        const title = this.interpolate(child.getAttribute("title") || "", context);
                        const popupText = this.interpolate(
                            child.getAttribute("popup") || child.textContent.trim(),
                            context,
                        );
                        if (!Number.isNaN(mLat) && !Number.isNaN(mLng)) {
                            const marker = L.marker([mLat, mLng], { title }).addTo(map);
                            if (popupText) marker.bindPopup(popupText);
                        }
                    } else if (tag === "polygon") {
                        const pointsStr = this.interpolate(child.getAttribute("points") || "", context);
                        const points = pointsStr
                            .split(";")
                            .map((pair) => {
                                const [pLat, pLng] = pair.split(",").map((s) => Number(s.trim()));
                                return !Number.isNaN(pLat) && !Number.isNaN(pLng) ? [pLat, pLng] : null;
                            })
                            .filter(Boolean);
                        if (points.length >= 3) {
                            const poly = L.polygon(points, {
                                color: child.getAttribute("color") || "#286247",
                                fillColor: child.getAttribute("fill_color") || "#d9ef62",
                                fillOpacity: Number(child.getAttribute("fill_opacity") || 0.34),
                            }).addTo(drawnItems);
                            const pText = child.getAttribute("popup") || child.textContent.trim();
                            if (pText) poly.bindPopup(pText);
                        }
                    }
                }

                // 4. Map Event Listeners
                map.on("moveend", () => {
                    const center = map.getCenter();
                    const zoom = map.getZoom();
                    if (bindCenter) this.setState(bindCenter, `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}`);
                    if (bindZoom) this.setState(bindZoom, zoom);
                });

                // Auto invalidate size on mount
                setTimeout(() => {
                    try {
                        map.invalidateSize();
                    } catch (_) {}
                }, 100);
                setTimeout(() => {
                    try {
                        map.invalidateSize();
                    } catch (_) {}
                }, 400);
            };

            setTimeout(initMapInstance, 0);
            return container;
        };

        /**
         * Declarative Leaflet Action Handlers
         */
        proto.executeLeafletAction = function (actionName, actionNode, context = {}) {
            const mapId = actionNode.getAttribute("map") || actionNode.getAttribute("target") || "map";
            const map = this._leafletMaps
                ? this._leafletMaps.get(mapId) || Array.from(this._leafletMaps.values())[0]
                : null;

            if (!map) return;

            const L = typeof window !== "undefined" ? window.L : null;
            const normAction = actionName.toUpperCase();

            if (normAction === "FLY_TO" || normAction === "PAN_TO" || normAction === "SET_VIEW") {
                const rawLat = actionNode.getAttribute("lat") || actionNode.getAttribute("latitude");
                const rawLng = actionNode.getAttribute("lng") || actionNode.getAttribute("longitude");
                const rawZoom = actionNode.getAttribute("zoom");
                const duration = Number(actionNode.getAttribute("duration") || 1.5);

                let lat = rawLat ? Number(this.interpolate(rawLat, context)) : map.getCenter().lat;
                let lng = rawLng ? Number(this.interpolate(rawLng, context)) : map.getCenter().lng;
                const zoom = rawZoom ? Number(this.interpolate(rawZoom, context)) : map.getZoom();

                if (actionNode.getAttribute("center")) {
                    const parts = this.interpolate(actionNode.getAttribute("center"), context)
                        .split(",")
                        .map((s) => Number(s.trim()));
                    if (parts.length >= 2 && !Number.isNaN(parts[0]) && !Number.isNaN(parts[1])) {
                        lat = parts[0];
                        lng = parts[1];
                    }
                }

                if (normAction === "FLY_TO" && map.flyTo) {
                    map.flyTo([lat, lng], zoom, { duration });
                } else if (normAction === "PAN_TO" && map.panTo) {
                    map.panTo([lat, lng]);
                } else {
                    map.setView([lat, lng], zoom);
                }
            } else if (normAction === "CLEAR_MAP" || normAction === "CLEAR_LAYERS") {
                if (map._drawnItems) {
                    map._drawnItems.clearLayers();
                }
                if (map._layersMap) {
                    map._layersMap.clear();
                }
                const bindPath = actionNode.getAttribute("bind") || actionNode.getAttribute("path") || map._bindPath;
                if (bindPath) {
                    const cleanPath = this.parseBindPath(this.interpolate(bindPath, context));
                    if (cleanPath) this.setState(cleanPath, []);
                }
            } else if (normAction === "REMOVE_LAYER" || normAction === "DELETE_LAYER") {
                const rawLayerId = actionNode.getAttribute("layer_id") || actionNode.getAttribute("id") || "";
                const layerId = this.interpolate(rawLayerId, context);
                if (layerId) {
                    const layersMap = map._layersMap;
                    if (layersMap && layersMap.has(layerId)) {
                        const layer = layersMap.get(layerId);
                        if (layer && map._drawnItems) {
                            try {
                                map._drawnItems.removeLayer(layer);
                            } catch (_) {}
                        }
                        layersMap.delete(layerId);
                    }
                    const bindPath =
                        actionNode.getAttribute("bind") || actionNode.getAttribute("path") || map._bindPath;
                    if (bindPath) {
                        const cleanPath = this.parseBindPath(this.interpolate(bindPath, context));
                        if (cleanPath) {
                            const current = this.getState(cleanPath);
                            if (Array.isArray(current)) {
                                const nextList = current.filter((it) => String(it.id) !== String(layerId));
                                this.setState(cleanPath, nextList);
                            }
                        }
                    }
                }
            } else if (
                normAction === "FOCUS_LAYER" ||
                normAction === "FIT_LAYER" ||
                normAction === "SELECT_LAYER" ||
                normAction === "FIT_BOUNDS"
            ) {
                const rawLayerId = actionNode.getAttribute("layer_id") || actionNode.getAttribute("id") || "";
                const layerId = this.interpolate(rawLayerId, context);
                if (layerId) {
                    const layersMap = map._layersMap;
                    let layer = layersMap ? layersMap.get(layerId) : null;

                    if (!layer && map._syncLayersFromState && map._bindPath) {
                        const items = this.getState(map._bindPath) || [];
                        map._syncLayersFromState(items);
                        layer = map._layersMap ? map._layersMap.get(layerId) : null;
                    }

                    if (layer) {
                        if (layer.getBounds && map.fitBounds) {
                            const bounds = layer.getBounds();
                            if (bounds && bounds.isValid && bounds.isValid()) {
                                map.fitBounds(bounds.pad ? bounds.pad(0.35) : bounds, { animate: true, duration: 1.2 });
                            }
                        } else if (layer.getLatLng && map.flyTo) {
                            map.flyTo(layer.getLatLng(), Math.max(map.getZoom(), 15), { duration: 1.2 });
                        }
                        if (layer.openPopup) {
                            setTimeout(() => {
                                try {
                                    layer.openPopup();
                                } catch (_) {}
                            }, 350);
                        }
                    } else if (map._bindPath && L) {
                        // Direct coordinate fallback from state
                        const items = this.getState(map._bindPath) || [];
                        const item = Array.isArray(items)
                            ? items.find((it) => String(it.id) === String(layerId))
                            : null;
                        if (item) {
                            const raw = item.points || item.latlngs || item.latLngs || item.coordinates;
                            let pts = null;
                            if (typeof raw === "string") {
                                try {
                                    pts = JSON.parse(raw);
                                } catch (_) {}
                            } else if (Array.isArray(raw)) pts = raw;
                            if (pts && pts.length >= 3 && map.fitBounds) {
                                const latlngs = pts.map((p) => (Array.isArray(p) ? p : [p.lat, p.lng]));
                                const bounds = L.latLngBounds(latlngs);
                                if (bounds.isValid()) map.fitBounds(bounds.pad(0.35), { animate: true, duration: 1.2 });
                            }
                        }
                    }
                } else if (map._drawnItems && map.fitBounds) {
                    const bounds = map._drawnItems.getBounds();
                    if (bounds && bounds.isValid && bounds.isValid()) {
                        map.fitBounds(bounds.pad ? bounds.pad(0.2) : bounds, { animate: true });
                    }
                }
            } else if (normAction === "INVALIDATE_MAP_SIZE" || normAction === "RESIZE_MAP") {
                try {
                    map.invalidateSize();
                } catch (_) {}
            } else if (normAction === "ADD_MARKER") {
                const lat = Number(this.interpolate(actionNode.getAttribute("lat") || "0", context));
                const lng = Number(this.interpolate(actionNode.getAttribute("lng") || "0", context));
                const popup = this.interpolate(actionNode.getAttribute("popup") || "", context);
                if (L && !Number.isNaN(lat) && !Number.isNaN(lng)) {
                    const marker = L.marker([lat, lng]).addTo(map);
                    if (popup) marker.bindPopup(popup).openPopup();
                }
            }
        };

        // Register Leaflet Actions in EUIX Action Registry
        const leafletActions = [
            "FLY_TO",
            "PAN_TO",
            "SET_VIEW",
            "FIT_BOUNDS",
            "FOCUS_LAYER",
            "FIT_LAYER",
            "SELECT_LAYER",
            "CLEAR_MAP",
            "CLEAR_LAYERS",
            "REMOVE_LAYER",
            "DELETE_LAYER",
            "INVALIDATE_MAP_SIZE",
            "RESIZE_MAP",
            "ADD_MARKER",
        ];

        leafletActions.forEach((actionName) => {
            if (typeof engineClass.registerAction === "function") {
                engineClass.registerAction(actionName, function (actionNode, context) {
                    return this.executeLeafletAction(actionName, actionNode, context);
                });
            }
        });
    },
};
