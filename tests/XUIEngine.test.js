import { describe, it, expect, beforeEach } from 'vitest';
import XUIEnginePkg from '../XUIEngine.js';

const XUIEngine = XUIEnginePkg.XUIEngine || XUIEnginePkg;
const XUIExpressionParser = XUIEnginePkg.XUIExpressionParser;

describe('XUIEngine Unit Tests', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
    });

    it('should mount basic XML spec into container', () => {
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

        const engine = XUIEngine.mount(xml, '#app');
        expect(engine).toBeDefined();

        const titleEl = document.querySelector('h2');
        expect(titleEl).not.toBeNull();
        expect(titleEl.textContent).toBe('Merhaba XUI');
    });

    it('should apply flexbox layout styles correctly', () => {
        const xml = `
        <uid_spec>
            <flex direction="row" align="center" justify="between" gap="16">
                <component type="text">Flex Item</component>
            </flex>
        </uid_spec>
        `;

        XUIEngine.mount(xml, '#app');
        const flexEl = document.querySelector('.xui-flex');

        expect(flexEl).not.toBeNull();
        expect(flexEl.style.display).toBe('flex');
        expect(flexEl.style.flexDirection).toBe('row');
        expect(flexEl.style.alignItems).toBe('center');
        expect(flexEl.style.justifyContent).toBe('space-between');
        expect(flexEl.style.gap).toBe('16px');
    });

    it('should apply grid layout columns correctly', () => {
        const xml = `
        <uid_spec>
            <grid cols="3" gap="12">
                <component type="text">Item 1</component>
                <component type="text">Item 2</component>
                <component type="text">Item 3</component>
            </grid>
        </uid_spec>
        `;

        XUIEngine.mount(xml, '#app');
        const gridEl = document.querySelector('.xui-grid');

        expect(gridEl).not.toBeNull();
        expect(gridEl.style.display).toBe('grid');
        expect(gridEl.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
        expect(gridEl.style.gap).toBe('12px');
    });

    it('should reactively update DOM when state changes fine-grained', () => {
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

        const engine = XUIEngine.mount(xml, '#app');
        const spanEl = document.querySelector('span');
        expect(spanEl).not.toBeNull();
        expect(spanEl.textContent).toBe('Ahmet');

        engine.setState('username', 'Mehmet');
        expect(spanEl.textContent).toBe('Mehmet');
    });

    it('should render for_each list items dynamically', () => {
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

        const engine = XUIEngine.mount(xml, '#app');
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

    it('should support generic <event type="..."> handlers (click, keyup, mouseenter)', () => {
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

        const engine = XUIEngine.mount(xml, '#app');
        const btn = document.querySelector('button');

        expect(engine.getState('status')).toBe('idle');

        btn.dispatchEvent(new window.MouseEvent('mouseenter'));
        expect(engine.getState('status')).toBe('hovered');

        btn.dispatchEvent(new window.MouseEvent('click'));
        expect(engine.getState('status')).toBe('clicked');
    });

    it('should evaluate complex expression conditions correctly using XUIExpressionParser', () => {
        expect(XUIExpressionParser.eval('10 > 5', () => 0)).toBe(true);
        expect(XUIExpressionParser.eval('"active" == "active" && 5 < 10', () => 0)).toBe(true);
        expect(XUIExpressionParser.eval('length("hello") == 5', () => 0)).toBe(true);
        expect(XUIExpressionParser.eval('contains("apple pie", "apple")', () => 0)).toBe(true);
    });
});
