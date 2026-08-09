import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { EUIXEngine } from '../src/EUIXEngine.js';

describe('DocPortalSection Tab Switching', () => {
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
    });

    it('should switch active_tab to docs when Documentation button is clicked', async () => {
        const xmlPath = path.resolve(process.cwd(), 'components/DocPortalSection.xml');
        const xmlContent = fs.readFileSync(xmlPath, 'utf8');

        const spec = `<uid_spec>
            ${xmlContent}
            <doc-portal-section />
        </uid_spec>`;

        const engine = EUIXEngine.mount(spec, container);
        await engine.preloadAsyncResources();
        expect(engine.getState('active_tab')).toBe('overview');

        const buttons = Array.from(container.querySelectorAll('button'));
        const docsBtn = buttons.find(b => b.textContent.includes('Documentation'));

        expect(docsBtn).toBeDefined();

        docsBtn.click();

        expect(engine.getState('active_tab')).toBe('docs');
        expect(container.textContent).toContain('What is EUIX Engine?');
        engine.unmount();
    }, 10000);
});
