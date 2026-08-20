/**
 * tests/leaflet_and_api_advanced.test.js
 * Comprehensive tests for Leaflet MAP_FOCUS_LAYER coordinate fallback, RESIZE_MAP, and API REVALIDATE action child nodes.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXLeafletPlugin } from '../src/plugins/EUIXLeafletPlugin.js';
import { EUIXApiPlugin } from '../src/plugins/EUIXApiPlugin.js';

describe('Leaflet & API Advanced Actions Suite', () => {
    let container;

    beforeEach(() => {
        EUIXEngineCore.use(EUIXLeafletPlugin);
        EUIXEngineCore.use(EUIXApiPlugin);
        container = document.createElement('div');
        container.id = 'app';
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        vi.restoreAllMocks();
    });

    it('should test API REVALIDATE action with child <url> and <tag> tags', async () => {
        const engine = new EUIXEngineCore(container);
        engine.revalidateApi = vi.fn().mockResolvedValue(true);

        const domParser = new DOMParser();
        const actionDoc1 = domParser.parseFromString(
            '<action action="REVALIDATE"><url>/api/users</url></action>',
            'text/xml'
        );
        const actionDoc2 = domParser.parseFromString(
            '<action action="REVALIDATE"><tag>stats_endpoint</tag></action>',
            'text/xml'
        );

        await engine.handleAction(actionDoc1.documentElement, {});
        expect(engine.revalidateApi).toHaveBeenCalledWith('/api/users');

        await engine.handleAction(actionDoc2.documentElement, {});
        expect(engine.revalidateApi).toHaveBeenCalledWith('stats_endpoint');
    });

    it('should test Leaflet FOCUS_LAYER coordinate fallback and RESIZE_MAP', async () => {
        const mockMap = {
            _bindPath: 'polygons',
            _drawnItems: null,
            _layersMap: new Map(),
            fitBounds: vi.fn(),
            invalidateSize: vi.fn(),
            getZoom: vi.fn().mockReturnValue(12),
            flyTo: vi.fn()
        };

        const mockL = {
            latLngBounds: vi.fn().mockReturnValue({
                isValid: vi.fn().mockReturnValue(true),
                pad: vi.fn().mockReturnValue([[40, 28], [42, 30]])
            })
        };
        window.L = mockL;

        const engine = new EUIXEngineCore(container);
        engine._data = { polygons: [{ id: 'poly_1', points: [[41.0, 28.9], [41.1, 29.0], [41.0, 29.1]] }] };
        engine._rawState = engine._data;

        const domParser = new DOMParser();
        const focusDoc = domParser.parseFromString(
            '<action action="FOCUS_LAYER" map="main_map" layer_id="poly_1" />',
            'text/xml'
        );
        const resizeDoc = domParser.parseFromString(
            '<action action="RESIZE_MAP" map="main_map" />',
            'text/xml'
        );

        // Attach mock map to engine
        engine._leafletMaps = new Map([['main_map', mockMap]]);

        await engine.handleAction(focusDoc.documentElement, { _mapInstance: mockMap });
        expect(mockL.latLngBounds).toHaveBeenCalled();
        expect(mockMap.fitBounds).toHaveBeenCalled();

        await engine.handleAction(resizeDoc.documentElement, { _mapInstance: mockMap });
        expect(mockMap.invalidateSize).toHaveBeenCalled();

        delete window.L;
    });
});
