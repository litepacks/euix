/**
 * tests/core_engine_slots_and_templates.test.js
 * Comprehensive tests for EUIXEngineCore named slot projection, template compilation, script/style loaders, and flex/grid layout styles.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';

describe('EUIXEngineCore - Named Slots, Template Compilation & Resource Loaders', () => {
    let container;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'app';
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        vi.restoreAllMocks();
    });

    it('should test named and default slot projection with fallback content', () => {
        const xml = `
        <uid_spec>
            <component_def name="card-layout">
                <div class="card-box">
                    <header class="card-header">
                        <slot name="header">
                            <span>Default Header</span>
                        </slot>
                    </header>
                    <main class="card-body">
                        <children />
                    </main>
                    <footer class="card-footer">
                        <slot name="footer">
                            <small>Default Footer Copyright</small>
                        </slot>
                    </footer>
                </div>
            </component_def>

            <!-- Usage with projected slots -->
            <component name="card-layout">
                <div slot="header">
                    <h2>Custom Projected Title</h2>
                </div>
                <p>Main Body Content Here</p>
            </component>
        </uid_spec>
        `;

        EUIXEngineCore.mount(xml, container);

        const headerEl = container.querySelector('.card-header');
        expect(headerEl.textContent).toContain('Custom Projected Title');

        const bodyEl = container.querySelector('.card-body');
        expect(bodyEl.textContent).toContain('Main Body Content Here');

        const footerEl = container.querySelector('.card-footer');
        expect(footerEl.textContent).toContain('Default Footer Copyright');
    });

    it('should test fast template cloning and dynamic slot replacement in for_each', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="users" type="array">[
                    {"id": 1, "name": "Alice", "role": "Admin"},
                    {"id": 2, "name": "Bob", "role": "User"}
                ]</state>
            </data_model>
            <flex direction="column" class="user-list">
                <for_each items="{data.users}" var="u" key="id">
                    <div class="user-card">
                        <span class="user-name">{u.name}</span>
                        <span class="user-role">{u.role}</span>
                    </div>
                </for_each>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);

        let names = Array.from(container.querySelectorAll('.user-name')).map(el => el.textContent);
        expect(names).toEqual(['Alice', 'Bob']);

        // Mutate array -> pure append fast-path
        engine.mutateState('users', 'PUSH', { id: 3, name: 'Charlie', role: 'Guest' });
        await new Promise(r => setTimeout(r, 40));

        names = Array.from(container.querySelectorAll('.user-name')).map(el => el.textContent);
        expect(names).toEqual(['Alice', 'Bob', 'Charlie']);
    });

    it('should test <use_script> and <use_style> declarative resource loaders', () => {
        const appendChildSpy = vi.spyOn(document.head, 'appendChild');

        const xml = `
        <uid_spec>
            <use_script src="https://cdn.example.com/analytics.js" />
            <use_style href="https://cdn.example.com/theme.css" />
            <div>Resource Loader Test</div>
        </uid_spec>
        `;

        EUIXEngineCore.mount(xml, container);

        expect(appendChildSpy).toHaveBeenCalled();
        const scriptTags = Array.from(document.querySelectorAll('script[src*="analytics.js"]'));
        expect(scriptTags.length).toBeGreaterThanOrEqual(1);

        const styleTags = Array.from(document.querySelectorAll('link[href*="theme.css"]'));
        expect(styleTags.length).toBeGreaterThanOrEqual(1);
    });

    it('should apply flex and grid layout style attributes directly to element style', () => {
        const xml = `
        <uid_spec>
            <flex direction="column" gap="16" align="center" justify="between" class="main-flex">
                <grid columns="3" gap="8" class="main-grid">
                    <div>Col 1</div>
                    <div>Col 2</div>
                    <div>Col 3</div>
                </grid>
            </flex>
        </uid_spec>
        `;

        EUIXEngineCore.mount(xml, container);

        const flexEl = container.querySelector('.main-flex');
        expect(flexEl).not.toBeNull();
        expect(flexEl.style.display).toBe('flex');
        expect(flexEl.style.flexDirection).toBe('column');
        expect(flexEl.style.alignItems).toBe('center');

        const gridEl = container.querySelector('.main-grid');
        expect(gridEl).not.toBeNull();
        expect(gridEl.style.display).toBe('grid');
    });
});
