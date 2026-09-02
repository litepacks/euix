import { describe, expect, it, vi } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";

describe("Aksiyon Shorthand Syntax Test Suite", () => {
    it("should handle on_click:set attribute with arithmetic expression", async () => {
        document.body.innerHTML = '<div id="app"></div>';
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="counter" type="number">0</state>
                </data_model>
                <flex direction="column">
                    <span id="counter-val">{data.counter}</span>
                    <button id="btn-inc" on_click:set="counter={data.counter + 1}">+1</button>
                    <button id="btn-dec" on_click:set="counter={data.counter - 1}">-1</button>
                    <button id="btn-reset" on_click:set="counter=0">Reset</button>
                </flex>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, "#app");
        const span = document.getElementById("counter-val");
        const btnInc = document.getElementById("btn-inc");
        const btnDec = document.getElementById("btn-dec");
        const btnReset = document.getElementById("btn-reset");

        expect(span.textContent).toBe("0");
        expect(engine.getState("counter")).toBe(0);

        btnInc.click();
        expect(engine.getState("counter")).toBe(1);
        expect(span.textContent).toBe("1");

        btnInc.click();
        btnInc.click();
        expect(engine.getState("counter")).toBe(3);
        expect(span.textContent).toBe("3");

        btnDec.click();
        expect(engine.getState("counter")).toBe(2);
        expect(span.textContent).toBe("2");

        btnReset.click();
        expect(engine.getState("counter")).toBe(0);
        expect(span.textContent).toBe("0");
    });

    it("should handle on_click:set for nested properties and strings", async () => {
        document.body.innerHTML = '<div id="app"></div>';
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="user" type="object">{"name": "Guest"}</state>
                </data_model>
                <flex>
                    <span id="user-name">{data.user.name}</span>
                    <button id="btn-set-alice" on_click:set="user.name='Alice'">Set Alice</button>
                    <button id="btn-set-bob" on_click:set="user.name='Bob'">Set Bob</button>
                </flex>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, "#app");
        const span = document.getElementById("user-name");
        const btnAlice = document.getElementById("btn-set-alice");
        const btnBob = document.getElementById("btn-set-bob");

        expect(span.textContent).toBe("Guest");

        btnAlice.click();
        expect(engine.getState("user.name")).toBe("Alice");
        expect(span.textContent).toBe("Alice");

        btnBob.click();
        expect(engine.getState("user.name")).toBe("Bob");
        expect(span.textContent).toBe("Bob");
    });

    it("should handle on_click:toggle attribute for boolean states", async () => {
        document.body.innerHTML = '<div id="app"></div>';
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="isOpen" type="boolean">false</state>
                </data_model>
                <flex>
                    <span id="status">{data.isOpen ? 'OPEN' : 'CLOSED'}</span>
                    <button id="btn-toggle" on_click:toggle="isOpen">Toggle</button>
                </flex>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, "#app");
        const span = document.getElementById("status");
        const btnToggle = document.getElementById("btn-toggle");

        expect(span.textContent).toBe("CLOSED");
        expect(engine.getState("isOpen")).toBe(false);

        btnToggle.click();
        expect(engine.getState("isOpen")).toBe(true);
        expect(span.textContent).toBe("OPEN");

        btnToggle.click();
        expect(engine.getState("isOpen")).toBe(false);
        expect(span.textContent).toBe("CLOSED");
    });

    it("should handle scoped state on_click:set and on_click:toggle in isolated components", async () => {
        document.body.innerHTML = '<div id="app"></div>';
        const xml = `
            <uid_spec>
                <component_def name="counter-widget" isolated="true">
                    <data_model>
                        <state id="count" type="number">10</state>
                        <state id="active" type="boolean">false</state>
                    </data_model>
                    <div class="card">
                        <span class="count-val">{local.count}</span>
                        <span class="active-val">{local.active ? 'YES' : 'NO'}</span>
                        <button class="btn-widget-inc" on_click:set="local.count={local.count + 5}">+5</button>
                        <button class="btn-widget-toggle" on_click:toggle="local.active">Toggle Active</button>
                    </div>
                </component_def>

                <flex direction="column">
                    <component name="counter-widget" />
                </flex>
            </uid_spec>
        `;

        EUIXEngine.mount(xml, "#app");
        const countSpan = document.querySelector(".count-val");
        const activeSpan = document.querySelector(".active-val");
        const btnInc = document.querySelector(".btn-widget-inc");
        const btnToggle = document.querySelector(".btn-widget-toggle");

        expect(countSpan.textContent).toBe("10");
        expect(activeSpan.textContent).toBe("NO");

        btnInc.click();
        expect(countSpan.textContent).toBe("15");

        btnToggle.click();
        expect(activeSpan.textContent).toBe("YES");
    });

    it("should handle on_click:mutate for array operations (PUSH, REMOVE, CLEAR)", async () => {
        document.body.innerHTML = '<div id="app"></div>';
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="items" type="array">[{"id": 1, "title": "First"}]</state>
                </data_model>
                <flex direction="column">
                    <span id="items-count">{data.items.length}</span>
                    <button id="btn-add" on_click:mutate="items.PUSH({id: 2, title: 'Second'})">Add Item</button>
                    <button id="btn-remove-1" on_click:mutate="items.REMOVE where id=1">Delete 1</button>
                    <button id="btn-clear" on_click:mutate="items.CLEAR">Clear All</button>

                    <for_each items="{data.items}" var="item" key="id">
                        <div class="item-row" data-id="{item.id}">
                            <span>{item.title}</span>
                            <button class="btn-del-item" on_click:mutate="items.REMOVE where id={item.id}">X</button>
                        </div>
                    </for_each>
                </flex>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, "#app");
        const countSpan = document.getElementById("items-count");
        const btnAdd = document.getElementById("btn-add");
        const btnRemove1 = document.getElementById("btn-remove-1");
        const btnClear = document.getElementById("btn-clear");

        expect(countSpan.textContent).toBe("1");
        expect(document.querySelectorAll(".item-row").length).toBe(1);

        btnAdd.click();
        expect(engine.getState("items").length).toBe(2);
        expect(countSpan.textContent).toBe("2");
        expect(document.querySelectorAll(".item-row").length).toBe(2);

        btnRemove1.click();
        expect(engine.getState("items").length).toBe(1);
        expect(engine.getState("items")[0].id).toBe(2);
        expect(countSpan.textContent).toBe("1");

        // Click delete button inside for_each
        const delBtn = document.querySelector(".btn-del-item");
        delBtn.click();
        expect(engine.getState("items").length).toBe(0);
        expect(countSpan.textContent).toBe("0");

        // Add item and clear
        btnAdd.click();
        expect(engine.getState("items").length).toBe(1);
        btnClear.click();
        expect(engine.getState("items").length).toBe(0);
    });

    it("should handle on_click:run for inline JavaScript execution", async () => {
        document.body.innerHTML = '<div id="app"></div>';
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="num" type="number">5</state>
                </data_model>
                <flex>
                    <span id="num-span">{data.num}</span>
                    <button id="btn-run" on_click:run="$data.num += 10">Add 10</button>
                </flex>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, "#app");
        const span = document.getElementById("num-span");
        const btnRun = document.getElementById("btn-run");

        expect(span.textContent).toBe("5");

        btnRun.click();
        expect(engine.getState("num")).toBe(15);
        expect(span.textContent).toBe("15");
    });

    it("should handle on_change:set auto-binding from input value and checkbox", async () => {
        document.body.innerHTML = '<div id="app"></div>';
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="userName">Initial</state>
                    <state id="isSubscribed" type="boolean">false</state>
                </data_model>
                <flex direction="column">
                    <span id="name-display">{data.userName}</span>
                    <span id="sub-display">{data.isSubscribed ? 'YES' : 'NO'}</span>

                    <input id="name-input" on_change:set="userName" />
                    <input id="sub-checkbox" type="checkbox" on_change:set="isSubscribed" />
                </flex>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, "#app");
        const nameDisplay = document.getElementById("name-display");
        const subDisplay = document.getElementById("sub-display");
        const nameInput = document.getElementById("name-input");
        const subCheckbox = document.getElementById("sub-checkbox");

        expect(nameDisplay.textContent).toBe("Initial");
        expect(subDisplay.textContent).toBe("NO");

        // Simulate typing and change event on text input
        nameInput.value = "Updated Name";
        nameInput.dispatchEvent(new Event("change"));
        expect(engine.getState("userName")).toBe("Updated Name");
        expect(nameDisplay.textContent).toBe("Updated Name");

        // Simulate checkbox toggle and change event
        subCheckbox.checked = true;
        subCheckbox.dispatchEvent(new Event("change"));
        expect(engine.getState("isSubscribed")).toBe(true);
        expect(subDisplay.textContent).toBe("YES");
    });

    it("should handle shorthand child tags (<on_click set='...' />, <on_click toggle='...' />)", async () => {
        document.body.innerHTML = '<div id="app"></div>';
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="score" type="number">100</state>
                    <state id="modalOpen" type="boolean">false</state>
                </data_model>
                <flex>
                    <span id="score-val">{data.score}</span>
                    <span id="modal-val">{data.modalOpen ? 'OPEN' : 'CLOSED'}</span>

                    <button id="btn-tag-set">
                        <on_click set="score" value="{data.score + 50}" />
                        +50
                    </button>
                    <button id="btn-tag-toggle">
                        <on_click toggle="modalOpen" />
                        Toggle Modal
                    </button>
                </flex>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, "#app");
        const scoreSpan = document.getElementById("score-val");
        const modalSpan = document.getElementById("modal-val");
        const btnSet = document.getElementById("btn-tag-set");
        const btnToggle = document.getElementById("btn-tag-toggle");

        expect(scoreSpan.textContent).toBe("100");
        expect(modalSpan.textContent).toBe("CLOSED");

        btnSet.click();
        expect(engine.getState("score")).toBe(150);
        expect(scoreSpan.textContent).toBe("150");

        btnToggle.click();
        expect(engine.getState("modalOpen")).toBe(true);
        expect(modalSpan.textContent).toBe("OPEN");
    });

    it("should respect confirm modifier on shorthand buttons", async () => {
        document.body.innerHTML = '<div id="app"></div>';
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="deleted" type="boolean">false</state>
                </data_model>
                <flex>
                    <span id="del-status">{data.deleted ? 'DELETED' : 'ALIVE'}</span>
                    <button id="btn-del" on_click:set="deleted=true" confirm="Are you sure?">Delete</button>
                </flex>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, "#app");
        const span = document.getElementById("del-status");
        const btnDel = document.getElementById("btn-del");

        // Mock window.confirm to return false
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

        btnDel.click();
        expect(confirmSpy).toHaveBeenCalledWith("Are you sure?");
        expect(engine.getState("deleted")).toBe(false);
        expect(span.textContent).toBe("ALIVE");

        // Mock window.confirm to return true
        confirmSpy.mockReturnValue(true);
        btnDel.click();
        expect(engine.getState("deleted")).toBe(true);
        expect(span.textContent).toBe("DELETED");

        confirmSpy.mockRestore();
    });

    it("should handle on_click:revalidate for API endpoints", async () => {
        document.body.innerHTML = '<div id="app"></div>';
        const xml = `
            <uid_spec>
                <flex>
                    <button id="btn-revalidate" on_click:revalidate="get_users">Refresh Users</button>
                </flex>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, "#app");
        engine.revalidateApi = vi.fn();

        const btn = document.getElementById("btn-revalidate");
        btn.click();

        expect(engine.revalidateApi).toHaveBeenCalledWith("get_users");
    });

    it("should handle on_click:call for composed action workflows", async () => {
        document.body.innerHTML = '<div id="app"></div>';
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="msg">Initial</state>
                </data_model>
                <actions>
                    <action_def name="CustomWorkflow">
                        <step action="SET_STATE">
                            <path>data.msg</path>
                            <value>Workflow Done</value>
                        </step>
                    </action_def>
                </actions>
                <flex>
                    <span id="msg-span">{data.msg}</span>
                    <button id="btn-call" on_click:call="CustomWorkflow">Execute</button>
                </flex>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, "#app");
        const span = document.getElementById("msg-span");
        const btnCall = document.getElementById("btn-call");

        expect(span.textContent).toBe("Initial");

        btnCall.click();
        await new Promise((r) => setTimeout(r, 10));

        expect(engine.getState("msg")).toBe("Workflow Done");
        expect(span.textContent).toBe("Workflow Done");
    });

    it("should handle key modifier on shorthand event handlers (e.g. key='Enter')", async () => {
        document.body.innerHTML = '<div id="app"></div>';
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="submitted" type="boolean">false</state>
                </data_model>
                <flex>
                    <span id="submit-status">{data.submitted ? 'YES' : 'NO'}</span>
                    <input id="test-input" on_keydown:set="submitted=true" key="Enter" />
                </flex>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, "#app");
        const span = document.getElementById("submit-status");
        const input = document.getElementById("test-input");

        expect(span.textContent).toBe("NO");

        // Keydown with Escape should NOT trigger
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        expect(engine.getState("submitted")).toBe(false);
        expect(span.textContent).toBe("NO");

        // Keydown with Enter SHOULD trigger
        input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
        expect(engine.getState("submitted")).toBe(true);
        expect(span.textContent).toBe("YES");
    });

    it("should handle multiple shorthand event handlers on the same element", async () => {
        document.body.innerHTML = '<div id="app"></div>';
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="hovered" type="boolean">false</state>
                    <state id="clicks" type="number">0</state>
                </data_model>
                <flex>
                    <span id="hover-span">{data.hovered ? 'HOVERED' : 'NORMAL'}</span>
                    <span id="click-span">{data.clicks}</span>
                    <button id="multi-btn" 
                        on_mouseenter:set="hovered=true" 
                        on_mouseleave:set="hovered=false" 
                        on_click:set="clicks={data.clicks + 1}">
                        Multi Event Button
                    </button>
                </flex>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, "#app");
        const hoverSpan = document.getElementById("hover-span");
        const clickSpan = document.getElementById("click-span");
        const btn = document.getElementById("multi-btn");

        expect(hoverSpan.textContent).toBe("NORMAL");
        expect(clickSpan.textContent).toBe("0");

        btn.dispatchEvent(new MouseEvent("mouseenter"));
        expect(engine.getState("hovered")).toBe(true);
        expect(hoverSpan.textContent).toBe("HOVERED");

        btn.click();
        expect(engine.getState("clicks")).toBe(1);
        expect(clickSpan.textContent).toBe("1");

        btn.dispatchEvent(new MouseEvent("mouseleave"));
        expect(engine.getState("hovered")).toBe(false);
        expect(hoverSpan.textContent).toBe("NORMAL");
    });

    it("should handle on_click:set with ternary expression", async () => {
        document.body.innerHTML = '<div id="app"></div>';
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="theme">light</state>
                </data_model>
                <flex>
                    <span id="theme-span">{data.theme}</span>
                    <button id="btn-theme" on_click:set="theme={data.theme == 'light' ? 'dark' : 'light'}">Toggle Theme</button>
                </flex>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, "#app");
        const span = document.getElementById("theme-span");
        const btn = document.getElementById("btn-theme");

        expect(span.textContent).toBe("light");

        btn.click();
        expect(engine.getState("theme")).toBe("dark");
        expect(span.textContent).toBe("dark");

        btn.click();
        expect(engine.getState("theme")).toBe("light");
        expect(span.textContent).toBe("light");
    });

    it("should handle on_click:title to set document title", async () => {
        document.body.innerHTML = '<div id="app"></div>';
        const xml = `
            <uid_spec>
                <flex>
                    <button id="btn-title" on_click:title="New Document Title">Set Title</button>
                </flex>
            </uid_spec>
        `;

        EUIXEngine.mount(xml, "#app");
        const btn = document.getElementById("btn-title");

        btn.click();
        expect(document.title).toBe("New Document Title");
    });
});
