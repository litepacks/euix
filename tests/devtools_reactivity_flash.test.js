import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";
import { EUIXDevTools } from "../src/EUIXDevTools.js";
import { OverlayManager } from "../src/plugins/inspector/overlay.js";

describe("DevTools Reactivity Visual Flash Suite", () => {
    let container;

    beforeEach(() => {
        document.body.innerHTML = '<div id="app"></div>';
        container = document.getElementById("app");
    });

    afterEach(() => {
        const hud = document.getElementById("euix-inspector-hud");
        if (hud) hud.remove();
        const panel = document.getElementById("euix-devtools-panel");
        if (panel) panel.remove();
        const flashCont = document.getElementById("euix-inspector-flash-container");
        if (flashCont) flashCont.remove();
    });

    it("initializes with highlightUpdates disabled by default and allows toggling", () => {
        const xml = `<uid_spec><span id="txt">Hello</span></uid_spec>`;
        const engine = EUIXEngine.mount(xml, container);
        const devtools = EUIXDevTools.init(engine);

        expect(devtools.highlightUpdates).toBe(false);

        devtools.enableHighlightUpdates();
        expect(devtools.highlightUpdates).toBe(true);

        devtools.disableHighlightUpdates();
        expect(devtools.highlightUpdates).toBe(false);

        devtools.toggleHighlightUpdates();
        expect(devtools.highlightUpdates).toBe(true);
    });

    it("automatically flashes DOM elements when state changes with highlightUpdates enabled", async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="counter" type="number">0</state>
                    <state id="username">Alice</state>
                </data_model>
                <div>
                    <h1 class="counter-display">Count: {data.counter}</h1>
                    <span class="user-display">User: {data.username}</span>
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const devtools = EUIXDevTools.init(engine, { highlightUpdates: true });

        expect(devtools.highlightUpdates).toBe(true);

        // Update counter state
        engine.setState("counter", 10);
        await new Promise((r) => setTimeout(r, 10));

        const flashBoxes = document.querySelectorAll(".euix-flash-box");
        expect(flashBoxes.length).toBeGreaterThan(0);

        const labels = Array.from(document.querySelectorAll(".euix-flash-label")).map((el) => el.textContent);
        expect(labels.some((l) => l.includes("counter"))).toBe(true);
    });

    it("toggles highlight updates via HUD Flash button", async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="score" type="number">100</state>
                </data_model>
                <div>
                    <p class="score-p">{data.score}</p>
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const devtools = EUIXDevTools.init(engine);

        const flashBtn = document.getElementById("euix-hud-flash-btn");
        expect(flashBtn).not.toBeNull();

        // Initially false
        expect(devtools.highlightUpdates).toBe(false);

        // Click HUD button
        flashBtn.click();
        expect(devtools.highlightUpdates).toBe(true);

        // Mutate score
        engine.setState("score", 200);
        await new Promise((r) => setTimeout(r, 10));

        const flashBoxes = document.querySelectorAll(".euix-flash-box");
        expect(flashBoxes.length).toBeGreaterThan(0);
    });

    it("supports direct OverlayManager.flash API with custom colors and labels", () => {
        const overlay = new OverlayManager();
        const testEl = document.createElement("div");
        testEl.id = "target-box";
        container.appendChild(testEl);

        const box = overlay.flash(testEl, { color: "#3b82f6", label: "custom_event" });
        expect(box).not.toBeNull();
        expect(box.className).toBe("euix-flash-box");
        expect(box.getAttribute("style")).toContain("#3b82f6");

        const label = box.querySelector(".euix-flash-label");
        expect(label).not.toBeNull();
        expect(label.textContent).toBe("⚡ custom_event");

        overlay.destroy();
    });

    it("flashes list items on array state mutations", async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="tasks" type="array">[{"id": 1, "title": "Buy Milk"}]</state>
                </data_model>
                <div class="tasks-container">
                    <for_each items="{data.tasks}" var="task" key="id">
                        <div class="task-row">{task.title}</div>
                    </for_each>
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const devtools = EUIXDevTools.init(engine, { highlightUpdates: true });

        engine.mutateState("tasks", "PUSH", { id: 2, title: "Walk Dog" });
        await new Promise((r) => setTimeout(r, 10));

        const flashBoxes = document.querySelectorAll(".euix-flash-box");
        expect(flashBoxes.length).toBeGreaterThan(0);
    });

    it("flashes conditional containers when branch toggles", async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="is_visible" type="boolean">false</state>
                </data_model>
                <div>
                    <if condition="{data.is_visible}">
                        <div class="secret-box">Revealed Secret</div>
                    </if>
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const devtools = EUIXDevTools.init(engine, { highlightUpdates: true });

        engine.setState("is_visible", true);
        await new Promise((r) => setTimeout(r, 10));

        const flashBoxes = document.querySelectorAll(".euix-flash-box");
        expect(flashBoxes.length).toBeGreaterThan(0);
    });

    it("flashes elements on two-way bound input changes", async () => {
        const xml = `
            <uid_spec>
                <data_model>
                    <state id="typed_val">initial</state>
                </data_model>
                <div>
                    <input bind="typed_val" class="text-input" />
                    <span class="preview-span">{data.typed_val}</span>
                </div>
            </uid_spec>
        `;

        const engine = EUIXEngine.mount(xml, container);
        const devtools = EUIXDevTools.init(engine, { highlightUpdates: true });

        engine.setState("typed_val", "updated value");
        await new Promise((r) => setTimeout(r, 10));

        const flashBoxes = document.querySelectorAll(".euix-flash-box");
        expect(flashBoxes.length).toBeGreaterThan(0);
    });

    it("exposes highlightUpdates controls on window.$euix console API", () => {
        const xml = `<uid_spec><span>Test</span></uid_spec>`;
        const engine = EUIXEngine.mount(xml, container);
        const devtools = EUIXDevTools.init(engine);

        expect(window.$euix).toBeDefined();
        expect(typeof window.$euix.enableHighlightUpdates).toBe("function");
        expect(typeof window.$euix.disableHighlightUpdates).toBe("function");
        expect(typeof window.$euix.toggleHighlightUpdates).toBe("function");
        expect(typeof window.$euix.flash).toBe("function");

        window.$euix.enableHighlightUpdates();
        expect(devtools.highlightUpdates).toBe(true);

        window.$euix.disableHighlightUpdates();
        expect(devtools.highlightUpdates).toBe(false);
    });
});
