import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXDialogPlugin } from "../src/plugins/EUIXDialogPlugin.js";
import { EUIXChartPlugin } from "../src/plugins/EUIXChartPlugin.js";

describe("Category 3 Lifecycle & Cleanup Test Suite", () => {
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
    // 3.1 Shared MutationObserver for on_unmount elements
    // -------------------------------------------------------------------------
    describe("3.1 Shared MutationObserver for on_unmount / on_destroy", () => {
        it("should trigger on_unmount action and disconnect shared observer on destroy", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="cleaned_up">false</state>
                    </data_model>
                    <container id="wrapper">
                        <div id="target-card">
                            <on_unmount action="SET_STATE">
                                <path>cleaned_up</path>
                                <value>true</value>
                            </on_unmount>
                            <span>Card Content</span>
                        </div>
                    </container>
                </uid_spec>
            `;
            const engine = EUIXEngineCore.mount(xml, container);
            expect(engine.getState("cleaned_up")).toBe("false");

            const targetCard = container.querySelector("#target-card");
            expect(targetCard).not.toBeNull();

            // Remove card from DOM
            targetCard.parentNode.removeChild(targetCard);

            // Wait for MutationObserver microtask
            await new Promise((r) => setTimeout(r, 60));

            expect(engine.getState("cleaned_up")).toBe("true");

            // Destroy engine and verify observer disconnect
            engine.destroy();
            expect(engine._sharedUnmountObserver).toBeNull();
            expect(engine._unmountTracked.size).toBe(0);
        });
    });

    // -------------------------------------------------------------------------
    // 3.2 EUIXDialogPlugin unmount cleanup & body scroll restore
    // -------------------------------------------------------------------------
    describe("3.2 Dialog Plugin Unmount Cleanup & Body Scroll Restore", () => {
        it("should restore document.body.style.overflow when engine is unmounted with active dialog", () => {
            const initialOverflow = document.body.style.overflow;

            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="is_dialog_open" type="boolean">true</state>
                    </data_model>
                    <dialog bind="is_dialog_open" title="Test Dialog" lock_scroll="true">
                        <p>Dialog Content</p>
                    </dialog>
                </uid_spec>
            `;
            const engine = EUIXEngineCore.use(EUIXDialogPlugin).mount(xml, container);

            // Dialog is open -> body overflow should be hidden
            expect(document.body.style.overflow).toBe("hidden");

            // Unmount engine
            engine.unmount();

            // Body scroll should be restored to initial value
            expect(document.body.style.overflow).toBe(initialOverflow || "");
        });
    });

    // -------------------------------------------------------------------------
    // 3.3 EUIXChartPlugin chart action resolution guard
    // -------------------------------------------------------------------------
    describe("3.3 Chart Plugin Action Resolution Guard", () => {
        it("should not mutate the first chart if a specified chart ID is not found", () => {
            const chart1 = {
                data: { datasets: [{ data: [10, 20] }] },
                update: vi.fn(),
                destroy: vi.fn(),
            };
            const chart2 = {
                data: { datasets: [{ data: [30, 40] }] },
                update: vi.fn(),
                destroy: vi.fn(),
            };

            const mockEngine = {
                _charts: new Map([
                    ["sales_chart", chart1],
                    ["users_chart", chart2],
                ]),
                executeChartAction: null,
            };

            EUIXChartPlugin.install({
                prototype: mockEngine,
            });

            // Action specifies non-existent chart
            const actionNode = {
                getAttribute: (k) => (k === "chart" ? "non_existent_chart" : null),
            };

            const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
            const result = mockEngine.executeChartAction("CHART_UPDATE", actionNode, {});

            expect(result).toBe(false);
            expect(chart1.update).not.toHaveBeenCalled();
            expect(chart2.update).not.toHaveBeenCalled();
            warnSpy.mockRestore();
        });
    });

    // -------------------------------------------------------------------------
    // 3.4 Watchers.js Map Cleanup on Unsubscribe
    // -------------------------------------------------------------------------
    describe("3.4 Watchers.js Map Key Cleanup", () => {
        it("should delete the key from _stateWatchers when all callbacks unsubscribe", () => {
            const engine = EUIXEngineCore.mount("<uid_spec><data_model><state id='count'>0</state></data_model></uid_spec>", container);

            const callback1 = vi.fn();
            const callback2 = vi.fn();

            const unwatch1 = engine.watch("count", callback1);
            const unwatch2 = engine.watch("count", callback2);

            expect(engine._stateWatchers.has("count")).toBe(true);
            expect(engine._stateWatchers.get("count").length).toBe(2);

            // Unsubscribe first
            unwatch1();
            expect(engine._stateWatchers.has("count")).toBe(true);
            expect(engine._stateWatchers.get("count").length).toBe(1);

            // Unsubscribe second
            unwatch2();
            expect(engine._stateWatchers.has("count")).toBe(false);
        });
    });
});
