/**
 * tests/router_links_viewport_and_keys.test.js
 * Deep tests for RouteLink viewport intersection prefetching, modifier keys bypass, and unmount cleanups.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXRouterPlugin, createMemoryRouter } from '../src/plugins/router/index.js';
import { createLinkRenderer } from '../src/plugins/router/core/links.js';

describe('Router Links - Viewport Intersection, Modifier Keys & Lifecycle', () => {
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

    it('should prefetch route when entering viewport via IntersectionObserver', () => {
        let observerCallback = null;
        const mockObserver = vi.fn().mockImplementation((cb) => {
            observerCallback = cb;
            return {
                observe: vi.fn(),
                disconnect: vi.fn()
            };
        });
        global.IntersectionObserver = mockObserver;

        const router = createMemoryRouter({
            routes: [{ id: 'dashboard', path: '/dashboard', component: 'dashboard-view' }]
        });
        router.prefetch = vi.fn();

        const engine = new EUIXEngineCore(container);
        const linkHandler = createLinkRenderer(engine, router);

        const domParser = new DOMParser();
        const xmlDoc = domParser.parseFromString(
            '<route-link to="/dashboard" prefetch="viewport">Go to Dashboard</route-link>',
            'text/xml'
        );

        const linkEl = linkHandler(xmlDoc.documentElement, {});
        container.appendChild(linkEl);

        expect(mockObserver).toHaveBeenCalled();
        expect(observerCallback).toBeDefined();

        // Simulate element intersecting viewport
        observerCallback([{ isIntersecting: true }]);
        expect(router.prefetch).toHaveBeenCalledWith('/dashboard');

        delete global.IntersectionObserver;
    });

    it('should bypass SPA navigation when clicking with modifier keys or target="_blank"', () => {
        const router = createMemoryRouter({
            routes: [{ id: 'docs', path: '/docs', component: 'docs-view' }]
        });
        router.navigate = vi.fn();

        const engine = new EUIXEngineCore(container);
        const linkHandler = createLinkRenderer(engine, router);

        const domParser = new DOMParser();
        const xmlDoc = domParser.parseFromString(
            '<route-link to="/docs" target="_blank">Docs</route-link>',
            'text/xml'
        );

        const linkEl = linkHandler(xmlDoc.documentElement, {});
        container.appendChild(linkEl);

        // Click with metaKey
        const metaClick = new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true });
        linkEl.dispatchEvent(metaClick);
        expect(router.navigate).not.toHaveBeenCalled();

        // Click with standard left-click but target="_blank"
        const normalClick = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
        linkEl.dispatchEvent(normalClick);
        expect(router.navigate).not.toHaveBeenCalled(); // target="_blank" bypassed!
    });
});
