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
});




