import { describe, it, expect, beforeEach } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";
import { EUIXDevTools } from "../src/EUIXDevTools.js";

describe("DevTools Live Interactive State Editor Suite", () => {
    let container;

    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
        container = document.getElementById("app");
    });

    it("renders state variables with type badges in State tab", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="count" type="number">42</state>
                    <state id="username" type="string">Alex</state>
                    <state id="is_admin" type="boolean">true</state>
                    <state id="tags" type="array">["vip", "pro"]</state>
                    <state id="config" type="object">{"theme": "dark"}</state>
                </data_model>
                <div><span>{data.username}</span></div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const devtools = EUIXDevTools.init(engine);
        devtools.enable();

        const panel = devtools.panel;
        panel.activeTab = "state";
        panel.render();

        const cards = panel.panelEl.querySelectorAll(".euix-state-card");
        expect(cards.length).toBeGreaterThanOrEqual(5);

        const cardKeys = Array.from(cards).map((c) => c.getAttribute("data-key"));
        expect(cardKeys).toContain("count");
        expect(cardKeys).toContain("username");
        expect(cardKeys).toContain("is_admin");
        expect(cardKeys).toContain("tags");
        expect(cardKeys).toContain("config");
    });

    it("edits string state live and reactively updates DOM", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="greeting" type="string">Hello World</state>
                </data_model>
                <div><h1 class="heading">{data.greeting}</h1></div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const devtools = EUIXDevTools.init(engine);
        devtools.enable();

        const panel = devtools.panel;
        panel.activeTab = "state";
        panel.render();

        const input = panel.panelEl.querySelector('.euix-state-live-input[data-key="greeting"]');
        expect(input).not.toBeNull();
        expect(input.value).toBe("Hello World");

        input.value = "Updated Greeting!";
        input.onchange();

        expect(engine.getState("greeting")).toBe("Updated Greeting!");
        expect(container.querySelector(".heading").textContent).toBe("Updated Greeting!");
    });

    it("edits number state live and preserves numeric type", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="score" type="number">100</state>
                </data_model>
                <div><span class="score-val">{data.score}</span></div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const devtools = EUIXDevTools.init(engine);
        devtools.enable();

        const panel = devtools.panel;
        panel.activeTab = "state";
        panel.render();

        const numInput = panel.panelEl.querySelector('.euix-state-live-input[data-key="score"]');
        expect(numInput).not.toBeNull();

        numInput.value = "250";
        numInput.onchange();

        expect(engine.getState("score")).toBe(250);
        expect(typeof engine.getState("score")).toBe("number");
        expect(container.querySelector(".score-val").textContent).toBe("250");
    });

    it("steps number state via increment and decrement buttons", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="level" type="number">5</state>
                </data_model>
                <div><span>Level {data.level}</span></div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const devtools = EUIXDevTools.init(engine);
        devtools.enable();

        const panel = devtools.panel;
        panel.activeTab = "state";
        panel.render();

        const plusBtn = panel.panelEl.querySelector('.euix-state-step-btn[data-key="level"][data-step="1"]');
        const minusBtn = panel.panelEl.querySelector('.euix-state-step-btn[data-key="level"][data-step="-1"]');

        plusBtn.click();
        expect(engine.getState("level")).toBe(6);

        minusBtn.click();
        minusBtn.click();
        expect(engine.getState("level")).toBe(4);
    });

    it("toggles boolean state via toggle button", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="is_active" type="boolean">false</state>
                </data_model>
                <div><span class="badge">{data.is_active ? "Online" : "Offline"}</span></div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const devtools = EUIXDevTools.init(engine);
        devtools.enable();

        const panel = devtools.panel;
        panel.activeTab = "state";
        panel.render();

        const toggleBtn = panel.panelEl.querySelector('.euix-state-toggle-bool[data-key="is_active"]');
        expect(toggleBtn).not.toBeNull();

        toggleBtn.click();
        expect(engine.getState("is_active")).toBe(true);
        expect(container.querySelector(".badge").textContent).toBe("Online");

        // Re-render and click again to turn false
        const toggleBtnAfter = panel.panelEl.querySelector('.euix-state-toggle-bool[data-key="is_active"]');
        toggleBtnAfter.click();
        expect(engine.getState("is_active")).toBe(false);
        expect(container.querySelector(".badge").textContent).toBe("Offline");
    });

    it("edits object state via JSON editor and reactively updates DOM", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="user" type="object">{"name": "Alice", "role": "Member"}</state>
                </data_model>
                <div><span class="role-text">{data.user.role}</span></div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const devtools = EUIXDevTools.init(engine);
        devtools.enable();

        const panel = devtools.panel;
        panel.activeTab = "state";
        panel.render();

        const editBtn = panel.panelEl.querySelector('.euix-state-edit-json-toggle[data-key="user"]');
        editBtn.click();

        const textarea = panel.panelEl.querySelector('.euix-state-json-textarea[data-key="user"]');
        expect(textarea).not.toBeNull();

        textarea.value = JSON.stringify({ name: "Alice", role: "SuperAdmin" });

        const saveBtn = panel.panelEl.querySelector('.euix-state-json-save[data-key="user"]');
        saveBtn.click();

        expect(engine.getState("user").role).toBe("SuperAdmin");
        expect(container.querySelector(".role-text").textContent).toBe("SuperAdmin");
    });

    it("clears array state with Clear button", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="items" type="array">[1, 2, 3]</state>
                </data_model>
                <div><span>Count: {data.items.length}</span></div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const devtools = EUIXDevTools.init(engine);
        devtools.enable();

        const panel = devtools.panel;
        panel.activeTab = "state";
        panel.render();

        const clearBtn = panel.panelEl.querySelector('.euix-state-array-clear[data-key="items"]');
        expect(clearBtn).not.toBeNull();

        clearBtn.click();
        expect(engine.getState("items")).toEqual([]);
        expect(container.textContent).toContain("Count: 0");
    });

    it("creates a new state variable via Add State form", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="existing">Init</state>
                </data_model>
                <div>Content</div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const devtools = EUIXDevTools.init(engine);
        devtools.enable();

        const panel = devtools.panel;
        panel.activeTab = "state";
        panel.render();

        const addToggle = document.getElementById("euix-state-add-toggle");
        addToggle.click();

        const keyInput = document.getElementById("euix-new-state-key");
        const typeSelect = document.getElementById("euix-new-state-type");
        const valInput = document.getElementById("euix-new-state-val");
        const submitBtn = document.getElementById("euix-new-state-submit");

        keyInput.value = "multiplier";
        typeSelect.value = "number";
        valInput.value = "3.14";
        submitBtn.click();

        expect(engine.getState("multiplier")).toBe(3.14);
    });

    it("deletes a state variable via delete button", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="temporary">To be deleted</state>
                </data_model>
                <div>Content</div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const devtools = EUIXDevTools.init(engine);
        devtools.enable();

        const panel = devtools.panel;
        panel.activeTab = "state";
        panel.render();

        const delBtn = panel.panelEl.querySelector('.euix-state-delete-btn[data-key="temporary"]');
        expect(delBtn).not.toBeNull();

        delBtn.click();
        expect(engine.getState("temporary")).toBeUndefined();
    });

    it("filters state variables by search keyword", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="alpha_var">1</state>
                    <state id="beta_var">2</state>
                    <state id="gamma_var">3</state>
                </data_model>
                <div>Content</div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const devtools = EUIXDevTools.init(engine);
        devtools.enable();

        const panel = devtools.panel;
        panel.activeTab = "state";
        panel.render();

        const filterInput = document.getElementById("euix-state-filter");
        filterInput.value = "beta";
        filterInput.oninput({ target: { value: "beta" } });

        const cards = panel.panelEl.querySelectorAll(".euix-state-card");
        expect(cards.length).toBe(1);
        expect(cards[0].getAttribute("data-key")).toBe("beta_var");
    });
});
