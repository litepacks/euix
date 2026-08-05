import { describe, it, expect, beforeEach } from 'vitest';
import XUIEnginePkg from '../XUIEngine.js';

const XUIEngine = XUIEnginePkg.XUIEngine || XUIEnginePkg;
const XUIExpressionParser = XUIEnginePkg.XUIExpressionParser;

describe('XUIEngine Unit Tests', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
    });

    it('should mount basic XML spec into container', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="title" type="string">Merhaba XUI</state>
            </data_model>
            <flex direction="column" gap="16">
                <component type="title">{data.title}</component>
            </flex>
        </uid_spec>
        `;

        const engine = await XUIEngine.mount(xml, '#app');
        expect(engine).toBeDefined();

        const titleEl = document.querySelector('h2');
        expect(titleEl).not.toBeNull();
        expect(titleEl.textContent).toBe('Merhaba XUI');
    });

    it('should apply flexbox layout styles correctly', async () => {
        const xml = `
        <uid_spec>
            <flex direction="row" align="center" justify="between" gap="16">
                <component type="text">Flex Item</component>
            </flex>
        </uid_spec>
        `;

        await XUIEngine.mount(xml, '#app');
        const flexEl = document.querySelector('.xui-flex');

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

        await XUIEngine.mount(xml, '#app');
        const gridEl = document.querySelector('.xui-grid');

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

        const engine = await XUIEngine.mount(xml, '#app');
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

        const engine = await XUIEngine.mount(xml, '#app');
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

        const engine = await XUIEngine.mount(xml, '#app');
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

        await XUIEngine.mount(xml, '#app');
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

        await XUIEngine.mount(xml, '#app');
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

        const engine = await XUIEngine.mount(xml, '#app');
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

        const engine = await XUIEngine.mount(xml, '#app');
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

        const engine = await XUIEngine.mount(xml, '#app');

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

    it('should evaluate complex expression conditions correctly using XUIExpressionParser', () => {
        expect(XUIExpressionParser.eval('10 > 5', () => 0)).toBe(true);
        expect(XUIExpressionParser.eval('"active" == "active" && 5 < 10', () => 0)).toBe(true);
        expect(XUIExpressionParser.eval('length("hello") == 5', () => 0)).toBe(true);
        expect(XUIExpressionParser.eval('contains("apple pie", "apple")', () => 0)).toBe(true);
    });
});
