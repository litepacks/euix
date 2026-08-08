import { describe, it, expect, beforeEach } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXApiPlugin } from '../src/plugins/EUIXApiPlugin.js';
import { EUIXComposerPlugin } from '../src/plugins/EUIXComposerPlugin.js';
import { EUIXStoragePlugin } from '../src/plugins/EUIXStoragePlugin.js';

describe('EUIXEngine Modular Architecture & Plugin System', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
    });

    it('1. should mount EUIXEngineCore standalone and handle core reactive state', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="count">10</state>
            </data_model>
            <flex direction="column">
                <span id="counter_val">{data.count}</span>
                <button id="inc_btn">
                    <on_click action="SET_STATE">
                        <path>data.count</path>
                        <value>{data.count} + 5</value>
                    </on_click>
                    +5
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, '#app');
        expect(engine.getState('count')).toBe('10');

        const btn = document.getElementById('inc_btn');
        btn.click();

        expect(engine.getState('count')).toBe('15');
        expect(document.getElementById('counter_val').textContent).toBe('15');
    });

    it('2. should dynamically register plugins via EUIXEngineCore.use()', () => {
        EUIXEngineCore.use(EUIXApiPlugin);
        EUIXEngineCore.use(EUIXComposerPlugin);
        EUIXEngineCore.use(EUIXStoragePlugin);

        expect(EUIXEngineCore._installedPlugins.has(EUIXApiPlugin)).toBe(true);
        expect(EUIXEngineCore._installedPlugins.has(EUIXComposerPlugin)).toBe(true);
        expect(EUIXEngineCore._installedPlugins.has(EUIXStoragePlugin)).toBe(true);
    });

    it('3. should execute Action Composer workflows registered via plugin on EUIXEngineCore', async () => {
        EUIXEngineCore.use(EUIXComposerPlugin);

        const xml = `
        <uid_spec>
            <actions>
                <action_def name="IncrementWorkflow">
                    <param name="stepVal" default="1" />
                    <step action="SET_STATE">
                        <path>data.val</path>
                        <value>{args.stepVal}</value>
                    </step>
                    <return>{data.val}</return>
                </action_def>
            </actions>
            <data_model>
                <state id="val">100</state>
            </data_model>
            <flex direction="column">
                <button id="run_workflow">
                    <on_click action="IncrementWorkflow">
                        <arg name="stepVal">150</arg>
                    </on_click>
                    Run
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, '#app');
        expect(engine.getState('val')).toBe('100');

        const btn = document.getElementById('run_workflow');
        btn.click();

        await new Promise(r => setTimeout(r, 20));

        expect(engine.getState('val')).toBe('150');
    });

    it('4. should persist state using EUIXStoragePlugin when enabled', () => {
        EUIXEngineCore.use(EUIXStoragePlugin);

        const xml = `
        <uid_spec>
            <data_model>
                <state id="theme">light</state>
            </data_model>
            <flex direction="column"></flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, '#app');
        engine.persist('theme', { storage: 'local', key: 'euix_test_theme' });
        engine.setState('theme', 'dark');

        expect(localStorage.getItem('euix_test_theme')).toBe('"dark"');
        engine.clearPersistedState('theme');
        expect(localStorage.getItem('euix_test_theme')).toBeNull();
    });
});
