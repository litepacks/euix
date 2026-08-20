/**
 * tests/plugins_deep_coverage.test.js
 * Deep coverage suite targeting Router Prefetch, Navigation Blocker, Navigator Plugin, and Data Cache.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXNavigatorPlugin } from '../src/plugins/EUIXNavigatorPlugin.js';
import { EUIXRouterPlugin, createMemoryRouter, EUIXRouter } from '../src/plugins/router/index.js';
import { RoutePrefetchManager } from '../src/plugins/router/navigation/prefetch.js';
import { NavigationBlockerManager } from '../src/plugins/router/navigation/blocker.js';
import { RouteDataCache } from '../src/plugins/router/data/cache.js';
import { createStaticRouter } from '../src/plugins/router/server/static-router.js';
import { serializeHydrationState, getHydrationData } from '../src/plugins/router/server/hydration.js';

describe('Plugins & Router Deep Coverage Test Suite', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        EUIXEngineCore.use(EUIXNavigatorPlugin).use(EUIXRouterPlugin);

        Object.defineProperty(global.navigator, 'onLine', { value: true, configurable: true, writable: true });
        Object.defineProperty(global.navigator, 'hardwareConcurrency', { value: 8, configurable: true, writable: true });
        Object.defineProperty(global.navigator, 'deviceMemory', { value: 16, configurable: true, writable: true });
        Object.defineProperty(global.navigator, 'maxTouchPoints', { value: 5, configurable: true, writable: true });
        Object.defineProperty(global.navigator, 'language', { value: 'tr-TR', configurable: true, writable: true });
        Object.defineProperty(global.navigator, 'languages', { value: ['tr-TR', 'tr', 'en-US', 'en'], configurable: true, writable: true });

        global.navigator.vibrate = vi.fn().mockReturnValue(true);
        global.navigator.share = vi.fn().mockResolvedValue(undefined);
        global.navigator.canShare = vi.fn().mockReturnValue(true);
        global.navigator.setAppBadge = vi.fn().mockResolvedValue(undefined);
        global.navigator.clearAppBadge = vi.fn().mockResolvedValue(undefined);
        global.navigator.wakeLock = {
            request: vi.fn().mockResolvedValue({
                released: false,
                release: vi.fn().mockResolvedValue(true)
            })
        };
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        vi.restoreAllMocks();
    });

    it('should test RouteDataCache maxEntries LRU eviction, invalidation, and clear', () => {
        const cache = new RouteDataCache({ maxEntries: 3 });

        cache.set('r1', '/p1', '', { data: 1 });
        cache.set('r2', '/p2', '', { data: 2 });
        cache.set('r3', '/p3', '', { data: 3 });
        expect(cache.has('r1', '/p1')).toBe(true);

        // Evict oldest (r1)
        cache.set('r4', '/p4', '', { data: 4 });
        expect(cache.has('r1', '/p1')).toBe(false);
        expect(cache.has('r4', '/p4')).toBe(true);

        // Invalidate specific routeId
        cache.invalidate('r2');
        expect(cache.has('r2', '/p2')).toBe(false);
        expect(cache.has('r3', '/p3')).toBe(true);

        // Clear all
        cache.clear();
        expect(cache.has('r3', '/p3')).toBe(false);
        expect(cache.get('r3', '/p3')).toBeUndefined();
    });

    it('should test NavigationBlockerManager with function, state binding, confirm dialog, and beforeunload', async () => {
        const blocker = new NavigationBlockerManager();

        // 1. Function Blocker
        const removeBlocker = blocker.addBlocker(({ nextLocation }) => {
            return nextLocation.pathname === '/blocked';
        });

        const blockedDetails = {
            currentLocation: { pathname: '/' },
            nextLocation: { pathname: '/blocked' }
        };

        // Window confirm returns false (block)
        window.confirm = vi.fn().mockReturnValue(false);
        const shouldBlock = await blocker.shouldBlock(blockedDetails);
        expect(shouldBlock).toBe(true);
        expect(blocker.state).toBe('idle');

        // Window confirm returns true (allow proceeding)
        window.confirm = vi.fn().mockReturnValue(true);
        const shouldProceed = await blocker.shouldBlock(blockedDetails);
        expect(shouldProceed).toBe(false);
        expect(blocker.state).toBe('proceeding');

        // Remove blocker
        removeBlocker();
        const noLongerBlocked = await blocker.shouldBlock(blockedDetails);
        expect(noLongerBlocked).toBe(false);

        // 2. BeforeUnload Event Handler
        blocker.addBlocker(() => 'Custom Leave Warning');
        const beforeUnloadEvent = new Event('beforeunload');
        beforeUnloadEvent.preventDefault = vi.fn();
        window.dispatchEvent(beforeUnloadEvent);

        blocker.destroy();
    });

    it('should test RoutePrefetchManager prefetching XML components and loader data', async () => {
        const routes = [
            {
                id: 'home',
                path: '/',
                component: './views/Home.xml',
                loader: async () => ({ title: 'Home Page' })
            },
            {
                id: 'module-view',
                path: '/lazy',
                route: { module: './lazy-module.js' }
            }
        ];

        const router = createMemoryRouter({ routes, initialEntries: ['/'] });
        const prefetcher = new RoutePrefetchManager({
            router,
            engine: null,
            cache: router.cache
        });

        // Prefetch target route
        await prefetcher.prefetch('/');
        expect(prefetcher._inFlightPrefetches.size).toBe(0);

        // Prefetch nonexistent route (early return)
        await prefetcher.prefetch('/nonexistent');
        expect(prefetcher._inFlightPrefetches.size).toBe(0);
    });

    it('should test StaticRouter and Hydration state serialization', async () => {
        const routes = [
            { id: 'about', path: '/about', loader: async () => ({ info: 'About Us' }) }
        ];

        const staticRouter = await createStaticRouter({
            routes,
            url: '/about'
        });

        expect(staticRouter.location.pathname).toBe('/about');
        expect(staticRouter.loaderData.about.info).toBe('About Us');

        const statePayload = {
            location: { pathname: '/about', search: '' },
            loaderData: { about: { info: 'SSR Hydrated Data' } }
        };

        const serializedScript = serializeHydrationState(statePayload);
        expect(serializedScript).toContain('__EUIX_ROUTER_DATA__');
        expect(serializedScript).toContain('SSR Hydrated Data');

        // Simulate client hydration read
        const scriptContainer = document.createElement('div');
        scriptContainer.innerHTML = serializedScript;
        document.body.appendChild(scriptContainer.firstChild);

        const hydrated = getHydrationData();
        expect(hydrated).not.toBeNull();
        expect(hydrated.loaderData.about.info).toBe('SSR Hydrated Data');
    });

    it('should test RouteMatcher param decoding and wildcard match', () => {
        const routes = [
            { id: 'user-profile', path: '/users/:userId/posts/:postId' },
            { id: 'catchall', path: '/files/*' }
        ];

        const router = createMemoryRouter({ routes, initialEntries: ['/'] });
        const matches = router.matcher.match('/users/alice%20smith/posts/42');

        expect(matches).toHaveLength(1);
        expect(matches[0].params.userId).toBe('alice smith');
        expect(matches[0].params.postId).toBe('42');

        const wildcardMatches = router.matcher.match('/files/docs/2026/report.pdf');
        expect(wildcardMatches).toHaveLength(1);
        expect(wildcardMatches[0].params['*']).toBe('docs/2026/report.pdf');
    });
});
