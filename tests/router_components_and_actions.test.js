/**
 * tests/router_components_and_actions.test.js
 * Comprehensive tests for <route-form>, <route-fetcher>, <route-block>, and Router declarative actions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXRouterPlugin, createMemoryRouter } from '../src/plugins/router/index.js';

describe('Router Declarative Components & Navigation Actions', () => {
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

    it('should test <route-form> form submission, <route-fetcher> rendering, and <route-block> blocking', async () => {
        const routes = [
            { id: 'home', path: '/' },
            { id: 'users', path: '/users' }
        ];

        const router = createMemoryRouter({ routes, initialEntries: ['/'] });
        const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(undefined);

        const xml = `
        <uid_spec>
            <data_model>
                <state id="isDirty">true</state>
            </data_model>
            <flex direction="column">
                <route-form action="/users" method="post" replace="true" class="user-form">
                    <input name="username" value="QuantumDev" />
                    <button type="submit" id="submit_btn">Save</button>
                </route-form>

                <route-fetcher>
                    <span class="fetcher-item">Fetcher Content</span>
                </route-fetcher>

                <route-block when="data.isDirty" message="Unsaved form changes!" />
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngineCore(container);
        engine.router = router;
        engine.mount(xml);

        // 1. <route-form> submission
        const form = container.querySelector('form.user-form');
        expect(form).not.toBeNull();
        expect(form.method).toBe('post');

        const submitBtn = container.querySelector('#submit_btn');
        submitBtn.click();
        await new Promise(r => setTimeout(r, 40));

        expect(navigateSpy).toHaveBeenCalledWith('/users', expect.objectContaining({
            replace: true,
            formData: expect.any(FormData)
        }));

        // 2. <route-fetcher> rendering
        const fetcherEl = container.querySelector('.euix-route-fetcher');
        expect(fetcherEl).not.toBeNull();
        expect(fetcherEl.querySelector('.fetcher-item').textContent).toBe('Fetcher Content');

        // 3. <route-block> blocker evaluation
        expect(router.blockerManager._blockers.size).toBe(1);
    });

    it('should test NAVIGATE, ROUTER_NAVIGATE, ROUTER_BACK, ROUTER_FORWARD, and ROUTER_REVALIDATE actions', async () => {
        const routes = [
            { id: 'dashboard', path: '/dashboard' },
            { id: 'settings', path: '/settings' }
        ];

        const router = createMemoryRouter({ routes, initialEntries: ['/dashboard'] });
        const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(undefined);
        const backSpy = vi.spyOn(router, 'back');
        const forwardSpy = vi.spyOn(router, 'forward');
        const revalidateSpy = vi.spyOn(router, 'revalidate').mockResolvedValue(undefined);

        const xml = `
        <uid_spec>
            <flex direction="column">
                <button id="nav_btn">
                    <on_click action="NAVIGATE" to="/settings" replace="true" />
                </button>
                <button id="alias_nav_btn">
                    <on_click action="ROUTER_NAVIGATE" to="/dashboard" />
                </button>
                <button id="back_btn">
                    <on_click action="ROUTER_BACK" />
                </button>
                <button id="fwd_btn">
                    <on_click action="ROUTER_FORWARD" />
                </button>
                <button id="reval_btn">
                    <on_click action="ROUTER_REVALIDATE" route="dashboard" />
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        engine.router = router;

        // 1. NAVIGATE
        container.querySelector('#nav_btn').click();
        expect(navigateSpy).toHaveBeenCalledWith('/settings', { replace: true });

        // 2. ROUTER_NAVIGATE
        container.querySelector('#alias_nav_btn').click();
        expect(navigateSpy).toHaveBeenCalledWith('/dashboard', { replace: false });

        // 3. ROUTER_BACK
        container.querySelector('#back_btn').click();
        expect(backSpy).toHaveBeenCalled();

        // 4. ROUTER_FORWARD
        container.querySelector('#fwd_btn').click();
        expect(forwardSpy).toHaveBeenCalled();

        // 5. ROUTER_REVALIDATE
        container.querySelector('#reval_btn').click();
        expect(revalidateSpy).toHaveBeenCalledWith('dashboard');
    });
});
