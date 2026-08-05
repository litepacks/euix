import { describe, it, expect, beforeEach } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('EUIXEngine Vitest Performance & Benchmark Suite', () => {
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
    });

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
});
