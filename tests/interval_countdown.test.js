import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('EUIXEngine Interval, Timer & Expression Evaluation Suite', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'app';
        document.body.appendChild(container);
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    it('should execute <on_interval> recurring timers and evaluate math operations in SET_STATE', async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="counter">10</state>
                </data_model>
                <flex direction="column">
                    <on_interval ms="1000" if="{data.counter} > 0" action="SET_STATE">
                        <path>data.counter</path>
                        <value>{data.counter} - 1</value>
                    </on_interval>
                    <span id="badge">{data.counter}s</span>
                </flex>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        expect(engine.getState('counter')).toBe('10');
        const badge = container.querySelector('#badge');
        expect(badge.textContent).toBe('10s');

        // Advance 1 second
        vi.advanceTimersByTime(1000);
        expect(engine.getState('counter')).toBe('9');
        expect(badge.textContent).toBe('9s');

        // Advance 3 more seconds
        vi.advanceTimersByTime(3000);
        expect(engine.getState('counter')).toBe('6');
        expect(badge.textContent).toBe('6s');
    });

    it('should stop timer when condition becomes false (counter reaches 0)', async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="timer">2</state>
                </data_model>
                <flex direction="column">
                    <on_interval ms="1000" if="{data.timer} > 0" action="SET_STATE">
                        <path>data.timer</path>
                        <value>{data.timer} - 1</value>
                    </on_interval>
                    <span id="display">{data.timer}</span>
                </flex>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        vi.advanceTimersByTime(1000);
        expect(engine.getState('timer')).toBe('1');

        vi.advanceTimersByTime(1000);
        expect(engine.getState('timer')).toBe('0');

        // Advance 5 more seconds - should remain 0
        vi.advanceTimersByTime(5000);
        expect(engine.getState('timer')).toBe('0');
    });

    it('should NOT render non-visual tags (<on_interval>, <api_config>, <data_model>) into the DOM tree as text or elements', () => {
        const xml = `
            <uid_spec>
                <api_config base_url="https://api.example.com" />
                <data_model>
                    <state id="val">50</state>
                </data_model>
                <flex direction="column" id="card">
                    <on_interval ms="1000" action="SET_STATE">
                        <path>data.val</path>
                        <value>{data.val} - 1</value>
                    </on_interval>
                    <span id="title">REMAINING TIME</span>
                    <span id="val_badge">{data.val}s</span>
                </flex>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        const card = container.querySelector('#card');
        expect(card.querySelector('on_interval')).toBeNull();
        expect(card.querySelector('path')).toBeNull();
        expect(card.querySelector('value')).toBeNull();
        expect(card.textContent).not.toContain('data.val');
        expect(card.textContent).not.toContain('50 - 1');
        expect(card.textContent).toContain('REMAINING TIME');
        expect(card.textContent).toContain('50s');
    });

    it('should evaluate complex ternary math expressions in SET_STATE without string leakage', () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="seconds">5</state>
                </data_model>
                <flex direction="column">
                    <button id="step_btn">
                        <on_click action="SET_STATE">
                            <path>data.seconds</path>
                            <value>{data.seconds} > 0 ? {data.seconds} - 1 : 0</value>
                        </on_click>
                    </button>
                    <span id="result">{data.seconds}</span>
                </flex>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        const btn = container.querySelector('#step_btn');
        btn.click();
        expect(engine.getState('seconds')).toBe('4');
        expect(container.querySelector('#result').textContent).toBe('4');

        btn.click();
        expect(engine.getState('seconds')).toBe('3');
        expect(container.querySelector('#result').textContent).toBe('3');
    });

    it('should automatically clear interval timer when DOM element is unmounted/removed', () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="ticks">0</state>
                </data_model>
                <flex direction="column" id="wrapper">
                    <on_interval ms="1000" action="SET_STATE">
                        <path>data.ticks</path>
                        <value>{data.ticks} + 1</value>
                    </on_interval>
                </flex>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);
        vi.advanceTimersByTime(1000);
        expect(engine.getState('ticks')).toBe('1');

        // Unmount container
        container.innerHTML = '';

        // Advance timer after unmount - should not update or throw error
        vi.advanceTimersByTime(3000);
        expect(engine.getState('ticks')).toBe('1');
    });

    it('should increment state correctly across multiple consecutive interval ticks without string concatenation', () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="seconds" type="number">0</state>
                </data_model>
                <flex direction="column">
                    <on_interval ms="1000" action="SET_STATE">
                        <path>data.seconds</path>
                        <value>{data.seconds} + 1</value>
                    </on_interval>
                    <p id="label">Sayaç: {data.seconds} sn</p>
                </flex>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        const label = container.querySelector('#label');
        expect(label.textContent).toBe('Sayaç: 0 sn');

        // Tick 1
        vi.advanceTimersByTime(1000);
        expect(engine.getState('seconds')).toBe(1);
        expect(label.textContent).toBe('Sayaç: 1 sn');

        // Tick 2
        vi.advanceTimersByTime(1000);
        expect(engine.getState('seconds')).toBe(2);
        expect(label.textContent).toBe('Sayaç: 2 sn');

        // Tick 3
        vi.advanceTimersByTime(1000);
        expect(engine.getState('seconds')).toBe(3);
        expect(label.textContent).toBe('Sayaç: 3 sn');

        // Tick 4
        vi.advanceTimersByTime(1000);
        expect(engine.getState('seconds')).toBe(4);
        expect(label.textContent).toBe('Sayaç: 4 sn');
    });
});
