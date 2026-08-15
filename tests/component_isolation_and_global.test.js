import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('Component-Scoped Isolation & Global State Dual Mode Test Suite', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
        if (EUIXEngine._globalComponentSpecs) {
            EUIXEngine._globalComponentSpecs.clear();
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('Scenario 1: Multiple instances of isolated="true" component have completely independent local state', () => {
        const cardCompXml = `
        <component_def name="accordion-card" isolated="true">
            <data_model>
                <state id="isOpen" type="boolean">false</state>
                <state id="clicks" type="number">0</state>
            </data_model>
            <div class="card-box">
                <span class="card-title">{props.title}</span>
                <span class="card-status">Status: {local.isOpen ? 'OPEN' : 'CLOSED'}</span>
                <span class="card-clicks">Clicks: {local.clicks}</span>
                <button class="toggle-btn">
                    <on_click action="SET_STATE">
                        <path>local.isOpen</path>
                        <value>{local.isOpen == 'true' || local.isOpen == true ? 'false' : 'true'}</value>
                    </on_click>
                    <on_click action="SET_STATE">
                        <path>local.clicks</path>
                        <value>{local.clicks} + 1</value>
                    </on_click>
                    Toggle
                </button>
            </div>
        </component_def>
        `;
        EUIXEngine.registerComponentSpec('accordion-card', cardCompXml);

        const appXml = `
        <uid_spec>
            <flex direction="column" class="app-root">
                <accordion-card title="Card A" class="card-a" />
                <accordion-card title="Card B" class="card-b" />
                <accordion-card title="Card C" class="card-c" />
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(appXml, '#app');

        // Verify initial states for all 3 cards
        const cards = document.querySelectorAll('.card-box');
        expect(cards.length).toBe(3);

        const statusA = cards[0].querySelector('.card-status');
        const statusB = cards[1].querySelector('.card-status');
        const statusC = cards[2].querySelector('.card-status');

        expect(statusA.textContent).toBe('Status: CLOSED');
        expect(statusB.textContent).toBe('Status: CLOSED');
        expect(statusC.textContent).toBe('Status: CLOSED');

        // Click Card A toggle button
        const btnA = cards[0].querySelector('.toggle-btn');
        btnA.dispatchEvent(new window.MouseEvent('click'));

        // Card A should now be OPEN, while Card B and Card C MUST REMAIN CLOSED!
        expect(statusA.textContent).toBe('Status: OPEN');
        expect(cards[0].querySelector('.card-clicks').textContent).toBe('Clicks: 1');

        expect(statusB.textContent).toBe('Status: CLOSED');
        expect(cards[1].querySelector('.card-clicks').textContent).toBe('Clicks: 0');

        expect(statusC.textContent).toBe('Status: CLOSED');
        expect(cards[2].querySelector('.card-clicks').textContent).toBe('Clicks: 0');

        // Click Card B toggle button
        const btnB = cards[1].querySelector('.toggle-btn');
        btnB.dispatchEvent(new window.MouseEvent('click'));

        expect(statusA.textContent).toBe('Status: OPEN');
        expect(statusB.textContent).toBe('Status: OPEN');
        expect(statusC.textContent).toBe('Status: CLOSED');
    });

    it('Scenario 2: Isolated component can access both its private local state and global shared state', () => {
        // Global store component (non-isolated / shared)
        const storeXml = `
        <component_def name="app-theme-store">
            <data_model scope="global">
                <state id="theme">dark</state>
                <state id="global_user">Ahmet</state>
            </data_model>
        </component_def>
        `;
        EUIXEngine.registerComponentSpec('app-theme-store', storeXml);

        // Isolated component
        const hybridCompXml = `
        <component_def name="user-profile-panel" isolated="true">
            <data_model>
                <state id="panel_expanded" type="boolean">false</state>
            </data_model>
            <div class="profile-panel {data.theme}">
                <span class="user-name">User: {data.global_user}</span>
                <span class="theme-info">Global Theme: {data.theme}</span>
                <span class="panel-state">Expanded: {local.panel_expanded ? 'YES' : 'NO'}</span>

                <button class="expand-btn">
                    <on_click action="SET_STATE">
                        <path>local.panel_expanded</path>
                        <value>{local.panel_expanded == 'true' || local.panel_expanded == true ? 'false' : 'true'}</value>
                    </on_click>
                    Expand
                </button>

                <button class="theme-btn">
                    <on_click action="SET_STATE">
                        <path>global.theme</path>
                        <value>{data.theme == 'dark' ? 'light' : 'dark'}</value>
                    </on_click>
                    Switch Global Theme
                </button>
            </div>
        </component_def>
        `;
        EUIXEngine.registerComponentSpec('user-profile-panel', hybridCompXml);

        const appXml = `
        <uid_spec>
            <flex direction="column">
                <h1 class="header-theme">Header sees theme: {data.theme}</h1>
                <user-profile-panel class="panel-1" />
                <user-profile-panel class="panel-2" />
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(appXml, '#app');

        const panels = document.querySelectorAll('.profile-panel');
        expect(panels.length).toBe(2);

        // Check global state shared correctly
        expect(panels[0].querySelector('.user-name').textContent).toBe('User: Ahmet');
        expect(panels[1].querySelector('.user-name').textContent).toBe('User: Ahmet');
        expect(document.querySelector('.header-theme').textContent).toBe('Header sees theme: dark');

        // Toggle panel 1 local state
        panels[0].querySelector('.expand-btn').dispatchEvent(new window.MouseEvent('click'));
        expect(panels[0].querySelector('.panel-state').textContent).toBe('Expanded: YES');
        expect(panels[1].querySelector('.panel-state').textContent).toBe('Expanded: NO');

        // Switch global theme from panel 1
        panels[0].querySelector('.theme-btn').dispatchEvent(new window.MouseEvent('click'));

        // Global theme should update everywhere (root + both panels)
        expect(engine.getState('theme')).toBe('light');
        expect(document.querySelector('.header-theme').textContent).toBe('Header sees theme: light');
        expect(panels[0].querySelector('.theme-info').textContent).toBe('Global Theme: light');
        expect(panels[1].querySelector('.theme-info').textContent).toBe('Global Theme: light');
    });

    it('Scenario 3: Individual <state scope="local"> inside a component is isolated while non-scoped states remain global', () => {
        const mixedCompXml = `
        <component_def name="smart-counter">
            <data_model>
                <!-- Local instance state -->
                <state id="local_count" scope="local" type="number">0</state>
                <!-- Shared global state -->
                <state id="global_banner">Welcome to Counter Hub</state>
            </data_model>
            <div class="counter-box">
                <span class="banner">{data.global_banner}</span>
                <span class="count-val">Count: {local.local_count}</span>
                <button class="plus-btn">
                    <on_click action="SET_STATE">
                        <path>local.local_count</path>
                        <value>{local.local_count} + 1</value>
                    </on_click>
                    +1
                </button>
            </div>
        </component_def>
        `;
        EUIXEngine.registerComponentSpec('smart-counter', mixedCompXml);

        const appXml = `
        <uid_spec>
            <flex direction="column">
                <smart-counter class="c1" />
                <smart-counter class="c2" />
                <div class="root-banner">Root Banner: {data.global_banner}</div>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(appXml, '#app');

        // Global banner should be visible everywhere
        expect(document.querySelector('.root-banner').textContent).toBe('Root Banner: Welcome to Counter Hub');
        expect(engine.getState('global_banner')).toBe('Welcome to Counter Hub');

        // Local state should NOT be polluted in global store
        expect(engine.getState('local_count')).toBeUndefined();

        const counters = document.querySelectorAll('.counter-box');
        const c1Plus = counters[0].querySelector('.plus-btn');

        c1Plus.dispatchEvent(new window.MouseEvent('click'));

        // C1 count incremented, C2 remained 0
        expect(counters[0].querySelector('.count-val').textContent).toBe('Count: 1');
        expect(counters[1].querySelector('.count-val').textContent).toBe('Count: 0');
    });
});
