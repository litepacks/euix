import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('Text Node Whitespace Preservation & Inline Tag Rendering Suite', () => {
    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should preserve spaces in inline text nodes between adjacent elements', () => {
        const xml = `
        <uid_spec>
            <div class="user-status-banner">
                <span>You are currently in </span><strong class="text-amber-300">Guest Mode</strong>.<br />
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const app = document.getElementById('app');
        const banner = app.querySelector('.user-status-banner');
        
        expect(banner).toBeTruthy();
        expect(banner.querySelector('span').textContent).toBe('You are currently in ');
        expect(banner.querySelector('strong').textContent).toBe('Guest Mode');
        expect(banner.querySelector('br')).toBeTruthy();
        expect(banner.textContent).toBe('You are currently in Guest Mode.');
    });

    it('should ignore pure whitespace/indentation nodes between XML block tags', () => {
        const xml = `
        <uid_spec>
            <div class="container">
                <div>First</div>
                <div>Second</div>
            </div>
        </uid_spec>
        `;

        EUIXEngine.mount(xml, '#app');
        const container = document.querySelector('.container');
        expect(container.childNodes.length).toBe(2);
        expect(container.children.length).toBe(2);
        expect(container.children[0].tagName).toBe('DIV');
        expect(container.children[1].tagName).toBe('DIV');
    });

    it('should support inline tags like br, hr, b, i, u, kbd, mark', () => {
        const xml = `
        <uid_spec>
            <p>
                <b>Bold</b> and <i>Italic</i> and <u>Underline</u><hr /><br />
            </p>
        </uid_spec>
        `;

        EUIXEngine.mount(xml, '#app');
        const p = document.querySelector('p');
        expect(p.querySelector('b')).toBeTruthy();
        expect(p.querySelector('i')).toBeTruthy();
        expect(p.querySelector('u')).toBeTruthy();
        expect(p.querySelector('hr')).toBeTruthy();
        expect(p.querySelector('br')).toBeTruthy();
        expect(p.textContent).toBe('Bold and Italic and Underline');
    });

    it('should reactively update text nodes in mixed content with sibling HTML elements', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="username">Alice</state>
                <state id="count">5</state>
            </data_model>
            <div class="card">
                <p class="mixed-text">Hello {data.username}, you have {data.count} <strong class="badge">unread</strong> alerts!</p>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const p = document.querySelector('.mixed-text');
        
        expect(p.innerHTML).toBe('Hello Alice, you have 5 <strong class="badge">unread</strong> alerts!');
        expect(p.textContent).toBe('Hello Alice, you have 5 unread alerts!');

        // Update username
        engine.setState('username', 'Bob');
        expect(p.innerHTML).toBe('Hello Bob, you have 5 <strong class="badge">unread</strong> alerts!');
        expect(p.textContent).toBe('Hello Bob, you have 5 unread alerts!');

        // Update count
        engine.setState('count', 12);
        expect(p.innerHTML).toBe('Hello Bob, you have 12 <strong class="badge">unread</strong> alerts!');
        expect(p.textContent).toBe('Hello Bob, you have 12 unread alerts!');
    });

    it('should correctly decode HTML named entities into Unicode symbols', () => {
        const xml = `
        <uid_spec>
            <footer class="site-footer">
                <p>Copyright &copy; 2026 &nbsp; &mdash; Litepacks &rarr; &check; &euro;50 &times; 2 &plusmn; 1 &bull; Star: &star;</p>
            </footer>
        </uid_spec>
        `;

        EUIXEngine.mount(xml, '#app');
        const footer = document.querySelector('.site-footer p');
        expect(footer).toBeTruthy();
        expect(footer.textContent).toBe('Copyright © 2026 \u00A0 — Litepacks → ✓ €50 × 2 ± 1 • Star: ☆');
    });

    it('should create SVG and its child tags in the SVG namespace with full attribute support', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="iconColor">#ef4444</state>
                <state id="radius">10</state>
            </data_model>
            <div class="icon-wrapper">
                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="{data.iconColor}" stroke-width="2">
                    <circle cx="12" cy="12" r="{data.radius}" fill="#3b82f6" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
                </svg>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const svg = document.querySelector('.icon-wrapper svg');
        const circle = svg.querySelector('circle');
        const path = svg.querySelector('path');

        expect(svg).toBeTruthy();
        expect(svg.namespaceURI).toBe('http://www.w3.org/2000/svg');
        expect(circle.namespaceURI).toBe('http://www.w3.org/2000/svg');
        expect(path.namespaceURI).toBe('http://www.w3.org/2000/svg');

        expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
        expect(svg.getAttribute('stroke')).toBe('#ef4444');
        expect(svg.getAttribute('stroke-width')).toBe('2');
        expect(circle.getAttribute('cx')).toBe('12');
        expect(circle.getAttribute('r')).toBe('10');
        expect(path.getAttribute('d')).toBe('M5 13l4 4L19 7');

        // Test reactive SVG attribute update
        engine.setState('iconColor', '#10b981');
        expect(svg.getAttribute('stroke')).toBe('#10b981');

        engine.setState('radius', 14);
        expect(circle.getAttribute('r')).toBe('14');
    });

    it('should correctly handle static and reactive boolean attributes without false-positives', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="isSaving" type="boolean">false</state>
                <state id="isHidden" type="boolean">false</state>
                <state id="isAgree" type="boolean">true</state>
                <state id="isDetailsOpen" type="boolean">false</state>
            </data_model>
            <div class="form-container">
                <button id="btn1" disabled="false">Normal Button</button>
                <button id="btn2" disabled="true">Disabled Button</button>
                <button id="btn3" disabled="{data.isSaving}">Saving Button</button>
                <div id="box1" hidden="false">Visible Box</div>
                <div id="box2" hidden="{data.isHidden}">Toggle Box</div>
                <input id="chk1" type="checkbox" checked="{data.isAgree}" />
                <details id="det1" open="{data.isDetailsOpen}">
                    <summary>More Info</summary>
                    <p>Details text</p>
                </details>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');

        const btn1 = document.getElementById('btn1');
        const btn2 = document.getElementById('btn2');
        const btn3 = document.getElementById('btn3');
        const box1 = document.getElementById('box1');
        const box2 = document.getElementById('box2');
        const chk1 = document.getElementById('chk1');
        const det1 = document.getElementById('det1');

        // Initial checks
        expect(btn1.hasAttribute('disabled')).toBe(false);
        expect(btn1.disabled).toBe(false);

        expect(btn2.hasAttribute('disabled')).toBe(true);
        expect(btn2.disabled).toBe(true);

        expect(btn3.hasAttribute('disabled')).toBe(false);
        expect(btn3.disabled).toBe(false);

        expect(box1.hasAttribute('hidden')).toBe(false);
        expect(box1.hidden).toBe(false);

        expect(box2.hasAttribute('hidden')).toBe(false);
        expect(box2.hidden).toBe(false);

        expect(chk1.hasAttribute('checked')).toBe(true);
        expect(chk1.checked).toBe(true);

        expect(det1.hasAttribute('open')).toBe(false);
        expect(det1.open).toBe(false);

        // Reactive state updates
        engine.setState('isSaving', true);
        expect(btn3.hasAttribute('disabled')).toBe(true);
        expect(btn3.disabled).toBe(true);

        engine.setState('isHidden', true);
        expect(box2.hasAttribute('hidden')).toBe(true);
        expect(box2.hidden).toBe(true);

        engine.setState('isAgree', false);
        expect(chk1.hasAttribute('checked')).toBe(false);
        expect(chk1.checked).toBe(false);

        engine.setState('isDetailsOpen', true);
        expect(det1.hasAttribute('open')).toBe(true);
        expect(det1.open).toBe(true);
    });

    it('should cleanly parse and evaluate unescaped operators in attributes and scripts', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="count" type="number">3</state>
                <state id="clicked" type="boolean">false</state>
            </data_model>
            <div id="test-div" class="{data.count < 5 ? 'under-limit' : 'over-limit'}">
                <button id="test-btn" disabled="{data.count < 5 && data.count > 0}">
                    <on_click action="RUN_SCRIPT">
                        if ($data.count <= 10 && $data.count > 0) {
                            $data.clicked = true;
                        }
                    </on_click>
                    Check
                </button>
                <a id="test-link" href="/items?page=1&limit=20&sort=desc">Items</a>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const div = document.getElementById('test-div');
        const btn = document.getElementById('test-btn');
        const link = document.getElementById('test-link');

        // Initial state
        expect(div.className).toBe('under-limit');
        expect(btn.hasAttribute('disabled')).toBe(true);
        expect(btn.disabled).toBe(true);
        expect(link.getAttribute('href')).toBe('/items?page=1&limit=20&sort=desc');

        // State update changing class and enabling button
        engine.setState('count', 10);
        expect(div.className).toBe('over-limit');
        expect(btn.hasAttribute('disabled')).toBe(false);
        expect(btn.disabled).toBe(false);

        // Script execution with < and && operators on enabled button
        btn.click();
        expect(engine.getState('clicked')).toBe(true);
    });

    it('should cleanly parse and render unclosed HTML5 void tags and bare valueless attributes', () => {
        const xml = `
        <uid_spec>
            <div class="card">
                <p id="msg">Line 1<br>Line 2<hr>Footer Note</p>
                <button id="b-disabled" disabled>Disabled</button>
                <input id="chk-checked" type="checkbox" checked />
                <details id="det-open" open>
                    <summary>More Info</summary>
                    <input id="txt-req" autofocus placeholder="Required field..." required>
                </details>
                <img id="avatar" src="/avatar.png">
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const p = document.getElementById('msg');
        const bDisabled = document.getElementById('b-disabled');
        const chkChecked = document.getElementById('chk-checked');
        const detOpen = document.getElementById('det-open');
        const txtReq = document.getElementById('txt-req');
        const img = document.getElementById('avatar');

        expect(p.querySelectorAll('br').length).toBe(1);
        expect(p.querySelectorAll('hr').length).toBe(1);
        expect(bDisabled.disabled).toBe(true);
        expect(chkChecked.checked).toBe(true);
        expect(detOpen.open).toBe(true);
        expect(txtReq.hasAttribute('required')).toBe(true);
        expect(txtReq.getAttribute('placeholder')).toBe('Required field...');
        expect(img.getAttribute('src')).toBe('/avatar.png');
    });

    it('should correctly format dynamic style objects/strings and support declarative event modifiers', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="themeColor">#3b82f6</state>
                <state id="cardStyle" type="object">{"backgroundColor": "#1e293b", "padding": "20px", "borderRadius": "10px", "--accent-glow": "0 0 10px #3b82f6"}</state>
                <state id="isSubmitted" type="boolean">false</state>
            </data_model>
            <div id="styled-card" style="{data.cardStyle}">
                <form id="test-form">
                    <button id="submit-btn" type="submit">
                        <on_click action="RUN_SCRIPT" prevent="true" stop="true">
                            $data.isSubmitted = true;
                        </on_click>
                        Submit
                    </button>
                </form>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const card = document.getElementById('styled-card');
        const btn = document.getElementById('submit-btn');

        // Style object verification
        const styleAttr = card.getAttribute('style');
        expect(styleAttr).toContain('background-color: #1e293b');
        expect(styleAttr).toContain('padding: 20px');
        expect(styleAttr).toContain('border-radius: 10px');
        expect(styleAttr).toContain('--accent-glow: 0 0 10px #3b82f6');

        // Update style state reactively
        engine.setState('cardStyle', { backgroundColor: '#0f172a', padding: '30px', borderRadius: '16px' });
        const updatedStyle = card.getAttribute('style');
        expect(updatedStyle).toContain('background-color: #0f172a');
        expect(updatedStyle).toContain('padding: 30px');
        expect(updatedStyle).toContain('border-radius: 16px');

        // Event modifier verification (prevent & stop on submit button inside form)
        let defaultPrevented = false;
        let propagationStopped = false;
        const fakeEvent = new Event('click', { bubbles: true, cancelable: true });
        const origPrevent = fakeEvent.preventDefault.bind(fakeEvent);
        const origStop = fakeEvent.stopPropagation.bind(fakeEvent);
        fakeEvent.preventDefault = () => { defaultPrevented = true; origPrevent(); };
        fakeEvent.stopPropagation = () => { propagationStopped = true; origStop(); };

        btn.dispatchEvent(fakeEvent);
        expect(defaultPrevented).toBe(true);
        expect(propagationStopped).toBe(true);
        expect(engine.getState('isSubmitted')).toBe(true);
    });

    it('should support JSON array state initialization and deep static/dynamic bracket indexing with reactivity', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="users" type="array">[{"name": "Alice", "city": "Istanbul"}, {"name": "Bob", "city": "London"}]</state>
                <state id="selectedIdx" type="number">1</state>
            </data_model>
            <div id="user-container">
                <p id="first-user">{data.users[0].name} from {data.users[0].city}</p>
                <p id="dynamic-user">{data.users[data.selectedIdx].name}</p>
                <span id="user-badge" data-city="{data.users[data.selectedIdx].city}">Active User</span>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const firstUser = document.getElementById('first-user');
        const dynamicUser = document.getElementById('dynamic-user');
        const badge = document.getElementById('user-badge');

        // Initial state
        expect(firstUser.textContent).toBe('Alice from Istanbul');
        expect(dynamicUser.textContent).toBe('Bob');
        expect(badge.getAttribute('data-city')).toBe('London');

        // Reactive index change
        engine.setState('selectedIdx', 0);
        expect(dynamicUser.textContent).toBe('Alice');
        expect(badge.getAttribute('data-city')).toBe('Istanbul');

        // Reactive array mutation
        engine.setState('users', [
            { name: 'Carol', city: 'Berlin' },
            { name: 'Dave', city: 'Tokyo' }
        ]);
        expect(firstUser.textContent).toBe('Carol from Berlin');
        expect(dynamicUser.textContent).toBe('Carol');
        expect(badge.getAttribute('data-city')).toBe('Berlin');
    });

    it('should support atomic object multi-state updates and deep bracket state mutations', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="users" type="array">[{"name": "Alice", "city": "Istanbul"}]</state>
                <state id="profile" type="object">{"first": "John", "last": "Doe"}</state>
                <state id="score" type="number">10</state>
            </data_model>
            <div id="stats">
                <span id="fullname">{data.profile.first} {data.profile.last}</span>
                <strong id="points">{data.score}</strong>
                <p id="first-user-name">{data.users[0].name}</p>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const fullname = document.getElementById('fullname');
        const points = document.getElementById('points');
        const firstUserName = document.getElementById('first-user-name');

        expect(fullname.textContent).toBe('John Doe');
        expect(points.textContent).toBe('10');
        expect(firstUserName.textContent).toBe('Alice');

        // 1. Atomic object setState
        engine.setState({
            'profile.first': 'Jane',
            'profile.last': 'Smith',
            'score': 100
        });

        expect(fullname.textContent).toBe('Jane Smith');
        expect(points.textContent).toBe('100');

        // 2. setStates helper
        engine.setStates({
            'score': 250
        });
        expect(points.textContent).toBe('250');

        // 3. Deep bracket indexing mutation
        engine.setState('users[0].name', 'Zeynep');
        expect(firstUserName.textContent).toBe('Zeynep');
    });

    it('should support named/default slots, two-way contenteditable binding, and deep state watchers', () => {
        const xml = `
        <uid_spec>
            <component_def name="modal-box">
                <div class="modal-card">
                    <div class="header">
                        <slot name="header"><h2>Default Title</h2></slot>
                    </div>
                    <div class="body">
                        <children />
                    </div>
                    <div class="footer">
                        <slot name="footer"><button class="btn-close">Close</button></slot>
                    </div>
                </div>
            </component_def>

            <data_model>
                <state id="docTitle">My Document</state>
                <state id="editorHtml"><strong>Hello World</strong></state>
                <state id="user" type="object">{"name": "Ahmet", "address": {"city": "Istanbul"}}</state>
            </data_model>

            <div id="main-container">
                <component type="modal-box">
                    <slot name="header">
                        <h1>Custom Header: {data.docTitle}</h1>
                    </slot>
                    <div contenteditable="true" bind="editorHtml" class="rich-editor"></div>
                    <slot name="footer">
                        <button id="save-btn">Save Document</button>
                    </slot>
                </component>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const header = document.querySelector('.header');
        const footer = document.querySelector('.footer');
        const editor = document.querySelector('.rich-editor');

        // 1. Slot projection verification
        expect(header.textContent.trim()).toBe('Custom Header: My Document');
        expect(footer.textContent.trim()).toBe('Save Document');
        expect(editor.innerHTML).toBe('<strong>Hello World</strong>');

        // Slot reactivity
        engine.setState('docTitle', 'Project Alpha');
        expect(header.textContent.trim()).toBe('Custom Header: Project Alpha');

        // 2. Two-way contenteditable verification
        editor.innerHTML = '<em>Edited by user</em>';
        editor.dispatchEvent(new Event('input'));
        expect(engine.getState('editorHtml')).toBe('<em>Edited by user</em>');

        engine.setState('editorHtml', '<span>New Remote Content</span>');
        expect(editor.innerHTML).toBe('<span>New Remote Content</span>');

        // 3. Deep state watcher verification
        let deepChangeReceived = null;
        engine.watch('user', (newVal, oldVal, changedPath) => {
            deepChangeReceived = { newVal, changedPath };
        });

        engine.setState('user.address.city', 'Izmir');
        expect(deepChangeReceived).toEqual({
            newVal: 'Izmir',
            changedPath: 'user.address.city'
        });
    });

    it('should generate accurate XML error code frames and return performance profiler metrics', () => {
        // 1. Code Frame Generator test
        const sampleXml = `<uid_spec>\n  <data_model>\n    <state id="x">0</state>\n  </data_model>\n  <unclosed>\n</uid_spec>`;
        const frame = EUIXEngineCore.generateCodeFrame(sampleXml, 5, 3);
        expect(frame).toContain('> 5 |   <unclosed>');
        expect(frame).toContain('^');

        // 2. XML Parse Error throwing
        const invalidXml = `<uid_spec>\n  <data_model>\n    <state id="a">1</state>\n  </data_model>\n  <broken_tag attr="val"\n</uid_spec>`;
        expect(() => {
            EUIXEngineCore.parseXmlToAst(invalidXml);
        }).toThrow();

        // 3. Performance & Profiler Metrics API
        const validXml = `
        <uid_spec>
            <data_model>
                <state id="counter">10</state>
            </data_model>
            <div>
                <span>Count: {data.counter}</span>
            </div>
        </uid_spec>
        `;
        const engine = EUIXEngine.mount(validXml, '#app');
        const metrics = engine.getPerformanceMetrics();
        expect(metrics).toBeDefined();
        expect(typeof metrics.mountDuration).toBe('number');
        expect(metrics.activeBindingsCount).toBeGreaterThanOrEqual(1);
        expect(metrics.astCache).toBeDefined();
        expect(metrics.astCache.hits).toBeDefined();
        expect(metrics.rawStateKeysCount).toBeGreaterThanOrEqual(1);

        const profilerData = engine.getProfilerData();
        expect(profilerData).toEqual(metrics);
    });
});






