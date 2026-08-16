import { describe, it, expect, beforeEach } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('EUIXEngine Vitest Performance & Benchmark Suite (js-framework-benchmark standard)', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
    });

    it('should measure Initial XML Mount time', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="items" type="array"></state>
            </data_model>
            <flex direction="column" gap="16" class="container">
                <flex direction="row" justify="between" align="center">
                    <component type="title">Benchmark App</component>
                </flex>
                <for_each items="{data.items}" var="item">
                    <flex direction="row" align="center" justify="between">
                        <component type="text">{item.text}</component>
                    </flex>
                </for_each>
            </flex>
        </uid_spec>
        `;

        const start = performance.now();
        const engine = EUIXEngine.mount(xml, '#app');
        const duration = performance.now() - start;

        expect(engine).toBeDefined();
        console.log(`[Vitest Bench] Initial Mount Duration: ${duration.toFixed(2)} ms`);
        expect(duration).toBeGreaterThanOrEqual(0);
    });

    it('should benchmark 1,000 Bulk Item DOM Mutation in Vitest', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="todos" type="array"></state>
            </data_model>
            <flex direction="column">
                <for_each items="{data.todos}" var="todo">
                    <flex direction="row" align="center" gap="8">
                        <component type="checkbox" bind="todo.completed" />
                        <component type="text">{todo.text}</component>
                    </flex>
                </for_each>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const items = Array.from({ length: 1000 }, (_, i) => ({ id: `${i}`, text: `Task ${i}`, completed: 'false' }));

        const start = performance.now();
        engine.setState('todos', items);
        const duration = performance.now() - start;

        expect(engine.getState('todos').length).toBe(1000);
        expect(document.querySelectorAll('span').length).toBe(1000);
        console.log(`[Vitest Bench] 1,000 Item Render Duration: ${duration.toFixed(2)} ms`);
    }, 15000);

    it('should benchmark 3,000 Bulk Item DOM Mutation in Vitest', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="todos" type="array"></state>
            </data_model>
            <flex direction="column">
                <for_each items="{data.todos}" var="todo">
                    <flex direction="row" align="center" gap="8">
                        <component type="text">{todo.text}</component>
                    </flex>
                </for_each>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const items = Array.from({ length: 3000 }, (_, i) => ({ id: `${i}`, text: `Item ${i}` }));

        const start = performance.now();
        engine.setState('todos', items);
        const duration = performance.now() - start;

        expect(engine.getState('todos').length).toBe(3000);
        expect(document.querySelectorAll('span').length).toBe(3000);
        console.log(`[Vitest Bench] 3,000 Item Render Duration: ${duration.toFixed(2)} ms`);
    }, 15000);

    it('should benchmark Partial Update (updating every 10th row out of 1,000)', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="rows" type="array"></state>
            </data_model>
            <flex direction="column">
                <for_each items="{data.rows}" var="row">
                    <flex direction="row">
                        <component type="text">{row.label}</component>
                    </flex>
                </for_each>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const initialRows = Array.from({ length: 1000 }, (_, i) => ({ id: `${i}`, label: `Row ${i}` }));
        engine.setState('rows', initialRows);

        const updatedRows = initialRows.map((row, idx) => {
            if (idx % 10 === 0) {
                return { ...row, label: `${row.label} !!!` };
            }
            return row;
        });

        const start = performance.now();
        engine.setState('rows', updatedRows);
        const duration = performance.now() - start;

        expect(engine.getState('rows')[10].label).toContain('!!!');
        console.log(`[Vitest Bench] Partial Update (10th row of 1,000): ${duration.toFixed(2)} ms`);
    }, 30000);

    it('should benchmark Swap 2 Rows out of 1,000 items', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="rows" type="array"></state>
            </data_model>
            <flex direction="column">
                <for_each items="{data.rows}" var="row">
                    <flex direction="row">
                        <component type="text">{row.label}</component>
                    </flex>
                </for_each>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const rows = Array.from({ length: 1000 }, (_, i) => ({ id: `${i}`, label: `Item ${i}` }));
        engine.setState('rows', rows);

        const swapped = [...rows];
        const temp = swapped[1];
        swapped[1] = swapped[998];
        swapped[998] = temp;

        const start = performance.now();
        engine.setState('rows', swapped);
        const duration = performance.now() - start;

        expect(engine.getState('rows')[1].label).toBe('Item 998');
        expect(engine.getState('rows')[998].label).toBe('Item 1');
        console.log(`[Vitest Bench] Swap 2 Rows in 1,000 items: ${duration.toFixed(2)} ms`);
    }, 30000);

    it('should benchmark Append 1,000 Rows to an existing 1,000 items list', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="rows" type="array"></state>
            </data_model>
            <flex direction="column">
                <for_each items="{data.rows}" var="row">
                    <flex direction="row">
                        <component type="text">{row.label}</component>
                    </flex>
                </for_each>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const initial = Array.from({ length: 1000 }, (_, i) => ({ id: `${i}`, label: `Initial ${i}` }));
        engine.setState('rows', initial);

        const extra = Array.from({ length: 1000 }, (_, i) => ({ id: `${1000 + i}`, label: `Extra ${i}` }));

        const start = performance.now();
        engine.setState('rows', [...initial, ...extra]);
        const duration = performance.now() - start;

        expect(engine.getState('rows').length).toBe(2000);
        console.log(`[Vitest Bench] Append 1,000 Rows (Total 2,000): ${duration.toFixed(2)} ms`);
    });

    it('should benchmark Clear All 1,000 Rows', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="rows" type="array"></state>
            </data_model>
            <flex direction="column">
                <for_each items="{data.rows}" var="row">
                    <flex direction="row">
                        <component type="text">{row.label}</component>
                    </flex>
                </for_each>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const rows = Array.from({ length: 1000 }, (_, i) => ({ id: `${i}`, label: `Item ${i}` }));
        engine.setState('rows', rows);

        const start = performance.now();
        engine.setState('rows', []);
        const duration = performance.now() - start;

        expect(engine.getState('rows').length).toBe(0);
        expect(document.querySelectorAll('span').length).toBe(0);
        console.log(`[Vitest Bench] Clear 1,000 Rows: ${duration.toFixed(2)} ms`);
    });

    it('should benchmark single fine-grained item update in-place', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="counter" type="string">0</state>
            </data_model>
            <flex direction="column">
                <component type="text" bind="data.counter">{data.counter}</component>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const span = document.querySelector('span');

        const start = performance.now();
        engine.setState('counter', '100');
        const duration = performance.now() - start;

        expect(span).not.toBeNull();
        expect(span.textContent).toBe('100');
        console.log(`[Vitest Bench] Fine-grained Single State Mutation: ${duration.toFixed(2)} ms`);
    });

    it('should benchmark Interaction Latency (button click to state & DOM mutation)', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="val" type="string">0</state>
            </data_model>
            <flex direction="column">
                <button id="inc_btn">
                    <on_click action="SET_STATE">
                        <path>data.val</path>
                        <value>42</value>
                    </on_click>
                    Increment
                </button>
                <span id="target_span">{data.val}</span>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const btn = document.querySelector('#inc_btn');
        const span = document.querySelector('#target_span');

        const start = performance.now();
        btn.dispatchEvent(new window.MouseEvent('click'));
        const duration = performance.now() - start;

        expect(span.textContent).toBe('42');
        expect(duration).toBeLessThan(500); // Must fit within budget under parallel test runner CPU contention
        console.log(`[Vitest Bench] Interaction Latency (Click -> DOM Mutation): ${duration.toFixed(2)} ms`);
    }, 15000);

    it('should benchmark Virtual Scrolling with 10,000 items in <for_each virtual="true">', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="cryptos" type="array"></state>
            </data_model>
            <for_each items="{data.cryptos}" var="coin" key="id" virtual="true" item_height="40" height="400px">
                <div class="row" style="height: 40px;">
                    <span>{coin.symbol} - {coin.price}</span>
                </div>
            </for_each>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const items10k = Array.from({ length: 10000 }, (_, i) => ({ id: `${i}`, symbol: `COIN_${i}`, price: `$${(i * 1.5).toFixed(2)}` }));

        const start = performance.now();
        engine.setState('cryptos', items10k);
        const duration = performance.now() - start;

        const spacer = document.querySelector('.euix-virtual-spacer');
        const renderedRows = document.querySelectorAll('.row');

        expect(spacer).toBeDefined();
        expect(spacer.style.height).toBe('400000px');
        expect(renderedRows.length).toBeLessThan(30); // Only visible rows rendered
        expect(engine.getState('cryptos').length).toBe(10000);
        console.log(`[Vitest Bench] Virtual Scrolling (10,000 items): ${duration.toFixed(2)} ms (Rendered ${renderedRows.length} DOM rows)`);
    }, 15000);
});
