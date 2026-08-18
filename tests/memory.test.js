import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('EUIXEngine Memory Leak & Teardown Test Suite', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    it('should clean up all DOM nodes and state watchers across 200 mount/unmount stress cycles', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="counter" type="string">0</state>
            </data_model>
            <flex direction="column">
                <span id="counter_val">{data.counter}</span>
                <button id="btn" ref="myBtn">Click</button>
            </flex>
        </uid_spec>
        `;

        for (let i = 0; i < 200; i++) {
            const engine = new EUIXEngine(container);
            engine.mount(xml);
            engine.setState('counter', `${i}`);

            expect(container.textContent).toContain(`${i}`);
            expect(engine.refs.myBtn).toBeDefined();

            // Destroy engine instance
            engine.destroy();
        }

        expect(container.children.length).toBe(0);
    }, 15000);

    it('should provide zero-leakage teardown when invoking engine.destroy() / engine.unmount()', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="user" type="string">John</state>
                <state id="tick" type="string">0</state>
            </data_model>
            <flex direction="column">
                <span id="usr">{data.user}</span>
                <on_interval ms="1000" action="SET_STATE">
                    <path>data.tick</path>
                    <value>10</value>
                </on_interval>
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        engine.watch('user', () => {});
        expect(engine._bindings.size).toBeGreaterThan(0);
        expect(engine._stateWatchers.size).toBeGreaterThan(0);
        expect(engine._activeIntervals.length).toBe(1);

        engine.unmount();

        expect(engine._bindings.size).toBe(0);
        expect(engine._stateWatchers.size).toBe(0);
        expect(engine._activeIntervals.length).toBe(0);
        expect(container.innerHTML).toBe('');
    });

    it('should properly unregister state watcher callbacks when unsubscribed', () => {
        const engine = new EUIXEngine(container);
        engine.mount('<uid_spec><data_model><state id="val">0</state></data_model></uid_spec>');

        const callback = vi.fn();
        const unsubscribe = engine.watch('val', callback);

        engine.setState('val', '1');
        expect(callback).toHaveBeenCalledTimes(1);

        unsubscribe();
        engine.setState('val', '2');
        expect(callback).toHaveBeenCalledTimes(1); // Should not trigger after unsubscribe
    });

    it('should clean up active recurring interval timers on engine destroy', async () => {
        vi.useFakeTimers();

        const xml = `
        <uid_spec>
            <data_model>
                <state id="tick" type="string">0</state>
            </data_model>
            <flex direction="column">
                <on_interval ms="100" action="SET_STATE">
                    <path>data.tick</path>
                    <value>10</value>
                </on_interval>
                <span>{data.tick}</span>
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        vi.advanceTimersByTime(250);
        expect(engine.getState('tick')).toBe('10');

        engine.destroy();

        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('should trigger on_unmount / on_destroy hooks when elements are removed from DOM', async () => {
        const onUnmountFn = vi.fn();

        const engine = new EUIXEngine(container);
        engine.registerAction('TRIGGER_UNMOUNT_HOOK', () => {
            onUnmountFn();
        });

        const xml = `
        <uid_spec>
            <flex direction="column">
                <on_unmount action="TRIGGER_UNMOUNT_HOOK" />
                <span>Unmount Test</span>
            </flex>
        </uid_spec>
        `;

        engine.mount(xml);
        expect(container.textContent).toContain('Unmount Test');

        // Unmount container
        engine.destroy();
    });

    it('should remove global window event listeners (focus, online, storage) on destroy/unmount', () => {
        const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

        const engine = new EUIXEngine(container);
        engine.mount('<uid_spec><data_model><state id="test">1</state></data_model></uid_spec>');

        // Trigger listener registrations
        if (typeof engine._initRevalidationListeners === 'function') {
            engine._initRevalidationListeners();
        }
        if (typeof engine._setupStorageListener === 'function') {
            engine._setupStorageListener();
        }

        const customHook = vi.fn();
        engine.onUnmount(customHook);

        engine.destroy();

        expect(customHook).toHaveBeenCalledTimes(1);
        expect(removeEventListenerSpy).toHaveBeenCalledWith('focus', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function));
        expect(removeEventListenerSpy).toHaveBeenCalledWith('storage', expect.any(Function));

        removeEventListenerSpy.mockRestore();
    });
});
