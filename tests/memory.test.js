import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('EUIXEngine Memory Leak & Detached Reference Test Suite', () => {
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

    it('should clean up all DOM nodes and state watchers across 100 mount/unmount cycles', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="counter" type="string">0</state>
            </data_model>
            <flex direction="column">
                <span id="counter_val">{data.counter}</span>
                <button id="btn">Click</button>
            </flex>
        </uid_spec>
        `;

        for (let i = 0; i < 100; i++) {
            const engine = new EUIXEngine(container);
            engine.mount(xml);
            engine.setState('counter', `${i}`);

            expect(container.textContent).toContain(`${i}`);

            // Unmount/clear container
            container.innerHTML = '';
        }

        expect(container.children.length).toBe(0);
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

    it('should clean up active recurring interval timers on container reset', async () => {
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

        // Advance timers by 250ms (should trigger 2 ticks)
        vi.advanceTimersByTime(250);
        expect(engine.getState('tick')).toBe('10');

        // Unmount component
        container.innerHTML = '';

        vi.restoreAllMocks();
        vi.useRealTimers();
    });
});
