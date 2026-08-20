/**
 * tests/leaflet_reactive_layers.test.js
 * Comprehensive tests for EUIXLeafletPlugin syncLayersFromState, tile providers, and drawing toolbar.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXLeafletPlugin } from '../src/plugins/EUIXLeafletPlugin.js';

describe('EUIXLeafletPlugin - Reactive Layers Sync & Map Providers', () => {
    let container;
    let mockMap;
    let mockDrawnItems;

    beforeEach(() => {
        EUIXEngineCore.use(EUIXLeafletPlugin);
        container = document.createElement('div');
        container.id = 'app';
        document.body.appendChild(container);

        mockDrawnItems = {
            addLayer: vi.fn(),
            removeLayer: vi.fn(),
            hasLayer: vi.fn().mockReturnValue(true),
            clearLayers: vi.fn()
        };

        mockMap = {
            _drawnItems: mockDrawnItems,
            _layersMap: new Map(),
            addLayer: vi.fn(),
            addControl: vi.fn(),
            on: vi.fn(),
            invalidateSize: vi.fn(),
            getCenter: vi.fn().mockReturnValue({ lat: 41.0, lng: 28.9 }),
            getZoom: vi.fn().mockReturnValue(12),
            fitBounds: vi.fn()
        };

        window.L = {
            map: vi.fn().mockReturnValue(mockMap),
            tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn() }),
            FeatureGroup: function() { return mockDrawnItems; },
            featureGroup: vi.fn().mockReturnValue(mockDrawnItems),
            polygon: vi.fn((points, options) => ({
                points,
                options,
                bindPopup: vi.fn(),
                getBounds: vi.fn().mockReturnValue({ isValid: () => true })
            })),
            Control: {
                Draw: vi.fn().mockReturnValue({ addTo: vi.fn() })
            },
            Draw: {
                Event: {
                    CREATED: 'draw:created',
                    EDITED: 'draw:edited',
                    DELETED: 'draw:deleted'
                }
            }
        };
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        vi.restoreAllMocks();
    });

    it('should test syncLayersFromState adding polygons from coordinates and object points', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="polygons" type="array">[
                    {"id":"poly_1","name":"Zone A","points":"[[41.0, 28.9],[41.1, 28.9],[41.1, 29.0]]","area":50000},
                    {"id":"poly_2","name":"Zone B","latLngs":[{"lat":41.2,"lng":28.8},{"lat":41.3,"lng":28.8},{"lat":41.3,"lng":28.9}]}
                ]</state>
            </data_model>
            <leaflet id="main_map" bind="data.polygons" center="41.0, 28.9" zoom="12" enable_draw="true">
                <draw_control />
            </leaflet>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        await new Promise(r => setTimeout(r, 60));

        expect(window.L.map).toHaveBeenCalled();
        expect(window.L.polygon).toHaveBeenCalled();
        expect(mockDrawnItems.addLayer).toHaveBeenCalledTimes(2);

        // Update state to remove poly_1
        engine.setState('polygons', [
            { id: "poly_2", name: "Zone B", latLngs: [{ lat: 41.2, lng: 28.8 }, { lat: 41.3, lng: 28.8 }, { lat: 41.3, lng: 28.9 }] }
        ]);

        expect(mockDrawnItems.removeLayer).toHaveBeenCalled();
    });

    it('should test Leaflet tileLayer configuration with custom url and attribution', async () => {
        const xml = `
        <uid_spec>
            <leaflet id="sat_map" tile_layer="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" tile_attribution="Esri" center="41.0, 28.9" zoom="10" />
        </uid_spec>
        `;

        EUIXEngineCore.mount(xml, container);
        await new Promise(r => setTimeout(r, 60));

        expect(window.L.tileLayer).toHaveBeenCalledWith(
            expect.stringContaining('arcgisonline.com'),
            expect.objectContaining({ attribution: 'Esri' })
        );
    });
});
