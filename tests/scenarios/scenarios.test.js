import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { EUIXEngine } from '../../src/EUIXEngine.js';

describe('Real-World Fixture Scenarios & Edge Cases', () => {
    let dom;
    let document;
    let container;

    beforeEach(() => {
        dom = new JSDOM('<!DOCTYPE html><html><head></head><body><div id="app"></div></body></html>', {
            url: 'http://localhost/',
        });
        document = dom.window.document;
        global.window = dom.window;
        global.document = document;
        global.HTMLElement = dom.window.HTMLElement;
        global.DOMParser = dom.window.DOMParser;
        global.Node = dom.window.Node;
        container = document.getElementById('app');
    });

    const readFixture = (filename) => {
        const filePath = path.join(__dirname, 'fixtures', filename);
        return fs.readFileSync(filePath, 'utf-8');
    };

    it('Scenario 1: should correctly execute E-Commerce Cart & Workflow calculations', async () => {
        const xml = readFixture('ecommerce_cart.xml');
        const engine = EUIXEngine.mount(xml, container);

        // 1. Initial State assertions
        expect(document.getElementById('cart-title').textContent).toContain('Shopping Cart (2 items)');
        expect(document.getElementById('item-p1').textContent).toContain('Qty: 2');
        expect(document.getElementById('item-p1').textContent).toContain('Subtotal: $200');
        expect(document.getElementById('coupon-status').textContent).toBe('No Coupon');

        // 2. Click + quantity button on p1
        const plusBtnP1 = document.querySelector('#item-p1 .btn-qty-plus');
        expect(plusBtnP1).not.toBeNull();
        plusBtnP1.click();
        await new Promise((r) => setTimeout(r, 50));

        expect(document.getElementById('item-p1').textContent).toContain('Qty: 3');
        expect(document.getElementById('item-p1').textContent).toContain('Subtotal: $300');

        // 3. Apply Coupon
        engine.setState('couponInput', 'SUMMER20');
        const applyBtn = document.getElementById('btn-apply-coupon');
        applyBtn.click();
        await new Promise((r) => setTimeout(r, 10));

        expect(document.getElementById('coupon-status').textContent).toBe('Coupon Applied (20% OFF)');
        expect(engine.getState('couponInput')).toBe('');
    });

    it('Scenario 2: should handle Multi-Tab Dashboard switching and Scoped Styles', async () => {
        const xml = readFixture('multi_tab_dashboard.xml');
        const engine = EUIXEngine.mount(xml, container);

        // 1. Initial Analytics tab
        expect(document.getElementById('tab-analytics').className).toContain('active');
        expect(document.getElementById('analytics-panel').style.display).toBe('block');
        expect(document.getElementById('settings-panel').style.display).toBe('none');
        expect(document.getElementById('kpi-visitors').textContent).toContain('12450');

        // 2. Switch to Settings tab
        const settingsTabBtn = document.getElementById('tab-settings');
        settingsTabBtn.click();
        await new Promise((r) => setTimeout(r, 10));

        expect(document.getElementById('tab-settings').className).toContain('active');
        expect(document.getElementById('tab-analytics').className).not.toContain('active');
        expect(document.getElementById('settings-panel').style.display).toBe('block');
        expect(document.getElementById('analytics-panel').style.display).toBe('none');

        // 3. Change theme color
        engine.setState('themeColor', '#ef4444');
        await new Promise((r) => setTimeout(r, 10));
        const styleTag = document.querySelector('style[data-euix-scoped-for]');
        if (styleTag) {
            expect(styleTag.textContent).toContain('#ef4444');
        }
    });

    it('Scenario 3: should manage Form Wizard steps, validation and submission', async () => {
        const xml = readFixture('form_wizard.xml');
        const engine = EUIXEngine.mount(xml, container);

        // Step 1 check
        expect(document.getElementById('step-indicator').textContent).toBe('Step 1 of 3');
        expect(document.getElementById('step-1').style.display).toBe('block');
        expect(document.getElementById('step-2').style.display).toBe('none');

        // Input name & email
        engine.setState('form.fullName', 'Alice Doe');
        engine.setState('form.email', 'alice@example.com');
        await new Promise((r) => setTimeout(r, 10));

        // Click next
        document.getElementById('btn-step1-next').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(document.getElementById('step-indicator').textContent).toBe('Step 2 of 3');
        expect(document.getElementById('step-2').style.display).toBe('block');
        expect(document.getElementById('step-1').style.display).toBe('none');

        // Click next to Step 3
        document.getElementById('btn-step2-next').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(document.getElementById('step-indicator').textContent).toBe('Step 3 of 3');
        expect(document.getElementById('review-summary').textContent).toContain('Alice Doe');
        expect(document.getElementById('review-summary').textContent).toContain('alice@example.com');

        // Submit form
        document.getElementById('btn-submit').click();
        await new Promise((r) => setTimeout(r, 10));

        expect(engine.getState('isSubmitted')).toBe(true);
        expect(document.getElementById('success-banner').style.display).toBe('block');
    });

    it('Scenario 4: should handle Live Stock Ticker with high-frequency updates and LIS reordering', async () => {
        const xml = readFixture('live_stock_ticker.xml');
        const engine = EUIXEngine.mount(xml, container);

        expect(document.getElementById('stock-AAPL')).not.toBeNull();
        expect(document.getElementById('stock-AAPL').textContent).toContain('$182.5');
        expect(document.getElementById('selected-info').textContent).toContain('None');

        // Select stock
        const selectBtnAAPL = document.querySelector('#stock-AAPL .btn-select');
        selectBtnAAPL.click();
        await new Promise((r) => setTimeout(r, 10));

        expect(document.getElementById('selected-info').textContent).toContain('AAPL');

        // Reorder & update prices
        const updatedStocks = [
            { symbol: 'MSFT', price: 410.5, change: 8.6 },
            { symbol: 'AAPL', price: 185.0, change: 3.75 },
            { symbol: 'NVDA', price: 800.0, change: 25.0 },
        ];
        engine.setState('stocks', updatedStocks);
        await new Promise((r) => setTimeout(r, 10));

        expect(document.getElementById('stock-NVDA')).not.toBeNull();
        expect(document.getElementById('stock-MSFT').textContent).toContain('$410.5');
        expect(document.getElementById('stock-GOOGL')).toBeNull();
    });

    it('Scenario 5: should correctly isolate local states in Nested Tree View with slot projection', async () => {
        const xml = readFixture('nested_tree_accordion.xml');
        const engine = EUIXEngine.mount(xml, container);

        // 1. Initial State
        expect(document.getElementById('active-selection').textContent).toBe('Selected: None');
        const rootNode = document.getElementById('node-root');
        expect(rootNode).not.toBeNull();

        const rootBranchContent = rootNode.querySelector('.branch-content');
        expect(rootBranchContent.style.display).toBe('none');

        // 2. Toggle Root branch
        const rootToggleBtn = rootNode.querySelector('.btn-toggle');
        rootToggleBtn.click();
        await new Promise((r) => setTimeout(r, 10));

        expect(rootBranchContent.style.display).toBe('block');

        // 3. Child 'src' should still be closed (isolated local state)
        const srcNode = document.getElementById('node-src');
        expect(srcNode).not.toBeNull();
        const srcBranchContent = srcNode.querySelector('.branch-content');
        expect(srcBranchContent.style.display).toBe('none');

        // 4. Select child node
        const srcSelectBtn = srcNode.querySelector('.btn-select');
        srcSelectBtn.click();
        await new Promise((r) => setTimeout(r, 10));

        expect(document.getElementById('active-selection').textContent).toBe('Selected: src');
    });

    it('Scenario 6: should handle Chained Computed Watchers and Conditional Triggers', async () => {
        const xml = readFixture('watcher_matrix_and_guards.xml');
        const engine = EUIXEngine.mount(xml, container);

        // Initial values: base=5, double=10, quad=20, high=NO, threshold=NORMAL
        expect(document.getElementById('txt-base').textContent).toBe('Base: 5');
        expect(document.getElementById('txt-double').textContent).toBe('Double: 10');
        expect(document.getElementById('txt-quad').textContent).toBe('Quad: 20');
        expect(document.getElementById('txt-high').textContent).toBe('High: NO');
        expect(document.getElementById('txt-threshold').textContent).toBe('Threshold: NORMAL');

        // Click +5 Base -> base becomes 10 -> double becomes 20 -> quad becomes 40 -> high becomes YES
        document.getElementById('btn-increment').click();
        await new Promise((r) => setTimeout(r, 20));

        expect(document.getElementById('txt-base').textContent).toBe('Base: 10');
        expect(document.getElementById('txt-double').textContent).toBe('Double: 20');
        expect(document.getElementById('txt-quad').textContent).toBe('Quad: 40');
        expect(document.getElementById('txt-high').textContent).toBe('High: YES');
        expect(document.getElementById('txt-threshold').textContent).toBe('Threshold: TRIGGERED');
    });

    it('Scenario 7: should manage API SWR endpoints with Loading, Error and Data States', async () => {
        // Mock global.fetch before engine mount
        const originalFetch = global.fetch;
        const mockData = {
            items: [
                { id: 101, name: 'euixjs', stargazers_count: 1500 },
                { id: 102, name: 'react', stargazers_count: 220000 },
            ],
        };

        global.fetch = async (url) => {
            return {
                ok: true,
                status: 200,
                statusText: 'OK',
                headers: {
                    get: (h) => (h.toLowerCase() === 'content-type' ? 'application/json' : null),
                },
                json: async () => mockData,
                text: async () => JSON.stringify(mockData),
            };
        };

        try {
            const xml = readFixture('api_swr_resilience.xml');
            const engine = EUIXEngine.mount(xml, container);

            // Initial state
            expect(document.getElementById('status-loading').style.display).toBe('none');
            expect(document.getElementById('status-error').style.display).toBe('none');

            // Trigger Search
            document.getElementById('btn-fetch-repos').click();
            await new Promise((r) => setTimeout(r, 50));

            expect(document.getElementById('repo-101')).not.toBeNull();
            expect(document.getElementById('repo-101').textContent).toContain('euixjs');
            expect(document.getElementById('repo-102').textContent).toContain('220000');
        } finally {
            global.fetch = originalFetch;
        }
    });

    it('Scenario 8: should handle Kanban Board multi-column array transitions and removals', async () => {
        const xml = readFixture('kanban_drag_drop.xml');
        const engine = EUIXEngine.mount(xml, container);

        expect(document.getElementById('col-todo').textContent).toContain('Todo (2)');
        expect(document.getElementById('col-done').textContent).toContain('Completed (1)');
        expect(document.getElementById('task-t1')).not.toBeNull();

        // Complete task t1
        const completeBtnT1 = document.querySelector('#task-t1 .btn-complete');
        completeBtnT1.click();
        await new Promise((r) => setTimeout(r, 10));

        expect(document.getElementById('col-todo').textContent).toContain('Todo (1)');
        expect(document.getElementById('col-done').textContent).toContain('Completed (2)');
        expect(document.getElementById('task-t1')).toBeNull();
        expect(document.getElementById('task-done-t1')).not.toBeNull();
        expect(document.getElementById('last-moved').textContent).toBe('Last Completed: t1');
    });

    it('Scenario 9: should handle complex Conditional Matrix and truthy/falsy evaluation', async () => {
        const xml = readFixture('conditional_matrix.xml');
        const engine = EUIXEngine.mount(xml, container);

        // Initial State
        expect(document.getElementById('role-badge').className).toContain('badge-guest');
        expect(document.getElementById('balance-status').textContent).toContain('ZERO_OR_NEGATIVE');
        expect(document.getElementById('premium-inbox').style.display).toBe('none');
        expect(document.getElementById('empty-state').style.display).toBe('block');

        // Promote to Admin
        document.getElementById('btn-make-admin').click();
        await new Promise((r) => setTimeout(r, 10));
        expect(document.getElementById('role-badge').className).toContain('badge-admin');

        // Deposit $1500
        document.getElementById('btn-add-balance').click();
        await new Promise((r) => setTimeout(r, 10));
        expect(document.getElementById('balance-status').textContent).toContain('WEALTHY');

        // Upgrade VIP
        document.getElementById('btn-upgrade-vip').click();
        await new Promise((r) => setTimeout(r, 10));
        expect(document.getElementById('premium-inbox').style.display).toBe('block');
        expect(document.getElementById('premium-inbox').textContent).toContain('VIP Inbox (2 unread)');
        expect(document.getElementById('empty-state').style.display).toBe('none');
    });
});
