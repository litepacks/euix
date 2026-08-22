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

    it('should safely render and reconcile lists with duplicate keys and non-extensible frozen objects', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="dup_items" type="array"></state>
            </data_model>
            <div id="dup-list">
                <for_each items="{data.dup_items}" var="row" key="id">
                    <div class="dup-row">
                        <span>{row.text}</span>
                    </div>
                </for_each>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);

        // 1. Dondurulmuş (Frozen/Sealed/Non-Extensible) ve Mükerrer ID'li Nesneler
        const frozenItem1 = Object.freeze({ id: 'same_id', text: 'First Duplicate' });
        const frozenItem2 = Object.preventExtensions({ id: 'same_id', text: 'Second Duplicate' });
        const sealedItem = Object.seal({ id: 'sealed_id', text: 'Sealed Item' });
        const item3 = { id: 'unique_id', text: 'Third Item' };

        engine.setState('dup_items', [frozenItem1, frozenItem2, sealedItem, item3]);

        let rows = container.querySelectorAll('.dup-row');
        expect(rows).toHaveLength(4);
        expect(rows[0].querySelector('span').textContent).toBe('First Duplicate');
        expect(rows[1].querySelector('span').textContent).toBe('Second Duplicate');
        expect(rows[2].querySelector('span').textContent).toBe('Sealed Item');
        expect(rows[3].querySelector('span').textContent).toBe('Third Item');

        // 2. Reconcile / Mutate (Duplicate Key listesini güncelle)
        engine.mutateState('dup_items', 'PUSH', Object.freeze({ id: 'same_id', text: 'Third Duplicate' }));
        rows = container.querySelectorAll('.dup-row');
        expect(rows).toHaveLength(5);
        expect(rows[4].querySelector('span').textContent).toBe('Third Duplicate');
    });

    it('should safely handle loose vs strict equality and nullish values in MUTATE_STATE <where> operations', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="items" type="array"></state>
            </data_model>
            <div id="items-list">
                <for_each items="{data.items}" var="item" key="id">
                    <div class="item-row" data-id="{item.id}">
                        <span>{item.title}</span>
                    </div>
                </for_each>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);

        // 1. Sayısal id, string id ve eksik/null alanlar içeren liste
        engine.setState('items', [
            { id: 101, title: 'Item Numeric 101' },
            { id: '102', title: 'Item String 102' },
            { id: 0, title: 'Item Zero' },
            { id: null, title: 'Item Null ID' },
            { id: 'custom', title: 'Item Custom' }
        ]);

        let rows = container.querySelectorAll('.item-row');
        expect(rows).toHaveLength(5);

        // 2. String '101' ile numeric 101 elemanını sil (loose match)
        engine.mutateState('items', 'REMOVE', { where: { field: 'id', equals: '101' } });
        rows = container.querySelectorAll('.item-row');
        expect(rows).toHaveLength(4);
        expect(rows[0].querySelector('span').textContent).toBe('Item String 102');

        // 3. Numeric 102 ile string '102' elemanını sil (loose match)
        engine.mutateState('items', 'REMOVE', { where: { field: 'id', equals: 102 } });
        rows = container.querySelectorAll('.item-row');
        expect(rows).toHaveLength(3);

        // 4. Null ID olan elemanı güncelle (null safety)
        engine.mutateState('items', 'UPDATE', { where: { field: 'id', equals: 0 }, value: { title: 'Updated Zero' } });
        rows = container.querySelectorAll('.item-row');
        expect(rows[0].querySelector('span').textContent).toBe('Updated Zero');
    });
});
