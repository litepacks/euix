import { describe, it, expect, beforeEach } from 'vitest';
import { EUIXRouter } from '../src/plugins/router/index.js';

describe('Router Outlet & View Transition Master Suite', () => {
    it('should test router view transitions and nested route structure', async () => {
        const router = new EUIXRouter({
            mode: 'memory',
            initialEntries: ['/'],
            viewTransitions: true,
            scrollRestoration: true,
            routes: [
                {
                    path: '/',
                    id: 'home',
                    component: '<div id="home">Home Page</div>'
                },
                {
                    path: '/admin',
                    id: 'admin',
                    component: '<div id="admin-layout">Admin Layout</div>',
                    children: [
                        {
                            path: 'dashboard',
                            id: 'admin_dashboard',
                            component: '<div id="admin-dash">Dashboard</div>'
                        },
                        {
                            path: 'users',
                            id: 'admin_users',
                            component: '<div id="admin-users">Users</div>'
                        }
                    ]
                }
            ]
        });

        expect(router.location.pathname).toBe('/');

        await router.navigate('/admin/dashboard');
        expect(router.location.pathname).toBe('/admin/dashboard');

        await router.navigate('/admin/users');
        expect(router.location.pathname).toBe('/admin/users');

        // Test public context
        const ctx = router.getPublicContext();
        expect(ctx.location.pathname).toBe('/admin/users');

        router.destroy();
    });
});
