import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('EUIXEngine API Client Suite (BaseURL, Default Headers, Credentials, Interceptors)', () => {
    let container;
    let originalFetch;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        originalFetch = global.fetch;
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        global.fetch = originalFetch;
        vi.restoreAllMocks();
    });

    it('should configure API Client programmatically using engine.configureApi()', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            headers: new Map([['content-type', 'application/json']]),
            json: async () => ({ status: 'success' })
        });
        global.fetch = mockFetch;

        const xml = `
        <uid_spec>
            <data_model>
                <state id="api_result"></state>
                <state id="user_token">secret_token_123</state>
            </data_model>
            <flex>
                <button id="fetch_btn">
                    <on_click action="XHR">
                        <method>GET</method>
                        <url>/user/profile</url>
                        <target>data.api_result</target>
                    </on_click>
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.configureApi({
            baseUrl: 'https://api.example.com/v1',
            credentials: 'include',
            headers: {
                'Authorization': 'Bearer {data.user_token}',
                'X-App-Client': 'EUIX-Engine'
            }
        });
        engine.mount(xml);

        const btn = container.querySelector('#fetch_btn');
        btn.click();

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [calledUrl, calledOptions] = mockFetch.mock.calls[0];

        expect(calledUrl).toBe('https://api.example.com/v1/user/profile');
        expect(calledOptions.credentials).toBe('include');
        expect(calledOptions.headers['Authorization']).toBe('Bearer secret_token_123');
        expect(calledOptions.headers['X-App-Client']).toBe('EUIX-Engine');
    });

    it('should parse declarative <api_config> from XML spec', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            headers: new Map([['content-type', 'application/json']]),
            json: async () => [{ id: 1, name: 'Item 1' }]
        });
        global.fetch = mockFetch;

        const xml = `
        <uid_spec>
            <api_config base_url="https://backend.test.org/api" credentials="same-origin">
                <headers>
                    <header name="X-Custom-Header">CustomValue</header>
                </headers>
            </api_config>
            <data_model>
                <state id="items" type="array"></state>
            </data_model>
            <flex>
                <button id="load_btn">
                    <on_click action="XHR">
                        <method>GET</method>
                        <url>items/list</url>
                        <target>data.items</target>
                    </on_click>
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        const btn = container.querySelector('#load_btn');
        btn.click();

        await new Promise(resolve => setTimeout(resolve, 50));

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const [calledUrl, calledOptions] = mockFetch.mock.calls[0];

        expect(calledUrl).toBe('https://backend.test.org/api/items/list');
        expect(calledOptions.credentials).toBe('same-origin');
        expect(calledOptions.headers['X-Custom-Header']).toBe('CustomValue');
    });

    it('should override default API headers with action-level headers', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            headers: new Map([['content-type', 'application/json']]),
            json: async () => ({ ok: true })
        });
        global.fetch = mockFetch;

        const xml = `
        <uid_spec>
            <data_model>
                <state id="res"></state>
            </data_model>
            <flex>
                <button id="post_btn">
                    <on_click action="XHR">
                        <method>POST</method>
                        <url>https://external-service.com/data</url>
                        <header name="Authorization">Bearer override_token</header>
                        <target>data.res</target>
                    </on_click>
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.setApiHeader('Authorization', 'Bearer default_token');
        engine.setApiHeader('X-Global-Key', 'global_val');
        engine.mount(xml);

        const btn = container.querySelector('#post_btn');
        btn.click();

        await new Promise(resolve => setTimeout(resolve, 50));

        const [calledUrl, calledOptions] = mockFetch.mock.calls[0];

        // Absolute URL should NOT have baseUrl prepended
        expect(calledUrl).toBe('https://external-service.com/data');
        expect(calledOptions.headers['Authorization']).toBe('Bearer override_token');
        expect(calledOptions.headers['X-Global-Key']).toBe('global_val');
    });

    it('should support dynamic setApiHeader and removeApiHeader methods', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            headers: new Map([['content-type', 'application/json']]),
            json: async () => ({ ok: true })
        });
        global.fetch = mockFetch;

        const xml = `
        <uid_spec>
            <data_model><state id="res"></state></data_model>
            <flex>
                <button id="btn">
                    <on_click action="XHR">
                        <method>GET</method>
                        <url>https://api.com/test</url>
                        <target>data.res</target>
                    </on_click>
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.setApiHeader('X-Session-ID', 'sess_123');
        engine.mount(xml);

        engine.removeApiHeader('X-Session-ID');
        engine.setApiHeader('X-New-Header', 'active');

        container.querySelector('#btn').click();
        await new Promise(resolve => setTimeout(resolve, 50));

        const [, calledOptions] = mockFetch.mock.calls[0];
        expect(calledOptions.headers['X-Session-ID']).toBeUndefined();
        expect(calledOptions.headers['X-New-Header']).toBe('active');
    });

    it('should invoke onRequest and onResponse interceptors', async () => {
        const onRequestSpy = vi.fn();
        const onResponseSpy = vi.fn();

        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'application/json']]),
            json: async () => ({ result: 'ok' })
        });
        global.fetch = mockFetch;

        const xml = `
        <uid_spec>
            <data_model><state id="res"></state></data_model>
            <flex>
                <button id="btn">
                    <on_click action="XHR">
                        <method>GET</method>
                        <url>https://api.com/users</url>
                        <target>data.res</target>
                    </on_click>
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.configureApi({
            onRequest: onRequestSpy,
            onResponse: onResponseSpy
        });
        engine.mount(xml);

        container.querySelector('#btn').click();
        await new Promise(resolve => setTimeout(resolve, 50));

        expect(onRequestSpy).toHaveBeenCalledTimes(1);
        expect(onRequestSpy.mock.calls[0][0].url).toBe('https://api.com/users');

        expect(onResponseSpy).toHaveBeenCalledTimes(1);
        expect(onResponseSpy.mock.calls[0][0].status).toBe(200);
    });
});
