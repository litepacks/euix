import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';

describe('ComponentLoader & Lifecycle Master Suite', () => {
    let container;
    let originalFetch;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        originalFetch = global.fetch;
    });

    afterEach(() => {
        global.fetch = originalFetch;
    });

    it('should handle XML parse error with visual error frame', () => {
        const invalidXml = `<uid_spec><unclosed_tag></uid_spec>`;
        const engine = EUIXEngineCore.mount(invalidXml, container);
        expect(container.querySelector('.euix-mount-error')).toBeTruthy();
        expect(container.textContent).toContain('EUIXEngine XML Parse Error');
    });

    it('should test dual-mode scoping: component-scoped isolated state vs global state', () => {
        const xml = `
        <uid_spec>
            <component_def name="user-badge" isolated="true">
                <data_model>
                    <state id="clicks" type="number">0</state>
                </data_model>
                <div class="user-badge">
                    <span class="click-count">{local.clicks}</span>
                    <button class="click-btn">
                        <on_click action="SET_STATE">
                            <path>local.clicks</path>
                            <value>{local.clicks} + 1</value>
                        </on_click>
                        Click
                    </button>
                </div>
            </component_def>
            <data_model>
                <state id="global_title">User Roster</state>
            </data_model>
            <flex direction="column">
                <h1>{data.global_title}</h1>
                <component name="user-badge" />
                <component name="user-badge" />
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(container.querySelector('h1').textContent).toBe('User Roster');

        const badges = container.querySelectorAll('.user-badge');
        expect(badges).toHaveLength(2);

        // Click on first badge button
        const firstBtn = badges[0].querySelector('.click-btn');
        firstBtn.click();

        expect(badges[0].querySelector('.click-count').textContent).toBe('1');
        expect(badges[1].querySelector('.click-count').textContent).toBe('0');
    });

    it('should test slot and children content projection', () => {
        const xml = `
        <uid_spec>
            <component_def name="modal-box">
                <div class="modal-wrapper">
                    <div class="modal-body">
                        <children />
                    </div>
                </div>
            </component_def>

            <container>
                <component name="modal-box">
                    <p class="dialog-msg">This is projected children content.</p>
                </component>
            </container>
        </uid_spec>
        `;

        EUIXEngineCore.mount(xml, container);
        const modalBody = container.querySelector('.modal-body');
        expect(modalBody).toBeTruthy();
        expect(modalBody.querySelector('.dialog-msg').textContent).toBe('This is projected children content.');
    });

    it('should test mount and state change lifecycle hooks', async () => {
        const onMountSpy = vi.fn();
        const onChangeSpy = vi.fn();

        global.window.__testLifecycleSpies = { onMountSpy, onChangeSpy };

        const xml = `
        <uid_spec>
            <data_model>
                <state id="counter">0</state>
            </data_model>
            <on_mount action="RUN_SCRIPT">
                window.__testLifecycleSpies.onMountSpy($data.counter);
            </on_mount>
            <on_state_change key="counter" action="RUN_SCRIPT">
                window.__testLifecycleSpies.onChangeSpy($data.counter);
            </on_state_change>
            <div>
                <span id="counter-val">{data.counter}</span>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(onMountSpy).toHaveBeenCalledWith('0');

        engine.setState('counter', 10);
        expect(onChangeSpy).toHaveBeenCalledWith(10);
    });
});
