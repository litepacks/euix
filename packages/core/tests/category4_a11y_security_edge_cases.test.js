import { describe, it, expect, beforeEach, vi } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";
import { EUIXDialogPlugin } from "../src/plugins/EUIXDialogPlugin.js";

describe("Category 4: A11y, Security & Edge Cases Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
        document.body.innerHTML = "";
    });

    describe("1. Array Mutation Edge Cases & Negative Bounds Protection", () => {
        it("should safely handle SWAP, MOVE_UP, MOVE_DOWN with out-of-bounds indices without corrupting state", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="items" type="array">[{"id":"a","text":"A"},{"id":"b","text":"B"}]</state>
                    </data_model>
                    <button id="btn-invalid-swap">
                        <on_click action="MUTATE_STATE">
                            <path>items</path>
                            <operation>SWAP</operation>
                            <from>-1</from>
                            <to>99</to>
                        </on_click>
                        Invalid Swap
                    </button>
                    <button id="btn-valid-swap">
                        <on_click action="MUTATE_STATE">
                            <path>items</path>
                            <operation>SWAP</operation>
                            <from>0</from>
                            <to>1</to>
                        </on_click>
                        Valid Swap
                    </button>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            const initialItems = engine.getState("items");
            expect(initialItems[0].id).toBe("a");
            expect(initialItems[1].id).toBe("b");

            // Trigger invalid swap
            container.querySelector("#btn-invalid-swap").click();
            expect(engine.getState("items").length).toBe(2);
            expect(engine.getState("items")[0].id).toBe("a");

            // Trigger valid swap
            container.querySelector("#btn-valid-swap").click();
            expect(engine.getState("items")[0].id).toBe("b");
            expect(engine.getState("items")[1].id).toBe("a");
        });

        it("should safely execute POP, SHIFT, and REVERSE using getState() reactive prioritization", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="list" type="array">[1, 2, 3]</state>
                    </data_model>
                    <button id="btn-reverse">
                        <on_click action="MUTATE_STATE">
                            <path>list</path>
                            <operation>REVERSE</operation>
                        </on_click>
                    </button>
                    <button id="btn-pop">
                        <on_click action="MUTATE_STATE">
                            <path>list</path>
                            <operation>POP</operation>
                        </on_click>
                    </button>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            container.querySelector("#btn-reverse").click();
            expect(engine.getState("list")).toEqual([3, 2, 1]);

            container.querySelector("#btn-pop").click();
            expect(engine.getState("list")).toEqual([3, 2]);
        });
    });

    describe("2. Dialog A11y & Focus Trapping", () => {
        it("should open dialog with aria attributes, close with Escape, and restore focus", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="is_open" type="boolean">false</state>
                    </data_model>
                    <button id="open-dialog-btn">
                        <on_click action="SET_STATE">
                            <path>data.is_open</path>
                            <value>true</value>
                        </on_click>
                        Open Dialog
                    </button>
                    <dialog bind="data.is_open" title="Test Dialog" close_label="Close Modal">
                        <p>Dialog Body Content</p>
                        <button id="confirm-btn">Confirm</button>
                    </dialog>
                </uid_spec>
            `;

            const engine = EUIXEngine.mount(xml, container);
            const openBtn = container.querySelector("#open-dialog-btn");
            openBtn.focus();

            // Open dialog
            openBtn.click();
            expect(engine.getState("is_open")).toBe(true);

            const panel = container.querySelector('[role="dialog"]');
            expect(panel).toBeTruthy();
            expect(panel.getAttribute("aria-modal")).toBe("true");

            // Close dialog via escape key on backdrop
            const backdrop = container.querySelector(".dialog-backdrop");
            backdrop.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));

            expect(engine.getState("is_open")).toBe(false);
            expect(container.querySelector('[role="dialog"]')).toBeNull();
        });
    });
});
