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
});


