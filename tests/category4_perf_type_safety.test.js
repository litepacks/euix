import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXNavigatorPlugin } from "../src/plugins/EUIXNavigatorPlugin.js";
import { EUIXCollapsePlugin } from "../src/plugins/EUIXCollapsePlugin.js";
import { EUIXComposerPlugin } from "../src/plugins/EUIXComposerPlugin.js";

describe("Category 4 Performance & Type Safety Test Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    // -------------------------------------------------------------------------
    // 4.1 Navigator Plugin Batching
    // -------------------------------------------------------------------------
    describe("4.1 Navigator Plugin State Batching", () => {
        it("should initialize device state with batched updates", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="my_device" type="object">{}</state>
                    </data_model>
                    <navigator target="my_device" />
                    <p>Platform: {data.my_device.platform}</p>
                </uid_spec>
            `;
            const engine = EUIXEngineCore.use(EUIXNavigatorPlugin).mount(xml, container);
            const dev = engine.getState("my_device");
            expect(dev).not.toBeNull();
            expect(typeof dev).toBe("object");
            expect(engine.getState("$device")).toEqual(dev);
            expect(engine.getState("device")).toEqual(dev);
        });
    });

    // -------------------------------------------------------------------------
    // 4.2 Collapse Plugin Boolean State Integrity
    // -------------------------------------------------------------------------
    describe("4.2 Collapse Plugin Boolean State Preservation", () => {
        it("should toggle boolean state as native boolean rather than string", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="is_open" type="boolean">false</state>
                    </data_model>
                    <collapse bind="is_open" title="Accordion Section">
                        <p id="section-body">Accordion Body Content</p>
                    </collapse>
                </uid_spec>
            `;
            const engine = EUIXEngineCore.use(EUIXCollapsePlugin).mount(xml, container);
            expect(engine.getState("is_open")).toBe(false);

            const header = container.querySelector(".euix-collapse-header");
            expect(header).not.toBeNull();

            // Toggle Open
            header.click();
            expect(engine.getState("is_open")).toBe("true");

            // Toggle Close
            header.click();
            expect(engine.getState("is_open")).toBe("false");
        });
    });

    // -------------------------------------------------------------------------
    // 4.3 Composer Plugin Parameter Type Coercion
    // -------------------------------------------------------------------------
    describe("4.3 Composer Plugin Parameter Type Coercion", () => {
        it("should coerce parameters according to declared type (number, boolean, object)", async () => {
            const xml = `
                <uid_spec>
                    <actions>
                        <action_def name="CalculateTotal">
                            <param name="quantity" type="number" default="5" />
                            <param name="isMember" type="boolean" default="true" />
                            <step action="SET_STATE">
                                <path>data.qty</path>
                                <value>{args.quantity}</value>
                            </step>
                            <step action="SET_STATE">
                                <path>data.memberFlag</path>
                                <value>{args.isMember}</value>
                            </step>
                        </action_def>
                    </actions>
                    <data_model>
                        <state id="qty" type="number">0</state>
                        <state id="memberFlag" type="boolean">false</state>
                    </data_model>
                    <button id="calc-btn">
                        <on_click action="CalculateTotal">
                            <arg name="quantity">42</arg>
                            <arg name="isMember">false</arg>
                        </on_click>
                        Calculate
                    </button>
                </uid_spec>
            `;
            const engine = EUIXEngineCore.use(EUIXComposerPlugin).mount(xml, container);
            const btn = container.querySelector("#calc-btn");
            btn.click();

            await new Promise((r) => setTimeout(r, 20));

            expect(engine.getState("qty")).toBe(42);
            expect(typeof engine.getState("qty")).toBe("number");
            expect(engine.getState("memberFlag")).toBe(false);
            expect(typeof engine.getState("memberFlag")).toBe("boolean");
        });
    });
});
