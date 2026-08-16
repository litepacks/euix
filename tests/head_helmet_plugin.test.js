import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import EUIXEnginePkg from '../src/EUIXEngine.js';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXHeadPlugin, EUIXHelmetPlugin } from '../src/plugins/EUIXHeadPlugin.js';

const EUIXEngine = EUIXEnginePkg.EUIXEngine || EUIXEnginePkg;

describe('EUIX Head & Helmet Plugin Suite', () => {
    let container;
    let originalTitle;

    beforeEach(() => {
        container = document.createElement('div');
        container.id = 'app';
        document.body.appendChild(container);
        originalTitle = document.title;
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        document.title = originalTitle;
        // Clean up any injected meta tags
        document.querySelectorAll('[data-euix-head="true"]').forEach(el => el.remove());
    });

    it('should set document.title declaratively from <head><title>', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="page_title">Dashboard Home</state>
            </data_model>
            <head>
                <title>{data.page_title} - EUIX App</title>
            </head>
            <flex class="p-4">
                <h1>Welcome to Dashboard</h1>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        expect(document.title).toBe('Dashboard Home - EUIX App');
    });

    it('should update document.title reactively when state changes', async () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="count">0</state>
            </data_model>
            <head>
                <title>Notifications ({data.count})</title>
            </head>
            <flex class="p-4">
                <button class="btn-inc">
                    <on_click action="SET_STATE">
                        <path>data.count</path>
                        <value>{data.count} + 1</value>
                    </on_click>
                    Add
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        expect(document.title).toBe('Notifications (0)');

        engine.setState('count', 5);
        expect(document.title).toBe('Notifications (5)');

        const btn = container.querySelector('.btn-inc');
        btn.click();
        expect(document.title).toBe('Notifications (6)');
    });

    it('should support <helmet> tag as an alias for <head>', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="view">Analytics</state>
            </data_model>
            <helmet>
                <title>Overview | {data.view}</title>
            </helmet>
            <flex>
                <span>Analytics View</span>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        expect(document.title).toBe('Overview | Analytics');

        engine.setState('view', 'Settings');
        expect(document.title).toBe('Overview | Settings');
    });

    it('should support direct <title> tag anywhere in layout', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="doc_name">Untitled Document</state>
            </data_model>
            <container class="editor">
                <title>{data.doc_name} • Editor</title>
                <p>Editor Content</p>
            </container>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        expect(document.title).toBe('Untitled Document • Editor');

        engine.setState('doc_name', 'Annual Report 2026');
        expect(document.title).toBe('Annual Report 2026 • Editor');
    });

    it('should manage reactive <meta> tags in document.head', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="description">Default description</state>
                <state id="og_title">Default OG Title</state>
            </data_model>
            <head>
                <meta name="description" content="{data.description}" />
                <meta property="og:title" content="{data.og_title}" />
            </head>
            <div>Page Body</div>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        
        const descMeta = document.head.querySelector('meta[name="description"][data-euix-head="true"]');
        expect(descMeta).not.toBeNull();
        expect(descMeta.getAttribute('content')).toBe('Default description');

        const ogMeta = document.head.querySelector('meta[property="og:title"][data-euix-head="true"]');
        expect(ogMeta).not.toBeNull();
        expect(ogMeta.getAttribute('content')).toBe('Default OG Title');

        // Update state reactively
        engine.setState('description', 'High performance XML UI framework');
        expect(descMeta.getAttribute('content')).toBe('High performance XML UI framework');
    });

    it('should support SET_TITLE action declaratively', () => {
        const xml = `
        <uid_spec>
            <flex>
                <button class="btn-change-title">
                    <on_click action="SET_TITLE">
                        <value>Updated from Action Button</value>
                    </on_click>
                    Change Title
                </button>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, '#app');
        const btn = container.querySelector('.btn-change-title');
        btn.click();

        expect(document.title).toBe('Updated from Action Button');
    });

    it('should work with modular Lite Core using EUIXEngineCore.use(EUIXHeadPlugin)', () => {
        const customCore = class extends EUIXEngineCore {};
        customCore.use(EUIXHeadPlugin);

        const xml = `
        <uid_spec>
            <data_model>
                <state id="status">Online</state>
            </data_model>
            <head>
                <title>Status: {data.status}</title>
            </head>
            <div>Core App</div>
        </uid_spec>
        `;

        const engine = customCore.mount(xml, container);
        expect(document.title).toBe('Status: Online');

        engine.setState('status', 'Busy');
        expect(document.title).toBe('Status: Busy');
    });
});
