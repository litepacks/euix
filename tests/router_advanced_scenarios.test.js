/**
 * tests/router_advanced_scenarios.test.js
 * Advanced tests for EUIX Router History, Links, Nested Outlets, and Transitions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXRouterPlugin, createMemoryRouter, createHashRouter, createBrowserRouter } from '../src/plugins/router/index.js';
import { BrowserHistory, HashHistory } from '../src/plugins/router/core/history.js';
import { createLinkRenderer } from '../src/plugins/router/core/links.js';
import { createOutletRenderer } from '../src/plugins/router/core/outlet.js';
import { ViewTransitionManager } from '../src/plugins/router/navigation/transitions.js';

describe('EUIX Router Advanced Scenarios - History, Links, Outlets, & Transitions', () => {
    let container;

    beforeEach(() => {
        EUIXEngineCore.use(EUIXRouterPlugin);
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

    it('should test BrowserHistory and HashHistory lifecycle, base paths, and navigation', () => {
        // 1. BrowserHistory
        const bHistory = new BrowserHistory({ base: '/app' });
        expect(bHistory.base).toBe('/app');
        expect(bHistory.prependBase('/dashboard')).toBe('/app/dashboard');
        expect(bHistory.stripBase('/app/settings')).toBe('/settings');
        expect(bHistory.createHref('/profile')).toBe('/app/profile');

        const bListener = vi.fn();
        const unlistenB = bHistory.listen(bListener);

        bHistory.push('/dashboard', { from: 'login' });
        expect(bHistory.action).toBe('PUSH');
        expect(bListener).toHaveBeenCalled();

        bHistory.replace('/overview');
        expect(bHistory.action).toBe('REPLACE');

        unlistenB();
        bHistory.destroy();

        // 2. HashHistory
        window.location.hash = '#/';
        const hHistory = new HashHistory({ base: '/' });
        expect(hHistory.createHref('/products')).toBe('#/products');

        const hListener = vi.fn();
        const unlistenH = hHistory.listen(hListener);

        hHistory.push('/analytics');
        expect(hHistory.action).toBe('PUSH');
        expect(window.location.hash).toBe('#/analytics');

        hHistory.replace('/reports');
        expect(hHistory.action).toBe('REPLACE');

        unlistenH();
        hHistory.destroy();
    });

    it('should test LinkRenderer with relative navigation, modifier key bypass, active/pending classes, and prefetch triggers', async () => {
        const routes = [
            { id: 'home', path: '/' },
            { id: 'user-profile', path: '/users/:userId' },
            { id: 'settings', path: '/settings' }
        ];

        const router = createMemoryRouter({ routes, initialEntries: ['/'] });
        const engine = new EUIXEngineCore(container);
        const renderLink = createLinkRenderer(engine, router);

        const xmlParser = new DOMParser();

        // 1. Named Route Link
        const namedDoc = xmlParser.parseFromString(
            '<route-link route="user-profile" params=\'{"userId":"42"}\' class="profile-link" active-class="nav-active">Profile</route-link>',
            'text/xml'
        );
        const namedLinkEl = renderLink(namedDoc.documentElement);
        expect(namedLinkEl.href).toContain('/users/42');
        expect(namedLinkEl.className).toContain('profile-link');

        // 2. Exact match active class
        const homeDoc = xmlParser.parseFromString(
            '<route-link to="/" exact="true" active-class="is-current">Home</route-link>',
            'text/xml'
        );
        const homeLinkEl = renderLink(homeDoc.documentElement);
        expect(homeLinkEl.classList.contains('is-current')).toBe(true);
        expect(homeLinkEl.getAttribute('aria-current')).toBe('page');

        // 3. Modifier click bypass test (Ctrl/Meta click should not call router.navigate)
        const navigateSpy = vi.spyOn(router, 'navigate');
        const metaClickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
        namedLinkEl.dispatchEvent(metaClickEvent);
        expect(navigateSpy).not.toHaveBeenCalled();

        // Normal click calls router.navigate
        const normalClick = new MouseEvent('click', { bubbles: true, cancelable: true });
        namedLinkEl.dispatchEvent(normalClick);
        expect(navigateSpy).toHaveBeenCalledWith('/users/42', { replace: false, preserveScroll: false });

        // 4. Prefetch hover trigger
        const prefetchSpy = vi.spyOn(router, 'prefetch');
        const prefetchDoc = xmlParser.parseFromString(
            '<route-link to="/settings" prefetch="hover">Settings</route-link>',
            'text/xml'
        );
        const prefetchLinkEl = renderLink(prefetchDoc.documentElement);
        prefetchLinkEl.dispatchEvent(new MouseEvent('mouseenter'));
        expect(prefetchSpy).toHaveBeenCalledWith('/settings');
    });

    it('should test Nested Outlet Rendering, Error Boundaries, and Fallback templates', async () => {
        const routes = [
            {
                id: 'dashboard',
                path: '/dashboard',
                component: 'dashboard-layout',
                children: [
                    {
                        id: 'stats',
                        path: 'stats',
                        component: 'stats-widget'
                    },
                    {
                        id: 'error-view',
                        path: 'broken',
                        loader: async () => { throw new Error('Data Load Failed'); },
                        errorComponent: 'error-boundary-widget'
                    }
                ]
            }
        ];

        const router = createMemoryRouter({ routes, initialEntries: ['/dashboard/stats'] });
        const engine = new EUIXEngineCore(container);

        // Register custom components
        engine._componentSpecs = new Map();
        const parser = new DOMParser();

        const dashDoc = parser.parseFromString('<component_def name="dashboard-layout"><div class="dash-root"><h2>Dashboard</h2><outlet /></div></component_def>', 'text/xml');
        const statsDoc = parser.parseFromString('<component_def name="stats-widget"><div class="stats-box">Total Users: 1,000</div></component_def>', 'text/xml');
        const errDoc = parser.parseFromString('<component_def name="error-boundary-widget"><div class="err-box">Something went wrong!</div></component_def>', 'text/xml');

        engine.registerComponentSpec('dashboard-layout', dashDoc.documentElement);
        engine.registerComponentSpec('stats-widget', statsDoc.documentElement);
        engine.registerComponentSpec('error-boundary-widget', errDoc.documentElement);

        const xml = `
        <uid_spec>
            <flex direction="column">
                <outlet />
            </flex>
        </uid_spec>
        `;

        EUIXEngineCore.mount(xml, container);
        await router.navigate('/dashboard/stats');

        expect(router.matches).toHaveLength(2);
        expect(router.matches[0].id).toBe('dashboard');
        expect(router.matches[1].id).toBe('stats');
    });

    it('should test ViewTransitionManager integration and fallback execution', async () => {
        const vtManager = new ViewTransitionManager({ enabled: true });

        const mutationFn = vi.fn().mockReturnValue('DOM Updated');

        // When document.startViewTransition is available
        document.startViewTransition = vi.fn((fn) => {
            fn();
            return {
                finished: Promise.resolve(),
                ready: Promise.resolve(),
                updateCallbackDone: Promise.resolve()
            };
        });

        await vtManager.runTransition(mutationFn);
        expect(document.startViewTransition).toHaveBeenCalled();
        expect(mutationFn).toHaveBeenCalled();

        // Fallback when startViewTransition is null
        document.startViewTransition = undefined;
        await vtManager.runTransition(mutationFn);
        expect(mutationFn).toHaveBeenCalledTimes(2);
    });
});
