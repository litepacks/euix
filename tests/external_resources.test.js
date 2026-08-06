import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('EUIXEngine External JSON Resources (data_model src, constants src, loadDataModel, loadConstants)', () => {
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

    it('should programmatically load data model and constants via engine.loadDataModel() and engine.loadConstants()', async () => {
        const mockFetch = vi.fn().mockImplementation(async (url) => {
            if (url.includes('state.json')) {
                return {
                    ok: true,
                    json: async () => ({ user_name: 'Ahmet', app_version: '2.5.0' })
                };
            }
            if (url.includes('tokens.json')) {
                return {
                    ok: true,
                    json: async () => ({ card_bg: 'bg-emerald-500', btn_style: 'px-5 py-2' })
                };
            }
            return { ok: false };
        });
        global.fetch = mockFetch;

        const engine = new EUIXEngine(container);
        engine.mount('<uid_spec><data_model><state id="user_name"></state></data_model></uid_spec>');

        await engine.loadDataModel('https://api.com/state.json');
        await engine.loadConstants('https://api.com/tokens.json');

        expect(engine.getState('user_name')).toBe('Ahmet');
        expect(engine.getState('app_version')).toBe('2.5.0');
        expect(engine.getConstant('card_bg')).toBe('bg-emerald-500');
    });

    it('should declaratively load external data_model and constants via src attribute in XML', async () => {
        const mockFetch = vi.fn().mockImplementation(async (url) => {
            if (url.includes('initial-state.json')) {
                return {
                    ok: true,
                    json: async () => ({ role: 'Lead Architect', score: 100 })
                };
            }
            if (url.includes('theme.json')) {
                return {
                    ok: true,
                    json: async () => ({ primary_badge: 'px-3 py-1 bg-indigo-100 text-indigo-700' })
                };
            }
            return { ok: false };
        });
        global.fetch = mockFetch;

        const xml = `
        <uid_spec>
            <constants src="https://api.com/theme.json" />
            <data_model src="https://api.com/initial-state.json">
                <state id="local_counter">1</state>
            </data_model>
            <flex direction="column">
                <span id="role_span">{data.role}</span>
                <span id="badge_span" class="{const.primary_badge}">Badge</span>
            </flex>
        </uid_spec>
        `;

        const engine = await EUIXEngine.mountAsync(xml, container);

        expect(engine.getState('role')).toBe('Lead Architect');
        expect(engine.getState('score')).toBe(100);
        expect(engine.getState('local_counter')).toBe('1');
        expect(engine.getConstant('primary_badge')).toBe('px-3 py-1 bg-indigo-100 text-indigo-700');

        const badgeEl = container.querySelector('#badge_span');
        expect(badgeEl.className).toContain('bg-indigo-100');
    });

    it('should declaratively load single state JSON from state src attribute', async () => {
        const mockFetch = vi.fn().mockImplementation(async (url) => {
            if (url.includes('profile.json')) {
                return {
                    ok: true,
                    json: async () => ({ id: 42, username: 'dev_user' })
                };
            }
            return { ok: false };
        });
        global.fetch = mockFetch;

        const xml = `
        <uid_spec>
            <data_model>
                <state id="profile" src="https://api.com/profile.json" />
            </data_model>
            <flex direction="column">
                <span id="user_span">{data.profile.username}</span>
            </flex>
        </uid_spec>
        `;

        const engine = await EUIXEngine.mountAsync(xml, container);
        expect(engine.getState('profile').username).toBe('dev_user');
    });
});
