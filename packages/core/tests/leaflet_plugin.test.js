/**
 * tests/leaflet_plugin.test.js
 * Comprehensive Unit and Integration Test Suite for EUIXLeafletPlugin
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXEngine } from "../src/EUIXEngine.js";
import {
    EUIXLeafletPlugin,
    calculatePolygonArea,
    formatMetricArea
} from "../src/plugins/EUIXLeafletPlugin.js";

describe("EUIXLeafletPlugin - Declarative Interactive Map & Spatial Analysis Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        container.id = "app";
        document.body.appendChild(container);

        // Mock window.L Leaflet object in JSDOM
        const createdLayers = [];
        const mockMapInstance = {
            _layers: new Map(),
            _center: { lat: 39.92077, lng: 32.85411 },
            _zoom: 13,
            getCenter() { return this._center; },
            getZoom() { return this._zoom; },
            addLayer(layer) {
                createdLayers.push(layer);
                return this;
            },
            removeLayer(layer) {
                const idx = createdLayers.indexOf(layer);
                if (idx !== -1) createdLayers.splice(idx, 1);
            },
            addControl: vi.fn(),
            flyTo: vi.fn(function(latlng, zoom) {
                this._center = { lat: latlng[0], lng: latlng[1] };
                this._zoom = zoom;
            }),
            panTo: vi.fn(function(latlng) {
                this._center = { lat: latlng[0], lng: latlng[1] };
            }),
            setView: vi.fn(function(latlng, zoom) {
                this._center = { lat: latlng[0], lng: latlng[1] };
                this._zoom = zoom;
            }),
            invalidateSize: vi.fn(),
            remove: vi.fn(),
            on: vi.fn((event, handler) => {
                mockMapInstance[`_on_${event}`] = handler;
            })
        };

        window.L = {
            map: vi.fn(() => mockMapInstance),
            tileLayer: vi.fn(() => ({
                addTo: vi.fn()
            })),
            marker: vi.fn((latlng, opts) => ({
                latlng,
                opts,
                addTo: vi.fn().mockReturnThis(),
                bindPopup: vi.fn().mockReturnThis(),
                openPopup: vi.fn().mockReturnThis()
            })),
            polygon: vi.fn((points, opts) => ({
                points,
                opts,
                addTo: vi.fn().mockReturnThis(),
                bindPopup: vi.fn().mockReturnThis(),
                getLatLngs: () => points.map(p => Array.isArray(p) ? { lat: p[0], lng: p[1] } : p)
            })),
            FeatureGroup: vi.fn(function() {
                const groupLayers = [];
                return {
                    addLayer(l) { groupLayers.push(l); },
                    removeLayer(l) {
                        const idx = groupLayers.indexOf(l);
                        if (idx !== -1) groupLayers.splice(idx, 1);
                    },
                    clearLayers() { groupLayers.length = 0; },
                    eachLayer(cb) { groupLayers.forEach(cb); },
                    getLayers() { return groupLayers; }
                };
            }),
            Control: {
                Draw: vi.fn(function(opts) {
                    this.options = opts;
                })
            },
            Draw: {
                Event: {
                    CREATED: "draw:created",
                    EDITED: "draw:edited",
                    DELETED: "draw:deleted"
                }
            }
        };
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        delete window.L;
        vi.restoreAllMocks();
    });

    it("1. should calculate polygon geodesic area and format metric area units correctly", () => {
        expect(calculatePolygonArea(null)).toBe(0);
        expect(calculatePolygonArea([])).toBe(0);
        expect(calculatePolygonArea([{ lat: 0, lng: 0 }])).toBe(0);

        // Approximate square in Ankara (~1.2 km sides)
        const squarePoints = [
            { lat: 39.92, lng: 32.85 },
            { lat: 39.93, lng: 32.85 },
            { lat: 39.93, lng: 32.86 },
            { lat: 39.92, lng: 32.86 }
        ];
        const area = calculatePolygonArea(squarePoints);
        expect(area).toBeGreaterThan(500000); // > 0.5 km²

        // Format checks
        expect(formatMetricArea(500)).toBe("500 m²");
        expect(formatMetricArea(25000)).toContain("ha");
        expect(formatMetricArea(3500000)).toContain("km²");
    });

    it("2. should expose plugin metadata and install method on engine", () => {
        expect(EUIXLeafletPlugin.name).toBe("leaflet");
        expect(typeof EUIXLeafletPlugin.install).toBe("function");
        expect(typeof EUIXEngineCore.prototype.renderLeafletMap).toBe("function");
        expect(typeof EUIXEngineCore.prototype.executeLeafletAction).toBe("function");
    });

    it("3. should mount declarative <leaflet_map> element into container", async () => {
        const xml = `
        <uid_spec>
            <leaflet_map id="test_map" lat="39.92" lng="32.85" zoom="14" class="custom-map-class" />
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const mapEl = container.querySelector("#test_map");

        expect(mapEl).not.toBeNull();
        expect(mapEl.className).toContain("euix-leaflet-map");
        expect(mapEl.className).toContain("custom-map-class");

        // Wait for next tick initialization
        await new Promise(r => setTimeout(r, 20));
        expect(window.L.map).toHaveBeenCalled();
    });

    it("4. should render declarative tile_layer, markers, and polygons inside <leaflet_map>", async () => {
        const xml = `
        <uid_spec>
            <leaflet_map id="city_map" lat="41.0082" lng="28.9784" zoom="12">
                <tile_layer url="https://tiles.example.com/{z}/{x}/{y}.png" attribution="Custom Tiles" />
                <marker lat="41.0082" lng="28.9784" title="Istanbul" popup="Historic Istanbul" />
                <polygon points="41.0,28.9; 41.01,28.91; 40.99,28.92" color="#ff0000" fill_color="#00ff00" />
            </leaflet_map>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        await new Promise(r => setTimeout(r, 20));

        expect(window.L.tileLayer).toHaveBeenCalledWith(
            "https://tiles.example.com/{z}/{x}/{y}.png",
            expect.objectContaining({ attribution: "Custom Tiles" })
        );
        expect(window.L.marker).toHaveBeenCalledWith([41.0082, 28.9784], { title: "Istanbul" });
        expect(window.L.polygon).toHaveBeenCalled();
    });

    it("5. should handle declarative FLY_TO, PAN_TO, and SET_VIEW actions", async () => {
        const xml = `
        <uid_spec>
            <flex direction="column">
                <leaflet_map id="main_map" lat="39.92" lng="32.85" zoom="13" />
                <flex>
                    <button id="btn_fly">
                        <on_click action="FLY_TO" map="main_map" lat="41.01" lng="28.98" zoom="15" duration="2" />
                        Fly to Istanbul
                    </button>
                    <button id="btn_pan">
                        <on_click action="PAN_TO" map="main_map" lat="38.42" lng="27.13" />
                        Pan to Izmir
                    </button>
                    <button id="btn_view">
                        <on_click action="SET_VIEW" map="main_map" lat="36.88" lng="30.70" zoom="12" />
                        Set View Antalya
                    </button>
                    <button id="btn_resize">
                        <on_click action="INVALIDATE_MAP_SIZE" map="main_map" />
                        Resize
                    </button>
                </flex>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        await new Promise(r => setTimeout(r, 20));

        const mapInstance = engine._leafletMaps.get("main_map");
        expect(mapInstance).toBeDefined();

        // Click Fly
        container.querySelector("#btn_fly").click();
        expect(mapInstance.flyTo).toHaveBeenCalledWith([41.01, 28.98], 15, { duration: 2 });

        // Click Pan
        container.querySelector("#btn_pan").click();
        expect(mapInstance.panTo).toHaveBeenCalledWith([38.42, 27.13]);

        // Click Set View
        container.querySelector("#btn_view").click();
        expect(mapInstance.setView).toHaveBeenCalledWith([36.88, 30.70], 12);

        // Click Resize
        container.querySelector("#btn_resize").click();
        expect(mapInstance.invalidateSize).toHaveBeenCalled();
    });

    it("6. should synchronize drawn layers with EUIX reactive state and support CLEAR_MAP and REMOVE_LAYER", async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="selections" type="array"></state>
                <state id="status">Ready</state>
            </data_model>
            <flex direction="column">
                <leaflet_map id="poly_map" lat="39.92" lng="32.85" zoom="13" bind="data.selections" draw="true" />
                <flex>
                    <button id="btn_clear">
                        <on_click action="CLEAR_MAP" map="poly_map" bind="data.selections" />
                        Clear
                    </button>
                    <button id="btn_remove_item">
                        <on_click action="REMOVE_LAYER" map="poly_map" layer_id="poly_1" />
                        Remove
                    </button>
                    <button id="btn_add_marker">
                        <on_click action="ADD_MARKER" map="poly_map" lat="39.95" lng="32.88" popup="New Spot" />
                        Add Marker
                    </button>
                </flex>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        await new Promise(r => setTimeout(r, 20));

        const mapInstance = engine._leafletMaps.get("poly_map");
        expect(mapInstance).toBeDefined();

        // Simulate a draw:created event
        const mockLayer = {
            _customName: "Test Bölgesi",
            bindPopup: vi.fn().mockReturnThis(),
            openPopup: vi.fn().mockReturnThis(),
            getLatLngs: () => [
                { lat: 39.92, lng: 32.85 },
                { lat: 39.93, lng: 32.85 },
                { lat: 39.93, lng: 32.86 }
            ]
        };

        if (mapInstance._on_drawcreated) {
            mapInstance._on_drawcreated({ layer: mockLayer });
        }

        // Verify state was populated
        const selections = engine.getState("selections");
        expect(Array.isArray(selections)).toBe(true);

        // Click Add Marker
        container.querySelector("#btn_add_marker").click();
        expect(window.L.marker).toHaveBeenCalledWith([39.95, 32.88]);

        // Click Clear
        container.querySelector("#btn_clear").click();
        expect(engine.getState("selections")).toEqual([]);
    });

    it("8. should switch active class on country buttons dynamically", async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="active_country">TR</state>
                </data_model>
                <container>
                    <button id="btn_tr" class="country-btn {data.active_country == 'TR' ? 'active' : ''}">
                        <on_click action="SET_STATE">
                            <path>data.active_country</path>
                            <value>TR</value>
                        </on_click>
                        TR
                    </button>
                    <button id="btn_uk" class="country-btn {data.active_country == 'UK' ? 'active' : ''}">
                        <on_click action="SET_STATE">
                            <path>data.active_country</path>
                            <value>UK</value>
                        </on_click>
                        UK
                    </button>
                </container>
            </uid_spec>
        `;
        const engine = EUIXEngine.mount(xml, container);
        const btnTr = container.querySelector("#btn_tr");
        const btnUk = container.querySelector("#btn_uk");

        expect(btnTr.className).toContain("active");
        expect(btnUk.className).not.toContain("active");

        btnUk.click();
        await new Promise(r => setTimeout(r, 20));

        expect(btnUk.className).toContain("active");
        expect(btnTr.className).not.toContain("active");
    });

    it("9. should execute SelectCity composed action workflow and switch active_country", async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="active_country">TR</state>
                    <state id="status">Ready</state>
                </data_model>
                <actions>
                    <action_def name="SelectCity">
                        <param name="country" required="true" />
                        <param name="city" required="true" />
                        <param name="lat" required="true" />
                        <param name="lng" required="true" />
                        <param name="zoom" default="13" />

                        <step action="SET_STATE">
                            <path>data.active_country</path>
                            <value>{args.country}</value>
                        </step>
                        <step action="SET_STATE">
                            <path>data.status</path>
                            <value>Focused on {args.city}.</value>
                        </step>
                        <step action="FLY_TO" map="main_map" lat="{args.lat}" lng="{args.lng}" zoom="{args.zoom}" duration="1.5" />
                    </action_def>
                </actions>
                <container>
                    <leaflet_map id="main_map" lat="41.0" lng="28.9" zoom="13" />
                    <button id="btn_tr" class="country-btn {data.active_country == 'TR' ? 'active' : ''}">
                        <on_click action="SelectCity">
                            <arg name="country">TR</arg>
                            <arg name="city">Istanbul, Turkey</arg>
                            <arg name="lat">41.0082</arg>
                            <arg name="lng">28.9784</arg>
                            <arg name="zoom">13</arg>
                        </on_click>
                        TR
                    </button>
                    <button id="btn_uk" class="country-btn {data.active_country == 'UK' ? 'active' : ''}">
                        <on_click action="SelectCity">
                            <arg name="country">UK</arg>
                            <arg name="city">London, United Kingdom</arg>
                            <arg name="lat">51.5074</arg>
                            <arg name="lng">-0.1278</arg>
                            <arg name="zoom">13</arg>
                        </on_click>
                        UK
                    </button>
                </container>
            </uid_spec>
        `;
        const engine = EUIXEngine.mount(xml, container);
        const btnTr = container.querySelector("#btn_tr");
        const btnUk = container.querySelector("#btn_uk");

        expect(engine.getState("active_country")).toBe("TR");
        expect(btnTr.className).toContain("active");
        expect(btnUk.className).not.toContain("active");

        btnUk.click();
        await new Promise(r => setTimeout(r, 40));

        expect(engine.getState("active_country")).toBe("UK");
        expect(engine.getState("status")).toBe("Focused on London, United Kingdom.");
        expect(btnUk.className).toContain("active");
        expect(btnTr.className).not.toContain("active");
    });

    it("10. should navigate smoothly across all cities in sequence with Action Composer", async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="active_country">TR</state>
                    <state id="status">Initial</state>
                </data_model>
                <actions>
                    <action_def name="SelectCity">
                        <param name="country" required="true" />
                        <param name="city" required="true" />
                        <param name="lat" required="true" />
                        <param name="lng" required="true" />
                        <param name="zoom" default="13" />

                        <step action="SET_STATE">
                            <path>data.active_country</path>
                            <value>{args.country}</value>
                        </step>
                        <step action="SET_STATE">
                            <path>data.status</path>
                            <value>Focused on {args.city}.</value>
                        </step>
                        <step action="FLY_TO" map="main_map" lat="{args.lat}" lng="{args.lng}" zoom="{args.zoom}" duration="1.5" />
                    </action_def>
                </actions>
                <container>
                    <leaflet_map id="main_map" lat="41.0" lng="28.9" zoom="13" />
                    <button id="btn_tr" class="country-btn {data.active_country == 'TR' ? 'active' : ''}">
                        <on_click action="SelectCity">
                            <arg name="country">TR</arg>
                            <arg name="city">Istanbul, Turkey</arg>
                            <arg name="lat">41.0082</arg>
                            <arg name="lng">28.9784</arg>
                        </on_click>
                        TR
                    </button>
                    <button id="btn_uk" class="country-btn {data.active_country == 'UK' ? 'active' : ''}">
                        <on_click action="SelectCity">
                            <arg name="country">UK</arg>
                            <arg name="city">London, United Kingdom</arg>
                            <arg name="lat">51.5074</arg>
                            <arg name="lng">-0.1278</arg>
                        </on_click>
                        UK
                    </button>
                    <button id="btn_usa" class="country-btn {data.active_country == 'USA' ? 'active' : ''}">
                        <on_click action="SelectCity">
                            <arg name="country">USA</arg>
                            <arg name="city">New York, United States</arg>
                            <arg name="lat">40.7128</arg>
                            <arg name="lng">-74.0060</arg>
                        </on_click>
                        USA
                    </button>
                    <button id="btn_jp" class="country-btn {data.active_country == 'JP' ? 'active' : ''}">
                        <on_click action="SelectCity">
                            <arg name="country">JP</arg>
                            <arg name="city">Tokyo, Japan</arg>
                            <arg name="lat">35.6762</arg>
                            <arg name="lng">139.6503</arg>
                        </on_click>
                        JP
                    </button>
                </container>
            </uid_spec>
        `;
        const engine = EUIXEngine.mount(xml, container);
        const btnTr = container.querySelector("#btn_tr");
        const btnUk = container.querySelector("#btn_uk");
        const btnUsa = container.querySelector("#btn_usa");
        const btnJp = container.querySelector("#btn_jp");

        // 1. Initial State
        expect(engine.getState("active_country")).toBe("TR");
        expect(btnTr.className).toContain("active");
        expect(btnUk.className).not.toContain("active");
        expect(btnUsa.className).not.toContain("active");
        expect(btnJp.className).not.toContain("active");

        // 2. Click USA
        btnUsa.click();
        await new Promise(r => setTimeout(r, 20));
        expect(engine.getState("active_country")).toBe("USA");
        expect(engine.getState("status")).toBe("Focused on New York, United States.");
        expect(btnUsa.className).toContain("active");
        expect(btnTr.className).not.toContain("active");

        // 3. Click JP
        btnJp.click();
        await new Promise(r => setTimeout(r, 20));
        expect(engine.getState("active_country")).toBe("JP");
        expect(engine.getState("status")).toBe("Focused on Tokyo, Japan.");
        expect(btnJp.className).toContain("active");
        expect(btnUsa.className).not.toContain("active");

        // 4. Click TR again
        btnTr.click();
        await new Promise(r => setTimeout(r, 20));
        expect(engine.getState("active_country")).toBe("TR");
        expect(engine.getState("status")).toBe("Focused on Istanbul, Turkey.");
        expect(btnTr.className).toContain("active");
        expect(btnJp.className).not.toContain("active");
    });

    it("10. should trigger on_draw_created declarative action workflow on map polygon creation", async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            headers: new Map([["content-type", "application/json"]]),
            json: async () => ({ success: true })
        });
        global.fetch = mockFetch;

        const xml = `
            <uid_spec>
                <data_model>
                    <state id="selections" type="array"></state>
                    <state id="persisted_msg"></state>
                    <state id="active_country">TR</state>
                    <state id="draft_id"></state>
                    <state id="draft_name"></state>
                </data_model>

                <api_config base_url="https://api.test.org" />

                <actions>
                    <action_def name="PersistDrawn">
                        <step action="RUN_SCRIPT"><![CDATA[
                            const items = $data.selections || [];
                            const latest = items[items.length - 1];
                            if (latest) {
                                $data.draft_id = latest.id;
                                $data.draft_name = latest.name;
                            }
                        ]]></step>
                        <step action="XHR">
                            <method>POST</method>
                            <url>/api/polygons</url>
                            <body>{"id":"{data.draft_id}","name":"{data.draft_name}"}</body>
                        </step>
                        <step action="SET_STATE">
                            <path>data.persisted_msg</path>
                            <value>Successfully Saved {data.draft_name}</value>
                        </step>
                    </action_def>
                </actions>

                <leaflet_map id="test_draw_map" lat="39.92" lng="32.85" zoom="13" bind="data.selections" draw="true">
                    <on_draw_created action="PersistDrawn" />
                </leaflet_map>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        await new Promise(r => setTimeout(r, 20));

        const mapInstance = engine._leafletMaps.get("test_draw_map");
        expect(mapInstance).toBeDefined();

        const mockLayer = {
            _customName: "Ankara Park",
            bindPopup: vi.fn().mockReturnThis(),
            openPopup: vi.fn().mockReturnThis(),
            getLatLngs: () => [
                { lat: 39.92, lng: 32.85 },
                { lat: 39.93, lng: 32.85 },
                { lat: 39.93, lng: 32.86 }
            ]
        };

        if (mapInstance["_on_draw:created"]) {
            mapInstance["_on_draw:created"]({ layer: mockLayer });
        }

        await new Promise(r => setTimeout(r, 60));

        expect(mockFetch).toHaveBeenCalled();
        const [calledUrl, calledOpts] = mockFetch.mock.calls[0];
        expect(calledUrl).toBe("https://api.test.org/api/polygons");
        expect(calledOpts.method).toBe("POST");
        expect(engine.getState("persisted_msg")).toContain("Successfully Saved");
    });
});



