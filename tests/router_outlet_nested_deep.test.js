/**
 * tests/router_outlet_nested_deep.test.js
 * Deep tests for Router Outlet lazy component loading, pending indicators, and route data fallback inheritance.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXRouterPlugin, createMemoryRouter } from '../src/plugins/router/index.js';
import { createOutletRenderer, createRouteContext } from '../src/plugins/router/core/outlet.js';

describe('Router Outlet - Lazy Loading, Pending State & Context Inheritance', () => {
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

    it('should test createRouteContext inheriting route data from parent matches when undefined', () => {
        const mockRouter = {
            location: { pathname: '/projects/1/tasks', search: '', hash: '' },
            matches: [
                { id: 'projects-layout', data: { projectName: 'Quantum Alpha' }, route: {} },
                { id: 'project-tasks', data: undefined, route: {} }
            ],
            getRouteData: vi.fn().mockReturnValue(undefined)
        };

        const targetMatch = mockRouter.matches[1];
        const ctx = createRouteContext(targetMatch, mockRouter);

        expect(ctx).toBeDefined();
        expect(ctx.data).toEqual({ projectName: 'Quantum Alpha' });
        expect(ctx.id).toBe('project-tasks');
    });

    it('should test Outlet lazy component loading with pending placeholder', async () => {
        const domParser = new DOMParser();
        const pendingDoc = domParser.parseFromString('<div class="loading-spinner">Loading View...</div>', 'text/xml');

        const routes = [
            {
                id: 'analytics',
                path: '/analytics',
                layout: './AnalyticsView.xml',
                pendingNode: pendingDoc.documentElement
            }
        ];

        // Mock loadComponent
        EUIXEngineCore.loadComponent = vi.fn().mockResolvedValue(
            domParser.parseFromString('<component_def name="analytics-view"><div class="analytics-content">Analytics Data</div></component_def>', 'text/xml').documentElement
        );

        const router = createMemoryRouter({ routes, initialEntries: ['/analytics'] });
        const engine = new EUIXEngineCore(container);
        const renderOutlet = createOutletRenderer(engine, router);

        const outletDoc = domParser.parseFromString('<outlet />', 'text/xml');
        const outletEl = renderOutlet(outletDoc.documentElement, {}, 0);
        container.appendChild(outletEl);

        // Check initial pending indicator rendered
        expect(outletEl.querySelector('.loading-spinner')).not.toBeNull();

        // Wait for async lazy component resolution
        await new Promise(r => setTimeout(r, 60));

        expect(EUIXEngineCore.loadComponent).toHaveBeenCalled();
        expect(outletEl.querySelector('.analytics-content')).not.toBeNull();
    });
});
