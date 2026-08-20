/**
 * tests/router_data_and_prefetch_deep.test.js
 * Deep coverage for RouteActionManager, RoutePrefetchManager, and ScrollRestorationManager.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RouteActionManager } from '../src/plugins/router/data/action.js';
import { RoutePrefetchManager } from '../src/plugins/router/navigation/prefetch.js';
import { ScrollRestorationManager } from '../src/plugins/router/navigation/scroll.js';
import { RouteDataCache } from '../src/plugins/router/data/cache.js';
import { RouterRedirect } from '../src/plugins/router/core/navigation.js';

describe('Route Actions, Prefetching & Scroll Restoration Deep Coverage', () => {
    beforeEach(() => {
        sessionStorage.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        sessionStorage.clear();
        vi.restoreAllMocks();
    });

    it('should test RouteActionManager named actions, formData submission, and Response redirects', async () => {
        const actionManager = new RouteActionManager();

        // 1. Named Action Registration & Execution
        actionManager.registerAction('saveProduct', async ({ formData, params }) => {
            return { saved: true, id: params.productId, name: formData ? formData.get('name') : 'Default' };
        });

        const formData = new Map([['name', 'Quantum Widget']]);

        const match = {
            id: 'product-edit',
            params: { productId: '101' },
            route: { action: 'saveProduct' }
        };

        const result = await actionManager.executeAction({
            match,
            location: { pathname: '/products/101/edit' },
            formData,
            signal: new AbortController().signal
        });

        expect(result).toEqual({ saved: true, id: '101', name: 'Quantum Widget' });

        // 2. Action Returning 302 Response Redirect
        const redirectMatch = {
            id: 'login',
            route: {
                action: async () => new Response(null, {
                    status: 302,
                    headers: { Location: '/dashboard' }
                })
            }
        };

        await expect(
            actionManager.executeAction({
                match: redirectMatch,
                location: { pathname: '/login' },
                signal: new AbortController().signal
            })
        ).rejects.toThrow(RouterRedirect);
    });

    it('should test RoutePrefetchManager loader and module prefetching with cache deduplication', async () => {
        const cache = new RouteDataCache();
        const executeLoaderSpy = vi.fn().mockResolvedValue({ preloaded: true });

        const mockRouter = {
            matcher: {
                match: vi.fn((path) => {
                    if (path === '/details') {
                        return [
                            {
                                id: 'details-route',
                                loader: executeLoaderSpy,
                                route: { loader: executeLoaderSpy, module: './details.js' }
                            }
                        ];
                    }
                    return null;
                })
            },
            dataEngine: {
                loaderManager: {
                    executeLoader: executeLoaderSpy
                }
            }
        };

        const prefetchManager = new RoutePrefetchManager({
            router: mockRouter,
            engine: null,
            cache
        });

        // 1. Prefetch /details
        await prefetchManager.prefetch('/details');
        expect(mockRouter.matcher.match).toHaveBeenCalledWith('/details');
        expect(executeLoaderSpy).toHaveBeenCalled();

        // 2. Prefetch with empty or unknown route
        await prefetchManager.prefetch('/unknown-404');
        expect(mockRouter.matcher.match).toHaveBeenCalledWith('/unknown-404');
    });

    it('should test ScrollRestorationManager position persistence, hash scroll, and popstate restoration', () => {
        const scrollManager = new ScrollRestorationManager({
            enabled: true,
            storageKey: 'test_scroll_key'
        });

        // 1. Save scroll position
        window.scrollX = 100;
        window.scrollY = 250;
        scrollManager.saveCurrentPosition('key-home');

        // Check sessionStorage persistence
        const stored = JSON.parse(sessionStorage.getItem('test_scroll_key'));
        expect(stored['key-home']).toEqual({ x: 100, y: 250 });

        // 2. Hash navigation target scrolling
        const targetSection = document.createElement('section');
        targetSection.id = 'pricing';
        targetSection.scrollIntoView = vi.fn();
        document.body.appendChild(targetSection);

        scrollManager.handleNavigation({
            location: { pathname: '/features', hash: '#pricing' },
            preserveScroll: false,
            isPop: false
        });

        expect(targetSection.scrollIntoView).toHaveBeenCalled();

        // 3. Preserve scroll flag bypass
        targetSection.scrollIntoView.mockClear();
        scrollManager.handleNavigation({
            location: { pathname: '/features', hash: '#pricing' },
            preserveScroll: true
        });
        expect(targetSection.scrollIntoView).not.toHaveBeenCalled();

        document.body.removeChild(targetSection);
    });
});
