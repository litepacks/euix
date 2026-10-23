/**
 * tests/declarative_automount.test.js
 * Test suite for EUIX Declarative Data-Attribute Auto-Mount Engine:
 *   <script euix />
 *   <div data-euix="/counter.xml"></div>
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";
import {
    coerceAttributeValue,
    extractPropsAndState,
    mountElement,
    normalizeXml,
    scan,
    unmountElement,
} from "../src/core/lifecycle/DeclarativeLoader.js";

describe("EUIX Declarative Data-Attribute Auto-Mount Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        container.id = "test-root";
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        document.body.innerHTML = "";
        vi.restoreAllMocks();
    });

    it("should correctly coerce attribute strings into primitives and objects", () => {
        expect(coerceAttributeValue("true")).toBe(true);
        expect(coerceAttributeValue("false")).toBe(false);
        expect(coerceAttributeValue("null")).toBe(null);
        expect(coerceAttributeValue("undefined")).toBe(undefined);
        expect(coerceAttributeValue("42")).toBe(42);
        expect(coerceAttributeValue("3.1415")).toBe(3.1415);
        expect(coerceAttributeValue('{"name":"EUIX"}')).toEqual({ name: "EUIX" });
        expect(coerceAttributeValue('[1, 2, 3]')).toEqual([1, 2, 3]);
        expect(coerceAttributeValue("hello world")).toBe("hello world");
    });

    it("should extract props and state from data-props, data-state, and individual data-prop-* attributes", () => {
        const el = document.createElement("div");
        el.setAttribute("data-props", JSON.stringify({ initialCount: 5, theme: "dark" }));
        el.setAttribute("data-prop-step", "2");
        el.setAttribute("data-prop-user-name", "Ahmet");
        el.setAttribute("data-prop-is-active", "true");
        el.setAttribute("data-state-custom", "100");

        const { props, state } = extractPropsAndState(el);

        expect(props.initialCount).toBe(5);
        expect(props.theme).toBe("dark");
        expect(props.step).toBe(2);
        expect(props.userName).toBe("Ahmet");
        expect(props.user_name).toBe("Ahmet");
        expect(props.isActive).toBe(true);
        expect(state.custom).toBe(100);
    });

    it("should normalize raw component_def and bare tags into valid uid_spec", () => {
        const compDefXml = `
            <component_def name="my-card">
                <div>Card Body</div>
            </component_def>
        `;
        const normalized = normalizeXml(compDefXml);
        expect(normalized).toContain("<uid_spec>");
        expect(normalized).toContain('<component name="my-card" />');

        const bareXml = `<div>Hello Bare Tag</div>`;
        const normalizedBare = normalizeXml(bareXml);
        expect(normalizedBare).toContain("<uid_spec>");
        expect(normalizedBare).toContain("<div>Hello Bare Tag</div>");
    });

    it("should mount inline XML directly from data-euix attribute", async () => {
        const div = document.createElement("div");
        div.setAttribute(
            "data-euix",
            `<uid_spec>
                <data_model>
                    <state id="count" type="number">10</state>
                </data_model>
                <div class="counter-display">Count: {data.count}</div>
            </uid_spec>`
        );
        container.appendChild(div);

        const engine = await mountElement(EUIXEngine, div);
        expect(engine).not.toBeNull();
        expect(div.classList.contains("euix-mounted")).toBe(true);
        expect(div.querySelector(".counter-display").textContent.trim()).toBe("Count: 10");
        expect(div._euixEngine).toBe(engine);
    });

    it("should mount template content referenced by selector id in data-euix='#template'", async () => {
        const tpl = document.createElement("template");
        tpl.id = "counter-template";
        tpl.innerHTML = `
            <uid_spec>
                <data_model>
                    <state id="count" type="number">99</state>
                </data_model>
                <span id="output">{data.count}</span>
            </uid_spec>
        `;
        document.body.appendChild(tpl);

        const div = document.createElement("div");
        div.setAttribute("data-euix", "#counter-template");
        container.appendChild(div);

        const engine = await mountElement(EUIXEngine, div);
        expect(engine).not.toBeNull();
        expect(div.querySelector("#output").textContent.trim()).toBe("99");
    });

    it("should fetch remote XML file and mount successfully with data-euix='/counter.xml'", async () => {
        const mockXml = `
            <uid_spec>
                <data_model>
                    <state id="count" type="number">0</state>
                </data_model>
                <flex direction="column">
                    <span id="count-val">{data.count}</span>
                    <button id="btn-add" on_click:set="count={data.count + 1}">+1</button>
                </flex>
            </uid_spec>
        `;

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => mockXml,
        });

        const div = document.createElement("div");
        div.setAttribute("data-euix", "/counter.xml");
        container.appendChild(div);

        const engine = await mountElement(EUIXEngine, div);
        expect(globalThis.fetch).toHaveBeenCalledWith("/counter.xml", expect.anything());
        expect(div.querySelector("#count-val").textContent.trim()).toBe("0");

        // Click button and verify fine-grained reactivity
        const btn = div.querySelector("#btn-add");
        btn.click();
        expect(div.querySelector("#count-val").textContent.trim()).toBe("1");
    });

    it("should pass props and allow initial state override via data-prop-* and data-state-*", async () => {
        const mockXml = `
            <uid_spec>
                <data_model>
                    <state id="count" type="number">0</state>
                </data_model>
                <div>
                    <h1 id="title">{props.title}</h1>
                    <span id="count-val">{data.count}</span>
                    <button id="step-btn" on_click:set="count={data.count + props.step}">Step</button>
                </div>
            </uid_spec>
        `;

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => mockXml,
        });

        const div = document.createElement("div");
        div.setAttribute("data-euix", "/widget.xml");
        div.setAttribute("data-prop-title", "Live Dashboard");
        div.setAttribute("data-prop-step", "5");
        div.setAttribute("data-state-count", "20");
        container.appendChild(div);

        const engine = await mountElement(EUIXEngine, div);
        expect(div.querySelector("#title").textContent.trim()).toBe("Live Dashboard");
        expect(div.querySelector("#count-val").textContent.trim()).toBe("20");

        // Click step button (adds props.step: 5)
        const btn = div.querySelector("#step-btn");
        btn.click();
        expect(div.querySelector("#count-val").textContent.trim()).toBe("25");
    });

    it("should support multiple isolated island instances on the same page", async () => {
        const mockXml = `
            <uid_spec>
                <data_model>
                    <state id="val" type="number">0</state>
                </data_model>
                <div>
                    <span class="val">{data.val}</span>
                    <button class="inc" on_click:set="val={data.val + 1}">+</button>
                </div>
            </uid_spec>
        `;

        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => mockXml,
        });

        const div1 = document.createElement("div");
        div1.setAttribute("data-euix", "/island.xml");
        div1.setAttribute("data-state-val", "10");

        const div2 = document.createElement("div");
        div2.setAttribute("data-euix", "/island.xml");
        div2.setAttribute("data-state-val", "50");

        container.appendChild(div1);
        container.appendChild(div2);

        await scan(EUIXEngine, container);

        expect(div1.querySelector(".val").textContent.trim()).toBe("10");
        expect(div2.querySelector(".val").textContent.trim()).toBe("50");

        // Increment island 1
        div1.querySelector(".inc").click();
        expect(div1.querySelector(".val").textContent.trim()).toBe("11");
        // Island 2 must remain unaffected
        expect(div2.querySelector(".val").textContent.trim()).toBe("50");
    });

    it("should support dynamic prop updates via engine.setProps(newProps)", async () => {
        const div = document.createElement("div");
        div.setAttribute(
            "data-euix",
            `<uid_spec>
                <span id="title">{props.title}</span>
            </uid_spec>`
        );
        div.setAttribute("data-prop-title", "Version 1");
        container.appendChild(div);

        const engine = await mountElement(EUIXEngine, div);
        expect(div.querySelector("#title").textContent.trim()).toBe("Version 1");

        engine.setProps({ title: "Version 2 (Updated)" });
        expect(div.querySelector("#title").textContent.trim()).toBe("Version 2 (Updated)");
    });

    it("should cleanly unmount element and clear resources via unmountElement", async () => {
        const div = document.createElement("div");
        div.setAttribute(
            "data-euix",
            `<uid_spec>
                <span>Active Component</span>
            </uid_spec>`
        );
        container.appendChild(div);

        const engine = await mountElement(EUIXEngine, div);
        expect(div._euixEngine).toBe(engine);
        expect(EUIXEngine.instances.has(engine)).toBe(true);

        unmountElement(EUIXEngine, div);
        expect(div._euixEngine).toBeNull();
        expect(div.classList.contains("euix-mounted")).toBe(false);
        expect(EUIXEngine.instances.has(engine)).toBe(false);
    });

    it("should expose global window.euix with mount, scan, get, and instances helpers", async () => {
        expect(window.euix).toBeDefined();
        expect(typeof window.euix.mount).toBe("function");
        expect(typeof window.euix.mountElement).toBe("function");
        expect(typeof window.euix.scan).toBe("function");
        expect(typeof window.euix.get).toBe("function");

        const div = document.createElement("div");
        div.id = "widget-123";
        div.setAttribute(
            "data-euix",
            `<uid_spec>
                <div id="content">Global Euix Widget</div>
            </uid_spec>`
        );
        container.appendChild(div);

        await window.euix.scan(container);

        const retrieved = window.euix.get("#widget-123");
        expect(retrieved).not.toBeNull();
        expect(div.querySelector("#content").textContent.trim()).toBe("Global Euix Widget");
    });

    it("should handle fetch error gracefully, applying .euix-error class", async () => {
        globalThis.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            statusText: "Not Found",
        });

        const div = document.createElement("div");
        div.setAttribute("data-euix", "/non-existent.xml");
        container.appendChild(div);

        const engine = await mountElement(EUIXEngine, div);
        expect(engine).toBeNull();
        expect(div.classList.contains("euix-error")).toBe(true);
        expect(div.querySelector(".euix-mount-error")).not.toBeNull();
    });
});
