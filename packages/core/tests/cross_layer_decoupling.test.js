import { describe, it, expect, vi, beforeEach } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { _handleActionInternal } from "../src/core/actions/ActionDispatcher.js";
import {
    _handleUndoStateAction,
    _handleRedoStateAction,
    _handleTakeSnapshotAction,
} from "../src/core/actions/BuiltInActions.js";

describe("Cross-Layer Decoupling & Hook Bridges", () => {
    let engine;

    beforeEach(() => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="count" type="number">10</state>
                </data_model>
                <container></container>
            </uid_spec>
        `;
        const container = document.createElement("div");
        engine = EUIXEngineCore.mount(xml, container);
    });

    it("should dispatch devtools:errorScope hook events on try-catch-finally blocks", async () => {
        const events = [];
        engine.hooks.on("devtools:errorScope", (payload) => {
            events.push(payload);
        });

        const tryXml = `
            <try>
                <on_click action="SET_STATE">
                    <path>count</path>
                    <value>20</value>
                </on_click>
            </try>
        `;
        const parser = new DOMParser();
        const tryDoc = parser.parseFromString(tryXml, "text/xml");
        const tryNode = tryDoc.documentElement;

        await _handleActionInternal(engine, tryNode, { _componentName: "TestComponent" });

        expect(engine.getState("count")).toBe(20);
        expect(events.length).toBeGreaterThanOrEqual(2);
        expect(events[0].eventType).toBe("TRY_ENTER");
        expect(events[1].eventType).toBe("TRY_SUCCESS");
    });

    it("should route undo/redo/takeSnapshot through engine.history if present", () => {
        const mockHistory = {
            undo: vi.fn(() => true),
            redo: vi.fn(() => true),
            takeSnapshot: vi.fn((label) => `snap-${label}`),
        };

        engine.history = mockHistory;

        const undoNode = document.createElement("on_click");
        undoNode.setAttribute("action", "UNDO_STATE");
        expect(_handleUndoStateAction.call(engine, undoNode, {})).toBe(true);
        expect(mockHistory.undo).toHaveBeenCalledTimes(1);

        const redoNode = document.createElement("on_click");
        redoNode.setAttribute("action", "REDO_STATE");
        expect(_handleRedoStateAction.call(engine, redoNode, {})).toBe(true);
        expect(mockHistory.redo).toHaveBeenCalledTimes(1);

        const snapNode = document.createElement("on_click");
        snapNode.setAttribute("action", "TAKE_SNAPSHOT");
        snapNode.setAttribute("label", "Checkpoint 1");
        expect(_handleTakeSnapshotAction.call(engine, snapNode, {})).toBe("snap-Checkpoint 1");
        expect(mockHistory.takeSnapshot).toHaveBeenCalledWith("Checkpoint 1");
    });

    it("should throw informative error when mounting IR without registered adapter", () => {
        // Ensure adapter is undefined
        const prevAdapter = EUIXEngineCore.irAdapter;
        EUIXEngineCore.irAdapter = null;
        if (typeof globalThis !== "undefined") delete globalThis.__EUIX_IR_ADAPTER__;

        const irApp = { irVersion: 1, states: [] };
        const container = document.createElement("div");

        expect(() => EUIXEngineCore.mount(irApp, container)).toThrow(
            /Mounting a Runtime IR object requires an IR adapter/,
        );

        // Restore
        EUIXEngineCore.irAdapter = prevAdapter;
    });

    it("should mount normalized IR object via loosely coupled registerIrAdapter", () => {
        const mockAdapter = vi.fn((ir) => "<uid_spec><container><h1>IR Mounted</h1></container></uid_spec>");
        EUIXEngineCore.registerIrAdapter(mockAdapter);

        const irApp = {
            irVersion: 1,
            states: [{ name: "title", initial: "Dynamic App" }],
        };

        const container = document.createElement("div");
        const mounted = EUIXEngineCore.mount(irApp, container);
        expect(mounted).toBeDefined();
        expect(mockAdapter).toHaveBeenCalledWith(irApp);
        expect(mounted.xmlDoc).toBeDefined();
    });
});
