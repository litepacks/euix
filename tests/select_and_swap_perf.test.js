import { describe, it, expect, beforeEach } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('EUIXEngine - Select & Swap Performance & Container Suite', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
    });

    it('1. should render table with <for_each as="tbody"> directly without wrapper <div>', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="rows" type="array"></state>
            </data_model>
            <table class="table">
                <for_each as="tbody" id="tbody" class="table-body" items="{data.rows}" var="row" key="id">
                    <tr class="table-row">
                        <td>{row.id}</td>
                        <td>{row.name}</td>
                    </tr>
                </for_each>
            </table>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        engine.setState('rows', [
            { id: '1', name: 'Alice' },
            { id: '2', name: 'Bob' }
        ]);

        const table = document.querySelector('table');
        const tbody = table.querySelector('tbody#tbody');
        expect(tbody).not.toBeNull();
        expect(tbody.tagName.toLowerCase()).toBe('tbody');
        expect(tbody.className).toBe('table-body');
        expect(tbody.children.length).toBe(2);
        expect(tbody.children[0].tagName.toLowerCase()).toBe('tr');
        expect(tbody.children[0].children[0].textContent).toBe('1');
        expect(tbody.children[0].children[1].textContent).toBe('Alice');
    });

    it('2. should execute Select Row (in-place class binding) when selected state changes', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="rows" type="array"></state>
                <state id="selected" type="string">-1</state>
            </data_model>
            <table>
                <for_each as="tbody" id="tbody" items="{data.rows}" var="row" key="id">
                    <tr class="{data.selected === row.id ? 'danger' : ''}">
                        <td class="col-id">{row.id}</td>
                        <td class="col-name">
                            <a class="lbl">
                                <on_click action="SET_STATE">
                                    <path>data.selected</path>
                                    <value>{row.id}</value>
                                </on_click>
                                {row.name}
                            </a>
                        </td>
                    </tr>
                </for_each>
            </table>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const items = Array.from({ length: 100 }, (_, i) => ({ id: String(i + 1), name: `User ${i + 1}` }));
        engine.setState('rows', items);

        // Initial state: no danger class
        expect(document.querySelectorAll('tr.danger').length).toBe(0);

        // Select row 5 via state
        engine.setState('selected', '5');
        const tr5 = document.querySelector('tbody tr:nth-of-type(5)');
        expect(tr5.className).toBe('danger');
        expect(document.querySelectorAll('tr.danger').length).toBe(1);

        // Select row 10 via click on link
        const a10 = document.querySelector('tbody tr:nth-of-type(10) a.lbl');
        a10.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

        expect(engine.getState('selected')).toBe('10');
        const tr10 = document.querySelector('tbody tr:nth-of-type(10)');
        expect(tr10.className).toBe('danger');
        expect(tr5.className).toBe('');
        expect(document.querySelectorAll('tr.danger').length).toBe(1);
    });

    it('3. should execute Swap 2 Rows Fast-Path preserving existing DOM node references', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="items" type="array"></state>
            </data_model>
            <div id="list">
                <for_each items="{data.items}" var="item" key="id">
                    <div class="row" data-id="{item.id}">
                        <span>{item.title}</span>
                    </div>
                </for_each>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const items = [
            { id: '1', title: 'First' },
            { id: '2', title: 'Second' },
            { id: '3', title: 'Third' },
            { id: '4', title: 'Fourth' },
            { id: '5', title: 'Fifth' }
        ];
        engine.setState('items', items);

        const node2Before = document.querySelector('div[data-id="2"]');
        const node4Before = document.querySelector('div[data-id="4"]');

        // Swap item 2 and item 4
        const swapped = [
            items[0],
            items[3], // id: 4 at index 1
            items[2],
            items[1], // id: 2 at index 3
            items[4]
        ];

        engine.setState('items', swapped);

        const rowsAfter = document.querySelectorAll('#list .row');
        expect(rowsAfter[1].getAttribute('data-id')).toBe('4');
        expect(rowsAfter[3].getAttribute('data-id')).toBe('2');

        // Verify existing DOM nodes were reordered without re-creation
        expect(rowsAfter[1]).toBe(node4Before);
        expect(rowsAfter[3]).toBe(node2Before);
    });

    it('4. should interpolate loop item variables in RUN_SCRIPT properly', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="users" type="array"></state>
                <state id="lastClickedUser"></state>
            </data_model>
            <for_each items="{data.users}" var="user" key="id">
                <div class="user-card">
                    <button class="select-btn">
                        <on_click action="RUN_SCRIPT">
                            $data.lastClickedUser = "Selected " + {user.name} + " (#" + {user.id} + ")";
                        </on_click>
                        Select {user.name}
                    </button>
                </div>
            </for_each>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        engine.setState('users', [
            { id: '101', name: 'Ahmet' },
            { id: '102', name: 'Mehmet' }
        ]);

        const btn1 = document.querySelectorAll('.select-btn')[0];
        btn1.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

        expect(engine.getState('lastClickedUser')).toBe('Selected Ahmet (#101)');

        const btn2 = document.querySelectorAll('.select-btn')[1];
        btn2.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));

        expect(engine.getState('lastClickedUser')).toBe('Selected Mehmet (#102)');
    });
});
