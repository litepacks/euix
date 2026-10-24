/**
 * @file packages/core/tests/global_listener_teardown.test.js
 * Comprehensive verification suite for Item 3:
 * Global Event Listener Teardown, Container Delegation Lifecycle & Memory Leak Prevention.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXEngine } from "../src/EUIXEngine.js";
import { EUIXInspectorPlugin, EUIXInspector } from "../src/plugins/EUIXInspectorPlugin.js";
import { EUIXDevTools } from "../src/EUIXDevTools.js";
import { EUIXStoragePlugin } from "../src/plugins/EUIXStoragePlugin.js";
import { EUIXNavigatorPlugin } from "../src/plugins/EUIXNavigatorPlugin.js";
import { EUIXDragDropPlugin } from "../src/plugins/EUIXDragDropPlugin.js";
import { EUIXDialogPlugin } from "../src/plugins/EUIXDialogPlugin.js";

describe("Item 3: Global Object Event Listener Teardown & Delegation Cleanup Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        container.id = "test-app-root";
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container?.parentNode) {
            container.parentNode.removeChild(container);
        }
        document.body.innerHTML = "";
    });

    describe("1. Core Global Listener Primitive: addGlobalListener & Teardown", () => {
        it("should register, trigger, and manually remove global listener via returned cleanup function", () => {
            const engine = new EUIXEngineCore();
            engine._isMounted = true;

            const target = new EventTarget();
            let callCount = 0;
            const handler = () => {
                callCount++;
            };

            const cleanup = engine.addGlobalListener(target, "custom_event", handler);
            expect(engine._globalListeners.size).toBe(1);

            target.dispatchEvent(new Event("custom_event"));
            expect(callCount).toBe(1);

            // Manual cleanup
            cleanup();
            expect(engine._globalListeners.size).toBe(0);

            target.dispatchEvent(new Event("custom_event"));
            expect(callCount).toBe(1); // not incremented
        });

        it("should automatically detach all global listeners when engine.destroy() or unmount() is called", () => {
            const engine = new EUIXEngineCore();
            engine._isMounted = true;

            const target1 = new EventTarget();
            const target2 = new EventTarget();
            let count1 = 0;
            let count2 = 0;

            engine.addGlobalListener(target1, "ping", () => count1++);
            engine.addGlobalListener(target2, "pong", () => count2++);
            expect(engine._globalListeners.size).toBe(2);

            target1.dispatchEvent(new Event("ping"));
            target2.dispatchEvent(new Event("pong"));
            expect(count1).toBe(1);
            expect(count2).toBe(1);

            // Destroy engine
            engine.destroy();
            expect(engine._globalListeners.size).toBe(0);
            expect(engine._isMounted).toBe(false);

            // Events after destroy must not reach handlers
            target1.dispatchEvent(new Event("ping"));
            target2.dispatchEvent(new Event("pong"));
            expect(count1).toBe(1);
            expect(count2).toBe(1);
        });

        it("should safely refuse to attach global listeners when engine is already destroyed", () => {
            const engine = new EUIXEngineCore();
            engine._isMounted = false;

            const target = new EventTarget();
            let triggered = false;
            const cleanup = engine.addGlobalListener(target, "test", () => {
                triggered = true;
            });

            expect(typeof cleanup).toBe("function");
            target.dispatchEvent(new Event("test"));
            expect(triggered).toBe(false);
        });
    });

    describe("2. Container Event Delegation Teardown & Container Re-use", () => {
        it("should cleanly remove delegated container listeners on engine destroy without leaving closures", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="clicks" type="number">0</state>
                    </data_model>
                    <div id="inner">
                        <button id="btn" on_click:set="clicks={data.clicks + 1}">Click</button>
                    </div>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            engine._setupContainerEventDelegation(container);
            expect(container._delegatedBound).toBe(true);
            expect(container._delegatedEngine).toBe(engine);

            const btn = container.querySelector("#btn");
            btn.click();
            expect(engine.getState("clicks")).toBe(1);

            // Destroy engine
            engine.destroy();
            expect(container._delegatedBound).toBeUndefined();
            expect(container._delegatedEngine).toBeUndefined();
            expect(engine._delegatedCleanup).toBeNull();
            expect(engine._isMounted).toBe(false);

            // Subsequent click on detached or re-appended button must not trigger dead engine
            btn.click();
            expect(engine.getState("clicks")).toBe(1);
        });

        it("should seamlessly rebind delegation when mounting a new engine onto the same container", () => {
            const xml1 = `
                <uid_spec>
                    <data_model>
                        <state id="val1" type="string">first</state>
                    </data_model>
                    <button id="btn1" on_click:set="val1='updated1'">Btn1</button>
                </uid_spec>
            `;

            const xml2 = `
                <uid_spec>
                    <data_model>
                        <state id="val2" type="string">second</state>
                    </data_model>
                    <button id="btn2" on_click:set="val2='updated2'">Btn2</button>
                </uid_spec>
            `;

            const engine1 = EUIXEngineCore.mount(xml1, container);
            engine1._setupContainerEventDelegation(container);
            expect(container._delegatedEngine).toBe(engine1);

            const engine2 = EUIXEngineCore.mount(xml2, container);
            engine2._setupContainerEventDelegation(container);
            expect(container._delegatedEngine).toBe(engine2);

            const btn2 = container.querySelector("#btn2");
            btn2.click();
            expect(engine2.getState("val2")).toBe("updated2");

            engine2.destroy();
            expect(container._delegatedEngine).toBeUndefined();
        });

        it("should cleanly tear down container delegation on for_each list container upon engine destroy", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="items" type="array">[{"id": 1, "title": "Alpha"}]</state>
                        <state id="clicked" type="boolean">false</state>
                    </data_model>
                    <for_each items="{data.items}" var="item">
                        <button id="item-btn" on_click:set="clicked=true">{item.title}</button>
                    </for_each>
                </uid_spec>
            `;

            const engine = EUIXEngineCore.mount(xml, container);
            const forEachContainer = container.querySelector(".euix-for-each-container") || container.firstElementChild;
            expect(forEachContainer._delegatedBound).toBe(true);
            expect(forEachContainer._delegatedEngine).toBe(engine);

            engine.destroy();
            expect(forEachContainer._delegatedBound).toBeUndefined();
            expect(forEachContainer._delegatedEngine).toBeUndefined();
        });
    });

    describe("3. Inspector & DevTools Document Listener Teardown", () => {
        it("should register document listeners in EUIXInspector and detach them on destroy()", () => {
            const engine = new EUIXEngineCore();
            engine._isMounted = true;

            const addSpy = vi.spyOn(document, "addEventListener");
            const removeSpy = vi.spyOn(document, "removeEventListener");

            const inspector = new EUIXInspector(engine, { enabled: true });
            expect(addSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
            expect(addSpy).toHaveBeenCalledWith("click", expect.any(Function), true);
            expect(addSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

            // Destroy inspector
            inspector.destroy();
            expect(removeSpy).toHaveBeenCalledWith("mousemove", expect.any(Function));
            expect(removeSpy).toHaveBeenCalledWith("click", expect.any(Function), true);
            expect(removeSpy).toHaveBeenCalledWith("keydown", expect.any(Function));

            addSpy.mockRestore();
            removeSpy.mockRestore();
        });

        it("should automatically destroy devtools when engine with EUIXInspectorPlugin is unmounted", () => {
            const EngineWithInspector = class extends EUIXEngineCore {};
            EngineWithInspector.use(EUIXInspectorPlugin);

            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="title" type="string">App</state>
                    </data_model>
                    <div>{data.title}</div>
                </uid_spec>
            `;

            const engine = EngineWithInspector.mount(xml, container);
            expect(engine._devtools).toBeDefined();
            const devtools = engine._devtools;
            const destroySpy = vi.spyOn(devtools, "destroy");

            engine.destroy();
            expect(destroySpy).toHaveBeenCalled();
            expect(engine._devtools).toBeNull();
        });

        it("should bind devtools teardown when initialized via EUIXDevTools.init(engine)", () => {
            const engine = new EUIXEngineCore();
            engine._isMounted = true;

            const devtools = EUIXDevTools.init(engine, { autoOpen: false });
            expect(engine._devtools).toBe(devtools);
            const destroySpy = vi.spyOn(devtools, "destroy");

            engine.destroy();
            expect(destroySpy).toHaveBeenCalled();
            expect(engine._devtools).toBeNull();
        });
    });

    describe("4. Storage Plugin Global Listener Teardown", () => {
        it("should detach window storage listeners when engine is destroyed", () => {
            const EngineWithStorage = class extends EUIXEngineCore {};
            EngineWithStorage.use(EUIXStoragePlugin);

            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="theme" type="string">light</state>
                    </data_model>
                    <div>{data.theme}</div>
                </uid_spec>
            `;

            const addSpy = vi.spyOn(window, "addEventListener");
            const removeSpy = vi.spyOn(window, "removeEventListener");

            const engine = EngineWithStorage.mount(xml, container);
            engine.persist("theme", { storage: "local" });

            expect(addSpy).toHaveBeenCalledWith("storage", expect.any(Function));
            expect(addSpy).toHaveBeenCalledWith("euix:storage", expect.any(Function));

            engine.destroy();

            expect(removeSpy).toHaveBeenCalledWith("storage", expect.any(Function));
            expect(removeSpy).toHaveBeenCalledWith("euix:storage", expect.any(Function));
            expect(engine._storageCleanup).toBeNull();

            addSpy.mockRestore();
            removeSpy.mockRestore();
        });
    });

    describe("5. Navigator Plugin Teardown & Async Race Protection", () => {
        it("should clean up network listeners via addGlobalListener on unmount", () => {
            const EngineWithNav = class extends EUIXEngineCore {};
            EngineWithNav.use(EUIXNavigatorPlugin);

            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="device_info" type="object">{}</state>
                    </data_model>
                    <div>Online</div>
                </uid_spec>
            `;

            const addSpy = vi.spyOn(window, "addEventListener");
            const removeSpy = vi.spyOn(window, "removeEventListener");

            const engine = EngineWithNav.mount(xml, container);
            engine.initNavigatorState("device_info", { trackNetwork: true });

            expect(addSpy).toHaveBeenCalledWith("online", expect.any(Function));
            expect(addSpy).toHaveBeenCalledWith("offline", expect.any(Function));

            engine.destroy();

            expect(removeSpy).toHaveBeenCalledWith("online", expect.any(Function));
            expect(removeSpy).toHaveBeenCalledWith("offline", expect.any(Function));

            addSpy.mockRestore();
            removeSpy.mockRestore();
        });

        it("should not attach battery listeners if engine is unmounted before battery promise resolves", async () => {
            const EngineWithNav = class extends EUIXEngineCore {};
            EngineWithNav.use(EUIXNavigatorPlugin);

            let resolveBattery;
            const batteryPromise = new Promise((res) => {
                resolveBattery = res;
            });

            const mockBattery = {
                level: 0.9,
                charging: true,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
            };

            const origGetBattery = navigator.getBattery;
            navigator.getBattery = () => batteryPromise;

            try {
                const xml = `
                    <uid_spec>
                        <data_model>
                            <state id="device_info" type="object">{}</state>
                        </data_model>
                        <div>Battery</div>
                    </uid_spec>
                `;

                const engine = EngineWithNav.mount(xml, container);
                engine.initNavigatorState("device_info", { trackBattery: true });

                // Destroy engine BEFORE battery promise resolves
                engine.destroy();
                expect(engine._isMounted).toBe(false);

                // Now resolve battery
                resolveBattery(mockBattery);
                await batteryPromise;
                await new Promise((r) => setTimeout(r, 10));

                // Must NOT attach listener to mockBattery
                expect(mockBattery.addEventListener).not.toHaveBeenCalled();
            } finally {
                if (origGetBattery) {
                    navigator.getBattery = origGetBattery;
                } else {
                    delete navigator.getBattery;
                }
            }
        });
    });

    describe("6. DragDrop Plugin Teardown on Interrupted Drag", () => {
        it("should clean up ghost element and pointer listeners if engine unmounts during drag", () => {
            const EngineWithDnd = class extends EUIXEngineCore {};
            EngineWithDnd.use(EUIXDragDropPlugin);

            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="dragged_id" type="string"></state>
                    </data_model>
                    <div id="drag-item" data-drag-id="card-1">Drag Me</div>
                </uid_spec>
            `;

            const engine = EngineWithDnd.mount(xml, container);
            const item = container.querySelector("#drag-item");
            engine.enableDraggable(item, true);

            const addSpy = vi.spyOn(window, "addEventListener");
            const removeSpy = vi.spyOn(window, "removeEventListener");

            // Simulate pointerdown to start drag
            const pointerDownEvt = new MouseEvent("pointerdown", { bubbles: true });
            item.dispatchEvent(pointerDownEvt);

            expect(addSpy).toHaveBeenCalledWith("pointermove", expect.any(Function), { passive: true });
            expect(engine._activePointerDragTeardown).toBeDefined();

            // Unmount during active drag
            engine.destroy();

            expect(removeSpy).toHaveBeenCalledWith("pointermove", expect.any(Function));
            expect(engine._activePointerDragTeardown).toBeNull();

            addSpy.mockRestore();
            removeSpy.mockRestore();
        });
    });

    describe("7. Dialog Plugin Instance Isolation", () => {
        it("should maintain independent active dialog sets per engine instance without prototype sharing", () => {
            const EngineWithDialog = class extends EUIXEngineCore {};
            EngineWithDialog.use(EUIXDialogPlugin);

            const container1 = document.createElement("div");
            const container2 = document.createElement("div");
            document.body.appendChild(container1);
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="isOpen" type="boolean">true</state>
                    </data_model>
                    <dialog bind="isOpen">
                        <dialog_header>Title</dialog_header>
                        <dialog_content>Body</dialog_content>
                    </dialog>
                </uid_spec>
            `;

            const engine1 = EngineWithDialog.mount(xml, container1);
            const engine2 = EngineWithDialog.mount(xml, container2);

            expect(engine1._activeDialogs).not.toBe(engine2._activeDialogs);
            expect(engine1._activeDialogs.size).toBe(1);
            expect(engine2._activeDialogs.size).toBe(1);

            // Destroy engine1
            engine1.destroy();
            expect(engine1._activeDialogs.size).toBe(0);
            expect(engine2._activeDialogs.size).toBe(1); // engine2 unaffected

            engine2.destroy();
            expect(engine2._activeDialogs.size).toBe(0);

            container1.remove();
            container2.remove();
        });
    });
});
