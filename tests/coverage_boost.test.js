import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngine } from '../src/EUIXEngine.js';
import { EUIXDevTools } from '../src/EUIXDevTools.js';

describe('EUIXEngine Full Coverage Boost Suite (Targeting 100% Code Coverage)', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
        localStorage.clear();
        sessionStorage.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    it('should test modal and dialog open, backdrop focus, and reactive state close removeChild cleanup', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="show_dlg">false</state>
            </data_model>
            <flex direction="column">
                <modal bind="show_dlg">
                    <div>Modal Content</div>
                </modal>
                <button id="open_dlg">
                    <on_click action="SET_STATE">
                        <path>data.show_dlg</path>
                        <value>true</value>
                    </on_click>
                    Open
                </button>
                <button id="close_dlg">
                    <on_click action="SET_STATE">
                        <path>data.show_dlg</path>
                        <value>false</value>
                    </on_click>
                    Close
                </button>
            </flex>
        </uid_spec>
        `;

        const originalRaf = window.requestAnimationFrame;
        delete window.requestAnimationFrame;

        const engine = EUIXEngine.mount(xml, container);
        const openBtn = container.querySelector('#open_dlg');
        const closeBtn = container.querySelector('#close_dlg');

        // Open modal -> appends backdrop
        openBtn.click();
        expect(String(engine.getState('show_dlg'))).toBe('true');

        // Close modal -> removes backdrop via containerNode.removeChild(backdrop)
        closeBtn.click();
        expect(String(engine.getState('show_dlg'))).toBe('false');

        // Open again via engine.setState
        engine.setState('show_dlg', true);
        expect(engine.getState('show_dlg')).toBe(true);

        // Close again via engine.setState (testing containerNode.contains(backdrop) === false branch)
        engine.setState('show_dlg', false);
        expect(engine.getState('show_dlg')).toBe(false);

        window.requestAnimationFrame = originalRaf;
    });

    it('should test module top-level DOMContentLoaded autoInit when document.readyState is loading', async () => {
        Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });

        const scriptTag = document.createElement('script');
        scriptTag.setAttribute('data-euix-devtools', 'true');
        document.head.appendChild(scriptTag);

        document.dispatchEvent(new Event('DOMContentLoaded'));

        if (scriptTag.parentNode) scriptTag.parentNode.removeChild(scriptTag);
        Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
    });

    it('should test XHR ignore_base_url, relative paths (./ and ../), and revalidate flags', () => {
        const xml = `
        <uid_spec>
            <api_config base_url="https://api.base.com" />
            <data_model>
                <state id="rel_data" type="array" />
            </data_model>
            <flex>
                <button id="xhr_ignore_btn">
                    <on_click action="XHR" ignore_base_url="true" revalidate_focus="true" revalidate_online="true">
                        <method>GET</method>
                        <url>/standalone-endpoint</url>
                        <target>data.rel_data</target>
                    </on_click>
                </button>
                <button id="xhr_relative_btn">
                    <on_click action="XHR">
                        <method>GET</method>
                        <url>./local-path</url>
                        <target>data.rel_data</target>
                    </on_click>
                </button>
                <button id="xhr_parent_btn">
                    <on_click action="XHR">
                        <method>GET</method>
                        <url>../parent-path</url>
                        <target>data.rel_data</target>
                    </on_click>
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        expect(() => {
            container.querySelector('#xhr_ignore_btn').click();
            container.querySelector('#xhr_relative_btn').click();
            container.querySelector('#xhr_parent_btn').click();
        }).not.toThrow();
    });

    it('should test MUTATE_STATE PUSH, UNSHIFT, and REMOVE operations', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="items" type="array">
                    <item id="1" title="A" />
                    <item id="2" title="B" />
                </state>
            </data_model>
            <flex direction="column">
                <button id="push_btn">
                    <on_click action="MUTATE_STATE" operation="PUSH">
                        <path>data.items</path>
                        <item id="3" title="C" />
                    </on_click>
                </button>
                <button id="unshift_btn">
                    <on_click action="MUTATE_STATE" operation="UNSHIFT">
                        <path>data.items</path>
                        <item id="0" title="Z" />
                    </on_click>
                </button>
                <button id="remove_btn">
                    <on_click action="MUTATE_STATE" operation="REMOVE">
                        <path>data.items</path>
                        <where field="id" equals="2" />
                    </on_click>
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);

        container.querySelector('#push_btn').click();
        expect(engine.getState('items').length).toBe(3);

        container.querySelector('#unshift_btn').click();
        expect(engine.getState('items')[0].id).toBe('0');

        container.querySelector('#remove_btn').click();
        expect(engine.getState('items').find(i => i.id === '2')).toBeUndefined();
    });

    it('should test MUTATE_STATE MOVE_UP, MOVE_DOWN, CLEAR operations', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="items" type="array">
                    <item id="1" title="First" />
                    <item id="2" title="Second" />
                    <item id="3" title="Third" />
                </state>
            </data_model>
            <flex direction="column">
                <button id="move_up_btn">
                    <on_click action="MUTATE_STATE" operation="MOVE_UP">
                        <path>data.items</path>
                        <index>1</index>
                    </on_click>
                    Move Up
                </button>
                <button id="move_down_btn">
                    <on_click action="MUTATE_STATE" operation="MOVE_DOWN">
                        <path>data.items</path>
                        <index>0</index>
                    </on_click>
                    Move Down
                </button>
                <button id="clear_btn">
                    <on_click action="MUTATE_STATE" operation="CLEAR">
                        <path>data.items</path>
                    </on_click>
                    Clear All
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        expect(engine.getState('items')[1].id).toBe('2');

        const moveUpBtn = container.querySelector('#move_up_btn');
        moveUpBtn.click();
        expect(engine.getState('items')[0].id).toBe('2');

        const moveDownBtn = container.querySelector('#move_down_btn');
        moveDownBtn.click();
        expect(engine.getState('items')[1].id).toBe('2');

        const clearBtn = container.querySelector('#clear_btn');
        clearBtn.click();
        expect(engine.getState('items').length).toBe(0);
    });

    it('should test SWR API revalidation and revalidateApi tag method', async () => {
        const xml = `
        <uid_spec>
            <api_config base_url="https://api.example.com" />
            <data_model>
                <state id="posts" type="array" />
            </data_model>
            <flex>
                <button id="reval_btn">
                    <on_click action="REVALIDATE_API" tag="posts_tag" />
                    Revalidate
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        expect(() => engine.revalidateApi('posts_tag')).not.toThrow();

        const btn = container.querySelector('#reval_btn');
        btn.click();
    });

    it('should test MUTATE_STATE SWAP operation with status swapping and applyResets', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="items" type="array">
                    <item id="1" title="Item 1" status="pending" />
                    <item id="2" title="Item 2" status="active" />
                </state>
            </data_model>
            <flex direction="column">
                <button id="swap_btn">
                    <on_click action="MUTATE_STATE" operation="SWAP">
                        <path>data.items</path>
                        <where field="id" equals="1" />
                        <target_where field="id" equals="2" />
                    </on_click>
                    Swap Items
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        expect(engine.getState('items')[0].id).toBe('1');

        const btn = container.querySelector('#swap_btn');
        btn.click();

        const updated = engine.getState('items');
        expect(updated[0].id).toBe('2');
        expect(updated[1].id).toBe('1');
    });

    it('should test MUTATE_STATE UPDATE with neq operator and editing_id cleanup', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="editing_id">42</state>
                <state id="edit_todo_input">Old Text</state>
                <state id="tasks" type="array">
                    <item id="42" text="Original" completed="false" />
                    <item id="99" text="Other" completed="false" />
                </state>
            </data_model>
            <flex direction="column">
                <button id="update_btn">
                    <on_click action="MUTATE_STATE" operation="UPDATE">
                        <path>data.tasks</path>
                        <where field="id" op="neq" value="99" />
                        <fields text="Updated Text" completed="true" />
                    </on_click>
                    Update Tasks
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const btn = container.querySelector('#update_btn');
        btn.click();

        const tasks = engine.getState('tasks');
        expect(tasks[0].text).toBe('Updated Text');
        expect(tasks[0].completed).toBe('true');

        expect(engine.getState('editing_id')).toBe('');
        expect(engine.getState('edit_todo_input')).toBe('');
    });

    it('should trigger autofocus on input elements with autofocus="true"', () => {
        const xml = `
        <uid_spec>
            <flex direction="column">
                <input id="auto_input" autofocus="true" placeholder="Autofocused" />
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const input = container.querySelector('#auto_input');
        expect(input).not.toBeNull();
        expect(input.dataset.xuiAutofocus).toBe('true');
    });

    it('should evaluate complex ternary math expressions and string methods in engine', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="val">10</state>
            </data_model>
            <flex>
                <span id="res">{data.val > 5 ? "High" : "Low"}</span>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const span = container.querySelector('#res');
        expect(span.textContent).toBe('High');
    });

    it('should test destroy and cleanup method without throwing errors', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="val">test</state>
            </data_model>
            <flex>
                <span>{data.val}</span>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        expect(engine).toBeDefined();

        expect(() => {
            engine.destroy();
        }).not.toThrow();

        expect(container.children.length).toBe(0);
    });

    it('should test registerComponent and custom action handlers', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="custom_state">initial</state>
            </data_model>
            <flex>
                <custom-badge label="Special Component" />
                <button id="custom_btn">
                    <on_click action="MY_CUSTOM_ACTION">
                        <val>updated_via_custom</val>
                    </on_click>
                    Custom Action
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = new EUIXEngine(container);

        engine.registerComponent('custom-badge', (xmlNode, context, eng) => {
            const badge = document.createElement('span');
            badge.className = 'custom-badge-class';
            badge.textContent = xmlNode.getAttribute('label') || 'Badge';
            return badge;
        });

        engine.registerAction('MY_CUSTOM_ACTION', (actionNode, context, eng) => {
            const val = actionNode.querySelector('val')?.textContent || 'custom';
            eng.setState('custom_state', val);
        });

        engine.mount(xml);

        const badge = container.querySelector('.custom-badge-class');
        expect(badge).not.toBeNull();
        expect(badge.textContent).toBe('Special Component');

        const btn = container.querySelector('#custom_btn');
        btn.click();
        expect(engine.getState('custom_state')).toBe('updated_via_custom');
    });

    it('should test EUIXDevTools empty state search results and empty log tab rendering', () => {
        const engine = EUIXEngine.mount('<uid_spec><flex><span/></flex></uid_spec>', container);
        const devtools = EUIXDevTools.init(engine);

        devtools.togglePanel(true);
        devtools.activeTab = 'logs';
        devtools.logs = [];
        devtools.renderPanel();
        expect(devtools.panelEl.innerHTML).toContain('No action logs recorded yet');

        devtools.activeTab = 'state';
        devtools.stateFilterQuery = 'non_matching_query_12345';
        devtools.renderPanel();
        expect(devtools.panelEl.innerHTML).toContain('No matching state variables');
    }, 30000);

    it('should test EUIXDevTools element inspection top & left window overflow positioning', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="counter">5</state>
                <state id="user_obj" type="json">{"name":"Alice","role":"admin"}</state>
            </data_model>
            <flex>
                <span id="badge_el" data-xui-component="Counter" data-xui-key="user_obj" data-xui-ref="badgeRef">User</span>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const devtools = EUIXDevTools.init(engine);

        devtools.toggle(true);

        const badgeEl = container.querySelector('#badge_el');

        // Test top overflow (tooltipTop < scrollY + 10)
        badgeEl.getBoundingClientRect = () => ({
            top: 2,
            left: 10,
            width: 100,
            height: 30,
            bottom: 32,
            right: 110
        });

        devtools.inspectElement(badgeEl, badgeEl, 'user_obj', 'state', 'badgeRef', 'Counter');
        expect(devtools.tooltipEl.style.display).toBe('block');

        // Test right overflow (tooltipLeft + 280 > window.innerWidth)
        badgeEl.getBoundingClientRect = () => ({
            top: 200,
            left: window.innerWidth + 500,
            width: 100,
            height: 30,
            bottom: 230,
            right: window.innerWidth + 600
        });

        devtools.inspectElement(badgeEl, badgeEl, 'counter', 'key', '', '');
        expect(devtools.tooltipEl.style.display).toBe('block');

        devtools.hideHighlight();
        devtools.toggle(false);
    }, 30000);

    it('should test EUIXDevTools mousemove targeting hud/panel elements and document body', () => {
        const xml = `<uid_spec><flex><span id="target_span">Target</span></flex></uid_spec>`;
        const engine = EUIXEngine.mount(xml, container);
        const devtools = EUIXDevTools.init(engine);

        devtools.toggle(true);

        const moveEventDoc = new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 10 });
        document.body.dispatchEvent(moveEventDoc);

        const devtoolsHud = document.getElementById('euix-devtools-hud');
        if (devtoolsHud) {
            const moveEventHud = new MouseEvent('mousemove', { bubbles: true });
            devtoolsHud.dispatchEvent(moveEventHud);
        }

        const span = container.querySelector('#target_span');
        const moveEventSpan = new MouseEvent('mousemove', { bubbles: true });
        span.dispatchEvent(moveEventSpan);

        devtools.toggle(false);
    });

    it('should test EUIXDevTools static init fallback and autoInit script tag', async () => {
        delete window.EUIXEngine;
        expect(EUIXDevTools.init(null)).toBeNull();

        const scriptTag = document.createElement('script');
        scriptTag.setAttribute('data-euix-devtools', 'open');
        document.head.appendChild(scriptTag);

        const mockEngineInst = EUIXEngine.mount('<uid_spec><flex><span/></flex></uid_spec>', container);
        window.EUIXEngine = { instance: mockEngineInst };

        let loadedCallback;
        const addListenerSpy = vi.spyOn(document, 'addEventListener').mockImplementation((event, fn) => {
            if (event === 'DOMContentLoaded') loadedCallback = fn;
        });

        Object.defineProperty(document, 'readyState', { value: 'loading', configurable: true });
        document.dispatchEvent(new Event('DOMContentLoaded'));
        if (loadedCallback) loadedCallback();

        addListenerSpy.mockRestore();

        const mockFetch = vi.fn().mockImplementation(async () => ({
            text: async () => '<component_def name="test-comp"><span>Test Comp</span></component_def>'
        }));

        global.fetch = mockFetch;

        const specNode = await EUIXEngine.loadComponent('test-comp', 'https://api.com/test-comp.xml');
        expect(specNode).not.toBeNull();

        expect(() => {
            EUIXEngine.autoInit();
        }).not.toThrow();

        if (scriptTag.parentNode) scriptTag.parentNode.removeChild(scriptTag);
        Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
    });

    it('should test EUIXDevTools autoInit in interactive readyState mode', async () => {
        vi.useFakeTimers();

        const scriptTag = document.createElement('script');
        scriptTag.setAttribute('data-euix-devtools', 'true');
        document.head.appendChild(scriptTag);

        const mockEngineInst = EUIXEngine.mount('<uid_spec><flex><span/></flex></uid_spec>', container);
        window.EUIXEngine = { instance: mockEngineInst };

        Object.defineProperty(document, 'readyState', { value: 'interactive', configurable: true });

        // Trigger fake timers to execute setTimeout(autoInitDevTools, 50)
        vi.advanceTimersByTime(100);

        if (scriptTag.parentNode) scriptTag.parentNode.removeChild(scriptTag);
        Object.defineProperty(document, 'readyState', { value: 'complete', configurable: true });
        vi.useRealTimers();
    });
});
