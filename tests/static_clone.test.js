import { describe, it, expect, beforeEach } from 'vitest';
import { EUIXEngine } from '../src/EUIXEngine.js';
import { isStaticSubtree } from '../src/core/renderer/DOMRenderer.js';
import { parseXmlToAst } from '../src/core/parser/AstParser.js';

describe('EUIXEngine Static Subtree Pre-Compilation & cloneNode Suite', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('should correctly identify static vs dynamic XML subtrees', () => {
        const doc = parseXmlToAst(`
            <root>
                <div id="static-box" class="p-4 bg-slate-800">
                    <span class="title">Static Header</span>
                    <p>Some constant description text.</p>
                </div>
                <div id="dynamic-box">
                    <span>{data.userName}</span>
                </div>
                <button id="dynamic-btn">
                    <on_click action="SET_STATE" path="data.count" value="1" />
                    Click Me
                </button>
            </root>
        `);

        const staticBox = doc.querySelector('#static-box');
        const dynamicBox = doc.querySelector('#dynamic-box');
        const dynamicBtn = doc.querySelector('#dynamic-btn');

        expect(isStaticSubtree(staticBox)).toBe(true);
        expect(isStaticSubtree(dynamicBox)).toBe(false);
        expect(isStaticSubtree(dynamicBtn)).toBe(false);
    });

    it('should mount static subtrees using _staticPrototype cloneNode and preserve exact structure', () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="user">Alice</state>
                </data_model>
                <flex direction="column" gap="16">
                    <div id="static-header" class="header p-4 bg-slate-900 border">
                        <span class="brand">EUIX Studio</span>
                        <span class="badge">v1.0</span>
                    </div>
                    <div id="dynamic-content">
                        <h2>Hello, {data.user}!</h2>
                    </div>
                </flex>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        const header = container.querySelector('#static-header');
        expect(header).not.toBeNull();
        expect(header.className).toContain('header');
        expect(header.querySelector('.brand').textContent).toBe('EUIX Studio');
        expect(header.querySelector('.badge').textContent).toBe('v1.0');

        const dynamicEl = container.querySelector('#dynamic-content h2');
        expect(dynamicEl.textContent).toBe('Hello, Alice!');

        // Update dynamic part
        engine.setState('user', 'Bob');
        expect(dynamicEl.textContent).toBe('Hello, Bob!');

        // Static part remains unchanged
        expect(header.querySelector('.brand').textContent).toBe('EUIX Studio');
    });

    it('should clone static components across multiple instances without state interference', () => {
        const xml = `
            <uid_spec>
                <component_def name="static-badge">
                    <div class="badge-box p-2 bg-slate-700 rounded">
                        <span class="badge-title">SYSTEM OK</span>
                    </div>
                </component_def>

                <flex direction="column">
                    <component name="static-badge" />
                    <component name="static-badge" />
                    <component name="static-badge" />
                </flex>
            </uid_spec>
        `;

        const engine = new EUIXEngine(container);
        engine.mount(xml);

        const badges = container.querySelectorAll('.badge-box');
        expect(badges.length).toBe(3);
        badges.forEach((b) => {
            expect(b.querySelector('.badge-title').textContent).toBe('SYSTEM OK');
        });
    });
});
