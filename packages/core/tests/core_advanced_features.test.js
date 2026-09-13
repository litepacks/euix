/**
 * tests/core_advanced_features.test.js
 * Advanced tests for EUIXEngineCore focusing on ref focus actions, set title, and toggle states.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';

describe('EUIXEngineCore - Advanced Ref Focus, Set Title, and Toggle State', () => {
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

    it('should execute SET_STATE with <focus> target focusing the referenced input element', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="query"></state>
            </data_model>
            <flex direction="column">
                <input ref="search_input" bind="query" placeholder="Type here..." />
                <button id="reset_focus_btn">
                    <on_click action="SET_STATE">
                        <path>data.query</path>
                        <value>Cleared</value>
                        <focus>ref:search_input</focus>
                    </on_click>
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const inputEl = container.querySelector('input');
        const focusSpy = vi.spyOn(inputEl, 'focus');

        container.querySelector('#reset_focus_btn').click();

        expect(engine.getState('query')).toBe('Cleared');
        expect(focusSpy).toHaveBeenCalled();
    });

    it('should execute SET_TITLE action and update document.title declaratively', () => {
        const xml = `
        <uid_spec>
            <flex direction="column">
                <button id="title_btn">
                    <on_click action="SET_TITLE" value="Quantum Dashboard v2" />
                </button>
            </flex>
        </uid_spec>
        `;

        EUIXEngineCore.mount(xml, container);
        container.querySelector('#title_btn').click();

        expect(document.title).toBe('Quantum Dashboard v2');
    });

    it('should execute TOGGLE_STATE action on boolean and truthy/falsy state variables', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="isOpen" type="boolean">false</state>
            </data_model>
            <flex direction="column">
                <button id="toggle_btn">
                    <on_click action="TOGGLE_STATE" path="data.isOpen" />
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);

        // Toggle from false -> true
        container.querySelector('#toggle_btn').click();
        expect(engine.getState('isOpen')).toBe(true);

        // Toggle from true -> false
        container.querySelector('#toggle_btn').click();
        expect(engine.getState('isOpen')).toBe(false);
    });
});
