import { describe, it, expect, beforeEach } from 'vitest';
import { EUIXEngineCore } from '../src/core/EUIXEngineCore.js';
import { EUIXInspectorPlugin } from '../src/plugins/EUIXInspectorPlugin.js';
import { OverlayManager } from '../src/plugins/inspector/overlay.js';
import { InspectorPanel } from '../src/plugins/inspector/panel.js';

describe('Inspector Panel & Overlay Master Suite', () => {
    let container;

    beforeEach(() => {
        EUIXEngineCore.use(EUIXInspectorPlugin);
        container = document.createElement('div');
        document.body.appendChild(container);
    });

    it('should initialize inspector panel and overlay without crashing', () => {
        const overlay = new OverlayManager();
        expect(overlay).toBeDefined();

        const mockInspector = { engine: { getState: () => ({}) } };
        const panel = new InspectorPanel(mockInspector);
        expect(panel).toBeDefined();

        const dummyEl = document.createElement('button');
        dummyEl.textContent = 'Action Button';
        container.appendChild(dummyEl);

        if (overlay.highlight) {
            overlay.highlight(dummyEl);
        }
        if (overlay.clear) {
            overlay.clear();
        }
    });

    it('should test inspector plugin lifecycle and keyboard shortcuts', () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="count">1</state>
            </data_model>
            <div>
                <span id="counter">{data.count}</span>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine).toBeDefined();

        // Simulate Alt+I shortcut toggle
        const altIEvent = new KeyboardEvent('keydown', { key: 'i', altKey: true, bubbles: true });
        window.dispatchEvent(altIEvent);
    });
});
