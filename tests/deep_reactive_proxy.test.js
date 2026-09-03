// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { JSDOM } from "jsdom";

describe("Deep Reactive State Proxy", () => {
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

    it("should reactively update UI when modifying an item property inside an array directly", () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="tasks" type="array">[
              {"id": "t1", "title": "Buy milk", "done": false},
              {"id": "t2", "title": "Write code", "done": true}
            ]</state>
          </data_model>

          <for_each items="{data.tasks}" var="task" key="id">
            <div class="task-row">
              <button class="btn-toggle">
                <on_click action="RUN_SCRIPT">
                  const target = $data.tasks.find(t => t.id === $item.id);
                  if (target) {
                    target.done = !target.done;
                  }
                </on_click>
                Toggle
              </button>
              <span class="status">{task.done ? "DONE" : "PENDING"}</span>
            </div>
          </for_each>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const rows = container.querySelectorAll(".task-row");
        const status0 = rows[0].querySelector(".status");
        const status1 = rows[1].querySelector(".status");

        expect(status0.textContent).toBe("PENDING");
        expect(status1.textContent).toBe("DONE");

        // Click toggle on item 1: directly mutates `target.done = true` without array reassignment!
        const btn0 = rows[0].querySelector(".btn-toggle");
        btn0.click();

        expect(status0.textContent).toBe("DONE");
        expect(engine._rawState.tasks[0].done).toBe(true);

        // Click again: toggles back to PENDING
        btn0.click();
        expect(status0.textContent).toBe("PENDING");
        expect(engine._rawState.tasks[0].done).toBe(false);
    });

    it("should reactively update UI when modifying deeply nested object properties", () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="user" type="object">{
              "profile": {
                "address": {
                  "city": "Izmir",
                  "zip": "35000"
                }
              }
            }</state>
          </data_model>

          <div class="user-card">
            <span class="city-text">{data.user.profile.address.city}</span>
            <button class="btn-change-city">
              <on_click action="RUN_SCRIPT">
                $data.user.profile.address.city = "Istanbul";
              </on_click>
              Change City
            </button>
          </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const citySpan = container.querySelector(".city-text");
        expect(citySpan.textContent).toBe("Izmir");

        const btn = container.querySelector(".btn-change-city");
        btn.click();

        expect(citySpan.textContent).toBe("Istanbul");
        expect(engine._rawState.user.profile.address.city).toBe("Istanbul");
    });

    it("should reactively update UI when pushing items to a nested array", () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="cart" type="object">{
              "items": [
                {"id": 1, "name": "Apple"}
              ]
            }</state>
          </data_model>

          <div class="cart-box">
            <span class="count-badge">{data.cart.items.length}</span>
            <button class="btn-add">
              <on_click action="RUN_SCRIPT">
                $data.cart.items.push({ id: 2, name: "Banana" });
              </on_click>
              Add Item
            </button>
            <for_each items="{data.cart.items}" var="i" key="id">
              <span class="cart-item">{i.name}</span>
            </for_each>
          </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(container.querySelector(".count-badge").textContent).toBe("1");
        expect(container.querySelectorAll(".cart-item").length).toBe(1);

        const btn = container.querySelector(".btn-add");
        btn.click();

        expect(container.querySelector(".count-badge").textContent).toBe("2");
        expect(container.querySelectorAll(".cart-item").length).toBe(2);
        expect(container.querySelectorAll(".cart-item")[1].textContent).toBe("Banana");
    });
});
