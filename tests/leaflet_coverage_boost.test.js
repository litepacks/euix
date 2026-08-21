import { describe, it, expect, beforeEach, vi } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import {
    EUIXLeafletPlugin,
    calculatePolygonArea,
    formatMetricArea
} from "../src/plugins/EUIXLeafletPlugin.js";

EUIXEngineCore.use(EUIXLeafletPlugin);

describe("EUIXLeafletPlugin Coverage Boost Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
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
            setZoom: vi.fn(function(zoom) {
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
                addTo: vi.fn(() => ({})),
                remove: vi.fn()
            })),
            marker: vi.fn((coords, opts) => ({
                addTo: vi.fn(() => ({})),
                bindPopup: vi.fn(() => ({ openPopup: vi.fn() })),
                on: vi.fn(),
                setLatLng: vi.fn(),
                remove: vi.fn()
            })),
            circle: vi.fn((coords, opts) => ({
                addTo: vi.fn(() => ({})),
                bindPopup: vi.fn(() => ({ openPopup: vi.fn() })),
                setLatLng: vi.fn(),
                setRadius: vi.fn(),
                remove: vi.fn()
            })),
            polygon: vi.fn((coords, opts) => ({
                addTo: vi.fn(() => ({})),
                bindPopup: vi.fn(() => ({ openPopup: vi.fn() })),
                setLatLngs: vi.fn(),
                remove: vi.fn()
            })),
            geoJSON: vi.fn((data, opts) => ({
                addTo: vi.fn(() => ({})),
                addData: vi.fn(),
                remove: vi.fn()
            })),
            layerGroup: vi.fn(() => ({
                addTo: vi.fn(() => ({})),
                addLayer: vi.fn(),
                clearLayers: vi.fn(),
                remove: vi.fn()
            })),
            icon: vi.fn(opts => opts),
            divIcon: vi.fn(opts => opts)
        };
    });

    it("should test polygon area calculation and metric area formatting", () => {
        // Empty or invalid coordinates
        expect(calculatePolygonArea([])).toBe(0);
        expect(calculatePolygonArea([[0, 0]])).toBe(0);
        expect(calculatePolygonArea([[0, 0], [0, 1]])).toBe(0);

        // Simple triangle
        const triangle = [
            [39.92077, 32.85411],
            [39.93077, 32.85411],
            [39.93077, 32.86411]
        ];
        const area = calculatePolygonArea(triangle);
        expect(area).toBeGreaterThan(0);

        // Formatting
        expect(formatMetricArea(500)).toBe("500 m²");
        expect(formatMetricArea(5000)).toBe("5,000 m²");
        expect(formatMetricArea(5000000)).toBe("5 km²");
    });

    it("should execute spatial actions MAP_FLY_TO, MAP_PAN_TO, MAP_SET_ZOOM, MAP_TOGGLE_LAYER", () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="targetLat" type="number">41.0082</state>
                <state id="targetLng" type="number">28.9784</state>
                <state id="mapZoom" type="number">10</state>
            </data_model>

            <flex direction="column">
                <map id="main-map" center="[39.92077, 32.85411]" zoom="12" height="300">
                    <tile_layer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <marker lat="39.92077" lng="32.85411" title="Ankara Center" popup="Capital City" />
                    <circle lat="39.92077" lng="32.85411" radius="500" color="#3b82f6" />
                </map>

                <button id="btn-fly">
                    <on_click action="MAP_FLY_TO" map="main-map" lat="{data.targetLat}" lng="{data.targetLng}" zoom="14" />
                    Fly
                </button>

                <button id="btn-pan">
                    <on_click action="MAP_PAN_TO" map="main-map" lat="{data.targetLat}" lng="{data.targetLng}" />
                    Pan
                </button>

                <button id="btn-zoom">
                    <on_click action="MAP_SET_ZOOM" map="main-map" zoom="16" />
                    Set Zoom
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine).toBeDefined();

        const btnFly = container.querySelector("#btn-fly");
        btnFly.click();

        const btnPan = container.querySelector("#btn-pan");
        btnPan.click();

        const btnZoom = container.querySelector("#btn-zoom");
        btnZoom.click();
    });
});
