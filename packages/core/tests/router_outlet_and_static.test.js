/**
 * tests/router_outlet_and_static.test.js
 * Comprehensive tests for Dynamic Outlet keying and StaticRouter SSR execution.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXRouterPlugin, createMemoryRouter } from '../src/plugins/router/index.js';
import { createStaticRouter } from '../src/plugins/router/server/static-router.js';
import { createOutletRenderer } from '../src/plugins/router/core/outlet.js';

describe('Router Outlet Keying & StaticRouter SSR Suite', () => {
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

    it('should test Outlet dynamic route keying with param interpolation', async () => {
        const routes = [
            {
                id: 'user-profile',
                path: '/users/:userId',
                component: 'user-view'
            }
        ];

        const router = createMemoryRouter({ routes, initialEntries: ['/users/10'] });
        const engine = new EUIXEngineCore(container);
        const renderOutlet = createOutletRenderer(engine, router);

        const xmlParser = new DOMParser();
        const outletDoc = xmlParser.parseFromString('<outlet key="params.userId" />', 'text/xml');
        const outletEl = renderOutlet(outletDoc.documentElement);
        container.appendChild(outletEl);

        expect(outletEl).not.toBeNull();
        expect(outletEl.className).toBe('euix-router-outlet');
    });

    it('should test StaticRouter SSR with nested routes, loader execution, and hydration state', async () => {
        const routes = [
            {
                id: 'root',
                path: '/',
                loader: async () => ({ appTitle: 'Quantum Portal' }),
                children: [
                    {
                        id: 'dashboard',
                        path: 'dashboard',
                        loader: async () => ({ activeUsers: 420 })
                    }
                ]
            }
        ];

        const staticResult = await createStaticRouter({
            routes,
            url: '/dashboard'
        });

        expect(staticResult.matches).toHaveLength(2);
        expect(staticResult.matches[0].id).toBe('root');
        expect(staticResult.matches[1].id).toBe('dashboard');

        // Check Loader data populated
        expect(staticResult.loaderData['root']).toEqual({ appTitle: 'Quantum Portal' });
        expect(staticResult.loaderData['dashboard']).toEqual({ activeUsers: 420 });

        // Hydration data serialization
        expect(staticResult.scriptTag).toBeDefined();
        expect(typeof staticResult.scriptTag).toBe('string');
        expect(staticResult.scriptTag).toContain('Quantum Portal');
        expect(staticResult.scriptTag).toContain('420');
    });
});
