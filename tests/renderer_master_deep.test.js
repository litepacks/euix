import { describe, it, expect, beforeEach } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { _getLongestIncreasingSubsequence, _extractExternalKeysFromExpr, _isVisualXmlChild } from '../src/core/renderer/ForEachRenderer.js';

describe('DOMRenderer & ForEach Keyed Reconciliation Master Suite', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('should test _getLongestIncreasingSubsequence algorithm', () => {
        expect(_getLongestIncreasingSubsequence([0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15])).toBeDefined();
        expect(_getLongestIncreasingSubsequence([])).toEqual([0]);
        expect(_getLongestIncreasingSubsequence([1, 2, 3])).toEqual([0, 1, 2]);
    });

    it('should test _extractExternalKeysFromExpr and _isVisualXmlChild filters', () => {
        const set = new Set();
        _extractExternalKeysFromExpr('{data.user_name} - {item.id} - {data.theme}', 'item', set);
        expect(set.has('user_name')).toBe(true);
        expect(set.has('theme')).toBe(true);
        expect(set.has('item')).toBe(false);

        expect(_isVisualXmlChild({ nodeType: 3, textContent: '   ' })).toBe(false);
        expect(_isVisualXmlChild({ nodeType: 3, textContent: 'Hello' })).toBe(true);
        expect(_isVisualXmlChild({ nodeType: 1, tagName: 'on_click' })).toBe(false);
        expect(_isVisualXmlChild({ nodeType: 1, tagName: 'div' })).toBe(true);
    });

    it('should render keyed for_each and perform efficient keyed reconciliation', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="items" type="array">
                    <item id="1" title="Item 1" />
                    <item id="2" title="Item 2" />
                    <item id="3" title="Item 3" />
                </state>
            </data_model>
            <div id="list-container">
                <for_each items="{data.items}" var="item" key="id">
                    <div class="row" data-id="{item.id}">
                        <span>{item.title}</span>
                    </div>
                </for_each>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        let rows = container.querySelectorAll('.row');
        expect(rows).toHaveLength(3);
        expect(rows[0].querySelector('span').textContent).toBe('Item 1');

        // Swap items 1 and 3
        engine.mutateState('items', 'SWAP', { index1: 0, index2: 2 });
        rows = container.querySelectorAll('.row');
        expect(rows[0].querySelector('span').textContent).toBe('Item 3');
        expect(rows[2].querySelector('span').textContent).toBe('Item 1');

        // Delete middle item (Item 2)
        engine.mutateState('items', 'REMOVE', { where: { field: 'id', equals: '2' } });
        rows = container.querySelectorAll('.row');
        expect(rows).toHaveLength(2);
    });

    it('should test virtual scrolling container initialization', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="v_items" type="array">
                    <item id="1" title="Task 1" />
                    <item id="2" title="Task 2" />
                </state>
            </data_model>
            <div id="virtual-box">
                <for_each items="{data.v_items}" var="t" key="id" virtual="true" item_height="40">
                    <div class="v-row">
                        <span>{t.title}</span>
                    </div>
                </for_each>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const vBox = container.querySelector('#virtual-box');
        expect(vBox).toBeTruthy();
    });
});
