import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('EUIXEngine Dynamic List Event Delegation Suite (<for_each>)', () => {
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

    it('should execute delegated on_click actions inside for_each without individual event listeners', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="selected_id">none</state>
                <state id="items" type="array"></state>
            </data_model>
            <container>
                <for_each items="{data.items}" var="item" key="id">
                    <div class="card" data-id="{item.id}">
                        <button class="select-btn">
                            <on_click action="SET_STATE">
                                <path>data.selected_id</path>
                                <value>{item.id}</value>
                            </on_click>
                            Select {item.name}
                        </button>
                    </div>
                </for_each>
            </container>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        engine.setState('items', [
            { id: '101', name: 'Item 101' },
            { id: '102', name: 'Item 102' }
        ]);

        const buttons = container.querySelectorAll('.select-btn');
        expect(buttons.length).toBe(2);

        // Click second item's select button -> delegated event catches and executes action
        buttons[1].click();
        expect(engine.getState('selected_id')).toBe('102');

        // Click first item's select button
        buttons[0].click();
        expect(engine.getState('selected_id')).toBe('101');
    });

    it('should handle nested element event bubbling under list event delegation', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="clicked_name">none</state>
                <state id="users" type="array"></state>
            </data_model>
            <container>
                <for_each items="{data.users}" var="u" key="id">
                    <div class="row">
                        <button class="btn">
                            <on_click action="SET_STATE">
                                <path>data.clicked_name</path>
                                <value>{u.name}</value>
                            </on_click>
                            <span class="icon">👤</span>
                            <span class="label">{u.name}</span>
                        </button>
                    </div>
                </for_each>
            </container>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        engine.setState('users', [
            { id: '1', name: 'Alice' }
        ]);

        // Click directly on nested span element inside button
        const iconSpan = container.querySelector('.icon');
        iconSpan.click();

        // Event delegation bubbles up from span to button and executes on_click with Alice context
        expect(engine.getState('clicked_name')).toBe('Alice');
    });
});
