import { describe, it, expect, beforeEach, vi } from "vitest";
import { EUIXEngineCore, EUIXXMLParseError, EUIXStructuredError, EUIXExpressionParser } from "../src/core/EUIXEngineCore.js";

describe("EUIXEngineCore Coverage Boost Suite", () => {
    let container;

    beforeEach(() => {
        container = document.createElement("div");
        document.body.appendChild(container);
    });

    it("should test EUIXXMLParseError and visual codeframe generation", () => {
        const err = new EUIXXMLParseError("Unexpected closing tag", 5, 12, "  4 | <flex>\n> 5 |   </wrong>\n  6 | </flex>", "<uid_spec></uid_spec>");
        expect(err.name).toBe("EUIXXMLParseError");
        expect(err.code).toBe("XML_PARSE_ERROR");
        expect(err.line).toBe(5);
        expect(err.column).toBe(12);
        expect(err.codeFrame).toContain("> 5 |");
    });

    it("should test EUIXStructuredError serialization and cause propagation", () => {
        const innerErr = new Error("Network timeout");
        const structured = new EUIXStructuredError({
            message: "Failed to submit form",
            code: "API_TIMEOUT",
            originatingAction: "XHR",
            status: 408,
            cause: innerErr
        });

        expect(structured.name).toBe("EUIXStructuredError");
        expect(structured.code).toBe("API_TIMEOUT");
        expect(structured.originatingAction).toBe("XHR");
        expect(structured.cause).toBe(innerErr);
        expect(structured.toJSON().status).toBe(408);
    });

    it("should test EUIXExpressionParser cache and clearExpressionCache", () => {
        EUIXExpressionParser.clearExpressionCache();
        const statsInitial = EUIXExpressionParser.getExpressionCacheStats();
        expect(statsInitial.size).toBe(0);

        const evaluated = EUIXExpressionParser.eval("10 + 20 * 2", () => 0);
        expect(evaluated).toBe(50);

        const statsAfter = EUIXExpressionParser.getExpressionCacheStats();
        expect(statsAfter.size).toBeGreaterThanOrEqual(1);

        EUIXExpressionParser.clearExpressionCache();
        expect(EUIXExpressionParser.getExpressionCacheStats().size).toBe(0);
    });

    it("should test custom component registration and lifecycle error boundaries", () => {
        EUIXEngineCore.registerComponent("throwing-widget", () => {
            throw new Error("Widget rendering crashed!");
        });

        const xml = `
        <uid_spec>
            <throwing-widget />
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine).toBeDefined();

        const fallbackEl = container.querySelector(".euix-error-fallback");
        expect(fallbackEl).not.toBeNull();
    });

    it("should test batch() synchronous execution and state synchronization", () => {
        const xml = `
        <uid_spec>
            <data_model>
                <state id="a">1</state>
                <state id="b">2</state>
            </data_model>
            <div>
                <span id="val-a">{data.a}</span>
                <span id="val-b">{data.b}</span>
            </div>
        </uid_spec>
        `;

        const engine = EUIXEngineCore.mount(xml, container);
        expect(engine).toBeDefined();

        engine.batch(() => {
            engine.setState("a", "10");
            engine.setState("b", "20");
        });

        expect(engine.getState("a")).toBe("10");
        expect(engine.getState("b")).toBe("20");
    });
});
