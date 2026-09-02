import { describe, it, expect, beforeEach } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";

describe("Form Input Type Coercion & Binding Modifiers Suite", () => {
    let container;

    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
        container = document.getElementById("app");
    });

    it("coerces input type='number' to JavaScript number", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="age" type="number">25</state>
                </data_model>
                <div>
                    <input id="age-input" type="number" bind="age" />
                    <span id="age-val">{data.age}</span>
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const input = container.querySelector("#age-input");

        input.value = "42";
        input.oninput({ target: input });

        expect(engine.getState("age")).toBe(42);
        expect(typeof engine.getState("age")).toBe("number");
        expect(container.querySelector("#age-val").textContent).toBe("42");
    });

    it("coerces input type='range' to JavaScript number", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="volume" type="number">50</state>
                </data_model>
                <div>
                    <input id="range-inp" type="range" bind="volume" min="0" max="100" />
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const input = container.querySelector("#range-inp");

        input.value = "85";
        input.oninput({ target: input });

        expect(engine.getState("volume")).toBe(85);
        expect(typeof engine.getState("volume")).toBe("number");
    });

    it("supports bind.number modifier on standard text inputs", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="custom_rate">10</state>
                </data_model>
                <div>
                    <input id="rate-input" bind.number="custom_rate" />
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const input = container.querySelector("#rate-input");

        input.value = "19.99";
        input.oninput({ target: input });

        expect(engine.getState("custom_rate")).toBe(19.99);
        expect(typeof engine.getState("custom_rate")).toBe("number");
    });

    it("supports bind:number colon syntax on standard text inputs", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="tax">5</state>
                </data_model>
                <div>
                    <input id="tax-input" bind:number="tax" />
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const input = container.querySelector("#tax-input");

        input.value = "18";
        input.oninput({ target: input });

        expect(engine.getState("tax")).toBe(18);
        expect(typeof engine.getState("tax")).toBe("number");
    });

    it("supports bind='number:...' inline prefix syntax", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="threshold">100</state>
                </data_model>
                <div>
                    <input id="thresh-input" bind="number:threshold" />
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const input = container.querySelector("#thresh-input");

        input.value = "250";
        input.oninput({ target: input });

        expect(engine.getState("threshold")).toBe(250);
        expect(typeof engine.getState("threshold")).toBe("number");
    });

    it("trims whitespace when bind.trim modifier is applied on input", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="username">Guest</state>
                </data_model>
                <div>
                    <input id="user-input" bind.trim="username" />
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const input = container.querySelector("#user-input");

        input.value = "   Alice Wonder   ";
        input.oninput({ target: input });

        expect(engine.getState("username")).toBe("Alice Wonder");
    });

    it("trims whitespace when bind.trim modifier is applied on textarea", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="notes">initial</state>
                </data_model>
                <div>
                    <textarea id="notes-ta" bind.trim="notes"></textarea>
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const textarea = container.querySelector("#notes-ta");

        textarea.value = "   \nMultiline trimmed content\t   ";
        textarea.oninput({ target: textarea });

        expect(engine.getState("notes")).toBe("Multiline trimmed content");
    });

    it("stores real boolean true/false when bind.boolean is applied to checkbox", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="is_enabled" type="boolean">false</state>
                </data_model>
                <div>
                    <input id="enabled-box" type="checkbox" bind.boolean="is_enabled" />
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const checkbox = container.querySelector("#enabled-box");

        checkbox.checked = true;
        checkbox.onchange({ target: checkbox });

        expect(engine.getState("is_enabled")).toBe(true);
        expect(typeof engine.getState("is_enabled")).toBe("boolean");

        checkbox.checked = false;
        checkbox.onchange({ target: checkbox });

        expect(engine.getState("is_enabled")).toBe(false);
        expect(typeof engine.getState("is_enabled")).toBe("boolean");
    });

    it("defers state updates until change/blur when bind.lazy is applied", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="query">initial</state>
                </data_model>
                <div>
                    <input id="search-box" bind.lazy="query" />
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const input = container.querySelector("#search-box");

        input.value = "typing without commit";
        if (input.oninput) input.oninput({ target: input });

        // State has not changed yet because it is lazy
        expect(engine.getState("query")).toBe("initial");

        // Trigger change event
        input.onchange({ target: input });
        expect(engine.getState("query")).toBe("typing without commit");
    });

    it("parses select dropdown value as number with bind.number", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="selected_role_id">1</state>
                </data_model>
                <div>
                    <select id="role-select" bind.number="selected_role_id">
                        <option value="1">Member</option>
                        <option value="2">Admin</option>
                        <option value="3">Owner</option>
                    </select>
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const select = container.querySelector("#role-select");

        select.value = "2";
        select.dispatchEvent(new Event("change"));

        expect(engine.getState("selected_role_id")).toBe(2);
        expect(typeof engine.getState("selected_role_id")).toBe("number");
    });

    it("automatically coerces value to number if state was defined with type='number' in data_model", () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="counter" type="number">10</state>
                </data_model>
                <div>
                    <!-- Plain input without type='number' or modifier -->
                    <input id="plain-input" bind="counter" />
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const input = container.querySelector("#plain-input");

        input.value = "77";
        input.oninput({ target: input });

        expect(engine.getState("counter")).toBe(77);
        expect(typeof engine.getState("counter")).toBe("number");
    });
});
