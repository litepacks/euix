/**
 * tests/core_engine_bindings_and_events.test.js
 * Deep tests for radio buttons, dead node garbage collection, dynamic layout expressions, and keyboard/mouse events.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';

describe('EUIXEngineCore - Radio Bindings, Dead-Node GC, Dynamic Layout & Events', () => {
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
        vi.restoreAllMocks();
    });

    it('should synchronize radio button checked states based on state value', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="plan">pro</state>
            </data_model>
            <flex direction="column">
                <input type="radio" name="plan_group" value="basic" bind="plan" id="radio-basic" />
                <input type="radio" name="plan_group" value="pro" bind="plan" id="radio-pro" />
                <input type="radio" name="plan_group" value="enterprise" bind="plan" id="radio-enterprise" />
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);

        const radioBasic = container.querySelector('#radio-basic');
        const radioPro = container.querySelector('#radio-pro');
        const radioEnterprise = container.querySelector('#radio-enterprise');

        expect(radioBasic.checked).toBe(false);
        expect(radioPro.checked).toBe(true);
        expect(radioEnterprise.checked).toBe(false);

        // Update state to enterprise
        engine.setState('plan', 'enterprise');
        await new Promise(r => setTimeout(r, 40));

        expect(radioBasic.checked).toBe(false);
        expect(radioPro.checked).toBe(false);
        expect(radioEnterprise.checked).toBe(true);
    });

    it('should clean up dead disconnected DOM nodes during syncBindings', () => {
        const engine = new EUIXEngineCore(container);
        engine._isMounted = true;

        const liveNode = document.createElement('div');
        container.appendChild(liveNode);

        const deadNode = document.createElement('div'); // Not attached to DOM!

        engine.registerBinding('theme', liveNode, 'text');
        engine.registerBinding('theme', deadNode, 'text');

        expect(engine._bindings.get('theme').length).toBe(2);

        // Trigger syncBindings
        engine.syncBindings('theme', 'dark');

        // Dead node should be pruned from bindings map
        const remaining = engine._bindings.get('theme');
        expect(remaining.length).toBe(1);
        expect(remaining[0].el).toBe(liveNode);
    });

    it('should evaluate dynamic direction and alignment expressions in flex layout', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="dir">row</state>
                <state id="alignment">center</state>
            </data_model>
            <flex direction="{data.dir}" align="{data.alignment}" class="dynamic-flex">
                <div>Child 1</div>
                <div>Child 2</div>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const flexEl = container.querySelector('.dynamic-flex');

        expect(flexEl.style.flexDirection).toBe('row');
        expect(flexEl.style.alignItems).toBe('center');
    });

    it('should dispatch keyboard and mouse events with $evt context', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="lastKey"></state>
                <state id="hovered" type="boolean">false</state>
            </data_model>
            <div>
                <div id="test-box" tabindex="0">
                    <on_keydown action="RUN_SCRIPT">
                        $data.lastKey = $evt.key;
                    </on_keydown>
                </div>
                <div id="hover-box">
                    <on_mouseenter action="RUN_SCRIPT">
                        $data.hovered = true;
                    </on_mouseenter>
                    <on_mouseleave action="RUN_SCRIPT">
                        $data.hovered = false;
                    </on_mouseleave>
                </div>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);

        const testBox = container.querySelector('#test-box');
        const keyEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        testBox.dispatchEvent(keyEvent);
        await new Promise(r => setTimeout(r, 40));

        expect(engine.getState('lastKey')).toBe('Enter');

        const hoverBox = container.querySelector('#hover-box');
        hoverBox.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await new Promise(r => setTimeout(r, 40));
        expect(engine.getState('hovered')).toBe(true);

        hoverBox.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }));
        await new Promise(r => setTimeout(r, 40));
        expect(engine.getState('hovered')).toBe(false);
    });
});
