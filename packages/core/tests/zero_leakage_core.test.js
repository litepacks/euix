import { describe, it, expect, beforeEach } from "vitest";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { EUIXCollapsePlugin } from "../src/plugins/EUIXCollapsePlugin.js";
import { EUIXDialogPlugin } from "../src/plugins/EUIXDialogPlugin.js";
import { EUIXA11yPlugin } from "../src/plugins/EUIXA11yPlugin.js";
import { EUIXHeadPlugin } from "../src/plugins/EUIXHeadPlugin.js";
import { EUIXStoragePlugin } from "../src/plugins/EUIXStoragePlugin.js";
import { EUIXApiPlugin } from "../src/plugins/EUIXApiPlugin.js";
import { resolveScopedValue, registerBindingNamespace } from "../src/core/binding/BindingResolver.js";

describe("Zero-Leakage Plugin Architecture & Core Pruning", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    it("1. should instantiate clean EUIXEngineCore without allocating plugin-specific state", () => {
        const engine = new EUIXEngineCore(container);
        // Zero plugin leakage in core constructor
        expect(engine._persistenceConfig).toBeNull();
        expect(engine._apiConfig).toBeNull();
        expect(engine._registeredXhrs).toBeNull();
        expect(engine._xhrCache).toBeNull();
    });

    it("2. should support static and instance registerTag for dynamic tag rendering", () => {
        // Register custom tag statically
        EUIXEngineCore.registerTag("custom_badge", function (xmlNode, context) {
            const span = document.createElement("span");
            span.className = "custom-badge";
            span.textContent = this.interpolate(xmlNode.textContent.trim(), context);
            return span;
        });

        const xml = `
            <uid_spec>
                <data_model>
                    <state id="status">Active</state>
                </data_model>
                <main>
                    <custom_badge>Status: {data.status}</custom_badge>
                </main>
            </uid_spec>
        `;

        const engine = new EUIXEngineCore(container);
        engine.mount(xml);

        const badge = container.querySelector(".custom-badge");
        expect(badge).toBeTruthy();
        expect(badge.textContent).toBe("Status: Active");
    });

    it("3. should render collapse and dialog tags via registered plugins without core hardcoding", () => {
        EUIXEngineCore.use(EUIXCollapsePlugin).use(EUIXDialogPlugin);

        const xml = `
            <uid_spec>
                <data_model>
                    <state id="isOpen" type="boolean">true</state>
                </data_model>
                <div>
                    <collapse bind="isOpen" title="Accordion Title">
                        <p>Accordion content</p>
                    </collapse>
                    <dialog bind="isOpen" title="Modal Title">
                        <p>Dialog content</p>
                    </dialog>
                </div>
            </uid_spec>
        `;

        const engine = new EUIXEngineCore(container);
        engine.mount(xml);

        const collapseHeader = container.querySelector(".euix-collapse-header");
        expect(collapseHeader).toBeTruthy();
        expect(collapseHeader.getAttribute("aria-expanded")).toBe("true");

        const dialogOverlay = container.querySelector(".dialog-backdrop");
        expect(dialogOverlay).toBeTruthy();
        expect(container.querySelector(".euix-dialog-container")).toBeTruthy();
    });

    it("4. should resolve custom binding namespaces registered via registerBindingNamespace", () => {
        registerBindingNamespace("user_profile", (engine, scope, prop) => {
            if (prop === "fullName") return "Alice Wonderland";
            if (prop === "level") return 42;
            return undefined;
        });

        const engine = new EUIXEngineCore(container);
        const nameVal = resolveScopedValue(engine, "user_profile", "fullName", {});
        const levelVal = resolveScopedValue(engine, "user_profile", "level", {});

        expect(nameVal).toBe("Alice Wonderland");
        expect(levelVal).toBe(42);

        // Path resolution via engine.resolveValueFromPath
        expect(engine.resolveValueFromPath("user_profile.fullName")).toBe("Alice Wonderland");
        expect(engine.resolveValueFromPath("user_profile.level")).toBe(42);
    });

    it("5. should lazily initialize _persistenceConfig when <persistence> or persist() is used", () => {
        EUIXEngineCore.use(EUIXStoragePlugin);

        const xml = `
            <uid_spec>
                <data_model>
                    <state id="theme" persist="local">dark</state>
                </data_model>
                <div>{data.theme}</div>
            </uid_spec>
        `;

        const engine = new EUIXEngineCore(container);
        engine.mount(xml);

        expect(engine._persistenceConfig).toBeInstanceOf(Map);
        expect(engine._persistenceConfig.has("theme")).toBe(true);
    });

    it("6. should lazily initialize _apiConfig when configureApi() is called", () => {
        EUIXEngineCore.use(EUIXApiPlugin);

        const engine = new EUIXEngineCore(container);
        expect(engine._apiConfig).toBeTruthy();
        expect(engine._apiConfig.baseUrl).toBe("");

        engine.configureApi({ baseUrl: "https://api.test.com", timeout: 5000 });
        expect(engine._apiConfig.baseUrl).toBe("https://api.test.com");
        expect(engine._apiConfig.timeout).toBe(5000);
    });
});
