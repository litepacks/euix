/**
 * tests/data_and_leaflet_deep.test.js
 * Comprehensive tests for Route Loader Manager, Revalidation Manager, and Leaflet Actions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXRouterPlugin, createMemoryRouter } from '../src/plugins/router/index.js';
import { RouteLoaderManager } from '../src/plugins/router/data/loader.js';
import { RouteRevalidationManager } from '../src/plugins/router/data/revalidation.js';
import { RouteDataCache } from '../src/plugins/router/data/cache.js';
import { RouterRedirect, RouterError } from '../src/plugins/router/core/navigation.js';
import { EUIXLeafletPlugin } from '../src/plugins/EUIXLeafletPlugin.js';

describe('Route Data Loaders, Revalidation & Leaflet Deep Coverage', () => {
    let container;

    beforeEach(() => {
        EUIXEngineCore.use(EUIXRouterPlugin).use(EUIXLeafletPlugin);
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

    it('should test RouteLoaderManager named loaders, response redirects, and declarative XML loader parsing', async () => {
        const cache = new RouteDataCache();
        const loaderManager = new RouteLoaderManager({ cache, engine: null });

        // 1. Named Loader Registration & Execution
        loaderManager.registerLoader('fetchUser', async ({ params }) => {
            return { id: params.id, name: 'Alice' };
        });

        const match = {
            id: 'user',
            loader: 'fetchUser',
            params: { id: '99' },
            route: { id: 'user', loader: 'fetchUser' }
        };

        const location = { pathname: '/users/99', search: '' };
        const data = await loaderManager.executeLoader({
            match,
            location,
            signal: new AbortController().signal
        });

        expect(data).toEqual({ id: '99', name: 'Alice' });
        expect(cache.has('user', '/users/99')).toBe(true);

        // 2. Response 302 Redirect Throwing
        const redirectMatch = {
            id: 'old-url',
            loader: async () => {
                return new Response(null, {
                    status: 302,
                    headers: { Location: '/new-url' }
                });
            },
            route: {}
        };

        await expect(
            loaderManager.executeLoader({
                match: redirectMatch,
                location: { pathname: '/old-url' },
                signal: new AbortController().signal
            })
        ).rejects.toThrow(RouterRedirect);

        // 3. Declarative XML loader execution
        const xmlParser = new DOMParser();
        const loaderDoc = xmlParser.parseFromString(
            '<loader request="https://api.example.com/items/{params.itemId}" method="GET" as="itemData" />',
            'text/xml'
        );

        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            json: async () => ({ title: 'Book A', price: 29 })
        });

        const declarativeMatch = {
            id: 'item-view',
            params: { itemId: '456' },
            route: { loaderNode: loaderDoc.documentElement }
        };

        const itemResult = await loaderManager.executeLoader({
            match: declarativeMatch,
            location: { pathname: '/items/456' },
            signal: new AbortController().signal
        });

        expect(itemResult).toEqual({ itemData: { title: 'Book A', price: 29 } });
        expect(global.fetch).toHaveBeenCalledWith('https://api.example.com/items/456', expect.any(Object));

        // Declarative Loader HTTP Error
        cache.clear();
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            json: async () => ({ error: 'Not Found' })
        });

        await expect(
            loaderManager.executeLoader({
                match: declarativeMatch,
                location: { pathname: '/items/456' },
                signal: new AbortController().signal
            })
        ).rejects.toThrow(RouterError);
    });

    it('should test RouteRevalidationManager named predicates and revalidation triggers', async () => {
        const cache = new RouteDataCache();
        const loaderManager = new RouteLoaderManager({ cache });
        const revalidationManager = new RouteRevalidationManager({ loaderManager, cache });

        // Register custom predicate
        revalidationManager.registerPredicate('revalidateOnMutation', ({ actionResult }) => {
            return actionResult && actionResult.updated === true;
        });

        const match = {
            id: 'dashboard',
            loader: vi.fn().mockResolvedValue({ stats: 100 }),
            route: { shouldRevalidate: 'revalidateOnMutation' }
        };

        // Predicate returns false
        const shouldNotRun = revalidationManager.shouldRevalidateMatch({
            match,
            currentUrl: '/dashboard',
            nextUrl: '/dashboard',
            actionResult: { updated: false }
        });
        expect(shouldNotRun).toBe(false);

        // Predicate returns true
        const shouldRun = revalidationManager.shouldRevalidateMatch({
            match,
            currentUrl: '/dashboard',
            nextUrl: '/dashboard',
            actionResult: { updated: true }
        });
        expect(shouldRun).toBe(true);

        // Execute revalidateMatches
        await revalidationManager.revalidateMatches({
            matches: [match],
            location: { pathname: '/dashboard' },
            signal: new AbortController().signal,
            actionResult: { updated: true }
        });

        expect(match.loader).toHaveBeenCalled();
        expect(match.data).toEqual({ stats: 100 });
    });

    it('should test EUIXLeafletPlugin declarative actions (CLEAR_MAP, REMOVE_LAYER, FOCUS_LAYER, FLY_TO)', () => {
        // Mock Leaflet L global
        const mockLayer = {
            getBounds: vi.fn().mockReturnValue({
                isValid: () => true
            }),
            getLatLng: vi.fn().mockReturnValue({ lat: 41.0, lng: 28.9 }),
            openPopup: vi.fn()
        };

        const mockDrawnItems = {
            clearLayers: vi.fn(),
            removeLayer: vi.fn()
        };

        const mockMap = {
            _drawnItems: mockDrawnItems,
            _layersMap: new Map([['marker_1', mockLayer]]),
            flyTo: vi.fn(),
            panTo: vi.fn(),
            setView: vi.fn(),
            fitBounds: vi.fn(),
            getCenter: vi.fn().mockReturnValue({ lat: 41.0, lng: 28.9 }),
            getZoom: vi.fn().mockReturnValue(10)
        };

        window.L = {
            map: vi.fn().mockReturnValue(mockMap),
            tileLayer: vi.fn().mockReturnValue({ addTo: vi.fn() }),
            featureGroup: vi.fn().mockReturnValue(mockDrawnItems)
        };

        const xml = `
        <uid_spec>
            <data_model>
                <state id="places" type="array">[{"id":"marker_1","title":"Place 1"}]</state>
            </data_model>
            <flex direction="column">
                <button id="fly_btn">
                    <on_click action="FLY_TO" center="41.01, 28.97" zoom="12" duration="1.5" />
                </button>
                <button id="pan_btn">
                    <on_click action="PAN_TO" lat="41.05" lng="29.01" />
                </button>
                <button id="focus_btn">
                    <on_click action="FOCUS_LAYER" layer_id="marker_1" />
                </button>
                <button id="remove_btn">
                    <on_click action="REMOVE_LAYER" layer_id="marker_1" bind="data.places" />
                </button>
                <button id="clear_btn">
                    <on_click action="CLEAR_MAP" bind="data.places" />
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        engine._leafletMaps = new Map([['map', mockMap]]);

        // Trigger FLY_TO
        container.querySelector('#fly_btn').click();
        expect(mockMap.flyTo).toHaveBeenCalled();

        // Trigger PAN_TO
        container.querySelector('#pan_btn').click();
        expect(mockMap.panTo).toHaveBeenCalledWith([41.05, 29.01]);

        // Trigger FOCUS_LAYER
        container.querySelector('#focus_btn').click();
        expect(mockMap.fitBounds).toHaveBeenCalled();

        // Trigger REMOVE_LAYER
        container.querySelector('#remove_btn').click();
        expect(mockDrawnItems.removeLayer).toHaveBeenCalledWith(mockLayer);
        expect(engine.getState('places')).toEqual([]);

        // Trigger CLEAR_MAP
        container.querySelector('#clear_btn').click();
        expect(mockDrawnItems.clearLayers).toHaveBeenCalled();
    });
});
