import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('EUIXEngine Edge Cases & Hardening Test Suite', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'app';
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    it('Edge Case 1: Division by zero should not pollute state with Infinity', () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="num">10</state>
                </data_model>
                <flex direction="column">
                    <button id="div_btn">
                        <on_click action="SET_STATE">
                            <path>data.num</path>
                            <value>{data.num} / 0</value>
                        </on_click>
                    </button>
                    <span id="res">{data.num}</span>
                </flex>
            </uid_spec>
        `;
        const engine = new EUIXEngine(container);
        engine.mount(xml);

        const btn = container.querySelector('#div_btn');
        btn.click();
        expect(engine.getState('num')).not.toBe('Infinity');
    });

    it('Edge Case 2: Non-existent state references in math should default to 0 gracefully', () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="total">100</state>
                </data_model>
                <flex direction="column">
                    <button id="calc_btn">
                        <on_click action="SET_STATE">
                            <path>data.total</path>
                            <value>{data.total} + {data.missing_key}</value>
                        </on_click>
                    </button>
                    <span id="res">{data.total}</span>
                </flex>
            </uid_spec>
        `;
        const engine = new EUIXEngine(container);
        engine.mount(xml);

        const btn = container.querySelector('#calc_btn');
        btn.click();
        expect(engine.getState('total')).toBe('100');
    });

    it('Edge Case 3: Negative numbers and floating point arithmetic', () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="val">0.1</state>
                </data_model>
                <flex direction="column">
                    <button id="add_btn">
                        <on_click action="SET_STATE">
                            <path>data.val</path>
                            <value>{data.val} + 0.2</value>
                        </on_click>
                    </button>
                    <button id="neg_btn">
                        <on_click action="SET_STATE">
                            <path>data.val</path>
                            <value>0 - {data.val}</value>
                        </on_click>
                    </button>
                </flex>
            </uid_spec>
        `;
        const engine = new EUIXEngine(container);
        engine.mount(xml);

        const addBtn = container.querySelector('#add_btn');
        addBtn.click();
        expect(parseFloat(engine.getState('val'))).toBeCloseTo(0.3);

        const negBtn = container.querySelector('#neg_btn');
        negBtn.click();
        expect(parseFloat(engine.getState('val'))).toBeCloseTo(-0.3);
    });

    it('Edge Case 4: Rapid state mutations should batch without UI tear or race conditions', () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="count">0</state>
                </data_model>
                <flex direction="column">
                    <span id="badge">{data.count}</span>
                </flex>
            </uid_spec>
        `;
        const engine = new EUIXEngine(container);
        engine.mount(xml);

        engine.batch(() => {
            for (let i = 0; i < 100; i++) {
                engine.setState('count', String(i));
            }
        });

        expect(engine.getState('count')).toBe('99');
        expect(container.querySelector('#badge').textContent).toBe('99');
    });

    it('Edge Case 5: Corrupted LocalStorage values should fall back safely without crashing engine', () => {
        localStorage.setItem('euix_state_corrupted_key', '{ malformed json... }');

        const xml = `
            <uid_spec>
                <data_model>
                    <state id="corrupted_key" persist="local">Default Fallback</state>
                </data_model>
                <flex direction="column">
                    <span id="target">{data.corrupted_key}</span>
                </flex>
            </uid_spec>
        `;

        expect(() => {
            const engine = new EUIXEngine(container);
            engine.mount(xml);
        }).not.toThrow();

        localStorage.removeItem('euix_state_corrupted_key');
    });

    it('Edge Case 6: EUIXEngine.escapeRegExp should safely escape special regex characters and handle nested path binding', () => {
        expect(EUIXEngine.escapeRegExp('user.name[0]? (test)*+')).toBe('user\\.name\\[0\\]\\? \\(test\\)\\*\\+');
        expect(EUIXEngine.escapeRegExp(null)).toBe('');

        const xml = `
            <uid_spec>
                <data_model>
                    <state id="user.name">Alice</state>
                </data_model>
                <flex direction="column">
                    <span id="target">{data.user.name}</span>
                </flex>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);
        expect(container.querySelector('#target').textContent).toBe('Alice');
    });
});
