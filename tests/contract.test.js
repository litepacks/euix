import { describe, it, expect, beforeEach, vi } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

function createActionNode(xmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');
    return doc.documentElement;
}

describe('EUIX Engine Public API & Contract Test Suite', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
    });

    describe('1. Public API Surface Contract', () => {
        it('should fulfill the EUIXEngine static and instance API contracts', () => {
            expect(typeof EUIXEngine.mount).toBe('function');
            expect(typeof EUIXEngine.registerComponentSpec).toBe('function');
            expect(typeof EUIXEngine.enableDevTools).toBe('function');

            const engine = new EUIXEngine('#app');
            expect(typeof engine.getState).toBe('function');
            expect(typeof engine.setState).toBe('function');
            expect(typeof engine.batch).toBe('function');
            expect(typeof engine.registerAction).toBe('function');
            expect(typeof engine.handleAction).toBe('function');
            expect(typeof engine.enableDevTools).toBe('function');
            expect('onError' in engine).toBe(true);
        });
    });

    describe('2. Data Model & State Contract', () => {
        it('should uphold the XML <data_model> initialization contract', async () => {
            const xml = `
            <uid_spec>
                <data_model>
                    <state id="username" type="string">john_doe</state>
                    <state id="age" type="number">28</state>
                    <state id="active" type="boolean">true</state>
                    <state id="items" type="array">
                        <item id="1" text="First Task" />
                    </state>
                </data_model>
                <flex direction="column">
                    <span class="user">{data.username}</span>
                </flex>
            </uid_spec>
            `;

            const engine = await EUIXEngine.mount(xml, '#app');
            expect(engine.getState('username')).toBe('john_doe');
            expect(engine.getState('age')).toBe('28');
            expect(engine.getState('active')).toBe('true');
            expect(Array.isArray(engine.getState('items'))).toBe(true);
            expect(engine.getState('items')[0].text).toBe('First Task');
        });
    });

    describe('3. Component Spec & Props Contract', () => {
        it('should uphold component registration, prop evaluation, and rendering contracts', async () => {
            EUIXEngine.registerComponentSpec('user-card', `
                <component_def name="user-card">
                    <flex class="card">
                        <span class="name">{props.title}</span>
                        <span class="role">{props.role}</span>
                    </flex>
                </component_def>
            `);

            const xml = `
            <uid_spec>
                <data_model>
                    <state id="current_role" type="string">Frontend Engineer</state>
                </data_model>
                <flex direction="column">
                    <user-card title="Alice" role="{data.current_role}" />
                </flex>
            </uid_spec>
            `;

            await EUIXEngine.mount(xml, '#app');
            expect(document.querySelector('.name').textContent).toBe('Alice');
            expect(document.querySelector('.role').textContent).toBe('Frontend Engineer');
        });
    });

    describe('4. Action Contract (SET_STATE, MUTATE_STATE, Custom Actions)', () => {
        it('should fulfill MUTATE_STATE (PUSH, REMOVE, UPDATE, CLEAR) operation contracts', async () => {
            const xml = `
            <uid_spec>
                <data_model>
                    <state id="todos" type="array">
                        <item id="1" text="Initial Task" completed="false" />
                    </state>
                </data_model>
                <flex direction="column">
                    <span>Task List</span>
                </flex>
            </uid_spec>
            `;

            const engine = await EUIXEngine.mount(xml, '#app');
            expect(engine.getState('todos').length).toBe(1);

            // 1. PUSH Contract
            engine.handleAction(createActionNode(`
                <on_click action="MUTATE_STATE">
                    <path>data.todos</path>
                    <operation>PUSH</operation>
                    <item id="2" text="Second Task" completed="false" />
                </on_click>
            `));
            expect(engine.getState('todos').length).toBe(2);

            // 2. UPDATE Contract
            engine.handleAction(createActionNode(`
                <on_click action="MUTATE_STATE">
                    <path>data.todos</path>
                    <operation>UPDATE</operation>
                    <where field="id" equals="2" />
                    <item text="Updated Task 2" />
                </on_click>
            `));
            expect(engine.getState('todos')[1].text).toBe('Updated Task 2');

            // 3. REMOVE Contract
            engine.handleAction(createActionNode(`
                <on_click action="MUTATE_STATE">
                    <path>data.todos</path>
                    <operation>REMOVE</operation>
                    <where field="id" equals="1" />
                </on_click>
            `));
            expect(engine.getState('todos').length).toBe(1);
            expect(engine.getState('todos')[0].id).toBe('2');

            // 4. CLEAR Contract
            engine.handleAction(createActionNode(`
                <on_click action="MUTATE_STATE">
                    <path>data.todos</path>
                    <operation>CLEAR</operation>
                </on_click>
            `));
            expect(engine.getState('todos').length).toBe(0);
        });

        it('should fulfill custom action registration and execution contract', async () => {
            const xml = `<uid_spec><flex direction="column"></flex></uid_spec>`;
            const engine = await EUIXEngine.mount(xml, '#app');

            const customActionSpy = vi.fn();
            engine.registerAction('MY_CUSTOM_CONTRACT_ACTION', (context) => {
                customActionSpy(context);
            });

            const actionNode = createActionNode('<on_click action="MY_CUSTOM_CONTRACT_ACTION" />');
            engine.handleAction(actionNode);

            expect(customActionSpy).toHaveBeenCalledTimes(1);
        });
    });

    describe('5. Error Boundary & Fallback Contract', () => {
        it('should trigger onError contract callback on parse or execution errors', async () => {
            const engine = new EUIXEngine('#app');
            const onErrorSpy = vi.fn();
            engine.onError = onErrorSpy;

            engine.mount('<uid_spec><broken_tag></uid_spec>');

            expect(onErrorSpy).toHaveBeenCalled();
        });
    });
});
