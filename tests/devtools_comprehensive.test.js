/**
 * tests/devtools_comprehensive.test.js
 * Comprehensive unit and integration test suite for EUIXDevTools Inspector.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngine } from '../src/EUIXEngine.js';
import { EUIXDevTools } from '../src/EUIXDevTools.js';

describe('EUIXDevTools Comprehensive Test Suite', () => {
    let container;
    let engine;
    let devtools;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);

        const xml = `
        <uid_spec>
            <data_model>
                <state id="user" type="object">{"name": "Ahmet", "role": "Architect"}</state>
                <state id="counter">42</state>
                <state id="items" type="array">[1, 2, 3]</state>
                <state id="isActive">true</state>
            </data_model>
            <flex direction="column" class="app-root">
                <h1 data-xui-key="user.name" data-xui-component="UserHeader">User Title</h1>
                <button id="inc-btn" data-xui-bind="counter" data-xui-ref="counterBtn">Increment</button>
                <span id="empty-span">Static Label</span>
            </flex>
        </uid_spec>
        `;

        engine = EUIXEngine.mount(xml, container);
        devtools = EUIXDevTools.init(engine);
    });

    afterEach(() => {
        if (devtools) {
            devtools.toggle(false);
            if (devtools.hudEl && devtools.hudEl.parentNode) devtools.hudEl.parentNode.removeChild(devtools.hudEl);
            if (devtools.panelEl && devtools.panelEl.parentNode) devtools.panelEl.parentNode.removeChild(devtools.panelEl);
            if (devtools.highlightEl && devtools.highlightEl.parentNode) devtools.highlightEl.parentNode.removeChild(devtools.highlightEl);
            if (devtools.tooltipEl && devtools.tooltipEl.parentNode) devtools.tooltipEl.parentNode.removeChild(devtools.tooltipEl);
        }
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        delete engine._devtools;
        vi.restoreAllMocks();
    });

    it('should toggle inspector on and off with HUD button and keyboard shortcuts', () => {
        expect(devtools.enabled).toBe(false);

        // 1. Toggle via HUD button
        const toggleBtn = document.getElementById('euix-dev-toggle');
        expect(toggleBtn).not.toBeNull();
        toggleBtn.click();
        expect(devtools.enabled).toBe(true);
        expect(window.$state).toBeDefined();
        expect(window.$engine).toBe(engine);

        toggleBtn.click();
        expect(devtools.enabled).toBe(false);

        // 2. Toggle via Alt+Shift+I shortcut
        const keydownAltShiftI = new KeyboardEvent('keydown', {
            key: 'i',
            altKey: true,
            shiftKey: true,
            bubbles: true
        });
        document.dispatchEvent(keydownAltShiftI);
        expect(devtools.enabled).toBe(true);

        // 3. Close via Escape shortcut
        const keydownEsc = new KeyboardEvent('keydown', {
            key: 'Escape',
            bubbles: true
        });
        document.dispatchEvent(keydownEsc);
        expect(devtools.enabled).toBe(false);
    });

    it('should open panel, switch across all tabs (State, Logs, Perf), search state and clear logs', () => {
        const panelBtn = document.getElementById('euix-dev-panel-btn');
        panelBtn.click();
        expect(devtools.panelOpen).toBe(true);
        expect(devtools.panelEl.style.display).toBe('flex');

        // Test State Tab Filter
        const stateTabBtn = document.getElementById('euix-tab-state');
        stateTabBtn.click();
        expect(devtools.activeTab).toBe('state');

        const filterInput = document.getElementById('euix-state-filter');
        expect(filterInput).not.toBeNull();
        filterInput.value = 'counter';
        filterInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(devtools.stateFilterQuery).toBe('counter');

        const contentEl = document.getElementById('euix-panel-content');
        expect(contentEl.textContent).toContain('counter');
        expect(contentEl.textContent).not.toContain('items');

        // Empty filter match
        filterInput.value = 'non_existent_key_xyz';
        filterInput.dispatchEvent(new Event('input', { bubbles: true }));
        expect(contentEl.textContent).toContain('No matching state variables');

        // Switch to Logs Tab
        const logsTabBtn = document.getElementById('euix-tab-logs');
        logsTabBtn.click();
        expect(devtools.activeTab).toBe('logs');

        // Log actions
        devtools.logAction('setState', { path: 'data.counter', value: 43 });
        devtools.logAction('MUTATE_STATE', { operation: 'PUSH', path: 'items' });
        devtools.logAction('CUSTOM_ACTION', { path: 'data.custom' });
        devtools.logAction('SIMPLE_ACTION');

        expect(devtools.logs.length).toBe(4);
        devtools.renderPanel();
        const updatedLogsContentEl = document.getElementById('euix-panel-content');
        expect(updatedLogsContentEl.textContent).toContain('setState');
        expect(updatedLogsContentEl.textContent).toContain('MUTATE_STATE');

        // Clear logs
        const clearBtn = document.getElementById('euix-clear-logs');
        expect(clearBtn).not.toBeNull();
        clearBtn.click();
        expect(devtools.logs.length).toBe(0);
        const clearedContentEl = document.getElementById('euix-panel-content');
        expect(clearedContentEl.textContent).toContain('No action logs recorded yet');

        // Switch to Perf Tab
        const perfTabBtn = document.getElementById('euix-tab-perf');
        perfTabBtn.click();
        expect(devtools.activeTab).toBe('perf');
        const perfContentEl = document.getElementById('euix-panel-content');
        expect(perfContentEl.textContent).toContain('Initial Mount Time');
        expect(perfContentEl.textContent).toContain('AST Cache Efficiency');

        // Close Panel with 'X' button
        const closeBtn = document.getElementById('euix-panel-close');
        closeBtn.click();
        expect(devtools.panelOpen).toBe(false);
        expect(devtools.panelEl.style.display).toBe('none');
    });

    it('should record all ErrorScope lifecycle events and cap log arrays at 30 items', () => {
        devtools.togglePanel(true);

        const errorEvents = [
            ['TRY_ENTER', { scopeId: 'scope_1' }],
            ['TRY_SUCCESS', { duration: 12.4 }],
            ['ACTION_ERROR', { error: { code: 'HTTP_500', message: 'Internal Server Error' } }],
            ['CATCH_ENTER', { varName: 'err' }],
            ['CATCH_SUCCESS', {}],
            ['FINALLY_ENTER', {}],
            ['FINALLY_COMPLETE', {}],
            ['ERROR_PROPAGATED', { error: { code: 'UNHANDLED', message: 'Fatal' } }],
            ['CUSTOM_ERROR_EVENT', {}]
        ];

        for (const [event, details] of errorEvents) {
            devtools.logErrorScope(event, details);
        }

        expect(devtools.logs.length).toBe(9);

        // Flood logs to test shift() cap at 30
        for (let i = 0; i < 35; i++) {
            devtools.logAction('setState', { path: `data.item_${i}`, value: i });
        }
        expect(devtools.logs.length).toBe(30);

        for (let i = 0; i < 35; i++) {
            devtools.logErrorScope('TRY_ENTER', { scopeId: `scope_${i}` });
        }
        expect(devtools.logs.length).toBe(30);
    });

    it('should inspect elements on mousemove, traversing hierarchy and parsing metadata', () => {
        devtools.toggle(true);

        const h1 = container.querySelector('h1');
        h1.getBoundingClientRect = () => ({
            top: 50,
            left: 20,
            width: 200,
            height: 40,
            bottom: 90,
            right: 220
        });

        // Trigger mousemove over h1 with component metadata
        const moveH1 = new MouseEvent('mousemove', { bubbles: true });
        h1.dispatchEvent(moveH1);

        expect(devtools.highlightEl.style.display).toBe('block');
        expect(devtools.tooltipEl.style.display).toBe('block');
        expect(devtools.tooltipEl.innerHTML).toContain('UserHeader');
        expect(devtools.tooltipEl.innerHTML).toContain('user.name');

        // Test inspect element on button with data-xui-bind and data-xui-ref
        const btn = container.querySelector('#inc-btn');
        btn.getBoundingClientRect = () => ({
            top: 100,
            left: 20,
            width: 120,
            height: 35,
            bottom: 135,
            right: 140
        });

        const moveBtn = new MouseEvent('mousemove', { bubbles: true });
        btn.dispatchEvent(moveBtn);

        expect(devtools.tooltipEl.innerHTML).toContain('counterBtn');
        expect(devtools.tooltipEl.innerHTML).toContain('counter');

        // Test mousemove on empty/body target
        const moveBody = new MouseEvent('mousemove', { bubbles: true });
        document.body.dispatchEvent(moveBody);
        expect(devtools.highlightEl.style.display).toBe('none');
        expect(devtools.tooltipEl.style.display).toBe('none');
    });

    it('should escape HTML in tooltip and log entries safely', () => {
        const escaped = devtools.escapeHtml('<script>alert("xss")</script>&"test"');
        expect(escaped).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;&amp;"test"');
    });
});
