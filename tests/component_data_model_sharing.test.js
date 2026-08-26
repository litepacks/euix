import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('Cross-Component data_model State Sharing Test Suite', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
        if (EUIXEngine._globalComponentSpecs) {
            EUIXEngine._globalComponentSpecs.clear();
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Scenario 1: Headless states.xml component registers states accessible by root and siblings', () => {
        // Register a headless states component
        const statesXml = `
        <component_def name="states-store">
            <data_model>
                <state id="app_title">Global App Store</state>
                <state id="theme">dark</state>
                <state id="counter" type="number">10</state>
                <state id="user_info" type="object">{"name": "Ahmet", "role": "Architect"}</state>
                <state id="items" type="array">
                    <item id="1" title="Initial Item 1" />
                    <item id="2" title="Initial Item 2" />
                </state>
            </data_model>
        </component_def>
        `;
        EUIXEngine.registerComponentSpec('states-store', statesXml);

        // Register a consumer component A
        const compAXml = `
        <component_def name="theme-widget">
            <flex direction="column" class="theme-widget-box">
                <span class="theme-text">Theme: {data.theme}</span>
                <button class="toggle-btn">
                    <on_click action="SET_STATE">
                        <path>data.theme</path>
                        <value>{data.theme == 'dark' ? 'light' : 'dark'}</value>
                    </on_click>
                    Toggle Theme
                </button>
            </flex>
        </component_def>
        `;
        EUIXEngine.registerComponentSpec('theme-widget', compAXml);

        // Register a consumer component B
        const compBXml = `
        <component_def name="counter-widget">
            <flex direction="column" class="counter-widget-box">
                <span class="counter-text">Count: {data.counter}</span>
                <button class="inc-btn">
                    <on_click action="SET_STATE">
                        <path>data.counter</path>
                        <value>{data.counter + 1}</value>
                    </on_click>
                    +1
                </button>
            </flex>
        </component_def>
        `;
        EUIXEngine.registerComponentSpec('counter-widget', compBXml);

        // Main App importing and using them (no states explicitly declared in main data_model)
        const appXml = `
        <uid_spec>
            <flex direction="column" class="p-4">
                <h1 class="main-title">{data.app_title}</h1>
                <p class="user-greeting">User: {data.user_info.name} ({data.user_info.role})</p>
                <theme-widget />
                <counter-widget />
                <div class="root-theme-mirror">Root sees theme as: {data.theme}</div>
                <div class="root-counter-mirror">Root sees count as: {data.counter}</div>
                <div class="items-count">Total Items: {data.items.length}</div>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(appXml, '#app');

        // 1. Check initial rendering from states-store data_model
        expect(document.querySelector('.main-title').textContent).toBe('Global App Store');
        expect(document.querySelector('.user-greeting').textContent).toBe('User: Ahmet (Architect)');
        expect(document.querySelector('.theme-text').textContent).toBe('Theme: dark');
        expect(document.querySelector('.root-theme-mirror').textContent).toBe('Root sees theme as: dark');
        expect(document.querySelector('.counter-text').textContent).toBe('Count: 10');
        expect(document.querySelector('.root-counter-mirror').textContent).toBe('Root sees count as: 10');
        expect(document.querySelector('.items-count').textContent).toBe('Total Items: 2');

        // 2. Interact with Component A (theme-widget)
        const toggleBtn = document.querySelector('.toggle-btn');
        toggleBtn.dispatchEvent(new window.MouseEvent('click'));

        // Verify state mutated and reactive in both Component A and root
        expect(engine.getState('theme')).toBe('light');
        expect(document.querySelector('.theme-text').textContent).toBe('Theme: light');
        expect(document.querySelector('.root-theme-mirror').textContent).toBe('Root sees theme as: light');

        // 3. Interact with Component B (counter-widget)
        const incBtn = document.querySelector('.inc-btn');
        incBtn.dispatchEvent(new window.MouseEvent('click'));

        expect(engine.getState('counter')).toBe(11);
        expect(document.querySelector('.counter-text').textContent).toBe('Count: 11');
        expect(document.querySelector('.root-counter-mirror').textContent).toBe('Root sees count as: 11');
    });

    it('Scenario 2: Inline <component_def> in the same XML file sharing its data_model', () => {
        const appWithInlineDef = `
        <uid_spec>
            <!-- Embedded component definition providing shared states -->
            <component_def name="app-config">
                <data_model>
                    <state id="api_status">ONLINE</state>
                    <state id="active_tab">dashboard</state>
                </data_model>
            </component_def>

            <!-- Embedded consumer component -->
            <component_def name="tab-switcher">
                <flex direction="row" gap="8">
                    <button class="tab-btn-settings">
                        <on_click action="SET_STATE">
                            <path>data.active_tab</path>
                            <value>settings</value>
                        </on_click>
                        Go to Settings
                    </button>
                </flex>
            </component_def>

            <flex direction="column">
                <span class="status-display">System Status: {data.api_status}</span>
                <span class="tab-display">Current Tab: {data.active_tab}</span>
                <tab-switcher />
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(appWithInlineDef, '#app');

        expect(document.querySelector('.status-display').textContent).toBe('System Status: ONLINE');
        expect(document.querySelector('.tab-display').textContent).toBe('Current Tab: dashboard');

        // Click button inside child component
        const btn = document.querySelector('.tab-btn-settings');
        btn.dispatchEvent(new window.MouseEvent('click'));

        expect(engine.getState('active_tab')).toBe('settings');
        expect(document.querySelector('.tab-display').textContent).toBe('Current Tab: settings');
    });

    it('Scenario 3: Main doc <data_model> overrides initial state of child components if duplicate ID exists', () => {
        const childComp = `
        <component_def name="header-comp">
            <data_model>
                <state id="app_name">Default Child App Name</state>
                <state id="child_exclusive">Child Only Value</state>
            </data_model>
            <header>
                <h1 class="child-h1">{data.app_name}</h1>
                <p class="child-p">{data.child_exclusive}</p>
            </header>
        </component_def>
        `;
        EUIXEngine.registerComponentSpec('header-comp', childComp);

        const mainApp = `
        <uid_spec>
            <data_model>
                <!-- Main overrides app_name -->
                <state id="app_name">Main Overridden App Name</state>
            </data_model>

            <flex direction="column">
                <header-comp />
                <span class="main-view">{data.app_name}</span>
                <span class="main-child-exclusive">{data.child_exclusive}</span>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(mainApp, '#app');

        // Both child component and main document see the overridden value
        expect(document.querySelector('.child-h1').textContent).toBe('Main Overridden App Name');
        expect(document.querySelector('.main-view').textContent).toBe('Main Overridden App Name');

        // Non-conflicting child state is still preserved
        expect(document.querySelector('.child-p').textContent).toBe('Child Only Value');
        expect(document.querySelector('.main-child-exclusive').textContent).toBe('Child Only Value');
        expect(engine.getState('child_exclusive')).toBe('Child Only Value');
    });

    it('Scenario 4: Array mutation across components using child data_model', () => {
        const storeComp = `
        <component_def name="todo-store">
            <data_model>
                <state id="todos" type="array">
                    <item id="1" text="Task A" />
                </state>
            </data_model>
        </component_def>
        `;
        EUIXEngine.registerComponentSpec('todo-store', storeComp);

        const todoListComp = `
        <component_def name="todo-viewer">
            <flex direction="column" class="todo-list">
                <for_each items="{data.todos}" var="item">
                    <div class="todo-item">{item.text}</div>
                </for_each>
            </flex>
        </component_def>
        `;
        EUIXEngine.registerComponentSpec('todo-viewer', todoListComp);

        const appXml = `
        <uid_spec>
            <flex direction="column">
                <todo-viewer />
                <button class="add-btn">
                    <on_click action="MUTATE_STATE">
                        <path>todos</path>
                        <operation>PUSH</operation>
                        <value>{"id": "2", "text": "Task B"}</value>
                    </on_click>
                    Add Task B
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(appXml, '#app');
        expect(document.querySelectorAll('.todo-item').length).toBe(1);
        expect(document.querySelector('.todo-item').textContent).toBe('Task A');

        // Add item from root
        const addBtn = document.querySelector('.add-btn');
        addBtn.dispatchEvent(new window.MouseEvent('click'));

        expect(engine.getState('todos').length).toBe(2);
        expect(document.querySelectorAll('.todo-item').length).toBe(2);
        expect(document.querySelectorAll('.todo-item')[1].textContent).toBe('Task B');
    });

    it('Scenario 5: Async component loading via fetch mock properly registers its data_model', async () => {
        const externalStatesXml = `
        <component_def name="async-states">
            <data_model>
                <state id="async_loaded_state">Loaded Asynchronously!</state>
                <state id="async_count" type="number">100</state>
            </data_model>
        </component_def>
        `;

        // Mock fetch for './states.xml'
        global.fetch = vi.fn().mockImplementation((url) => {
            if (url.includes('states.xml')) {
                return Promise.resolve({
                    ok: true,
                    text: () => Promise.resolve(externalStatesXml),
                    json: () => Promise.resolve({})
                });
            }
            return Promise.reject(new Error(`Unknown url ${url}`));
        });

        const appXml = `
        <uid_spec>
            <import src="./states.xml" name="async-states" />
            <flex direction="column">
                <span class="async-text">{data.async_loaded_state}</span>
                <span class="async-num">{data.async_count}</span>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(appXml, '#app');

        // Wait for async mount promise to resolve
        if (engine._mountPromise) {
            await engine._mountPromise;
        }

        expect(engine.getState('async_loaded_state')).toBe('Loaded Asynchronously!');
        expect(engine.getState('async_count')).toBe(100);
        expect(document.querySelector('.async-text').textContent).toBe('Loaded Asynchronously!');
        expect(document.querySelector('.async-num').textContent).toBe('100');
    });
});
