// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { JSDOM } from "jsdom";

describe("Smart Object / JS Expression Parser in MUTATE_STATE", () => {
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

    it("should parse dynamic JS expressions like + Date.now() in PUSH <value>", () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="newTask">Write article</state>
            <state id="tasks" type="array">[]</state>
          </data_model>

          <button class="btn-add">
            <on_click action="MUTATE_STATE">
              <path>tasks</path>
              <operation>PUSH</operation>
              <value>{"id": "t_" + Date.now(), "title": data.newTask, "done": false}</value>
            </on_click>
            Add Task
          </button>

          <for_each items="{data.tasks}" var="t" key="id">
            <span class="task-title">{t.title}</span>
          </for_each>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const btn = container.querySelector(".btn-add");
        btn.click();

        const tasks = engine.getState("tasks");
        expect(tasks.length).toBe(1);
        expect(tasks[0].title).toBe("Write article");
        expect(tasks[0].done).toBe(false);
        expect(tasks[0].id.startsWith("t_")).toBe(true);
        expect(container.querySelector(".task-title").textContent).toBe("Write article");
    });

    it("should parse unary boolean operations !task.done and !{task.done} in UPDATE <value>", () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="tasks" type="array">[{"id": "t1", "title": "Test 1", "done": false}]</state>
          </data_model>

          <for_each items="{data.tasks}" var="task" key="id">
            <button class="btn-toggle">
              <on_click action="MUTATE_STATE">
                <path>tasks</path>
                <operation>UPDATE</operation>
                <where field="id" equals="{task.id}" />
                <value>{"done": !task.done}</value>
              </on_click>
              {task.done ? "DONE" : "PENDING"}
            </button>
          </for_each>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const btn = container.querySelector(".btn-toggle");
        expect(btn.textContent.trim()).toBe("PENDING");

        // 1. Toggle to true
        btn.click();
        expect(engine.getState("tasks")[0].done).toBe(true);
        expect(container.querySelector(".btn-toggle").textContent.trim()).toBe("DONE");

        // 2. Toggle back to false
        container.querySelector(".btn-toggle").click();
        expect(engine.getState("tasks")[0].done).toBe(false);
        expect(container.querySelector(".btn-toggle").textContent.trim()).toBe("PENDING");
    });

    it("should parse bracketed dynamic expressions !{task.done} in UPDATE <value>", () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="tasks" type="array">[{"id": "t1", "title": "Test 1", "done": false}]</state>
          </data_model>

          <for_each items="{data.tasks}" var="task" key="id">
            <button class="btn-toggle-bracket">
              <on_click action="MUTATE_STATE">
                <path>tasks</path>
                <operation>UPDATE</operation>
                <where field="id" equals="{task.id}" />
                <value>{"done": !{task.done}}</value>
              </on_click>
              {task.done ? "DONE" : "PENDING"}
            </button>
          </for_each>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const btn = container.querySelector(".btn-toggle-bracket");
        expect(btn.textContent.trim()).toBe("PENDING");

        btn.click();
        expect(engine.getState("tasks")[0].done).toBe(true);
        expect(container.querySelector(".btn-toggle-bracket").textContent.trim()).toBe("DONE");
    });
});
