import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngine } from '../src/EUIXEngine.js';
import { EUIXStoragePlugin } from '../src/plugins/EUIXStoragePlugin.js';

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

    it('should test EUIXStoragePlugin plugin metadata, install method, and null/empty guards', () => {
        expect(EUIXStoragePlugin.name).toBe('storage');
        expect(typeof EUIXStoragePlugin.install).toBe('function');

        const mockEngineClass = function() {};
        mockEngineClass.prototype = {
            _persistenceConfig: new Map(),
            parseBindPath: (k) => k
        };

        EUIXStoragePlugin.install(mockEngineClass);

        const instance = new mockEngineClass();
        expect(typeof instance.persist).toBe('function');
        expect(typeof instance.clearPersistedState).toBe('function');

        // Guard tests for empty key
        expect(instance.persist('')).toBe(instance);
        expect(instance.persist(null)).toBe(instance);
        expect(instance.clearPersistedState('')).toBe(instance);
        expect(instance.clearPersistedState(null)).toBe(instance);
    });

    it('should handle JSON parse fallback and storage event with null newValue in EUIXStoragePlugin', () => {
        localStorage.setItem('euix_state_fallback_key', 'raw_string_without_quotes');

        const xml = `
        <uid_spec>
            <data_model>
                <state id="fallback_key" persist="local">default_val</state>
            </data_model>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        expect(engine.getState('fallback_key')).toBe('raw_string_without_quotes');

        // Trigger storage event with null newValue
        const storageEvent = new Event('storage');
        storageEvent.key = 'euix_state_fallback_key';
        storageEvent.newValue = null;
        window.dispatchEvent(storageEvent);

        expect(engine.getState('fallback_key')).toBe('');
    });

    it('should clear sessionStorage persisted state and handle undefined value persistence', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="sess_key">initial</state>
                <state id="undef_key">initial_undef</state>
            </data_model>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.persist('sess_key', { storage: 'session', key: 'custom_session_key' });
        engine.persist('undef_key', { storage: 'local', key: 'custom_undef_key' });
        engine.mount(xml);

        expect(sessionStorage.getItem('custom_session_key')).toBe('"initial"');
        engine.clearPersistedState('sess_key');
        expect(sessionStorage.getItem('custom_session_key')).toBeNull();

        // Test undefined state value persistence
        engine.setState('undef_key', undefined);
        expect(localStorage.getItem('custom_undef_key')).toBe('""');
    });

    it('should test storage event error catch fallback and non-matching event guards', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="sync_key" persist="local">val1</state>
            </data_model>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        // 1. Storage event with unparseable JSON (triggers catch block)
        const badJsonEvent = new Event('storage');
        badJsonEvent.key = 'euix_state_sync_key';
        badJsonEvent.newValue = 'not-valid-json{[[(';
        window.dispatchEvent(badJsonEvent);
        expect(engine.getState('sync_key')).toBe('not-valid-json{[[(');

        // 2. Storage event with empty/null key (guard test)
        const emptyKeyEvent = new Event('storage');
        emptyKeyEvent.key = '';
        emptyKeyEvent.newValue = 'something';
        window.dispatchEvent(emptyKeyEvent);
        expect(engine.getState('sync_key')).toBe('not-valid-json{[[(');

        // 3. Storage event with different key
        const diffKeyEvent = new Event('storage');
        diffKeyEvent.key = 'other_app_key';
        diffKeyEvent.newValue = '"value"';
        window.dispatchEvent(diffKeyEvent);
        expect(engine.getState('sync_key')).toBe('not-valid-json{[[(');
    });

    it('should test persist with default options and _savePersistedState error handling', () => {
        const engine = new EUIXEngine(container);
        engine.mount('<uid_spec><data_model><state id="foo">bar</state></data_model></uid_spec>');

        // Persist with no options argument (tests default parameter)
        engine.persist('foo');
        expect(localStorage.getItem('euix_state_foo')).toBe('"bar"');

        // Test clearing unpersisted key
        expect(engine.clearPersistedState('non_existent')).toBe(engine);

        // Test _savePersistedState for unconfigured key
        engine._savePersistedState('non_existent_key', 'some_value');

        // Test _savePersistedState catch block when store.setItem throws
        let reportedMsg = '';
        const reportSpy = vi.spyOn(engine, 'reportError').mockImplementation((err, msg) => {
            reportedMsg = msg;
        });
        const setItemSpy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
            throw new Error('QuotaExceededError');
        });

        engine._savePersistedState('foo', 'new_val');
        expect(reportSpy).toHaveBeenCalled();
        expect(reportedMsg).toContain('Error persisting state key "foo"');

        setItemSpy.mockRestore();
    });

    it('should handle persist when storage type is uppercase and trigger watchers on storage event', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="watched_key">init</state>
                <state id="session_ignored">sess_val</state>
            </data_model>
        </uid_spec>
        `;
        const engine = new EUIXEngine(container);
        engine.persist('watched_key', { storage: 'LOCAL' });
        engine.persist('session_ignored', { storage: 'SESSION', key: 'euix_sess_key' });
        engine.mount(xml);

        let watcherCalled = false;
        engine.watch('watched_key', (newVal) => {
            watcherCalled = true;
        });

        // 1. Storage event for session-persisted key should NOT trigger update
        const sessEvent = new Event('storage');
        sessEvent.key = 'euix_sess_key';
        sessEvent.newValue = '"new_sess_val"';
        window.dispatchEvent(sessEvent);
        expect(engine.getState('session_ignored')).toBe('sess_val');

        // 2. Storage event for local key should trigger watcher (testing { silent: false })
        const localEvent = new Event('storage');
        localEvent.key = 'euix_state_watched_key';
        localEvent.newValue = '"fresh_val"';
        window.dispatchEvent(localEvent);
        expect(engine.getState('watched_key')).toBe('fresh_val');
        expect(watcherCalled).toBe(true);
    });

    it('should handle persist when storage type is invalid or store is unavailable', () => {
        const engine = new EUIXEngine(container);
        engine.mount('<uid_spec><data_model><state id="baz">qux</state></data_model></uid_spec>');

        // Invalid storage type (neither session nor local store is returned if invalid name)
        engine.persist('baz', { storage: 'invalid_store_type' });
        engine.clearPersistedState('baz');
        engine._savePersistedState('baz', 'val');
    });
});


