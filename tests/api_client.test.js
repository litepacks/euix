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

    it('should support component-scoped <api_config> per component without cross-contamination', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'application/json']]),
            json: async () => ({ status: 'ok' })
        });
        global.fetch = mockFetch;

        const xml = `
        <uid_spec>
            <component_def name="comp-a">
                <api_config base_url="https://api-a.com" />
                <flex>
                    <button id="btn_a">
                        <on_click action="XHR">
                            <url>/endpoint-a</url>
                            <target>data.res_a</target>
                        </on_click>
                    </button>
                </flex>
            </component_def>

            <component_def name="comp-b">
                <api_config base_url="https://api-b.com" />
                <flex>
                    <button id="btn_b">
                        <on_click action="XHR">
                            <url>/endpoint-b</url>
                            <target>data.res_b</target>
                        </on_click>
                    </button>
                </flex>
            </component_def>

            <data_model>
                <state id="res_a"></state>
                <state id="res_b"></state>
            </data_model>

            <flex direction="column">
                <comp-a />
                <comp-b />
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        container.querySelector('#btn_a').click();
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(mockFetch.mock.calls[0][0]).toBe('https://api-a.com/endpoint-a');

        container.querySelector('#btn_b').click();
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(mockFetch.mock.calls[1][0]).toBe('https://api-b.com/endpoint-b');
    });

    it('should allow component-level <api_config> to override global engine.configureApi()', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'application/json']]),
            json: async () => ({ status: 'ok' })
        });
        global.fetch = mockFetch;

        const xml = `
        <uid_spec>
            <component_def name="scoped-comp">
                <api_config base_url="https://component-api.com" />
                <flex>
                    <button id="scoped_btn">
                        <on_click action="XHR">
                            <url>/scoped-route</url>
                            <target>data.res</target>
                        </on_click>
                    </button>
                </flex>
            </component_def>

            <data_model><state id="res"></state></data_model>
            <scoped-comp />
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.configureApi({ baseUrl: 'https://global-api.com' });
        engine.mount(xml);

        container.querySelector('#scoped_btn').click();
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(mockFetch.mock.calls[0][0]).toBe('https://component-api.com/scoped-route');
    });

    it('should test nested component <api_config> header inheritance and precedence', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'application/json']]),
            json: async () => ({ status: 'ok' })
        });
        global.fetch = mockFetch;

        const xml = `
        <uid_spec>
            <component_def name="header-comp">
                <api_config base_url="https://headers-api.com">
                    <headers>
                        <header name="X-Component-Header">ScopedValue</header>
                    </headers>
                </api_config>
                <flex>
                    <button id="header_btn">
                        <on_click action="XHR">
                            <url>/header-route</url>
                            <target>data.res</target>
                        </on_click>
                    </button>
                </flex>
            </component_def>

            <data_model><state id="res"></state></data_model>
            <header-comp />
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        container.querySelector('#header_btn').click();
        await new Promise(resolve => setTimeout(resolve, 50));
        
        const calledOptions = mockFetch.mock.calls[0][1];
        expect(mockFetch.mock.calls[0][0]).toBe('https://headers-api.com/header-route');
        expect(calledOptions.headers['X-Component-Header']).toBe('ScopedValue');
    });

    it('should block dangerous API URL schemes (javascript:, vbscript:, data:)', async () => {
        const mockFetch = vi.fn();
        global.fetch = mockFetch;

        const xml = `
        <uid_spec>
            <data_model>
                <state id="res"></state>
                <state id="err"></state>
            </data_model>
            <flex>
                <button id="bad_url_btn">
                    <on_click action="XHR">
                        <url>javascript:alert(1)</url>
                        <target>data.res</target>
                        <error>data.err</error>
                    </on_click>
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        container.querySelector('#bad_url_btn').click();
        expect(mockFetch).not.toHaveBeenCalled();
        expect(engine.getState('err')).toContain('Blocked dangerous API URL scheme');
    });

    it('should auto-inject Anti-CSRF token header when meta tag is present on mutating XHR requests', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'application/json']]),
            json: async () => ({ status: 'created' })
        });
        global.fetch = mockFetch;

        const meta = document.createElement('meta');
        meta.name = 'csrf-token';
        meta.content = 'test_csrf_token_abc123';
        document.head.appendChild(meta);

        const xml = `
        <uid_spec>
            <data_model><state id="res"></state></data_model>
            <flex>
                <button id="csrf_btn">
                    <on_click action="XHR">
                        <method>POST</method>
                        <url>/api/create</url>
                        <body name="test" />
                        <target>data.res</target>
                    </on_click>
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        container.querySelector('#csrf_btn').click();
        await new Promise(resolve => setTimeout(resolve, 50));

        const calledOptions = mockFetch.mock.calls[0][1];
        expect(calledOptions.headers['X-CSRF-Token']).toBe('test_csrf_token_abc123');

        meta.remove();
    });

    it('should support programmatic engine.revalidateApi(tag) and declarative <on_click action="REVALIDATE_API" tag="...">', async () => {
        let callCount = 0;
        const mockFetch = vi.fn().mockImplementation(async () => {
            callCount++;
            return {
                ok: true,
                status: 200,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => ({ count: callCount })
            };
        });
        global.fetch = mockFetch;

        const xml = `
        <uid_spec>
            <data_model>
                <state id="posts"></state>
            </data_model>
            <flex>
                <button id="fetch_posts">
                    <on_click action="XHR" tag="posts">
                        <url>https://api.example.com/posts</url>
                        <target>data.posts</target>
                    </on_click>
                </button>

                <button id="refresh_btn">
                    <on_click action="REVALIDATE_API" tag="posts" />
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        // Initial fetch
        container.querySelector('#fetch_posts').click();
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // Declarative Revalidate Action Click
        container.querySelector('#refresh_btn').click();
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(mockFetch).toHaveBeenCalledTimes(2);

        // Programmatic Revalidate API Call
        engine.revalidateApi('posts');
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should automatically revalidate tagged query after mutation POST action with <revalidate_tag>', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: new Map([['content-type', 'application/json']]),
            json: async () => ({ status: 'success' })
        });
        global.fetch = mockFetch;

        const xml = `
        <uid_spec>
            <data_model>
                <state id="list"></state>
                <state id="res"></state>
            </data_model>
            <flex>
                <button id="load_list">
                    <on_click action="XHR" tag="items">
                        <url>/api/items</url>
                        <target>data.list</target>
                    </on_click>
                </button>

                <button id="add_item">
                    <on_click action="XHR">
                        <method>POST</method>
                        <url>/api/items</url>
                        <target>data.res</target>
                        <revalidate>items</revalidate>
                    </on_click>
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        // 1. Initial list load
        container.querySelector('#load_list').click();
        await new Promise(resolve => setTimeout(resolve, 50));
        expect(mockFetch).toHaveBeenCalledTimes(1);

        // 2. Perform mutation which specifies <revalidate>items</revalidate>
        container.querySelector('#add_item').click();
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Should trigger POST + automatic refetch of /api/items
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });
});
