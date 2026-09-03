// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXInspectorPlugin, EUIXStateHistoryManager, computeStateDiff } from "../src/plugins/EUIXInspectorPlugin.js";
import { JSDOM } from "jsdom";

describe("Time-Travel Debugging & State History Suite (EUIXStateHistoryManager)", () => {
    let dom;
    let container;

    beforeEach(() => {
        dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"app\"></div></body></html>");
        global.document = dom.window.document;
        global.window = dom.window;
        global.DOMParser = dom.window.DOMParser;
        container = document.getElementById("app");

        EUIXEngineCore.use(EUIXInspectorPlugin);
    });

    afterEach(() => {
        if (container) container.innerHTML = "";
    });

    it("should compute state diffs accurately", () => {
        const oldState = { count: 0, user: "Ahmet", items: [1, 2] };
        const newState = { count: 1, user: "Ahmet", items: [1, 2, 3], role: "admin" };

        const diff = computeStateDiff(oldState, newState);
        expect(diff.hasChanges).toBe(true);
        expect(diff.added).toEqual({ role: "admin" });
        expect(diff.changed.count).toEqual({ from: 0, to: 1 });
        expect(diff.changed.items).toBeDefined();
    });

    it("should record state transitions and allow undo/redo with reactive DOM update", () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="counter" type="number">0</state>
            <state id="name">Guest</state>
          </data_model>

          <flex direction="column">
            <span class="count-display">{data.counter}</span>
            <span class="name-display">{data.name}</span>

            <button class="btn-undo">
              <on_click action="UNDO_STATE" />
              Undo
            </button>
            <button class="btn-redo">
              <on_click action="REDO_STATE" />
              Redo
            </button>
          </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(container.querySelector(".count-display").textContent).toBe("0");

        // Step 1: Modify state
        engine.setState("counter", 1);
        expect(container.querySelector(".count-display").textContent).toBe("1");

        // Step 2: Modify state again
        engine.setState("counter", 2);
        expect(container.querySelector(".count-display").textContent).toBe("2");

        // Step 3: Modify name
        engine.setState("name", "Alice");
        expect(container.querySelector(".name-display").textContent).toBe("Alice");

        const history = engine._historyManager || engine._devtools?.history;
        expect(history).toBeDefined();
        expect(history.snapshots.length).toBe(4); // Initial + 3 changes

        // Test Undo
        expect(engine.canUndo()).toBe(true);
        engine.undo(); // Undo name change
        expect(engine.getState("name")).toBe("Guest");
        expect(container.querySelector(".name-display").textContent).toBe("Guest");
        expect(engine.getState("counter")).toBe(2);

        engine.undo(); // Undo counter: 2 -> 1
        expect(engine.getState("counter")).toBe(1);
        expect(container.querySelector(".count-display").textContent).toBe("1");

        // Test Redo
        expect(engine.canRedo()).toBe(true);
        engine.redo(); // Redo counter: 1 -> 2
        expect(engine.getState("counter")).toBe(2);
        expect(container.querySelector(".count-display").textContent).toBe("2");

        // Test Declarative Action Undo
        engine._handleUndoStateAction();
        expect(engine.getState("counter")).toBe(1);
        expect(container.querySelector(".count-display").textContent).toBe("1");
    });

    it("should support manual snapshots and scrubbing to arbitrary time-travel index", () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="step" type="number">1</state>
          </data_model>

          <div>
            <span class="step-text">{data.step}</span>
          </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);

        engine.setState("step", 2);
        engine.takeSnapshot("Step 2 Checkpoint");
        engine.setState("step", 3);
        engine.setState("step", 4);

        expect(container.querySelector(".step-text").textContent).toBe("4");

        // Time travel directly to snapshot index 0 (initial)
        engine.timeTravelTo(0);
        expect(engine.getState("step")).toBe(1);
        expect(container.querySelector(".step-text").textContent).toBe("1");

        // Time travel directly to snapshot index 2 (step 2 checkpoint)
        engine.timeTravelTo(2);
        expect(engine.getState("step")).toBe(2);
        expect(container.querySelector(".step-text").textContent).toBe("2");
    });

    it("should export and import state history JSON", () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="score" type="number">100</state>
          </data_model>
          <span class="score">{data.score}</span>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        engine.setState("score", 200);
        engine.setState("score", 300);

        const exported = engine.exportStateHistory();
        expect(typeof exported).toBe("string");
        expect(exported).toContain("\"score\": 300");

        // Reset and import
        engine.setState("score", 0);
        expect(container.querySelector(".score").textContent).toBe("0");

        const imported = engine.importStateHistory(exported);
        expect(imported).toBe(true);
        expect(engine.getState("score")).toBe(300);
        expect(container.querySelector(".score").textContent).toBe("300");
    });
});
