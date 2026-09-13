import { describe, it, expect, beforeEach } from 'vitest';
import { EUIXEngine } from '../src/EUIXEngine.js';

describe('EUIXEngine Data Model Type Preservation Suite', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('should preserve number type across SET_STATE and mathematical operations', () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="count" type="number">10</state>
                </data_model>
                <flex direction="column">
                    <button id="inc">
                        <on_click action="SET_STATE">
                            <path>data.count</path>
                            <value>{data.count + 5}</value>
                        </on_click>
                    </button>
                    <button id="dec">
                        <on_click action="SET_STATE">
                            <path>data.count</path>
                            <value>{data.count - 3}</value>
                        </on_click>
                    </button>
                    <span id="display">{data.count}</span>
                </flex>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        expect(typeof engine.getState('count')).toBe('number');
        expect(engine.getState('count')).toBe(10);

        container.querySelector('#inc').click();
        expect(typeof engine.getState('count')).toBe('number');
        expect(engine.getState('count')).toBe(15);
        expect(container.querySelector('#display').textContent).toBe('15');

        container.querySelector('#dec').click();
        expect(typeof engine.getState('count')).toBe('number');
        expect(engine.getState('count')).toBe(12);
        expect(container.querySelector('#display').textContent).toBe('12');
    });

    it('should preserve boolean type across TOGGLE_STATE and SET_STATE', () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="isActive" type="boolean">true</state>
                    <state id="isModalOpen" type="boolean">false</state>
                </data_model>
                <flex direction="column">
                    <button id="toggle">
                        <on_click action="TOGGLE_STATE" path="data.isActive" />
                    </button>
                    <button id="open_modal">
                        <on_click action="SET_STATE">
                            <path>data.isModalOpen</path>
                            <value>true</value>
                        </on_click>
                    </button>
                    <button id="close_modal">
                        <on_click action="SET_STATE">
                            <path>data.isModalOpen</path>
                            <value>false</value>
                        </on_click>
                    </button>
                </flex>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        expect(typeof engine.getState('isActive')).toBe('boolean');
        expect(engine.getState('isActive')).toBe(true);

        container.querySelector('#toggle').click();
        expect(typeof engine.getState('isActive')).toBe('boolean');
        expect(engine.getState('isActive')).toBe(false);

        container.querySelector('#toggle').click();
        expect(typeof engine.getState('isActive')).toBe('boolean');
        expect(engine.getState('isActive')).toBe(true);

        container.querySelector('#open_modal').click();
        expect(typeof engine.getState('isModalOpen')).toBe('boolean');
        expect(engine.getState('isModalOpen')).toBe(true);

        container.querySelector('#close_modal').click();
        expect(typeof engine.getState('isModalOpen')).toBe('boolean');
        expect(engine.getState('isModalOpen')).toBe(false);
    });

    it('should preserve array type across MUTATE_STATE operations', () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="items" type="array">[{"id": 1, "name": "Item 1"}]</state>
                </data_model>
                <flex direction="column">
                    <button id="add">
                        <on_click action="MUTATE_STATE">
                            <path>items</path>
                            <operation>PUSH</operation>
                            <value>{"id": 2, "name": "Item 2"}</value>
                        </on_click>
                    </button>
                    <button id="clear">
                        <on_click action="MUTATE_STATE">
                            <path>items</path>
                            <operation>CLEAR</operation>
                        </on_click>
                    </button>
                </flex>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        expect(Array.isArray(engine.getState('items'))).toBe(true);
        expect(engine.getState('items').length).toBe(1);

        container.querySelector('#add').click();
        expect(Array.isArray(engine.getState('items'))).toBe(true);
        expect(engine.getState('items').length).toBe(2);

        container.querySelector('#clear').click();
        expect(Array.isArray(engine.getState('items'))).toBe(true);
        expect(engine.getState('items').length).toBe(0);
    });

    it('should preserve object type and nested properties', () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="user" type="object">{"name": "Ahmet", "role": "Architect"}</state>
                </data_model>
                <flex direction="column">
                    <span id="user-role">{data.user.role}</span>
                </flex>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        const user = engine.getState('user');
        expect(typeof user).toBe('object');
        expect(user.name).toBe('Ahmet');
        expect(user.role).toBe('Architect');
        expect(container.querySelector('#user-role').textContent).toBe('Architect');

        engine.setState('user.role', 'Lead Developer');
        expect(engine.getState('user').role).toBe('Lead Developer');
        expect(container.querySelector('#user-role').textContent).toBe('Lead Developer');
    });

    it('should preserve string type for default and string states', () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="title" type="string">EUIX</state>
                    <state id="desc">Declarative Engine</state>
                </data_model>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        expect(typeof engine.getState('title')).toBe('string');
        expect(engine.getState('title')).toBe('EUIX');
        expect(typeof engine.getState('desc')).toBe('string');
        expect(engine.getState('desc')).toBe('Declarative Engine');
    });
});
