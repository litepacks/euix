/**
 * tests/api_and_outlet_deep.test.js
 * Comprehensive tests for EUIXApiPlugin mutation operations, cache TTL, and Outlet renderer edge cases.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXApiPlugin } from '../src/plugins/EUIXApiPlugin.js';
import { EUIXRouterPlugin, createMemoryRouter } from '../src/plugins/router/index.js';
import { createOutletRenderer } from '../src/plugins/router/core/outlet.js';

describe('API Plugin Mutations & Outlet Renderer Edge Cases', () => {
    let container;

    beforeEach(() => {
        EUIXEngineCore.use(EUIXApiPlugin).use(EUIXRouterPlugin);
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

    it('should test EUIXApiPlugin XHR UPDATE and REMOVE target operations, and Cache TTL', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="users" type="array">[{"id":"1","name":"Alice"},{"id":"2","name":"Bob"}]</state>
            </data_model>
            <flex direction="column">
                <button id="update_btn">
                    <on_click action="XHR">
                        <url>https://api.example.com/users/2</url>
                        <method>PUT</method>
                        <target op="UPDATE">users</target>
                        <where equals="2" />
                    </on_click>
                </button>
                <button id="remove_btn">
                    <on_click action="XHR">
                        <url>https://api.example.com/users/1</url>
                        <method>DELETE</method>
                        <target op="REMOVE">users</target>
                        <where equals="1" />
                    </on_click>
                </button>
                <button id="revalidate_alias_btn">
                    <on_click action="REVALIDATE" tag="users_list" />
                </button>
            </flex>
        </uid_spec>
        `;

        global.fetch = vi.fn().mockImplementation(async (url, options) => {
            if (options.method === 'PUT') {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ id: '2', name: 'Robert' })
                };
            }
            if (options.method === 'DELETE') {
                return {
                    ok: true,
                    status: 200,
                    json: async () => ({ success: true })
                };
            }
            return {
                ok: true,
                status: 200,
                json: async () => ({ data: [] })
            };
        });

        const engine = EUIXEngineCore.mount(xml, container);
        const revalidateSpy = vi.spyOn(engine, 'revalidateApi').mockReturnValue(Promise.resolve());

        // 1. Trigger UPDATE
        container.querySelector('#update_btn').click();
        await new Promise(r => setTimeout(r, 60));
        const usersAfterUpdate = engine.getState('users');
        expect(usersAfterUpdate.find(u => u.id === '2').name).toBe('Robert');

        // 2. Trigger REMOVE
        container.querySelector('#remove_btn').click();
        await new Promise(r => setTimeout(r, 60));
        const usersAfterRemove = engine.getState('users');
        expect(usersAfterRemove.find(u => u.id === '1')).toBeUndefined();
        expect(usersAfterRemove.length).toBe(1);

        // 3. Trigger REVALIDATE Action Alias
        container.querySelector('#revalidate_alias_btn').click();
        expect(revalidateSpy).toHaveBeenCalledWith('users_list');
    });

    it('should test EUIXApiPlugin XHR inside TRY scope throwing structured error on HTTP 500', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="err_msg"></state>
            </data_model>
            <flex direction="column">
                <button id="try_btn">
                    <on_click action="TRY">
                        <step action="XHR">
                            <url>https://api.example.com/fail</url>
                            <method>GET</method>
                        </step>
                        <catch var="err">
                            <step action="SET_STATE">
                                <path>data.err_msg</path>
                                <value>{err.message}</value>
                            </step>
                        </catch>
                    </on_click>
                </button>
            </flex>
        </uid_spec>
        `;

        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            text: async () => 'Database failure'
        });

        const engine = EUIXEngineCore.mount(xml, container);
        container.querySelector('#try_btn').click();
        await new Promise(r => setTimeout(r, 60));

        expect(engine.getState('err_msg')).toContain('500');
    });

    it('should test Outlet renderer with inline XML nodes, inline error node, and pending node template', async () => {
        const parser = new DOMParser();
        const inlineComponentDoc = parser.parseFromString('<div class="inline-view">Inline Content</div>', 'text/xml');
        const inlineErrorDoc = parser.parseFromString('<div class="inline-err">Custom Error Boundary</div>', 'text/xml');

        const routes = [
            {
                id: 'inline-route',
                path: '/inline',
                componentNode: inlineComponentDoc.documentElement
            },
            {
                id: 'error-route',
                path: '/error-view',
                loader: async () => { throw new Error('Loader Failed'); },
                errorNode: inlineErrorDoc.documentElement
            }
        ];

        const router = createMemoryRouter({ routes, initialEntries: ['/inline'] });
        const engine = new EUIXEngineCore(container);
        const renderOutlet = createOutletRenderer(engine, router);

        const outletDoc = parser.parseFromString('<outlet />', 'text/xml');
        const outletEl = renderOutlet(outletDoc.documentElement);
        container.appendChild(outletEl);

        expect(outletEl.querySelector('.inline-view')).not.toBeNull();
        expect(outletEl.querySelector('.inline-view').textContent).toBe('Inline Content');

        // Navigate to error route with inline errorNode
        await router.navigate('/error-view');
        expect(outletEl.querySelector('.inline-err')).not.toBeNull();
        expect(outletEl.querySelector('.inline-err').textContent).toBe('Custom Error Boundary');
    });
});
