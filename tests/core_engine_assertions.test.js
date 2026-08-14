import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore, EUIXExpressionParser, EUIXStructuredError } from '../src/core/EUIXEngineCore.js';
import { EUIXApiPlugin } from '../src/plugins/EUIXApiPlugin.js';

EUIXEngineCore.use(EUIXApiPlugin);

describe('EUIXEngineCore - Deep Assertions & Edge Cases Test Suite', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    describe('1. EUIXExpressionParser AST & Operator Evaluation', () => {
        it('should evaluate binary arithmetic operators (*, /, %, +, -)', () => {
            const resolver = (key) => ({ a: 10, b: 3, c: 5 }[key]);
            
            expect(EUIXExpressionParser.eval('a * c', resolver)).toBe(50);
            expect(EUIXExpressionParser.eval('a / c', resolver)).toBe(2);
            expect(EUIXExpressionParser.eval('a % b', resolver)).toBe(1);
            expect(EUIXExpressionParser.eval('a + b * c', resolver)).toBe(25);
            expect(EUIXExpressionParser.eval('(a + b) * c', resolver)).toBe(65);
            expect(EUIXExpressionParser.eval('a - b', resolver)).toBe(7);
        });

        it('should evaluate unary operators (! and -)', () => {
            const resolver = (key) => ({ x: 5, flag: true, zero: 0 }[key]);

            expect(EUIXExpressionParser.eval('-x', resolver)).toBe(-5);
            expect(EUIXExpressionParser.eval('!flag', resolver)).toBe(false);
            expect(EUIXExpressionParser.eval('!zero', resolver)).toBe(true);
        });

        it('should evaluate relational and logical operators with short-circuiting', () => {
            const resolver = (key) => ({ score: 85, active: true, name: 'Alice' }[key]);

            expect(EUIXExpressionParser.eval('score >= 80 && active', resolver)).toBe(true);
            expect(EUIXExpressionParser.eval('score < 50 || active', resolver)).toBe(true);
            expect(EUIXExpressionParser.eval('name == "Alice"', resolver)).toBe(true);
            expect(EUIXExpressionParser.eval('name != "Bob"', resolver)).toBe(true);
            expect(EUIXExpressionParser.eval('score <= 100', resolver)).toBe(true);
        });

        it('should evaluate CallExpressions (length, contains, includes, not)', () => {
            const resolver = (key) => ({
                items: ['apple', 'banana', 'cherry'],
                title: 'Hello World',
                empty: []
            }[key]);

            expect(EUIXExpressionParser.eval('length(items)', resolver)).toBe(3);
            expect(EUIXExpressionParser.eval('length(title)', resolver)).toBe(11);
            expect(EUIXExpressionParser.eval('length(empty)', resolver)).toBe(0);
            expect(EUIXExpressionParser.eval('contains(title, "World")', resolver)).toBe(true);
            expect(EUIXExpressionParser.eval('contains(title, "Foo")', resolver)).toBe(false);
            expect(EUIXExpressionParser.eval('includes(items, "banana")', resolver)).toBe(true);
            expect(EUIXExpressionParser.eval('includes(items, "orange")', resolver)).toBe(false);
            expect(EUIXExpressionParser.eval('not(false)', resolver)).toBe(true);
        });

        it('should evaluate ternary conditional expressions', () => {
            const resolver = (key) => ({ status: 'active', count: 0 }[key]);

            expect(EUIXExpressionParser.eval('status == "active" ? "Online" : "Offline"', resolver)).toBe('Online');
            expect(EUIXExpressionParser.eval('count > 0 ? "Has items" : "Empty"', resolver)).toBe('Empty');
        });
    });

    describe('2. State Management & Nested Path Mutations', () => {
        it('should handle nested dot-notation paths in getState and setState', () => {
            const xml = `
            <uid_spec>
                <data_model>
                    <state id="user" type="object">{"profile": {"name": "Ahmet", "age": 30}}</state>
                </data_model>
                <container>
                    <span>{data.user.profile.name}</span>
                </container>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            expect(engine.getState('user.profile.name')).toBe('Ahmet');

            engine.setState('user.profile.name', 'Mehmet');
            expect(engine.getState('user.profile.name')).toBe('Mehmet');
            expect(container.querySelector('span').textContent).toBe('Mehmet');
        });

        it('should toggle boolean state via toggleState() method', () => {
            const xml = `
            <uid_spec>
                <data_model>
                    <state id="is_active" type="boolean">false</state>
                </data_model>
                <container><span>{data.is_active ? 'Active' : 'Inactive'}</span></container>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            expect(engine.getState('is_active')).toBe(false);

            engine.toggleState('is_active');
            expect(engine.getState('is_active')).toBe(true);
            expect(container.querySelector('span').textContent).toBe('Active');

            engine.toggleState('is_active');
            expect(engine.getState('is_active')).toBe(false);
            expect(container.querySelector('span').textContent).toBe('Inactive');
        });

        it('should handle array MUTATE_STATE POP, SHIFT, INSERT, UPDATE, TOGGLE operations', () => {
            const xml = `
            <uid_spec>
                <data_model>
                    <state id="list" type="array">
                        <item id="1" name="Item 1" />
                        <item id="2" name="Item 2" />
                        <item id="3" name="Item 3" />
                    </state>
                </data_model>
                <container><div/></container>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);

            // POP -> removes last element
            engine.mutateState('list', 'POP');
            expect(engine.getState('list').length).toBe(2);
            expect(engine.getState('list')[1].id).toBe('2');

            // SHIFT -> removes first element
            engine.mutateState('list', 'SHIFT');
            expect(engine.getState('list').length).toBe(1);
            expect(engine.getState('list')[0].id).toBe('2');

            // INSERT at index 0
            engine.mutateState('list', 'INSERT', { item: { id: '0', name: 'Inserted' }, index: 0 });
            expect(engine.getState('list')[0].id).toBe('0');

            // UPDATE matching where condition
            engine.mutateState('list', 'UPDATE', { where: { field: 'id', equals: '2' }, value: { id: '2', name: 'Updated Name' } });
            const item2 = engine.getState('list').find(i => i.id === '2');
            expect(item2.name).toBe('Updated Name');

            // Out of bounds SWAP should return gracefully without throwing
            expect(() => engine.mutateState('list', 'SWAP', { index1: -1, index2: 100 })).not.toThrow();
        });
    });

    describe('3. Two-Way Form Controls Data Binding', () => {
        it('should sync input, checkbox, and select controls reactively with state', async () => {
            const xml = `
            <uid_spec>
                <data_model>
                    <state id="username">Guest</state>
                    <state id="agree" type="boolean">false</state>
                    <state id="role">user</state>
                </data_model>
                <flex direction="column">
                    <input id="txt-user" bind="username" />
                    <input id="chk-agree" type="checkbox" bind="agree" />
                    <select id="sel-role" bind="role">
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                    </select>
                </flex>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const txtInput = container.querySelector('#txt-user');
            const chkInput = container.querySelector('#chk-agree');
            const selInput = container.querySelector('#sel-role');

            expect(txtInput.value).toBe('Guest');
            expect(chkInput.checked).toBe(false);
            expect(selInput.value).toBe('user');

            // Simulate user typing in input
            txtInput.value = 'Alice';
            txtInput.dispatchEvent(new Event('input', { bubbles: true }));
            expect(engine.getState('username')).toBe('Alice');

            // Simulate checkbox toggle
            chkInput.checked = true;
            chkInput.dispatchEvent(new Event('change', { bubbles: true }));
            expect(String(engine.getState('agree'))).toBe('true');

            // Simulate select change
            selInput.value = 'admin';
            selInput.dispatchEvent(new Event('change', { bubbles: true }));
            expect(engine.getState('role')).toBe('admin');
        });
    });

    describe('4. Lifecycle Hooks & Global Error Boundary', () => {
        it('should execute on_mount and on_state_change lifecycle hooks', async () => {
            const xml = `
            <uid_spec>
                <data_model>
                    <state id="mounted">false</state>
                    <state id="change_count">0</state>
                </data_model>

                <on_mount action="SET_STATE">
                    <path>data.mounted</path>
                    <value>true</value>
                </on_mount>

                <on_state_change key="mounted" action="RUN_SCRIPT">
                    $data.change_count = Number($data.change_count) + 1;
                </on_state_change>

                <container>
                    <span>Mounted: {data.mounted ? 'Yes' : 'No'}</span>
                </container>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            
            await new Promise(r => setTimeout(r, 20));

            expect(engine.getState('mounted')).toBe('true');
            expect(Number(engine.getState('change_count'))).toBe(1);
        });

        it('should trigger engine.onError global error boundary on uncaught errors', async () => {
            const errorSpy = vi.fn();

            const xml = `
            <uid_spec>
                <flex>
                    <button id="err-btn">
                        <on_click action="RUN_SCRIPT">
                            throw new Error("Triggered runtime error");
                        </on_click>
                        Fail
                    </button>
                </flex>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            engine.onError = errorSpy;

            const btn = container.querySelector('#err-btn');
            btn.click();

            expect(errorSpy).toHaveBeenCalledWith(
                expect.objectContaining({ message: 'Triggered runtime error' }),
                expect.stringContaining('Action Execution')
            );
        });
    });

    describe('5. API Configuration & Interceptors', () => {
        it('should apply request interceptors on API requests', async () => {
            const fakeFetch = vi.fn().mockResolvedValue({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: async () => ({ status: 'ok' })
            });
            vi.stubGlobal('fetch', fakeFetch);

            const xml = `
            <uid_spec>
                <api_config base_url="https://api.example.com">
                    <api_endpoint id="get_data" url="/data" method="GET" bind_target="res_data" auto_fetch="false" />
                </api_config>
                <container><div/></container>
            </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            engine.configureApi({
                onRequest: (req) => {
                    req.options.headers = req.options.headers || {};
                    req.options.headers['Authorization'] = 'Bearer token-123';
                }
            });

            await engine.revalidateApi('get_data');

            expect(fakeFetch).toHaveBeenCalledWith(
                'https://api.example.com/data',
                expect.objectContaining({
                    headers: expect.objectContaining({ Authorization: 'Bearer token-123' })
                })
            );

            vi.unstubAllGlobals();
        });
    });
});
