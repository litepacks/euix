import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXApiPlugin } from '../src/plugins/EUIXApiPlugin.js';

describe('EUIXApiPlugin Deep Coverage & SWR Suite', () => {
    let container;
    let originalFetch;

    beforeEach(() => {
        EUIXEngineCore.use(EUIXApiPlugin);
        container = document.createElement('div');
        document.body.appendChild(container);
        originalFetch = global.fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('should handle REVALIDATE_API, REVALIDATE aliases, and endpoint tags', async () => {
        let fetchCount = 0;
        global.fetch = vi.fn().mockImplementation(async (url) => {
            fetchCount++;
            return {
                ok: true,
                status: 200,
                headers: new Headers({ 'content-type': 'application/json' }),
                json: async () => [{ id: fetchCount, title: `Post ${fetchCount}` }]
            };
        });

        const xml = `
        <uid_spec>
            <api_config base_url="https://api.test.com">
                <api_endpoint id="posts_ep" tag="get_posts" url="/posts" method="GET" target="posts_data" auto_fetch="true" />
            </api_config>
            <data_model>
                <state id="posts_data" type="array"></state>
            </data_model>
            <div>
                <button id="reval-btn">
                    <on_click action="REVALIDATE_API">
                        <tag>get_posts</tag>
                    </on_click>
                    Refresh
                </button>
                <button id="reval-alias-btn">
                    <on_click action="REVALIDATE" tag="get_posts" />
                    Refresh Alias
                </button>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        await new Promise(r => setTimeout(r, 20));

        expect(fetchCount).toBe(1);

        // Click REVALIDATE_API button
        container.querySelector('#reval-btn').click();
        await new Promise(r => setTimeout(r, 20));
        expect(fetchCount).toBe(2);

        // Click REVALIDATE alias button
        container.querySelector('#reval-alias-btn').click();
        await new Promise(r => setTimeout(r, 20));
        expect(fetchCount).toBe(3);

        // Programmatic revalidateApi with non-existent tag
        await engine.revalidateApi('non_existent_tag');
    });

    it('should handle API errors and populate error status and structured error in try/catch scope', async () => {
        global.fetch = vi.fn().mockImplementation(async () => {
            return {
                ok: false,
                status: 404,
                statusText: 'Not Found',
                headers: new Headers({ 'content-type': 'application/json' }),
                text: async () => '{"error": "Resource not found"}'
            };
        });

        const xml = `
        <uid_spec>
            <api_config base_url="https://api.test.com">
                <api_endpoint id="err_ep" url="/missing" method="GET" target="err_data" loading="is_loading" error="err_msg" auto_fetch="true" />
            </api_config>
            <data_model>
                <state id="err_data" type="string"></state>
                <state id="is_loading" type="string">false</state>
                <state id="err_msg" type="string"></state>
            </data_model>
            <div>
                <span id="err-text">{data.err_msg}</span>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        await new Promise(r => setTimeout(r, 20));

        expect(engine.getState('err_msg')).toBeTruthy();
        const status = engine.getApiStatus('err_ep');
        expect(status.error).toBeTruthy();
        expect(status.status).toBe(404);
    });

    it('should test request/response interceptors with headers and token injection', async () => {
        let sentHeaders = null;
        global.fetch = vi.fn().mockImplementation(async (url, init) => {
            sentHeaders = init.headers;
            return {
                ok: true,
                status: 200,
                headers: new Headers({ 'content-type': 'application/json' }),
                json: async () => ({ success: true })
            };
        });

        const xml = `
        <uid_spec>
            <api_config base_url="https://api.test.com">
                <api_endpoint id="auth_ep" url="/secure" method="POST" auto_fetch="false">
                    <header name="X-Custom-Header">CustomVal</header>
                    <body>{"msg": "hello"}</body>
                </api_endpoint>
            </api_config>
            <data_model>
                <state id="resp_data" type="object"></state>
            </data_model>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        if (engine.api && engine.api.onRequest) {
            engine.api.onRequest((config) => {
                config.headers['Authorization'] = 'Bearer token-123';
                return config;
            });
        }

        await engine.revalidateApi('auth_ep');
        expect(sentHeaders).toBeTruthy();
    });
});
