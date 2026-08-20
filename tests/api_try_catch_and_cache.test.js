/**
 * tests/api_try_catch_and_cache.test.js
 * Comprehensive tests for EUIXApiPlugin TRY/CATCH error propagation, REVALIDATE_API actions, and GET XHR Cache TTL.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXApiPlugin } from '../src/plugins/EUIXApiPlugin.js';

describe('EUIXApiPlugin - TRY/CATCH Error Boundaries, Declarative Revalidate & Cache TTL', () => {
    let container;

    beforeEach(() => {
        EUIXEngineCore.use(EUIXApiPlugin);
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

    it('should propagate HTTP error to TRY/CATCH action scope with structured error details', async () => {
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            statusText: 'Not Found',
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ message: 'Resource not found' }),
            text: async () => 'Resource not found'
        });

        const xml = `
        <uid_spec>
            <data_model>
                <state id="error_msg"></state>
                <state id="error_code"></state>
                <state id="is_done">false</state>
            </data_model>
            <flex direction="column">
                <button id="try_xhr_btn">
                    <on_click action="TRY">
                        <step action="XHR">
                            <url>https://api.example.com/not-found</url>
                            <method>GET</method>
                        </step>
                        <catch var="err">
                            <step action="SET_STATE">
                                <path>data.error_msg</path>
                                <value>{err.message}</value>
                            </step>
                            <step action="SET_STATE">
                                <path>data.error_code</path>
                                <value>{err.code}</value>
                            </step>
                        </catch>
                        <finally>
                            <step action="SET_STATE">
                                <path>data.is_done</path>
                                <value>true</value>
                            </step>
                        </finally>
                    </on_click>
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        container.querySelector('#try_xhr_btn').click();

        await new Promise(r => setTimeout(r, 60));

        expect(engine.getState('error_msg')).toContain('404');
        expect(engine.getState('error_code')).toBe('API_HTTP_ERROR');
        expect(engine.getState('is_done')).toBe('true');
    });

    it('should execute REVALIDATE_API declarative action', async () => {
        const fetchSpy = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ count: 42 })
        });
        global.fetch = fetchSpy;

        const xml = `
        <uid_spec>
            <data_model>
                <state id="stats" type="object"></state>
            </data_model>
            <api_config>
                <api_endpoint id="get_stats" tag="stats_tag" url="https://api.example.com/stats" method="GET" bind_target="stats" auto_fetch="false" />
            </api_config>
            <flex direction="column">
                <button id="reval_tag_btn">
                    <on_click action="REVALIDATE_API" tag="stats_tag" />
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        container.querySelector('#reval_tag_btn').click();

        await new Promise(r => setTimeout(r, 60));

        expect(fetchSpy).toHaveBeenCalledWith(
            expect.stringContaining('/stats'),
            expect.anything()
        );
        expect(engine.getState('stats')).toEqual({ count: 42 });
    });

    it('should cache GET XHR requests when cache_ttl_ms is specified', async () => {
        const fetchSpy = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => ({ version: '1.0.0' })
        });
        global.fetch = fetchSpy;

        const xml = `
        <uid_spec>
            <data_model>
                <state id="info" type="object"></state>
            </data_model>
            <flex direction="column">
                <button id="fetch_cached_btn">
                    <on_click action="XHR">
                        <url>https://api.example.com/version</url>
                        <method>GET</method>
                        <target>info</target>
                        <cache_ttl_ms>5000</cache_ttl_ms>
                    </on_click>
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);

        // 1st click -> fetches from network
        container.querySelector('#fetch_cached_btn').click();
        await new Promise(r => setTimeout(r, 40));
        expect(fetchSpy).toHaveBeenCalledTimes(1);

        // 2nd click -> served from in-memory TTL cache
        container.querySelector('#fetch_cached_btn').click();
        await new Promise(r => setTimeout(r, 40));
        expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
});
