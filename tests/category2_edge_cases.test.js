import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EUIXEngine } from "../src/EUIXEngine.js";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import { AstParser } from "../src/core/parser/AstParser.js";
import { EUIXValidationPlugin } from "../src/plugins/EUIXValidationPlugin.js";
import { EUIXDatePlugin, EUIXDateFormatter } from "../src/plugins/EUIXDatePlugin.js";
import { EUIXWebMCPPlugin, validateInput } from "../src/plugins/EUIXWebMCPPlugin.js";
import { EUIXHeadPlugin } from "../src/plugins/EUIXHeadPlugin.js";
import { EUIXResiliencePlugin } from "../src/plugins/EUIXResiliencePlugin.js";
import { renderToString } from "../src/server/index.js";

describe("Category 2 Edge Cases & Inconsistencies Test Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    afterEach(() => {
        if (container && container.parentNode) {
            container.parentNode.removeChild(container);
        }
    });

    // -------------------------------------------------------------------------
    // 2.1 AstParser CDATA auto-wrap with script action aliases
    // -------------------------------------------------------------------------
    describe("2.1 AstParser CDATA Auto-wrap on Action Aliases", () => {
        it("should auto-protect raw JS containing '<' and '&&' in action='SCRIPT' or 'EVAL_JS'", () => {
            const rawXml = `
                <uid_spec>
                    <button id="btn1">
                        <on_click action="SCRIPT">
                            if (1 < 2 && 3 > 2) {
                                console.log("OK");
                            }
                        </on_click>
                    </button>
                    <button id="btn2">
                        <on_click action="EVAL_JS">
                            if (a < b && c > d) return true;
                        </on_click>
                    </button>
                </uid_spec>
            `;
            // Should parse without XML syntax errors
            const doc = AstParser.parse(rawXml);
            expect(doc).not.toBeNull();
            expect(doc.children.length).toBeGreaterThan(0);
        });
    });

    // -------------------------------------------------------------------------
    // 2.2 Validation Plugin: Boolean false required validation
    // -------------------------------------------------------------------------
    describe("2.2 Validation Plugin Required Rule on Checkbox", () => {
        it("should fail required validation when boolean checkbox state is false", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="agree_terms" type="boolean">false</state>
                    </data_model>
                    <input type="checkbox" bind="agree_terms" required="true" required_message="You must accept terms" />
                </uid_spec>
            `;
            const engine = EUIXEngineCore.use(EUIXValidationPlugin).mount(xml, container);
            const isValid = engine.validate();
            expect(isValid).toBe(false);
            expect(engine.getFieldError("agree_terms")).toBe("You must accept terms");

            // Now set to true
            engine.setState("agree_terms", true);
            const isNowValid = engine.validate();
            expect(isNowValid).toBe(true);
            expect(engine.getFieldError("agree_terms")).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // 2.3 Date Plugin: Short (e.g. 9-digit) numeric string timestamps
    // -------------------------------------------------------------------------
    describe("2.3 Date Plugin Variable-Length Timestamp Strings", () => {
        it("should safely parse 9-digit or short timestamp strings", () => {
            const formatter = new EUIXDateFormatter();
            // 9-digit timestamp in seconds: 980000000 (Jan 20, 2001)
            const date = formatter.parseDate("980000000");
            expect(date).not.toBeNull();
            expect(date.getTime()).toBe(980000000 * 1000);

            // 13-digit timestamp in milliseconds
            const dateMs = formatter.parseDate("1700000000000");
            expect(dateMs).not.toBeNull();
            expect(dateMs.getTime()).toBe(1700000000000);
        });
    });

    // -------------------------------------------------------------------------
    // 2.4 WebMCP Plugin: Enum validation in validateInput
    // -------------------------------------------------------------------------
    describe("2.4 WebMCP Plugin Enum Validation", () => {
        it("should throw validation error when input value is not in schema enum", () => {
            const schema = {
                type: "object",
                properties: {
                    status: {
                        type: "string",
                        enum: ["active", "paused", "completed"],
                    },
                },
                required: ["status"],
            };

            // Valid enum value
            expect(() => validateInput({ status: "active" }, schema)).not.toThrow();

            // Invalid enum value
            expect(() => validateInput({ status: "invalid_status" }, schema)).toThrowError(
                /not in allowed enum values/,
            );
        });
    });

    // -------------------------------------------------------------------------
    // 2.5 Head Plugin: Reactive simple token placeholders {key}
    // -------------------------------------------------------------------------
    describe("2.5 Head Plugin Reactive Placeholders", () => {
        it("should update document.title when state changes with simple placeholder {page_title}", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="page_title">Initial Title</state>
                    </data_model>
                    <head>
                        <title>{page_title}</title>
                    </head>
                </uid_spec>
            `;
            const engine = EUIXEngineCore.use(EUIXHeadPlugin).mount(xml, container);
            expect(document.title).toBe("Initial Title");

            engine.setState("page_title", "Updated Page Title");
            expect(document.title).toBe("Updated Page Title");
        });
    });

    // -------------------------------------------------------------------------
    // 2.6 SSR Server Renderer: Flex CSS Normalization
    // -------------------------------------------------------------------------
    describe("2.6 SSR Server Renderer Flex CSS Normalization", () => {
        it("should output valid CSS for justify='between' and align='start'", () => {
            const xml = `
                <uid_spec>
                    <flex direction="row" justify="between" align="start" gap="12">
                        <span>Item 1</span>
                        <span>Item 2</span>
                    </flex>
                </uid_spec>
            `;
            const html = renderToString(xml);
            expect(html).toContain("justify-content: space-between");
            expect(html).toContain("align-items: flex-start");
            expect(html).not.toContain("justify-content: between");
            expect(html).not.toContain("align-items: start");
        });
    });

    // -------------------------------------------------------------------------
    // 2.7 BindingResolver: Deep context path binding
    // -------------------------------------------------------------------------
    describe("2.7 Deep Context Binding (item.user.name)", () => {
        it("should bind and update nested properties on loop context items", () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="members" type="array">[
                            {"id": 1, "user": {"name": "Alice", "role": "Admin"}}
                        ]</state>
                    </data_model>
                    <container>
                        <for_each items="{data.members}" var="member">
                            <input id="input-role" bind="member.user.role" />
                        </for_each>
                    </container>
                </uid_spec>
            `;
            const engine = EUIXEngine.mount(xml, container);
            const input = container.querySelector("#input-role");
            expect(input).not.toBeNull();
            expect(input.value).toBe("Admin");

            // Change input value
            input.value = "Superadmin";
            input.dispatchEvent(new Event("input", { bubbles: true }));

            const members = engine.getState("members");
            expect(members[0].user.role).toBe("Superadmin");
        });
    });

    // -------------------------------------------------------------------------
    // 2.8 Resilience Plugin: WAIT and SLEEP direct execution
    // -------------------------------------------------------------------------
    describe("2.8 Resilience Plugin Direct Delay Execution", () => {
        it("should execute WAIT and SLEEP actions without error", async () => {
            const xml = `
                <uid_spec>
                    <data_model>
                        <state id="status">pending</state>
                    </data_model>
                    <button id="btn-wait">
                        <on_click action="WAIT" ms="20" />
                        <on_click action="SET_STATE">
                            <path>status</path>
                            <value>done</value>
                        </on_click>
                    </button>
                </uid_spec>
            `;
            const engine = EUIXEngineCore.use(EUIXResiliencePlugin).mount(xml, container);
            const btn = container.querySelector("#btn-wait");
            btn.click();

            await new Promise((r) => setTimeout(r, 60));
            expect(engine.getState("status")).toBe("done");
        });
    });
});
