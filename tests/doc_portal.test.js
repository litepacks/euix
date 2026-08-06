import { describe, it, expect, beforeEach } from 'vitest';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('DocPortalSection Tab Switching', () => {
    let EUIXEngine;

    beforeEach(async () => {
        const dom = new JSDOM('<!DOCTYPE html><html><body><div id="app"></div></body></html>', {
            url: 'http://localhost/'
        });
        global.window = dom.window;
        global.document = dom.window.document;
        global.Node = dom.window.Node;
        global.HTMLElement = dom.window.HTMLElement;
        global.navigator = dom.window.navigator;

        const engineModule = await import('../src/EUIXEngine.js');
        EUIXEngine = engineModule.EUIXEngine || engineModule.default;
    });

    it('should switch active_tab to docs when Documentation button is clicked', async () => {
        const xmlPath = path.resolve(process.cwd(), 'components/DocPortalSection.xml');
        const xmlContent = fs.readFileSync(xmlPath, 'utf8');

        const spec = `<uid_spec>
            ${xmlContent}
            <doc-portal-section />
        </uid_spec>`;

        const engine = await EUIXEngine.mount(spec, '#app');
        expect(engine.getState('active_tab')).toBe('overview');

        const buttons = Array.from(document.querySelectorAll('button'));
        const docsBtn = buttons.find(b => b.textContent.includes('Documentation'));

        expect(docsBtn).toBeDefined();

        docsBtn.click();

        expect(engine.getState('active_tab')).toBe('docs');
        expect(document.body.textContent).toContain('What is EUIX Engine?');
    });
});
