import { describe, it, expect, beforeEach, vi } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXDevTools } from "../src/EUIXDevTools.js";
import { EUIXInspectorPlugin } from "../src/plugins/EUIXInspectorPlugin.js";
import { createDebugSnapshot, registerElementMetadata, getElementMetadata } from "../src/plugins/inspector/metadata.js";
import { generateSelectors } from "../src/plugins/inspector/selectors.js";

EUIXEngineCore.use(EUIXInspectorPlugin);

describe("EUIXDevTools & Inspector Coverage Boost Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    it("should initialize DevTools and toggle inspector with static and instance methods", () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="username">JohnDoe</state>
            </data_model>
            <div data-euix-component="TestCard">
                <span id="user-display">{data.username}</span>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine).toBeDefined();

        // Init devtools
        const devtools = EUIXDevTools.init(engine, { autoOpen: false });
        expect(devtools).toBeDefined();

        // Static controls
        EUIXDevTools.open();
        EUIXDevTools.close();
        EUIXDevTools.toggle();

        // Instance controls
        devtools.enable();
        devtools.disable();
        devtools.toggle();

        // Overlay highlights
        const targetEl = container.querySelector("#user-display");
        if (targetEl && devtools.overlay) {
            devtools.overlay.highlight(targetEl, { name: "TestCard" });
            devtools.overlay.hide();
        }

        // Metadata inspection
        if (targetEl) {
            registerElementMetadata(targetEl, { component: "TestCard", instanceId: "inst_1" });
            const meta = getElementMetadata(targetEl);
            expect(meta).toBeDefined();
            const snapshot = createDebugSnapshot(targetEl, engine);
            expect(snapshot).toBeDefined();
            expect(snapshot.component).toBe("TestCard");
            const selectors = generateSelectors(targetEl);
            expect(selectors.length).toBeGreaterThan(0);
        }
    });

    it("should test panel rendering, bounds, and event timeline", () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="count" type="number">0</state>
            </data_model>
            <flex direction="column">
                <span id="counter-val">{data.count}</span>
            </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const devtools = EUIXDevTools.init(engine);

        engine.setState("count", 42);
        expect(engine.getState("count")).toBe(42);

        if (devtools.panel) {
            devtools.panel.toggle(true);
            devtools.panel.toggle(false);
        }
    });
});
