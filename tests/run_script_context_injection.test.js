// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { JSDOM } from "jsdom";

describe("RUN_SCRIPT Context Injection ($ctx, $item, $index, $local)", () => {
    let dom;
    let container;

    beforeEach(() => {
        dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"app\"></div></body></html>");
        global.document = dom.window.document;
        global.window = dom.window;
        global.DOMParser = dom.window.DOMParser;
        container = document.getElementById("app");
    });

    afterEach(() => {
        if (container) container.innerHTML = "";
    });

    it("should inject $ctx, $item, and $index into RUN_SCRIPT within <for_each>", async () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="todos" type="array">[
              {"id": "t1", "text": "First Task", "done": false},
              {"id": "t2", "text": "Second Task", "done": true}
            ]</state>
          </data_model>

          <for_each items="{data.todos}" var="todo" key="id">
            <div class="todo-row">
              <button class="btn-ctx-toggle">
                <on_click action="RUN_SCRIPT">
                  const target = $data.todos.find(t => t.id === $ctx.todo.id);
                  if (target) {
                    target.done = !target.done;
                    $data.todos = [...$data.todos];
                  }
                </on_click>
                Toggle CTX
              </button>
              <button class="btn-item-toggle">
                <on_click action="RUN_SCRIPT">
                  const target = $data.todos.find(t => t.id === $item.id);
                  if (target) {
                    target.done = !target.done;
                    $data.todos = [...$data.todos];
                  }
                </on_click>
                Toggle Item
              </button>
              <button class="btn-index-check">
                <on_click action="RUN_SCRIPT">
                  $data.clickedIndex = $index;
                </on_click>
                Index
              </button>
              <span class="status">{todo.done ? "DONE" : "PENDING"}</span>
            </div>
          </for_each>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const ctxBtns = container.querySelectorAll(".btn-ctx-toggle");
        const itemBtns = container.querySelectorAll(".btn-item-toggle");
        const indexBtns = container.querySelectorAll(".btn-index-check");
        const statuses = container.querySelectorAll(".status");

        expect(statuses[0].textContent).toBe("PENDING");
        expect(statuses[1].textContent).toBe("DONE");

        // 1. Click $ctx toggle on first item
        ctxBtns[0].click();
        expect(engine.getState("todos")[0].done).toBe(true);
        expect(container.querySelectorAll(".status")[0].textContent).toBe("DONE");

        // 2. Click $item toggle on second item
        itemBtns[1].click();
        expect(engine.getState("todos")[1].done).toBe(false);
        expect(container.querySelectorAll(".status")[1].textContent).toBe("PENDING");

        // 3. Click $index on second row
        indexBtns[1].click();
        expect(engine.getState("clickedIndex")).toBe(1);
    });

    it("should support async RUN_SCRIPT with $ctx and $item", async () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="items" type="array">[{"id": "a1", "val": 10}]</state>
            <state id="asyncLog"></state>
          </data_model>

          <for_each items="{data.items}" var="row">
            <button class="btn-async">
              <on_click action="RUN_SCRIPT">
                await new Promise(r => setTimeout(r, 10));
                $data.asyncLog = "Updated " + $item.id + " with val " + $ctx.row.val;
              </on_click>
              Run Async
            </button>
          </for_each>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const btn = container.querySelector(".btn-async");
        btn.click();

        await new Promise((r) => setTimeout(r, 30));
        expect(engine.getState("asyncLog")).toBe("Updated a1 with val 10");
    });
});
