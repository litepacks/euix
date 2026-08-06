import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngine } from '../src/EUIXEngine.js';

describe('EUIXEngine State Persistence Suite (LocalStorage & SessionStorage)', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        localStorage.clear();
        sessionStorage.clear();
    });

    afterEach(() => {
        document.body.innerHTML = '';
        localStorage.clear();
        sessionStorage.clear();
    });

    it('should persist state to localStorage when using engine.persist()', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="username">JohnDoe</state>
            </data_model>
            <flex>
                <span>{data.username}</span>
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.persist('username', { storage: 'local', key: 'app_user' });
        engine.mount(xml);

        expect(localStorage.getItem('app_user')).toBe('"JohnDoe"');

        engine.setState('username', 'JaneDoe');
        expect(localStorage.getItem('app_user')).toBe('"JaneDoe"');
    });

    it('should persist state to sessionStorage when using engine.persist()', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="session_token">abc123token</state>
            </data_model>
            <flex>
                <span>{data.session_token}</span>
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.persist('session_token', { storage: 'session', key: 'user_auth' });
        engine.mount(xml);

        expect(sessionStorage.getItem('user_auth')).toBe('"abc123token"');

        engine.setState('session_token', 'xyz987updated');
        expect(sessionStorage.getItem('user_auth')).toBe('"xyz987updated"');
    });

    it('should restore stored state from localStorage during XML mount', async () => {
        localStorage.setItem('euix_state_theme_mode', '"dark_mode"');

        const xml = `
        <uid_spec>
            <data_model>
                <state id="theme_mode" persist="local">light_mode</state>
            </data_model>
            <flex>
                <span id="theme_label">{data.theme_mode}</span>
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        expect(engine.getState('theme_mode')).toBe('dark_mode');
        const label = container.querySelector('#theme_label');
        expect(label).not.toBeNull();
        expect(label.textContent).toBe('dark_mode');
    });

    it('should parse declarative <persistence> tags in XML spec', async () => {
        localStorage.setItem('pref_lang', '"tr_TR"');

        const xml = `
        <uid_spec>
            <persistence storage="local">
                <persisted_key key="app_lang" storage_key="pref_lang" />
            </persistence>
            <data_model>
                <state id="app_lang">en_US</state>
            </data_model>
            <flex>
                <span id="lang_label">{data.app_lang}</span>
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        expect(engine.getState('app_lang')).toBe('tr_TR');
        const label = container.querySelector('#lang_label');
        expect(label).not.toBeNull();
        expect(label.textContent).toBe('tr_TR');
    });

    it('should clear persisted storage when calling engine.clearPersistedState()', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="draft_text" persist="local">Draft</state>
            </data_model>
            <flex>
                <span>{data.draft_text}</span>
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        expect(localStorage.getItem('euix_state_draft_text')).toBe('"Draft"');

        engine.clearPersistedState('draft_text');
        expect(localStorage.getItem('euix_state_draft_text')).toBeNull();
    });

    it('should synchronize state reactive UI when window storage event fires (multi-tab sync)', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="shared_val" persist="local">Initial</state>
            </data_model>
            <flex>
                <span id="val_label">{data.shared_val}</span>
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        const storageEvent = new Event('storage');
        storageEvent.key = 'euix_state_shared_val';
        storageEvent.newValue = JSON.stringify('Updated From Tab 2');

        window.dispatchEvent(storageEvent);

        expect(engine.getState('shared_val')).toBe('Updated From Tab 2');
        const label = container.querySelector('#val_label');
        expect(label).not.toBeNull();
        expect(label.textContent).toBe('Updated From Tab 2');
    });

    it('should correctly evaluate math addition on state expressions (e.g. counter + 1)', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="persisted_counter" persist="local">0</state>
            </data_model>
            <flex>
                <button id="add_btn">
                    <on_click action="SET_STATE">
                        <path>data.persisted_counter</path>
                        <value>{data.persisted_counter} + 1</value>
                    </on_click>
                    Add
                </button>
                <span id="counter_label">{data.persisted_counter}</span>
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        const btn = container.querySelector('#add_btn');
        btn.click();
        expect(engine.getState('persisted_counter')).toBe('1');

        btn.click();
        expect(engine.getState('persisted_counter')).toBe('2');

        btn.click();
        expect(engine.getState('persisted_counter')).toBe('3');
    });
});
