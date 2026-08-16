import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('API Endpoint ID-based Status & Loading Tracking Suite', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
        if (EUIXEngine._globalComponentSpecs) {
            EUIXEngine._globalComponentSpecs.clear();
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Scenario 1: Explicit loading & error binding via loading="state_key" and error="state_key"', async () => {
        let resolveFetch;
        const fetchPromise = new Promise(resolve => { resolveFetch = resolve; });

        vi.stubGlobal('fetch', vi.fn().mockImplementation(() => fetchPromise));

        const appXml = `
        <uid_spec>
            <data_model>
                <state id="posts_loading" type="boolean">false</state>
                <state id="posts_error"></state>
                <state id="posts" type="array"></state>
            </data_model>

            <api_config base_url="https://api.example.com">
                <api_endpoint 
                    id="get_posts" 
                    url="/posts" 
                    method="GET" 
                    bind_target="posts" 
                    loading="posts_loading" 
                    error="posts_error"
                    auto_fetch="true" 
                />
            </api_config>

            <flex direction="column">
                <span class="loading-indicator">Loading: {data.posts_loading ? 'YES' : 'NO'}</span>
                <span class="error-msg">Error: {data.posts_error}</span>
                <span class="count">Posts: {data.posts.length}</span>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(appXml, '#app');

        // Immediately after mount, loading should be true
        expect(engine.getState('posts_loading')).toBe('true');
        expect(document.querySelector('.loading-indicator').textContent).toBe('Loading: YES');

        // Resolve API call
        resolveFetch({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => [{ id: 1, title: 'Post 1' }, { id: 2, title: 'Post 2' }]
        });

        await new Promise(r => setTimeout(r, 20));

        // Loading should be false, posts populated
        expect(engine.getState('posts_loading')).toBe('false');
        expect(document.querySelector('.loading-indicator').textContent).toBe('Loading: NO');
        expect(document.querySelector('.count').textContent).toBe('Posts: 2');
    });

    it('Scenario 2: Automatic ID-based status access via {api.get_posts.loading}, status, error, and engine.getApiStatus()', async () => {
        let resolveFetch;
        const fetchPromise = new Promise(resolve => { resolveFetch = resolve; });

        vi.stubGlobal('fetch', vi.fn().mockImplementation(() => fetchPromise));

        const appXml = `
        <uid_spec>
            <data_model>
                <state id="posts" type="array"></state>
            </data_model>

            <api_config base_url="https://api.example.com">
                <api_endpoint 
                    id="get_posts" 
                    url="/posts" 
                    method="GET" 
                    bind_target="posts" 
                    auto_fetch="true" 
                />
            </api_config>

            <flex direction="column">
                <span class="api-loading">API Loading: {api.get_posts.loading ? 'TRUE' : 'FALSE'}</span>
                <span class="api-status">API Status: {api.get_posts.status}</span>
                <span class="api-error">API Error: {api.get_posts.error}</span>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(appXml, '#app');

        // Initial state during request
        const statusDuring = engine.getApiStatus('get_posts');
        expect(statusDuring.loading).toBe(true);
        expect(document.querySelector('.api-loading').textContent).toBe('API Loading: TRUE');

        // Resolve fetch with 200 OK
        resolveFetch({
            ok: true,
            status: 200,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: async () => [{ id: 1, title: 'Hello World' }]
        });

        await new Promise(r => setTimeout(r, 20));

        const statusAfter = engine.getApiStatus('get_posts');
        expect(statusAfter.loading).toBe(false);
        expect(statusAfter.status).toBe(200);
        expect(statusAfter.error).toBeNull();
        expect(document.querySelector('.api-loading').textContent).toBe('API Loading: FALSE');
        expect(document.querySelector('.api-status').textContent).toBe('API Status: 200');
    });

    it('Scenario 3: Automatic ID-based error tracking on HTTP failure', async () => {
        let rejectFetch;
        const fetchPromise = new Promise((_, reject) => { rejectFetch = reject; });

        vi.stubGlobal('fetch', vi.fn().mockImplementation(() => fetchPromise));

        const appXml = `
        <uid_spec>
            <api_config base_url="https://api.example.com">
                <api_endpoint 
                    id="user_data" 
                    url="/user/profile" 
                    method="GET" 
                    auto_fetch="true" 
                />
            </api_config>

            <flex direction="column">
                <span class="loading-val">{api.user_data.loading ? 'LOADING' : 'IDLE'}</span>
                <span class="error-val">Error: {api.user_data.error}</span>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(appXml, '#app');
        expect(document.querySelector('.loading-val').textContent).toBe('LOADING');

        rejectFetch(new Error('Network connection failed'));

        await new Promise(r => setTimeout(r, 20));

        const status = engine.getApiStatus('user_data');
        expect(status.loading).toBe(false);
        expect(status.error).toContain('Network connection failed');
        expect(document.querySelector('.loading-val').textContent).toBe('IDLE');
        expect(document.querySelector('.error-val').textContent).toBe('Error: Network connection failed');
    });
});
