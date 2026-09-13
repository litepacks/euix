import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EUIXEngine } from '../src/EUIXEngine.js';
import { scopeCSS } from '../src/core/renderer/DOMRenderer.js';

describe('EUIXEngine Style Tag & Scoped CSS Suite', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'app';
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container.parentNode) {
            container.parentNode.removeChild(container);
        }
        // Clean up any remaining test styles in head
        document.querySelectorAll('style[data-euix-scoped-for], style#test-style, style#reactive-style').forEach(el => el.remove());
    });

    it('should inject global <style> tag into document.head and apply to template elements', () => {
        const xml = `
            <uid_spec>
                <style id="test-style">
                    .custom-card {
                        background-color: rgb(30, 41, 59);
                        color: rgb(248, 250, 252);
                        padding: 16px;
                    }
                </style>
                <flex direction="column">
                    <div id="card" class="custom-card">Hello Styled EUIX</div>
                </flex>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        const injectedStyle = document.querySelector('style#test-style');
        expect(injectedStyle).not.toBeNull();
        expect(injectedStyle.textContent).toContain('.custom-card');

        const card = container.querySelector('#card');
        expect(card).not.toBeNull();
        expect(card.classList.contains('custom-card')).toBe(true);

        engine.destroy();
        expect(document.querySelector('style#test-style')).toBeNull();
    });

    it('should support scopeCSS utility with :host, child selectors, and media queries', () => {
        const rawCSS = `
            :host { display: block; }
            .btn, span.label { color: red; }
            div > p { margin: 0; }
            @media (min-width: 768px) {
                .btn { font-size: 18px; }
            }
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;

        const scoped = scopeCSS(rawCSS, '[data-euix-scope="c123"]');

        expect(scoped).toContain('[data-euix-scope="c123"] { display: block; }');
        expect(scoped).toContain('[data-euix-scope="c123"] .btn, [data-euix-scope="c123"].btn');
        expect(scoped).toContain('[data-euix-scope="c123"] span.label, [data-euix-scope="c123"]span.label');
        expect(scoped).toContain('[data-euix-scope="c123"] div > p, [data-euix-scope="c123"]div > p');
        expect(scoped).toContain('@media (min-width: 768px)');
        expect(scoped).toContain('@keyframes fadeIn');
    });

    it('should scope component styles with scoped="true" and attach data-euix-scope to component', () => {
        const xml = `
            <uid_spec>
                <component_def name="user-badge" isolated="true">
                    <style scoped="true">
                        .badge-box {
                            background: #0f172a;
                            border-radius: 8px;
                        }
                        :host {
                            display: inline-flex;
                        }
                    </style>
                    <div class="badge-box">
                        <span class="user-text">John Doe</span>
                    </div>
                </component_def>

                <flex direction="column">
                    <component name="user-badge" />
                </flex>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        const badgeWrapper = container.querySelector('[data-euix-component="user-badge"]');
        expect(badgeWrapper).not.toBeNull();

        const scopeId = badgeWrapper.getAttribute('data-euix-scope') || badgeWrapper.getAttribute('data-euix-instance');
        expect(scopeId).toBeTruthy();

        const scopedStyle = document.querySelector(`style[data-euix-scoped-for="${scopeId}"]`);
        expect(scopedStyle).not.toBeNull();
        expect(scopedStyle.textContent).toContain(`[data-euix-scope="${scopeId}"]`);
        expect(scopedStyle.textContent).toContain('.badge-box');

        engine.destroy();
        expect(document.querySelector(`style[data-euix-scoped-for="${scopeId}"]`)).toBeNull();
    });

    it('should reactively update CSS expressions when bound state variables change', () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="themeColor">#ef4444</state>
                    <state id="padSize" type="number">20</state>
                </data_model>

                <style id="reactive-style">
                    .dynamic-theme {
                        background-color: {data.themeColor};
                        padding: {data.padSize}px;
                    }
                </style>

                <flex direction="column">
                    <div id="target" class="dynamic-theme">Reactive Themed Box</div>
                </flex>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        const styleEl = document.querySelector('style#reactive-style');
        expect(styleEl).not.toBeNull();
        expect(styleEl.textContent).toContain('background-color: #ef4444;');
        expect(styleEl.textContent).toContain('padding: 20px;');

        // Update state
        engine.setState('themeColor', '#10b981');
        engine.setState('padSize', 32);

        expect(styleEl.textContent).toContain('background-color: #10b981;');
        expect(styleEl.textContent).toContain('padding: 32px;');

        engine.destroy();
        expect(document.querySelector('style#reactive-style')).toBeNull();
    });

    it('should parse and protect raw CSS containing special characters (<, >, &) without XML parse errors', () => {
        const xml = `
            <uid_spec>
                <style id="special-chars-style">
                    div > span & {
                        color: #6366f1;
                    }
                    p:has(> a) {
                        text-decoration: underline;
                    }
                </style>
                <flex direction="column">
                    <div>
                        <span>Special CSS Character Test</span>
                    </div>
                </flex>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        expect(() => engine.mount(xml)).not.toThrow();

        const styleEl = document.querySelector('style#special-chars-style');
        expect(styleEl).not.toBeNull();
        expect(styleEl.textContent).toContain('div > span');

        engine.destroy();
    });

    it('should load external stylesheets when src attribute is present on <style>', () => {
        let loadedHref = null;
        const xml = `
            <uid_spec>
                <style src="https://cdn.example.com/theme.css" />
                <div class="content">Content</div>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.loadStyle = (href) => {
            loadedHref = href;
        };

        engine.mount(xml);
        expect(loadedHref).toBe('https://cdn.example.com/theme.css');

        engine.destroy();
    });
});
