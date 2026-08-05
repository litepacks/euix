import { describe, it, expect, beforeEach } from 'vitest';
import XUIEnginePkg from '../XUIEngine.js';

const XUIEngine = XUIEnginePkg.XUIEngine || XUIEnginePkg;

describe('XUIEngine Vitest Performance & Benchmark Suite', () => {
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
        const engine = XUIEngine.mount(xml, '#app');
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

        const engine = XUIEngine.mount(xml, '#app');
        const report = engine.runBenchmark(1000, 'todos');

        expect(report.count).toBe(1000);
        expect(report.fineGrained).toBe(true);
        expect(document.querySelectorAll('span').length).toBe(1000);
        console.log(`[Vitest Bench] 1,000 Item Render Duration: ${report.durationMs} ms (${report.opsPerSec.toLocaleString()} ops/sec)`);
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

        const engine = XUIEngine.mount(xml, '#app');
        const report = engine.runBenchmark(3000, 'todos');

        expect(report.count).toBe(3000);
        expect(document.querySelectorAll('span').length).toBe(3000);
        console.log(`[Vitest Bench] 3,000 Item Render Duration: ${report.durationMs} ms (${report.opsPerSec.toLocaleString()} ops/sec)`);
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

        const engine = XUIEngine.mount(xml, '#app');
        const span = document.querySelector('span');

        const start = performance.now();
        engine.setState('counter', '100');
        const duration = performance.now() - start;

        expect(span).not.toBeNull();
        expect(span.textContent).toBe('100');
        console.log(`[Vitest Bench] Fine-grained Single State Mutation: ${duration.toFixed(2)} ms`);
    });
});
