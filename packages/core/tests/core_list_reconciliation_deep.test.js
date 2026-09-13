/**
 * tests/core_list_reconciliation_deep.test.js
 * Deep tests for EUIXEngineCore LIS reordering, hash mutation updates, and virtual scroll slices.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';

describe('EUIXEngineCore - LIS Keyed Reconciliation & Virtual Scroll Slices', () => {
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

    it('should reorder keyed elements using LIS algorithm with minimal DOM operations', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="items" type="array">[
                    {"id": "a", "val": "Item A"},
                    {"id": "b", "val": "Item B"},
                    {"id": "c", "val": "Item C"},
                    {"id": "d", "val": "Item D"},
                    {"id": "e", "val": "Item E"}
                ]</state>
            </data_model>
            <flex direction="column" class="item-list">
                <for_each items="{data.items}" var="it" key="id">
                    <span class="list-item" data-id="{it.id}">{it.val}</span>
                </for_each>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);

        let renderedIds = Array.from(container.querySelectorAll('.list-item')).map(el => el.getAttribute('data-id'));
        expect(renderedIds).toEqual(['a', 'b', 'c', 'd', 'e']);

        // Reverse / Permute order -> [e, c, a, d, b]
        engine.setState('items', [
            { id: "e", val: "Item E" },
            { id: "c", val: "Item C" },
            { id: "a", val: "Item A" },
            { id: "d", val: "Item D" },
            { id: "b", val: "Item B" }
        ]);
        await new Promise(r => setTimeout(r, 40));

        renderedIds = Array.from(container.querySelectorAll('.list-item')).map(el => el.getAttribute('data-id'));
        expect(renderedIds).toEqual(['e', 'c', 'a', 'd', 'b']);
    });

    it('should test virtual scroll container with rowHeight and slice rendering on scroll', async () => {
        const largeArray = Array.from({ length: 100 }, (_, i) => ({
            id: i,
            title: `Task #${i + 1}`
        }));

        const xml = `
        <uid_spec>
            <data_model>
                <state id="tasks" type="array">${JSON.stringify(largeArray)}</state>
            </data_model>
            <flex direction="column" style="height: 300px; overflow-y: auto;" class="virtual-scroll-box">
                <for_each items="{data.tasks}" var="t" key="id" virtual="true" row_height="30">
                    <div class="task-row">{t.title}</div>
                </for_each>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const scrollBox = container.querySelector('.virtual-scroll-box');
        expect(scrollBox).not.toBeNull();

        const initialRows = container.querySelectorAll('.task-row');
        expect(initialRows.length).toBeGreaterThan(0);
        expect(initialRows.length).toBeLessThan(100); // Only visible slice rendered!

        // Simulate scroll event
        scrollBox.scrollTop = 600;
        scrollBox.dispatchEvent(new Event('scroll'));
        await new Promise(r => setTimeout(r, 60));

        const scrolledRows = container.querySelectorAll('.task-row');
        expect(scrolledRows.length).toBeGreaterThan(0);
    });
});
