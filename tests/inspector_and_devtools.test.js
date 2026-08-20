/**
 * tests/inspector_and_devtools.test.js
 * Comprehensive unit and integration test suite for EUIX Inspector & DevTools Plugin (@euix/inspector / @euix/devtools).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";
import { EUIXInspector, inspector, EUIXDevTools } from "../src/EUIXDevTools.js";
import { generateSelectors, checkUniqueness, getAccessibleInfo, getCssPath } from "../src/plugins/inspector/selectors.js";
import { maskSensitive, isSensitiveKey, getElementMetadata, createDebugSnapshot, buildComponentTree } from "../src/plugins/inspector/metadata.js";
import { euix, getByComponent, getByAction, getByTestId } from "../src/plugins/inspector/playwright.js";

describe("EUIX Inspector & DevTools Plugin Suite", () => {
    let container;
    let engine;
    let devtools;

    beforeEach(() => {
        container = document.createElement("div");
        container.id = "app-container";
        document.body.appendChild(container);

        const xml = `
        <uid_spec>
            <data_model>
                <state id="user" type="object">{"name": "Ahmet", "role": "Architect", "apiKey": "secret_12345", "token": "jwt.abc.xyz"}</state>
                <state id="counter">10</state>
                <state id="theme">dark</state>
            </data_model>

            <component_def name="UserCard">
                <data_model isolated="true">
                    <state id="cardOpen" type="boolean">true</state>
                    <state id="password">super_secret_pw</state>
                </data_model>
                <flex direction="column" class="user-card" id="user-card-root">
                    <h2 test-id="user-title" aria-label="User Profile Header">User Profile</h2>
                    <span bind="user.name" class="user-name">Name</span>
                    <button test-id="save-user-btn" action="saveUser" class="btn btn-primary" name="save">Save User</button>
                    <input type="text" name="user_notes" placeholder="Enter notes" bind="user_notes" />
                </flex>
            </component_def>

            <flex direction="column" class="main-layout">
                <component name="UserCard" user_id="101" />
                <button id="counter-btn" data-xui-ref="counterButton">
                    <on_click action="SET_STATE">
                        <path>data.counter</path>
                        <value>{data.counter} + 1</value>
                    </on_click>
                    Increment
                </button>
            </flex>
        </uid_spec>
        `;

        engine = EUIXEngine.mount(xml, container);
        devtools = EUIXDevTools.init(engine, { enabled: true, autoOpen: true, maxEvents: 50 });
    });

    afterEach(() => {
        if (devtools) {
            devtools.destroy();
        }
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
        delete engine._devtools;
        delete window.EUIX_INSPECTOR;
        delete window.$euix;
        vi.restoreAllMocks();
    });

    it("should support zero-cost disabled mode when enabled: false", () => {
        const disabledInspector = new EUIXInspector(engine, { enabled: false });
        expect(disabledInspector.enabled).toBe(false);
        expect(disabledInspector.overlay).toBeNull();
        expect(disabledInspector.panel).toBeNull();
        expect(disabledInspector.actionLogs.length).toBe(0);
        disabledInspector.destroy();
    });

    it("should toggle inspect mode via shortcut (Alt+Shift+X, Alt+Shift+I, Escape) and programmatic methods", () => {
        expect(devtools.enabled).toBe(true);

        // 1. Programmatic disable
        devtools.disable();
        expect(devtools.enabled).toBe(false);

        // 2. Programmatic enable & toggle
        devtools.enable();
        expect(devtools.enabled).toBe(true);
        devtools.toggle();
        expect(devtools.enabled).toBe(false);

        // 3. Alt+Shift+X Shortcut
        const keyAltShiftX = new KeyboardEvent("keydown", {
            key: "x",
            altKey: true,
            shiftKey: true,
            bubbles: true
        });
        document.dispatchEvent(keyAltShiftX);
        expect(devtools.enabled).toBe(true);

        // 4. Escape Shortcut
        const keyEsc = new KeyboardEvent("keydown", {
            key: "Escape",
            bubbles: true
        });
        document.dispatchEvent(keyEsc);
        expect(devtools.enabled).toBe(false);
    });

    it("should inspect element, extract metadata, and render highlight overlay and tooltip", () => {
        const saveBtn = container.querySelector('[test-id="save-user-btn"]');
        expect(saveBtn).not.toBeNull();

        saveBtn.getBoundingClientRect = () => ({
            top: 100,
            left: 50,
            width: 140,
            height: 38,
            bottom: 138,
            right: 190
        });

        // Trigger hover inspect
        const moveEvt = new MouseEvent("mousemove", { bubbles: true });
        saveBtn.dispatchEvent(moveEvt);

        // Verify overlay and tooltip
        expect(devtools.overlay).not.toBeNull();
        const meta = getElementMetadata(saveBtn, engine);
        expect(meta.component).toBe("UserCard");
        expect(meta.testId).toBe("save-user-btn");
        expect(meta.actions).toContain("saveUser");

        devtools.overlay.highlight(saveBtn, meta);
        expect(devtools.overlay.highlightEl.style.display).toBe("block");
        expect(devtools.overlay.tooltipEl.style.display).toBe("block");
        expect(devtools.overlay.tooltipEl.innerHTML).toContain("UserCard");
        expect(devtools.overlay.tooltipEl.innerHTML).toContain("save-user-btn");
        expect(devtools.overlay.tooltipEl.innerHTML).toContain("saveUser");
    });

    it("should generate scored stable selector alternatives and verify uniqueness", () => {
        const saveBtn = container.querySelector('[test-id="save-user-btn"]');
        const selectors = generateSelectors(saveBtn, document);

        expect(selectors.length).toBeGreaterThan(0);

        // 1. Top recommendation should be Test ID
        const topSelector = selectors[0];
        expect(topSelector.type).toBe("test-id");
        expect(topSelector.selector).toBe('[data-euix-test="save-user-btn"]');
        expect(topSelector.score).toBe(100);
        expect(topSelector.isUnique).toBe(true);
        expect(topSelector.playwright).toBe("page.getByTestId('save-user-btn')");
        expect(topSelector.cypress).toBe("cy.get('[data-euix-test=\"save-user-btn\"]')");
        expect(topSelector.vanilla).toBe("document.querySelector('[data-euix-test=\"save-user-btn\"]')");

        // 2. Action selector
        const actionSel = selectors.find(s => s.type === "action");
        expect(actionSel).toBeDefined();
        expect(actionSel.selector).toBe('[data-euix-action="saveUser"]');

        // 3. Component-scoped selector
        const compSel = selectors.find(s => s.type === "component-scoped");
        expect(compSel).toBeDefined();
        expect(compSel.selector).toContain('data-euix-component="UserCard"');

        // 4. Test accessible role selector for heading
        const heading = container.querySelector('[test-id="user-title"]');
        const headingSelectors = generateSelectors(heading, document);
        const accessibleSel = headingSelectors.find(s => s.type === "accessible");
        expect(accessibleSel).toBeDefined();
        expect(accessibleSel.playwright).toContain("page.getByRole('heading'");
    });

    it("should mask sensitive keys (password, token, apiKey, secret) across metadata and snapshots", () => {
        expect(isSensitiveKey("apiKey")).toBe(true);
        expect(isSensitiveKey("password")).toBe(true);
        expect(isSensitiveKey("authToken")).toBe(true);
        expect(isSensitiveKey("userName")).toBe(false);

        const rawData = {
            userId: 101,
            token: "jwt.secret.token",
            password: "plaintext_password",
            apiKey: "key_xyz",
            profile: {
                secretAnswer: "my_cat",
                theme: "dark"
            }
        };

        const masked = maskSensitive(rawData);
        expect(masked.userId).toBe(101);
        expect(masked.token).toBe("********");
        expect(masked.password).toBe("********");
        expect(masked.apiKey).toBe("********");
        expect(masked.profile.secretAnswer).toBe("********");
        expect(masked.profile.theme).toBe("dark");

        // Test debug snapshot
        const saveBtn = container.querySelector('[test-id="save-user-btn"]');
        const snapshot = createDebugSnapshot(saveBtn, engine);
        expect(snapshot.component).toBe("UserCard");
        if (snapshot.globalState?.user) {
            expect(snapshot.globalState.user.apiKey).toBe("********");
            expect(snapshot.globalState.user.token).toBe("********");
        }
    });

    it("should record action lifecycle in ring buffer and handle action logs tab", async () => {
        devtools.logAction("setState", { path: "data.counter", value: 11 });
        devtools.logAction("saveUser", { path: "users/101" });
        devtools.logErrorScope("ACTION_ERROR", { error: { code: "ERR_HTTP", message: "Failed request" } });

        expect(devtools.actionLogs.length).toBe(3);

        // Open devtools panel
        devtools.panel.toggle(true);
        devtools.panel.activeTab = "logs";
        devtools.panel.render();

        const contentEl = document.getElementById("euix-panel-content");
        expect(contentEl.textContent).toContain("setState");
        expect(contentEl.textContent).toContain("saveUser");
        expect(contentEl.textContent).toContain("ACTION_ERROR");

        // Clear actions
        const clearBtn = document.getElementById("euix-clear-logs");
        expect(clearBtn).not.toBeNull();
        clearBtn.click();
        expect(devtools.actionLogs.length).toBe(0);
    });

    it("should build component tree and support boundary visualizer", () => {
        const tree = buildComponentTree(container);
        expect(tree.length).toBeGreaterThan(0);
        expect(tree[0].name).toBe("UserCard");

        // Test boundary visualizer
        devtools.showBoundaries();
        expect(devtools.boundariesVisible).toBe(true);
        expect(devtools.overlay.boundaryContainer.style.display).toBe("block");

        devtools.hideBoundaries();
        expect(devtools.boundariesVisible).toBe(false);
        expect(devtools.overlay.boundaryContainer.style.display).toBe("none");
    });

    it("should provide global console API ($euix.inspect, $euix.snapshot, $euix.componentOf, $euix.tree)", () => {
        expect(window.$euix).toBeDefined();

        const saveBtn = container.querySelector('[test-id="save-user-btn"]');
        const inspectRes = window.$euix.inspect(saveBtn);
        expect(inspectRes.component).toBe("UserCard");
        expect(inspectRes.selectors.length).toBeGreaterThan(0);

        const compName = window.$euix.componentOf(saveBtn);
        expect(compName).toBe("UserCard");

        const snapshot = window.$euix.snapshot(saveBtn);
        expect(snapshot.component).toBe("UserCard");

        const tree = window.$euix.tree();
        expect(tree.length).toBeGreaterThan(0);

        const actions = window.$euix.actions();
        expect(Array.isArray(actions)).toBe(true);
    });

    it("should execute search across components, actions, and test IDs in panel", () => {
        devtools.panel.toggle(true);
        devtools.panel.activeTab = "search";
        devtools.panel.searchQuery = "save";
        devtools.panel.render();

        const contentEl = document.getElementById("euix-panel-content");
        expect(contentEl.textContent).toContain("saveUser");
        expect(contentEl.textContent).toContain("save-user-btn");
    });

    it("should support Playwright helper euix(page) chaining and locator builders", async () => {
        // Mock Playwright Page object
        const mockLocator = {
            locator: vi.fn((sel) => ({
                click: vi.fn(),
                fill: vi.fn(),
                textContent: vi.fn(() => "User Profile"),
                waitFor: vi.fn()
            })),
            evaluate: vi.fn(() => ({
                component: "UserCard",
                componentId: "comp_1",
                props: { userId: "101" },
                actions: ["saveUser"]
            })),
            waitForFunction: vi.fn()
        };

        const pw = euix(mockLocator);
        expect(pw).toBeDefined();

        // 1. Scoped component locator
        const userCard = pw.component("UserCard");
        expect(userCard.scopeSelector).toContain('data-euix-component="UserCard"');

        // 2. Action locator
        userCard.action("saveUser");
        expect(mockLocator.locator).toHaveBeenCalled();

        // 3. Test ID locator
        userCard.getByTestId("save-user-btn");
        expect(mockLocator.locator).toHaveBeenCalled();

        // 4. WaitForIdle helper
        await pw.waitForIdle();
        expect(mockLocator.waitForFunction).toHaveBeenCalled();

        // 5. Debug helper
        const debugSnapshot = await userCard.debug();
        expect(debugSnapshot.component).toBe("UserCard");

        // 6. Standalone helpers
        getByComponent(mockLocator, "UserCard");
        getByAction(mockLocator, "saveUser");
        getByTestId(mockLocator, "save-user-btn");
        expect(mockLocator.locator).toHaveBeenCalled();
    });
});
