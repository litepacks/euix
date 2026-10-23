import { describe, it, expect } from "vitest";
import {
    repairPartialJson,
    repairPartialXml,
    parsePartialJson,
    parseStreamingEuix,
    streamRender,
    createEuixStreamRenderer,
    stripMarkdownFences,
} from "../src/prepare/parser/streamingJson.js";

describe("Streaming Partial JSON & XML Parser Suite (Faz 4)", () => {
    describe("stripMarkdownFences", () => {
        it("strips ```json code fences with newline", () => {
            const raw = "```json\n{\"version\": 1}\n```";
            expect(stripMarkdownFences(raw)).toBe("{\"version\": 1}");
        });

        it("strips unclosed ```json code fence", () => {
            const raw = "```json\n{\"version\": 1, \"view\": {";
            expect(stripMarkdownFences(raw)).toBe("{\"version\": 1, \"view\": {");
        });

        it("handles empty or non-string input safely", () => {
            expect(stripMarkdownFences("")).toBe("");
            expect(stripMarkdownFences(null)).toBe("");
        });
    });

    describe("repairPartialJson", () => {
        it("returns already valid JSON without change", () => {
            const input = '{"version": 1, "state": {"count": 0}}';
            const repaired = repairPartialJson(input);
            expect(repaired).toBe(input);
            expect(JSON.parse(repaired)).toEqual({ version: 1, state: { count: 0 } });
        });

        it("repairs unclosed root object", () => {
            const input = '{"version": 1, "state": {"count": 42}';
            const repaired = repairPartialJson(input);
            expect(JSON.parse(repaired)).toEqual({ version: 1, state: { count: 42 } });
        });

        it("repairs deeply nested objects and arrays", () => {
            const input = '{"a": {"b": [1, 2, {"c": "nested"';
            const repaired = repairPartialJson(input);
            expect(JSON.parse(repaired)).toEqual({ a: { b: [1, 2, { c: "nested" }] } });
        });

        it("repairs unclosed string value", () => {
            const input = '{"version": 1, "view": {"tag": "button", "children": ["Click me now';
            const repaired = repairPartialJson(input);
            expect(JSON.parse(repaired)).toEqual({
                version: 1,
                view: { tag: "button", children: ["Click me now"] },
            });
        });

        it("preserves escaped quotes inside unclosed string values", () => {
            const input = '{"title": "Welcome \\"guest\\" to our ';
            const repaired = repairPartialJson(input);
            expect(JSON.parse(repaired)).toEqual({
                title: 'Welcome "guest" to our ',
            });
        });

        it("strips incomplete dangling object keys", () => {
            const input = '{"tag": "flex", "wid';
            const repaired = repairPartialJson(input);
            expect(JSON.parse(repaired)).toEqual({ tag: "flex" });
        });

        it("strips incomplete object keys when it is the first key", () => {
            const input = '{"wid';
            const repaired = repairPartialJson(input);
            expect(JSON.parse(repaired)).toEqual({});
        });

        it("strips dangling key with colon but no value", () => {
            const input = '{"tag": "flex", "children": ';
            const repaired = repairPartialJson(input);
            expect(JSON.parse(repaired)).toEqual({ tag: "flex" });
        });

        it("strips trailing comma in arrays and objects", () => {
            const arrInput = '{"items": [1, 2, 3, ';
            const arrRepaired = repairPartialJson(arrInput);
            expect(JSON.parse(arrRepaired)).toEqual({ items: [1, 2, 3] });

            const objInput = '{"a": 1, "b": 2, ';
            const objRepaired = repairPartialJson(objInput);
            expect(JSON.parse(objRepaired)).toEqual({ a: 1, b: 2 });
        });

        it("repairs partial boolean literals (tru -> true, fal -> false)", () => {
            const input1 = '{"active": tru';
            expect(JSON.parse(repairPartialJson(input1))).toEqual({ active: true });

            const input2 = '{"active": fal';
            expect(JSON.parse(repairPartialJson(input2))).toEqual({ active: false });

            const input3 = '{"items": [true, false, nul';
            expect(JSON.parse(repairPartialJson(input3))).toEqual({ items: [true, false, null] });
        });

        it("repairs partial numbers with trailing minus or decimal dot", () => {
            const input1 = '{"count": -';
            expect(JSON.parse(repairPartialJson(input1))).toEqual({ count: 0 });

            const input2 = '{"ratio": 3.';
            expect(JSON.parse(repairPartialJson(input2))).toEqual({ ratio: 3.0 });
        });

        it("handles trailing backslash at end of string without breaking quotes", () => {
            const input = '{"path": "C:\\\\Windows\\\\';
            const repaired = repairPartialJson(input);
            expect(JSON.parse(repaired)).toEqual({ path: "C:\\Windows\\" });
        });

        it("returns null if no JSON root structure is found", () => {
            expect(repairPartialJson("Hello world, here is some text")).toBeNull();
            expect(repairPartialJson("")).toBeNull();
        });
    });

    describe("parsePartialJson", () => {
        it("parses complete JSON with isComplete: true", () => {
            const res = parsePartialJson('{"version": 1}');
            expect(res.isComplete).toBe(true);
            expect(res.data).toEqual({ version: 1 });
            expect(res.error).toBeNull();
        });

        it("parses partial JSON with isComplete: false and repaired data", () => {
            const res = parsePartialJson('{"version": 1, "view": {"tag": "h1"');
            expect(res.isComplete).toBe(false);
            expect(res.data).toEqual({ version: 1, view: { tag: "h1" } });
            expect(res.error).toBeNull();
        });

        it("returns null data for invalid non-JSON inputs", () => {
            const res = parsePartialJson("Just plain text");
            expect(res.data).toBeNull();
            expect(res.error).toBeInstanceOf(Error);
        });
    });

    describe("repairPartialXml", () => {
        it("closes unclosed XML tags in correct LIFO order", () => {
            const partial = '<uid_spec><flex direction="column"><button class="btn">Click';
            const repaired = repairPartialXml(partial);
            expect(repaired).toContain("</button></flex></uid_spec>");
        });

        it("repairs unclosed attribute quotes and incomplete opening tag", () => {
            const partial = '<uid_spec><card padding="16';
            const repaired = repairPartialXml(partial);
            expect(repaired).toContain('padding="16"');
            expect(repaired).toContain("</card></uid_spec>");
        });

        it("closes unclosed CDATA sections", () => {
            const partial = '<uid_spec><data_model><computed id="x"><![CDATA[ $data.a < $data.b';
            const repaired = repairPartialXml(partial);
            expect(repaired).toContain("]]>");
            expect(repaired).toContain("</computed></data_model></uid_spec>");
        });
    });

    describe("parseStreamingEuix", () => {
        it("parses streaming JSON into canonical EUIX Source representation", () => {
            const stream = '{"version": 1, "state": {"count": 10}, "view": {"tag": "div", "children": ["Hello';
            const { source, isComplete, format } = parseStreamingEuix(stream);

            expect(isComplete).toBe(false);
            expect(format).toBe("json");
            expect(source).not.toBeNull();
            expect(source.version).toBe(1);
            expect(source.state).toEqual({ count: 10 });
            expect(source.view).toEqual({ tag: "div", children: ["Hello"] });
        });

        it("parses streaming XML into canonical EUIX Source representation", () => {
            const stream = '<uid_spec><data_model><state id="count" type="number">5</state></data_model><flex><p>Hi';
            const { source, isComplete, format } = parseStreamingEuix(stream);

            expect(isComplete).toBe(false);
            expect(format).toBe("xml");
            expect(source).not.toBeNull();
            expect(source.state.count).toBe(5);
            expect(source.view.tag).toBe("flex");
        });
    });

    describe("streamRender & createEuixStreamRenderer", () => {
        it("progressively renders streaming JSON chunk to HTML string", () => {
            const stream = '{"version": 1, "view": {"tag": "flex", "props": {"direction": "column"}, "children": [{"tag": "h1", "children": ["Live Stream';
            const { html, isComplete } = streamRender(stream);

            expect(isComplete).toBe(false);
            expect(html).toContain('style="display: flex; flex-direction: column;"');
            expect(html).toContain("<h1>Live Stream</h1>");
        });

        it("handles stream before view has been output without throwing", () => {
            const stream = '{"version": 1, "state": {"count": 0}';
            const { html, isComplete } = streamRender(stream);
            expect(isComplete).toBe(false);
            expect(html).toBe("");
        });

        it("consumes an async iterable token stream and yields progressive frames", async () => {
            async function* fakeLlmStream() {
                yield '{"version": 1, ';
                yield '"view": {"tag": ';
                yield '"card", "props": {"padding": 20}, ';
                yield '"children": ["Card ';
                yield 'Title"]}}';
            }

            const frames = [];
            for await (const frame of createEuixStreamRenderer(fakeLlmStream())) {
                frames.push(frame);
            }

            expect(frames.length).toBe(5);
            // Last frame should be complete and have rendered card
            const lastFrame = frames[frames.length - 1];
            expect(lastFrame.isComplete).toBe(true);
            expect(lastFrame.html).toContain('class="euix-card"');
            expect(lastFrame.html).toContain("Card Title");
        });
    });
});
