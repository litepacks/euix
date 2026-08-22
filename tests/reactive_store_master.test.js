import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';

describe('ReactiveStore & Watchers Master Suite', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('should handle deep path watchers and batching updates', async () => {
        const watcherSpy = vi.fn();
        const xml = `
        <uid_spec>
            <data_model>
                <state id="settings" type="object">{"theme": "dark", "layout": {"sidebar": true}}</state>
            </data_model>
            <div>
                <span id="theme-val">{data.settings.theme}</span>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        engine.watch('settings', watcherSpy);

        // Batch multiple updates
        engine.batch(() => {
            engine.setState('settings.theme', 'light');
            engine.setState('settings.layout.sidebar', false);
        });

        await new Promise(r => setTimeout(r, 20));
        expect(container.querySelector('#theme-val').textContent).toBe('light');
    });

    it('should evaluate dynamic expressions combining multiple state variables', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="first_name">John</state>
                <state id="last_name">Doe</state>
            </data_model>
            <div>
                <span id="name-box">{data.first_name} {data.last_name}</span>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(container.querySelector('#name-box').textContent).toBe('John Doe');

        engine.setState('first_name', 'Jane');
        await new Promise(r => setTimeout(r, 20));
        expect(container.querySelector('#name-box').textContent).toBe('Jane Doe');
    });
});
