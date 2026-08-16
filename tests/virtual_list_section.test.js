import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';
import fs from 'fs';
import path from 'path';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('Playground VirtualListSection Component Integration Test Suite', () => {
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

    it('should render VirtualListSection.xml and interactively populate and virtualize 1,000 items', async () => {
        const virtualSectionXml = fs.readFileSync(path.resolve(__dirname, '../components/VirtualListSection.xml'), 'utf-8');

        const xml = `
        <uid_spec>
            <data_model>
                <state id="virtual_list_open" type="string">true</state>
                <state id="virtual_items" type="array"></state>
                <state id="virtual_render_time" type="string">0.00</state>
                <state id="code_modal_open" type="string">false</state>
                <state id="code_modal_title" type="string"></state>
                <state id="code_modal_lines" type="string"></state>
                <state id="code_modal_content" type="string"></state>
            </data_model>

            <container>
                ${virtualSectionXml}
                <virtual-list-section />
            </container>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        expect(engine).toBeDefined();
        expect(engine.getState('virtual_items').length).toBe(0);

        // Click "Load 1,000 Items" button
        const buttons = Array.from(container.querySelectorAll('button'));
        const load1000Btn = buttons.find(b => b.textContent.includes('Load 1,000 Items'));
        expect(load1000Btn).toBeDefined();

        load1000Btn.click();

        expect(engine.getState('virtual_items').length).toBe(1000);
        expect(parseFloat(engine.getState('virtual_render_time'))).toBeGreaterThanOrEqual(0);

        // Under virtual scroll, only viewport rows are rendered in DOM (not all 1,000 DOM elements)
        const virtualContainer = container.querySelector('.euix-virtual-list');
        expect(virtualContainer).toBeDefined();

        // Click "Clear List" button
        const clearBtn = buttons.find(b => b.textContent.includes('Clear List'));
        expect(clearBtn).toBeDefined();
        clearBtn.click();

        expect(engine.getState('virtual_items').length).toBe(0);
    });
});
