import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('EUIXEngine State Mutation Batching & Microtask Flushing Suite', () => {
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

    it('should update getState synchronously while coalescing DOM updates in engine.batchUpdates(fn)', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="firstName">Jane</state>
                <state id="lastName">Doe</state>
            </data_model>
            <container>
                <p id="target">{data.firstName} {data.lastName}</p>
            </container>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const syncSpy = vi.spyOn(engine, 'syncBindings');

        engine.batchUpdates(() => {
            engine.setState('firstName', 'John');
            engine.setState('lastName', 'Smith');

            // Synchronous getState reads updated state immediately
            expect(engine.getState('firstName')).toBe('John');
            expect(engine.getState('lastName')).toBe('Smith');

            // DOM hasn't flushed yet during batch
            expect(syncSpy).not.toHaveBeenCalled();
        });

        // After batch block completes, DOM has flushed!
        expect(syncSpy).toHaveBeenCalled();
        expect(container.querySelector('#target').textContent).toBe('John Smith');
    });

    it('should flush pending updates asynchronously via queueMicrotask when using setState(k, v, { batch: true })', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="count">0</state>
            </data_model>
            <container>
                <span id="counter">{data.count}</span>
            </container>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');

        engine.setState('count', 1, { batch: true });
        engine.setState('count', 2, { batch: true });
        engine.setState('count', 3, { batch: true });

        // Synchronous state is immediately 3
        expect(engine.getState('count')).toBe(3);

        // Await microtask queue
        await Promise.resolve();

        // DOM updated to 3 after microtask flush
        expect(container.querySelector('#counter').textContent).toBe('3');
    });

    it('should allow explicit synchronous DOM flush via engine.flushStateUpdates()', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="title">Draft</state>
            </data_model>
            <container>
                <h1 id="heading">{data.title}</h1>
            </container>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');

        engine.setState('title', 'Published', { batch: true });
        expect(container.querySelector('#heading').textContent).toBe('Draft');

        // Explicitly flush pending state updates synchronously
        engine.flushStateUpdates();
        expect(container.querySelector('#heading').textContent).toBe('Published');
    });
});
