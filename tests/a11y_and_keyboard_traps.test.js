// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXDialogPlugin } from "../src/plugins/EUIXDialogPlugin.js";
import { EUIXCollapsePlugin } from "../src/plugins/EUIXCollapsePlugin.js";
import {
    EUIXA11yPlugin,
    createFocusTrap,
    getFocusableElements,
    announce,
    setupRovingTabIndex,
} from "../src/plugins/EUIXA11yPlugin.js";
import { JSDOM } from "jsdom";

describe("Accessibility (A11y) & Automated Keyboard Focus Traps Suite", () => {
    let dom;
    let container;

    beforeEach(() => {
        dom = new JSDOM("<!DOCTYPE html><html><body><div id=\"app\"></div></body></html>");
        global.document = dom.window.document;
        global.window = dom.window;
        global.DOMParser = dom.window.DOMParser;
        global.Node = dom.window.Node;
        global.HTMLElement = dom.window.HTMLElement;
        global.Event = dom.window.Event;
        global.MouseEvent = dom.window.MouseEvent;
        global.KeyboardEvent = dom.window.KeyboardEvent;
        container = document.getElementById("app");

        EUIXEngineCore.use(EUIXA11yPlugin);
        EUIXEngineCore.use(EUIXDialogPlugin);
        EUIXEngineCore.use(EUIXCollapsePlugin);
    });

    afterEach(() => {
        if (container) container.innerHTML = "";
    });

    it("should query focusable elements and manage WAI-ARIA Focus Trap cycling and Escape", () => {
        const modalContainer = document.createElement("div");
        modalContainer.innerHTML = `
            <button id="btn1">Button 1</button>
            <input id="input1" type="text" />
            <button id="btn-disabled" disabled>Disabled</button>
            <a id="link1" href="https://example.com">Link 1</a>
            <button id="btn2">Button 2</button>
        `;
        document.body.appendChild(modalContainer);

        const focusables = getFocusableElements(modalContainer);
        expect(focusables.map((el) => el.id)).toEqual(["btn1", "input1", "link1", "btn2"]);

        let escapeTriggered = false;
        const trap = createFocusTrap(modalContainer, {
            onEscape: () => {
                escapeTriggered = true;
            },
        });

        trap.activate();
        expect(trap.isActive()).toBe(true);

        // Test Tab Cycling (Forward)
        const btn2 = modalContainer.querySelector("#btn2");
        btn2.focus();

        const tabEvent = new dom.window.KeyboardEvent("keydown", {
            key: "Tab",
            bubbles: true,
            cancelable: true,
        });
        modalContainer.dispatchEvent(tabEvent);

        // Test Escape
        const escEvent = new dom.window.KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true,
            cancelable: true,
        });
        modalContainer.dispatchEvent(escEvent);
        expect(escapeTriggered).toBe(true);

        trap.deactivate();
        expect(trap.isActive()).toBe(false);
    });

    it("should render <dialog> with complete WAI-ARIA attributes, auto focus trap, and body scroll lock", () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="isModalOpen" type="boolean">false</state>
          </data_model>

          <flex direction="column">
            <button id="open-btn">
              <on_click action="SET_STATE">
                <path>data.isModalOpen</path>
                <value>true</value>
              </on_click>
              Open Modal
            </button>

            <dialog bind="isModalOpen" title="User Details" lock_scroll="true">
              <description>Please review your account profile information below.</description>
              <input id="first_name" placeholder="First Name" />
              <input id="last_name" placeholder="Last Name" />
              <actions>
                <button id="save-btn">Save</button>
              </actions>
            </dialog>
          </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(document.querySelector(".dialog-backdrop")).toBeNull();
        expect(document.body.style.overflow).toBe("");

        // Open Dialog
        engine.setState("isModalOpen", true);

        const backdrop = document.querySelector(".dialog-backdrop");
        const panel = document.querySelector(".dialog-panel");
        const title = document.querySelector(".dialog-title");
        const body = document.querySelector(".dialog-body");

        expect(backdrop).not.toBeNull();
        expect(panel).not.toBeNull();
        expect(panel.getAttribute("role")).toBe("dialog");
        expect(panel.getAttribute("aria-modal")).toBe("true");
        expect(panel.getAttribute("aria-labelledby")).toBe(title.id);
        expect(panel.getAttribute("aria-describedby")).toBe(body.id);
        expect(document.body.style.overflow).toBe("hidden");

        // Close Dialog via state
        engine.setState("isModalOpen", false);
        expect(document.querySelector(".dialog-backdrop")).toBeNull();
        expect(document.body.style.overflow).toBe("");
    });

    it("should render <collapse> with WAI-ARIA aria-expanded, aria-controls, role=region and keyboard arrow navigation", () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="tab1Open" type="boolean">true</state>
            <state id="tab2Open" type="boolean">false</state>
          </data_model>

          <div id="accordion-group">
            <collapse bind="tab1Open" title="General Settings" group="settings">
              <p id="content1">General options</p>
            </collapse>

            <collapse bind="tab2Open" title="Security Settings" group="settings">
              <p id="content2">Security options</p>
            </collapse>
          </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const headers = container.querySelectorAll(".euix-collapse-header");
        const bodies = container.querySelectorAll(".euix-collapse-body");

        expect(headers.length).toBe(2);
        expect(headers[0].getAttribute("aria-expanded")).toBe("true");
        expect(headers[1].getAttribute("aria-expanded")).toBe("false");

        // Check aria-controls and role="region"
        expect(bodies.length).toBe(1); // Only tab1 body is open and rendered
        expect(headers[0].getAttribute("aria-controls")).toBe(bodies[0].id);
        expect(bodies[0].getAttribute("role")).toBe("region");
        expect(bodies[0].getAttribute("aria-labelledby")).toBe(headers[0].id);

        // Test ArrowDown navigation
        const arrowDown = new dom.window.KeyboardEvent("keydown", {
            key: "ArrowDown",
            bubbles: true,
            cancelable: true,
        });
        headers[0].dispatchEvent(arrowDown);

        // Toggle Tab 2
        headers[1].click();
        expect(engine.getState("tab2Open")).toBe("true");
        expect(headers[1].getAttribute("aria-expanded")).toBe("true");
    });

    it("should render <live_region> tag and trigger engine.announce() programmatic announcements", async () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="statusMessage">Initial Ready</state>
          </data_model>

          <flex direction="column">
            <live_region bind="statusMessage" priority="polite" />

            <button id="announce-btn">
              <on_click action="ANNOUNCE" message="Profile Saved!" priority="assertive" />
              Notify
            </button>
          </flex>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        const liveRegion = container.querySelector("[aria-live='polite']");

        expect(liveRegion).not.toBeNull();
        expect(liveRegion.getAttribute("role")).toBe("status");
        expect(liveRegion.textContent).toBe("Initial Ready");

        // Reactive Update
        engine.setState("statusMessage", "Upload in progress (50%)");
        expect(liveRegion.textContent).toBe("Upload in progress (50%)");

        // Programmatic Announcement
        engine.announce("Backup created successfully", "polite");

        await new Promise((resolve) => setTimeout(resolve, 150));
        const announcer = document.getElementById("euix-a11y-announcer-polite");
        expect(announcer).not.toBeNull();
        expect(announcer.getAttribute("aria-live")).toBe("polite");
        expect(announcer.textContent).toBe("Backup created successfully");
    });

    it("should support roving tabindex helper across arbitrary item lists", () => {
        const listContainer = document.createElement("div");
        listContainer.innerHTML = `
            <button id="t1">Tab 1</button>
            <button id="t2">Tab 2</button>
            <button id="t3">Tab 3</button>
        `;
        document.body.appendChild(listContainer);

        const items = Array.from(listContainer.querySelectorAll("button"));
        setupRovingTabIndex(items, { orientation: "horizontal" });

        expect(items[0].getAttribute("tabindex")).toBe("0");
        expect(items[1].getAttribute("tabindex")).toBe("-1");
        expect(items[2].getAttribute("tabindex")).toBe("-1");

        // ArrowRight from Tab 1 to Tab 2
        const rightEvt = new dom.window.KeyboardEvent("keydown", {
            key: "ArrowRight",
            bubbles: true,
            cancelable: true,
        });
        items[0].dispatchEvent(rightEvt);

        expect(items[0].getAttribute("tabindex")).toBe("-1");
        expect(items[1].getAttribute("tabindex")).toBe("0");
    });
});
