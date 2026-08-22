import { describe, it, expect } from 'vitest';
import { applyArrayMutation } from '../src/core/state/Mutations.js';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';

describe('State Mutations & Array Ops Exhaustive Test Suite', () => {
    it('should test all applyArrayMutation branches (CLEAR, PUSH, UNSHIFT, POP, SHIFT, REMOVE, INSERT, UPDATE, SWAP, unknown)', () => {
        // 1. CLEAR, EMPTY, RESET
        expect(applyArrayMutation([1, 2, 3], 'CLEAR')).toEqual([]);
        expect(applyArrayMutation([1, 2, 3], 'EMPTY')).toEqual([]);
        expect(applyArrayMutation([1, 2, 3], 'RESET')).toEqual([]);

        // 2. PUSH / APPEND
        const arrPush = [1];
        expect(applyArrayMutation(arrPush, 'PUSH', { item: 2 })).toEqual([1, 2]);
        expect(applyArrayMutation(arrPush, 'APPEND', 3)).toEqual([1, 2, 3]);

        // 3. UNSHIFT / PREPEND
        const arrUnshift = [3];
        expect(applyArrayMutation(arrUnshift, 'UNSHIFT', { item: 2 })).toEqual([2, 3]);
        expect(applyArrayMutation(arrUnshift, 'PREPEND', 1)).toEqual([1, 2, 3]);

        // 4. POP & SHIFT
        const arrPopShift = [10, 20, 30];
        expect(applyArrayMutation(arrPopShift, 'POP')).toEqual([10, 20]);
        expect(applyArrayMutation(arrPopShift, 'SHIFT')).toEqual([20]);

        // 5. REMOVE / DELETE with index, where, or direct value match
        const arrRemove = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }, { id: 3, name: 'c' }];
        expect(applyArrayMutation(arrRemove, 'REMOVE', { index: 1 })).toEqual([{ id: 1, name: 'a' }, { id: 3, name: 'c' }]);
        expect(applyArrayMutation(arrRemove, 'REMOVE', { where: { field: 'id', equals: 1 } })).toEqual([{ id: 3, name: 'c' }]);

        const primitiveArr = ['apple', 'banana', 'orange'];
        expect(applyArrayMutation(primitiveArr, 'DELETE', 'banana')).toEqual(['apple', 'orange']);

        // 6. INSERT
        const arrInsert = [1, 3];
        expect(applyArrayMutation(arrInsert, 'INSERT', { index: 1, item: 2 })).toEqual([1, 2, 3]);

        // 7. UPDATE (object merge and primitive replace)
        const arrUpdate = [{ id: 1, status: 'pending' }, { id: 2, status: 'pending' }];
        applyArrayMutation(arrUpdate, 'UPDATE', { where: { field: 'id', equals: '1' }, value: { status: 'done' } });
        expect(arrUpdate[0]).toEqual({ id: 1, status: 'done' });

        const arrUpdatePrim = [{ id: 'a', val: 10 }];
        applyArrayMutation(arrUpdatePrim, 'UPDATE', { where: { field: 'id', equals: 'a' }, value: 'primitive-val' });
        expect(arrUpdatePrim[0]).toBe('primitive-val');

        // 8. SWAP
        const arrSwap = ['first', 'second', 'third'];
        applyArrayMutation(arrSwap, 'SWAP', { index1: 0, index2: 2 });
        expect(arrSwap).toEqual(['third', 'second', 'first']);

        // SWAP edge cases: out of bounds, same index, invalid numbers
        applyArrayMutation(arrSwap, 'SWAP', { index1: 0, index2: 0 });
        expect(arrSwap).toEqual(['third', 'second', 'first']);
        applyArrayMutation(arrSwap, 'SWAP', { index1: -1, index2: 10 });
        expect(arrSwap).toEqual(['third', 'second', 'first']);
        applyArrayMutation(arrSwap, 'SWAP', { index1: 'NaN', index2: 1 });
        expect(arrSwap).toEqual(['third', 'second', 'first']);

        // 9. Unknown operation
        expect(applyArrayMutation([1, 2], 'UNKNOWN_OP')).toEqual([1, 2]);
    });

    it('should test ReactiveStore array mutations and state bindings', async () => {
        const container = document.createElement('div');
        const xml = `
        <uid_spec>
            <data_model>
                <state id="user" type="object">{"name": "Ahmet", "meta": {"role": "Admin"}}</state>
                <state id="items" type="array">
                    <item id="1" title="Item 1" />
                </state>
            </data_model>
            <div id="app">
                <span id="name-display">{data.user.name}</span>
                <span id="role-display">{data.user.meta.role}</span>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(container.querySelector('#name-display').textContent).toBe('Ahmet');
        expect(container.querySelector('#role-display').textContent).toBe('Admin');

        // Test mutateState array push
        engine.mutateState('items', 'PUSH', { id: 2, title: 'Item 2' });
        expect(engine.getState('items')).toHaveLength(2);

        // Test mutateState array clear
        engine.mutateState('items', 'CLEAR');
        expect(engine.getState('items')).toHaveLength(0);

        // Test mutateState on non-array (should initialize array)
        engine.mutateState('non_existent_arr', 'PUSH', 'val1');
        expect(engine.getState('non_existent_arr')).toEqual(['val1']);
    });
});
