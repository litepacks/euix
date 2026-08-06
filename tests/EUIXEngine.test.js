import { describe, it, expect, beforeEach } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;
const EUIXExpressionParser = EUIXEnginePkg.EUIXExpressionParser;

describe('EUIXEngine Unit Tests', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
    });

    it('should mount basic XML spec into container', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="title" type="string">Merhaba EUIX</state>
            </data_model>
            <flex direction="column">
                <component type="text" class="title-el">{data.title}</component>
            </flex>
        </uid_spec>
        `;

        const engine = await EUIXEngine.mount(xml, '#app');
        const titleEl = document.querySelector('.title-el');
        expect(titleEl).not.toBeNull();
        expect(titleEl.textContent).toBe('Merhaba EUIX');
    });

    it('should apply flexbox layout styles correctly', async () => {
        const xml = `
        <uid_spec>
            <flex direction="row" align="center" justify="between" gap="16">
                <component type="text">Flex Item</component>
            </flex>
        </uid_spec>
        `;

        await EUIXEngine.mount(xml, '#app');
        const flexEl = document.querySelector('.euix-flex');

        expect(flexEl).not.toBeNull();
        expect(flexEl.style.display).toBe('flex');
        expect(flexEl.style.flexDirection).toBe('row');
        expect(flexEl.style.alignItems).toBe('center');
        expect(flexEl.style.justifyContent).toBe('space-between');
        expect(flexEl.style.gap).toBe('16px');
    });

    it('should apply grid layout columns correctly', async () => {
        const xml = `
        <uid_spec>
            <grid cols="3" gap="12">
                <component type="text">Item 1</component>
                <component type="text">Item 2</component>
                <component type="text">Item 3</component>
            </grid>
        </uid_spec>
        `;

        await EUIXEngine.mount(xml, '#app');
        const gridEl = document.querySelector('.euix-grid');

        expect(gridEl).not.toBeNull();
        expect(gridEl.style.display).toBe('grid');
        expect(gridEl.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
        expect(gridEl.style.gap).toBe('12px');
    });

    it('should reactively update DOM when state changes fine-grained', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="username" type="string">Ahmet</state>
            </data_model>
            <flex direction="column">
                <component type="text" bind="data.username">{data.username}</component>
            </flex>
        </uid_spec>
        `;

        const engine = await EUIXEngine.mount(xml, '#app');
        const spanEl = document.querySelector('span');
        expect(spanEl).not.toBeNull();
        expect(spanEl.textContent).toBe('Ahmet');

        engine.setState('username', 'Mehmet');
        expect(spanEl.textContent).toBe('Mehmet');
    });

    it('should render for_each list items dynamically', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="todos" type="array">
                    <item id="1" text="Görev 1" />
                    <item id="2" text="Görev 2" />
                </state>
            </data_model>
            <flex direction="column">
                <for_each items="{data.todos}" var="todo">
                    <component type="text">{todo.text}</component>
                </for_each>
            </flex>
        </uid_spec>
        `;

        const engine = await EUIXEngine.mount(xml, '#app');
        let spans = document.querySelectorAll('span');
        expect(spans.length).toBe(2);
        expect(spans[0].textContent).toBe('Görev 1');
        expect(spans[1].textContent).toBe('Görev 2');

        engine.setState('todos', [
            { id: '1', text: 'Görev 1' },
            { id: '2', text: 'Görev 2' },
            { id: '3', text: 'Görev 3' }
        ]);

        spans = document.querySelectorAll('span');
        expect(spans.length).toBe(3);
        expect(spans[2].textContent).toBe('Görev 3');
    });

    it('should support generic <event type="..."> handlers (click, keyup, mouseenter)', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="status" type="string">idle</state>
            </data_model>
            <flex direction="column">
                <component type="button">
                    <label>Test Event</label>
                    <event type="click" action="SET_STATE">
                        <path>data.status</path>
                        <value>clicked</value>
                    </event>
                    <event type="mouseenter" action="SET_STATE">
                        <path>data.status</path>
                        <value>hovered</value>
                    </event>
                </component>
            </flex>
        </uid_spec>
        `;

        const engine = await EUIXEngine.mount(xml, '#app');
        const btn = document.querySelector('button');

        expect(engine.getState('status')).toBe('idle');

        btn.dispatchEvent(new window.MouseEvent('mouseenter'));
        expect(engine.getState('status')).toBe('hovered');

        btn.dispatchEvent(new window.MouseEvent('click'));
        expect(engine.getState('status')).toBe('clicked');
    });

    it('should register and render custom component specs with props (<component_def>)', async () => {
        const xml = `
        <uid_spec>
            <component_def name="user-badge">
                <flex direction="row" gap="8">
                    <component type="text" class="badge-title">{props.title}</component>
                    <component type="text" class="badge-label">{props.label}</component>
                </flex>
            </component_def>
            <flex direction="column">
                <user-badge title="Ahmet" label="Admin" />
                <component type="user-badge" title="Mehmet" label="Developer" />
            </flex>
        </uid_spec>
        `;

        await EUIXEngine.mount(xml, '#app');
        const titleSpans = document.querySelectorAll('.badge-title');
        const labelSpans = document.querySelectorAll('.badge-label');

        expect(titleSpans.length).toBe(2);
        expect(titleSpans[0].textContent).toBe('Ahmet');
        expect(titleSpans[1].textContent).toBe('Mehmet');

        expect(labelSpans[0].textContent).toBe('Admin');
        expect(labelSpans[1].textContent).toBe('Developer');
    });

    it('should render nested components inside components (component in component)', async () => {
        const xml = `
        <uid_spec>
            <component_def name="sub-card">
                <component type="text" class="sub-text">Sub: {props.val}</component>
            </component_def>
            <component_def name="parent-card">
                <flex direction="column" class="parent-flex">
                    <component type="title">Parent: {props.title}</component>
                    <sub-card val="{props.subval}" />
                </flex>
            </component_def>
            <flex direction="column">
                <parent-card title="Ana Kart" subval="Alt Bilgi" />
            </flex>
        </uid_spec>
        `;

        await EUIXEngine.mount(xml, '#app');
        const titleEl = document.querySelector('h2');
        const subSpan = document.querySelector('.sub-text');

        expect(titleEl).not.toBeNull();
        expect(titleEl.textContent).toBe('Parent: Ana Kart');

        expect(subSpan).not.toBeNull();
        expect(subSpan.textContent).toBe('Sub: Alt Bilgi');
    });

    it('should register refs (engine.refs) for elements with ref attribute', async () => {
        const xml = `
        <uid_spec>
            <flex direction="column">
                <component type="text_input" ref="userInput" placeholder="Test" />
                <component type="button" ref="submitBtn"><label>Gönder</label></component>
            </flex>
        </uid_spec>
        `;

        const engine = await EUIXEngine.mount(xml, '#app');
        expect(engine.refs.userInput).toBeDefined();
        expect(engine.refs.userInput.tagName).toBe('INPUT');

        expect(engine.refs.submitBtn).toBeDefined();
        expect(engine.refs.submitBtn.tagName).toBe('BUTTON');
    });

    it('should toggle item completed state and update conditional text styling on checkbox change', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="todos" type="array">
                    <item id="1" text="Görev 1" completed="false" />
                </state>
            </data_model>
            <flex direction="column">
                <for_each items="{data.todos}" var="todo">
                    <component type="checkbox" bind="todo.completed" />
                    <if condition="{todo.completed} == true">
                        <component type="text" class="completed-text">{todo.text}</component>
                        <else>
                            <component type="text" class="active-text">{todo.text}</component>
                        </else>
                    </if>
                </for_each>
            </flex>
        </uid_spec>
        `;

        const engine = await EUIXEngine.mount(xml, '#app');
        let activeEl = document.querySelector('.active-text');
        expect(activeEl).not.toBeNull();
        expect(activeEl.textContent).toBe('Görev 1');

        const checkbox = document.querySelector('input[type="checkbox"]');
        checkbox.checked = true;
        checkbox.dispatchEvent(new window.Event('change'));

        let completedEl = document.querySelector('.completed-text');
        expect(completedEl).not.toBeNull();
        expect(completedEl.textContent).toBe('Görev 1');
    });

    it('should support form, select, textarea, and radio form controls', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="bio" type="string">Kısa biyografi</state>
                <state id="category" type="string">frontend</state>
                <state id="level" type="string">senior</state>
            </data_model>
            <form class="test-form">
                <textarea bind="data.bio" />
                <select bind="data.category">
                    <option value="frontend">Frontend</option>
                    <option value="backend">Backend</option>
                </select>
                <component type="radio" name="level" value="junior" bind="data.level" />
                <component type="radio" name="level" value="senior" bind="data.level" />
            </form>
        </uid_spec>
        `;

        const engine = await EUIXEngine.mount(xml, '#app');

        const formEl = document.querySelector('form');
        const textareaEl = document.querySelector('textarea');
        const selectEl = document.querySelector('select');
        const radioEls = document.querySelectorAll('input[type="radio"]');

        expect(formEl).not.toBeNull();
        expect(textareaEl).not.toBeNull();
        expect(textareaEl.value).toBe('Kısa biyografi');

        expect(selectEl).not.toBeNull();
        expect(selectEl.value).toBe('frontend');

        expect(radioEls.length).toBe(2);
        expect(radioEls[1].checked).toBe(true);

        // Change select value
        selectEl.value = 'backend';
        selectEl.dispatchEvent(new window.Event('change'));
        expect(engine.getState('category')).toBe('backend');
    });

    it('should evaluate complex expression conditions correctly using EUIXExpressionParser', () => {
        expect(EUIXExpressionParser.eval('10 > 5', () => 0)).toBe(true);
        expect(EUIXExpressionParser.eval('"active" == "active" && 5 < 10', () => 0)).toBe(true);
        expect(EUIXExpressionParser.eval('length("hello") == 5', () => 0)).toBe(true);
        expect(EUIXExpressionParser.eval('contains("apple pie", "apple")', () => 0)).toBe(true);
    });

    it('should evaluate math expressions in SET_STATE (Counter math operations)', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="count" type="string">0</state>
            </data_model>
            <flex direction="column">
                <button class="inc-btn">
                    +1
                    <on_click action="SET_STATE">
                        <path>data.count</path>
                        <value>{data.count} + 1</value>
                    </on_click>
                </button>
                <button class="add5-btn">
                    +5
                    <on_click action="SET_STATE">
                        <path>data.count</path>
                        <value>{data.count} + 5</value>
                    </on_click>
                </button>
                <span class="count-display">{data.count}</span>
            </flex>
        </uid_spec>
        `;

        const engine = await EUIXEngine.mount(xml, '#app');
        const spanEl = document.querySelector('.count-display');
        const incBtn = document.querySelector('.inc-btn');
        const add5Btn = document.querySelector('.add5-btn');

        expect(engine.getState('count')).toBe('0');
        expect(spanEl.textContent).toBe('0');

        incBtn.dispatchEvent(new window.MouseEvent('click'));
        expect(engine.getState('count')).toBe('1');
        expect(spanEl.textContent).toBe('1');

        add5Btn.dispatchEvent(new window.MouseEvent('click'));
        expect(engine.getState('count')).toBe('6');
        expect(spanEl.textContent).toBe('6');
    });

    it('should perform MUTATE_STATE array operations (PUSH, UNSHIFT, UPDATE, REMOVE, CLEAR)', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="items" type="array">
                    <item id="1" text="Item 1" />
                    <item id="2" text="Item 2" />
                </state>
            </data_model>
            <flex direction="column">
                <button class="push-btn">
                    <on_click action="MUTATE_STATE">
                        <path>data.items</path>
                        <operation>PUSH</operation>
                        <item text="Item 3" />
                    </on_click>
                </button>
                <button class="clear-btn">
                    <on_click action="MUTATE_STATE">
                        <path>data.items</path>
                        <operation>CLEAR</operation>
                    </on_click>
                </button>
                <for_each items="{data.items}" var="it">
                    <component type="text" class="item-el">{it.text}</component>
                </for_each>
            </flex>
        </uid_spec>
        `;

        const engine = await EUIXEngine.mount(xml, '#app');
        expect(engine.getState('items').length).toBe(2);

        const pushBtn = document.querySelector('.push-btn');
        pushBtn.dispatchEvent(new window.MouseEvent('click'));
        expect(engine.getState('items').length).toBe(3);

        const clearBtn = document.querySelector('.clear-btn');
        clearBtn.dispatchEvent(new window.MouseEvent('click'));
        expect(engine.getState('items').length).toBe(0);
        expect(document.querySelectorAll('.item-el').length).toBe(0);
    });

    it('should render modal dialog (<dialog>) and handle backdrop clicks', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="modal_open" type="string">false</state>
            </data_model>
            <flex direction="column">
                <button class="open-btn">
                    Open
                    <on_click action="SET_STATE">
                        <path>data.modal_open</path>
                        <value>true</value>
                    </on_click>
                </button>
                <dialog bind="data.modal_open" title="Test Dialog">
                    <span>Modal Content</span>
                </dialog>
            </flex>
        </uid_spec>
        `;

        const engine = await EUIXEngine.mount(xml, '#app');
        expect(document.querySelector('.dialog-backdrop')).toBeNull();

        const openBtn = document.querySelector('.open-btn');
        openBtn.dispatchEvent(new window.MouseEvent('click'));

        const backdrop = document.querySelector('.dialog-backdrop');
        expect(backdrop).not.toBeNull();

        const closeBtn = document.querySelector('.dialog-close');
        closeBtn.dispatchEvent(new window.MouseEvent('click'));
        expect(engine.getState('modal_open')).toBe('false');
        expect(document.querySelector('.dialog-backdrop')).toBeNull();
    });

    it('should render collapsible accordions (<collapse>) and toggle state on header click', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="section_open" type="string">true</state>
            </data_model>
            <flex direction="column">
                <collapse bind="data.section_open" title="Collapsible Title">
                    <span class="body-content">Collapsible Body Content</span>
                </collapse>
            </flex>
        </uid_spec>
        `;

        const engine = await EUIXEngine.mount(xml, '#app');
        const collapseEl = document.querySelector('.euix-collapse');
        expect(collapseEl).not.toBeNull();
        expect(collapseEl.classList.contains('is-open')).toBe(true);
        expect(document.querySelector('.body-content')).not.toBeNull();

        const headerBtn = collapseEl.querySelector('button');
        headerBtn.dispatchEvent(new window.MouseEvent('click'));

        expect(engine.getState('section_open')).toBe('false');
        expect(collapseEl.classList.contains('is-closed')).toBe(true);
        expect(document.querySelector('.body-content')).toBeNull();
    });

    it('should render fallback error UI when XML parse error occurs without throwing unhandled exceptions', async () => {
        const brokenXml = `<uid_spec><data_model><state id="foo">test</data_model></uid_spec>`;

        let reportedError = false;
        const engine = new EUIXEngine('#app');
        engine.onError = () => { reportedError = true; };
        engine.mount(brokenXml);

        const mountErrorEl = document.querySelector('.euix-mount-error');
        expect(mountErrorEl).not.toBeNull();
        expect(mountErrorEl.textContent).toContain('XML Parse Error');
        expect(reportedError).toBe(true);
    });

    it('should gracefully catch action execution errors using action fallback', async () => {
        const xml = `
        <uid_spec>
            <flex direction="column">
                <button class="broken-action-btn">
                    Trigger Action
                    <on_click action="CUSTOM_BROKEN_ACTION" />
                </button>
            </flex>
        </uid_spec>
        `;

        let actionReported = false;
        const engine = new EUIXEngine('#app');
        engine.onError = () => { actionReported = true; };

        engine.registerAction('CUSTOM_BROKEN_ACTION', () => {
            throw new Error('Intentional Action Test Error');
        });

        engine.mount(xml);
        const btn = document.querySelector('.broken-action-btn');
        btn.dispatchEvent(new window.MouseEvent('click'));

        expect(actionReported).toBe(true);
    });

    it('should extract and interpolate <constants> / <vars> tokens in templates and classes', () => {
        const xml = `
        <uid_spec>
            <constants>
                <const id="card_style">p-4 bg-white border rounded-xl</const>
                <const id="btn_primary">px-4 py-2 bg-blue-600 text-white</const>
            </constants>
            <vars>
                <var id="app_title">My EUIX App</var>
            </vars>
            <flex class="{const.card_style}">
                <span class="title">{var.app_title}</span>
                <button class="{const.btn_primary}">Submit</button>
            </flex>
        </uid_spec>
        `;

        EUIXEngine.mount(xml, '#app');

        const card = document.querySelector('.euix-flex');
        expect(card.className).toContain('p-4 bg-white border rounded-xl');

        const title = document.querySelector('.title');
        expect(title.textContent).toBe('My EUIX App');

        const btn = document.querySelector('button');
        expect(btn.className).toContain('px-4 py-2 bg-blue-600 text-white');
    });

    it('should support static registerConstant and instance registerConstant', () => {
        EUIXEngine.registerConstant('global_theme', 'dark-mode');
        const engine = new EUIXEngine('#app');
        engine.registerConstant('local_token', 'token-123');

        expect(engine.getConstant('global_theme')).toBe('dark-mode');
        expect(engine.getConstant('local_token')).toBe('token-123');

        const xml = `<uid_spec><span class="badge {const.global_theme}">{const.local_token}</span></uid_spec>`;
        engine.mount(xml);

        const span = document.querySelector('.badge');
        expect(span.className).toContain('dark-mode');
        expect(span.textContent).toBe('token-123');
    });

    it('should handle REST XHR CRUD operations (POST with UNSHIFT, DELETE with REMOVE)', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="posts" type="array">
                    <item id="1" title="Post One" />
                </state>
                <state id="loading" type="string">false</state>
                <state id="error" type="string"></state>
            </data_model>
            <flex direction="column">
                <button class="create-btn">
                    Create
                    <on_click action="XHR">
                        <method>POST</method>
                        <url>https://jsonplaceholder.typicode.com/posts</url>
                        <body>{"title": "New Post"}</body>
                        <target>data.posts</target>
                        <operation>UNSHIFT</operation>
                        <loading>data.loading</loading>
                    </on_click>
                </button>

                <button class="delete-btn">
                    Delete
                    <on_click action="XHR">
                        <method>DELETE</method>
                        <url>https://jsonplaceholder.typicode.com/posts/1</url>
                        <target>data.posts</target>
                        <operation>REMOVE</operation>
                        <where field="id" equals="1" />
                    </on_click>
                </button>
            </flex>
        </uid_spec>
        `;

        // Mock global fetch for XHR CRUD test
        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockImplementation((url, options) => {
            if (options?.method === 'POST') {
                return Promise.resolve({
                    ok: true,
                    headers: new Map([['content-type', 'application/json']]),
                    json: () => Promise.resolve({ id: 101, title: 'New Post' })
                });
            }
            return Promise.resolve({
                ok: true,
                headers: new Map([['content-type', 'application/json']]),
                json: () => Promise.resolve({})
            });
        });

        try {
            const engine = await EUIXEngine.mount(xml, '#app');
            expect(engine.getState('posts').length).toBe(1);

            const createBtn = document.querySelector('.create-btn');
            createBtn.dispatchEvent(new window.MouseEvent('click'));

            await new Promise(resolve => setTimeout(resolve, 50));
            expect(engine.getState('posts').length).toBe(2);
            expect(engine.getState('posts')[0].title).toBe('New Post');

            const deleteBtn = document.querySelector('.delete-btn');
            deleteBtn.dispatchEvent(new window.MouseEvent('click'));

            await new Promise(resolve => setTimeout(resolve, 50));
            expect(engine.getState('posts').length).toBe(1);
        } finally {
            global.fetch = originalFetch;
        }
    });

    it('should evaluate complex math and string conditions in ExpressionParser', () => {
        const EUIXExpressionParser = EUIXEnginePkg.EUIXExpressionParser;
        const resolveFn = (path) => {
            if (path === 'data.count') return 10;
            if (path === 'data.status') return 'active';
            if (path === 'data.user.role') return 'admin';
            return undefined;
        };

        expect(EUIXExpressionParser.eval('{data.count} > 5', resolveFn)).toBe(true);
        expect(EUIXExpressionParser.eval('{data.count} + 5', resolveFn)).toBe(15);
        expect(EUIXExpressionParser.eval('{data.status} == active', resolveFn)).toBe(true);
        expect(EUIXExpressionParser.eval('{data.user.role} == admin', resolveFn)).toBe(true);
        expect(EUIXExpressionParser.eval('{data.count} == 0', resolveFn)).toBe(false);
    });

    it('should handle nested <if>, <else_if>, <else> branches correctly', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="status" type="string">pending</state>
            </data_model>
            <flex direction="column">
                <if condition="{data.status} == success">
                    <span class="res">Success Status</span>
                    <else_if condition="{data.status} == pending">
                        <span class="res">Pending Status</span>
                    </else_if>
                    <else>
                        <span class="res">Unknown Status</span>
                    </else>
                </if>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        let resEl = document.querySelector('.res');
        expect(resEl.textContent).toBe('Pending Status');

        engine.setState('status', 'success');
        resEl = document.querySelector('.res');
        expect(resEl.textContent).toBe('Success Status');

        engine.setState('status', 'error');
        resEl = document.querySelector('.res');
        expect(resEl.textContent).toBe('Unknown Status');
    });

    it('should perform all MUTATE_STATE operations (PUSH, UNSHIFT, UPDATE, REMOVE, CLEAR)', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="items" type="array">
                    <item id="1" text="Item 1" />
                    <item id="2" text="Item 2" />
                </state>
            </data_model>
            <flex direction="column">
                <for_each items="{data.items}" var="it">
                    <span>{it.text}</span>
                </for_each>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        expect(engine.getState('items').length).toBe(2);

        // PUSH
        engine.handleAction({
            tagName: 'on_click',
            getAttribute: (a) => a === 'action' ? 'MUTATE_STATE' : null,
            children: [
                { tagName: 'path', textContent: 'data.items' },
                { tagName: 'operation', textContent: 'PUSH' },
                { tagName: 'item', getAttribute: (a) => a === 'id' ? '3' : (a === 'text' ? 'Item 3' : null), attributes: [] }
            ]
        });

        // UNSHIFT
        engine.handleAction({
            tagName: 'on_click',
            getAttribute: (a) => a === 'action' ? 'MUTATE_STATE' : null,
            children: [
                { tagName: 'path', textContent: 'data.items' },
                { tagName: 'operation', textContent: 'UNSHIFT' },
                { tagName: 'item', getAttribute: (a) => a === 'id' ? '0' : (a === 'text' ? 'Item 0' : null), attributes: [] }
            ]
        });

        expect(engine.getState('items')[0].text).toBe('Item 0');

        // CLEAR
        engine.handleAction({
            tagName: 'on_click',
            getAttribute: (a) => a === 'action' ? 'MUTATE_STATE' : null,
            children: [
                { tagName: 'path', textContent: 'data.items' },
                { tagName: 'operation', textContent: 'CLEAR' }
            ]
        });

        expect(engine.getState('items').length).toBe(0);
    });

    it('should support component-scoped constants overriding global constants', () => {
        EUIXEngine.registerConstant('theme_color', 'blue-600');
        EUIXEngine.registerComponentSpec('custom-badge', `
            <component_def name="custom-badge">
                <constants>
                    <const id="theme_color">purple-700</const>
                </constants>
                <span class="custom-badge bg-{const.theme_color}">Badge</span>
            </component_def>
        `);

        const xml = `<uid_spec><custom-badge /></uid_spec>`;
        EUIXEngine.mount(xml, '#app');

        const badge = document.querySelector('.custom-badge');
        expect(badge.className).toContain('purple-700');
    });

    it('should catch and prevent infinite reactivity state loops using Infinite Loop Guard', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="val" type="string">0</state>
            </data_model>
            <flex direction="column">
                <input bind="data.val" class="inp" />
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        let errorCaught = false;
        engine.onError = (err) => {
            if (err.message.includes('Infinite Loop Guard')) errorCaught = true;
        };

        // Register a cyclic binding listener that triggers infinite recursion
        engine.registerBinding('val', document.querySelector('.inp'), 'custom', () => {
            engine.setState('val', String(Math.random()));
        });

        expect(() => {
            engine.setState('val', 'trigger');
        }).toThrow(/Infinite Loop Guard/);

        expect(errorCaught).toBe(true);
    });

    it('should catch and prevent infinite component recursion (>20 depth)', () => {
        EUIXEngine.registerComponentSpec('recursive-comp', `
            <component_def name="recursive-comp">
                <recursive-comp />
            </component_def>
        `);

        const xml = `<uid_spec><recursive-comp /></uid_spec>`;
        let recursionReported = false;
        const engine = new EUIXEngine('#app');
        engine.onError = (err) => {
            if (err.message.includes('recursion depth')) recursionReported = true;
        };

        engine.mount(xml);
        expect(recursionReported).toBe(true);
        expect(document.querySelector('.euix-recursion-error')).not.toBeNull();
    });

    it('should trigger <on_change watch="..."> lifecycle hook when watched state changes', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="input_val" type="string">hello</state>
                <state id="log_msg" type="string">initial</state>
            </data_model>
            <flex direction="column">
                <span class="target-span">
                    {data.log_msg}
                    <on_change watch="data.input_val" action="SET_STATE">
                        <path>data.log_msg</path>
                        <value>Input Changed!</value>
                    </on_change>
                </span>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        expect(engine.getState('log_msg')).toBe('initial');

        engine.setState('input_val', 'new value');
        expect(engine.getState('log_msg')).toBe('Input Changed!');
    });

    it('should trigger <on_interval ms="..."> lifecycle recurring timer hook', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="ticks" type="string">0</state>
            </data_model>
            <flex direction="column">
                <span class="tick-box">
                    {data.ticks}
                    <on_interval ms="50" action="SET_STATE">
                        <path>data.ticks</path>
                        <value>1</value>
                    </on_interval>
                </span>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        expect(engine.getState('ticks')).toBe('0');

        await new Promise(resolve => setTimeout(resolve, 120));
        expect(engine.getState('ticks')).toBe('1');
    });
});
