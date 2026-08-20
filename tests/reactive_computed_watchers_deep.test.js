/**
 * tests/reactive_computed_watchers_deep.test.js
 * Comprehensive tests for EUIXReactivePlugin computed properties, dependency graphs, and deep watchers.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXReactivePlugin, EUIXDependencyGraph } from '../src/plugins/EUIXReactivePlugin.js';

describe('EUIXReactivePlugin - Computed Properties, Deep Watchers & Dependency Graph', () => {
    let container;

    beforeEach(() => {
        EUIXEngineCore.use(EUIXReactivePlugin);
        container = document.createElement('div');
        container.id = 'app';
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        vi.restoreAllMocks();
    });

    it('should test EUIXDependencyGraph dependency mapping and component cleanup', () => {
        const graph = new EUIXDependencyGraph();

        graph.addComputedDep('data.user.name', 'comp_1');
        graph.addComputedDep('data.user', 'comp_2');
        graph.addWatcherDep('data.user.name', 'watch_1');

        // Affected computed on subpath change
        const affectedComp = graph.getAffectedComputed('data.user.name');
        expect(affectedComp.has('comp_1')).toBe(true);
        expect(affectedComp.has('comp_2')).toBe(true);

        // Affected watchers on path change
        const affectedWatch = graph.getAffectedWatchers('data.user.name');
        expect(affectedWatch.has('watch_1')).toBe(true);

        // Remove component scoped deps
        graph.addComputedDep('data.theme', 'UserProfileComponent:comp_3');
        graph.removeComponentDeps('UserProfileComponent');
        expect(graph.getAffectedComputed('data.theme').has('UserProfileComponent:comp_3')).toBe(false);
    });

    it('should evaluate declarative <computed> values and re-evaluate on dependency state changes', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="quantity">5</state>
                <state id="price">20</state>
                <computed id="totalCost">{data.quantity} * {data.price}</computed>
            </data_model>
            <flex direction="column">
                <span id="cost_display">{data.totalCost}</span>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);

        expect(engine.getState('totalCost')).toBe(100);

        // Mutate quantity state -> computed automatically recalculates
        engine.setState('quantity', 10);
        await new Promise(r => setTimeout(r, 40));

        expect(engine.getState('totalCost')).toBe(200);
    });

    it('should execute engine.watch callback and clean up on disposeComponentReactive', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="score">50</state>
            </data_model>
            <div>Score Board</div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const logHistory = [];

        // Register watcher and get unwatch cleanup function
        const unwatch = engine.watch('score', (newVal, oldVal) => {
            logHistory.push(`Score changed from ${oldVal} to ${newVal}`);
        });

        // Mutate state
        engine.setState('score', 95);
        await new Promise(r => setTimeout(r, 40));

        expect(logHistory).toHaveLength(1);
        expect(logHistory[0]).toBe('Score changed from 50 to 95');

        // Clean up via unwatch
        unwatch();
        engine.setState('score', 100);
        await new Promise(r => setTimeout(r, 40));

        expect(logHistory).toHaveLength(1);
    });
});
