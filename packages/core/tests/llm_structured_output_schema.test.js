import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    generateLlmSchema,
    formatOpenAiStructuredOutput,
    formatGeminiResponseSchema,
    jsonToXml,
    xmlToJson,
} from "../src/prepare/index.js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

describe("Phase 2: Schema & Constraint-Driven LLM Code Generation", () => {
    const tempDir = path.resolve(process.cwd(), "tests/temp_llm_schema");

    beforeEach(() => {
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    });

    describe("2.1 Dynamic LLM Schema Generator (generateLlmSchema)", () => {
        it("should dynamically inject states into StateKey enum and ViewNode $bind", async () => {
            const schema = await generateLlmSchema({
                states: ["counter", "user_name", "is_active"],
            });

            expect(schema.$defs.StateKey).toBeDefined();
            expect(schema.$defs.StateKey.enum).toEqual(["counter", "user_name", "is_active"]);

            const viewNodeObj = schema.$defs.ViewNode.anyOf.find(
                (e) => e.type === "object" && e.properties,
            );
            expect(viewNodeObj.properties.$bind.$ref).toBe("#/$defs/StateKey");
            expect(viewNodeObj.properties.for_each.anyOf[0].$ref).toBe("#/$defs/StateKey");
        });

        it("should dynamically inject actions into ActionName enum", async () => {
            const schema = await generateLlmSchema({
                actions: ["saveUser", "resetForm", "fetchAnalytics"],
            });

            expect(schema.$defs.ActionName).toBeDefined();
            expect(schema.$defs.ActionName.enum).toEqual(["saveUser", "resetForm", "fetchAnalytics"]);
        });

        it("should dynamically inject components into ComponentName enum", async () => {
            const schema = await generateLlmSchema({
                components: ["UserCard", "HeaderNav", "FooterBar"],
            });

            expect(schema.$defs.ComponentName).toBeDefined();
            expect(schema.$defs.ComponentName.enum).toEqual(["UserCard", "HeaderNav", "FooterBar"]);

            const viewNodeObj = schema.$defs.ViewNode.anyOf.find(
                (e) => e.type === "object" && e.properties,
            );
            expect(viewNodeObj.properties.component.$ref).toBe("#/$defs/ComponentName");
        });

        it("should dynamically inject routes into Route enum", async () => {
            const schema = await generateLlmSchema({
                routes: ["/", "/dashboard", "/settings"],
            });

            expect(schema.properties.route.anyOf[0].enum).toEqual(["/", "/dashboard", "/settings"]);
            expect(schema.properties.route.anyOf[1].properties.path.enum).toEqual(["/", "/dashboard", "/settings"]);
        });

        it("should dynamically extract context entities when projectPath is provided", async () => {
            const schema = await generateLlmSchema({
                projectPath: path.resolve(process.cwd(), "tests/fixtures/components"),
            });

            expect(schema.$defs.StateKey).toBeDefined();
            expect(schema.$defs.ComponentName).toBeDefined();
        });

        it("should enforce strict mode with additionalProperties: false and required everywhere", async () => {
            const schema = await generateLlmSchema({
                states: ["count", "active"],
                actions: ["increment"],
                strict: true,
            });

            // Verify strict rules at top level
            expect(schema.additionalProperties).toBe(false);
            expect(schema.required).toBeDefined();
            expect(schema.required).toEqual(Object.keys(schema.properties));

            // Helper to recursively assert strictness
            function assertStrictness(node) {
                if (!node || typeof node !== "object") return;
                if (node.type === "object" || node.properties) {
                    expect(node.additionalProperties).toBe(false);
                    if (node.properties) {
                        expect(node.required).toEqual(Object.keys(node.properties));
                        for (const val of Object.values(node.properties)) {
                            assertStrictness(val);
                        }
                    }
                }
                if (node.items) {
                    if (Array.isArray(node.items)) node.items.forEach(assertStrictness);
                    else assertStrictness(node.items);
                }
                if (node.anyOf) node.anyOf.forEach(assertStrictness);
                if (node.oneOf) node.oneOf.forEach(assertStrictness);
            }

            assertStrictness(schema);
        });

        it("should format correctly for OpenAI Structured Outputs", async () => {
            const baseSchema = await generateLlmSchema({
                states: ["count"],
            });

            const openAiFormat = formatOpenAiStructuredOutput(baseSchema, "euix_component");
            expect(openAiFormat.type).toBe("json_schema");
            expect(openAiFormat.json_schema.name).toBe("euix_component");
            expect(openAiFormat.json_schema.strict).toBe(true);
            expect(openAiFormat.json_schema.schema.additionalProperties).toBe(false);
        });

        it("should format correctly for Google Gemini JSON Mode", async () => {
            const baseSchema = await generateLlmSchema({
                states: ["count"],
            });

            const geminiFormat = formatGeminiResponseSchema(baseSchema);
            expect(geminiFormat.responseMimeType).toBe("application/json");
            expect(geminiFormat.responseSchema).toBeDefined();
            expect(geminiFormat.responseSchema.title).toContain("EUIX Source JSON Specification");
        });
    });

    describe("2.2 Escape Safety & Declarative Normalization in jsonToXml", () => {
        it("should automatically wrap computed expressions containing operators in CDATA", () => {
            const jsonSource = {
                version: 1,
                state: { counter: 0 },
                computed: {
                    isSmall: { get: "data.counter <= 10 && data.counter >= 0" },
                    simpleName: { get: "data.first + ' ' + data.last" },
                    withOr: { get: "data.a || data.b" },
                },
                view: { tag: "div" },
            };

            const xml = jsonToXml(jsonSource);

            // Operators must be wrapped in CDATA
            expect(xml).toContain("<computed id=\"isSmall\"><![CDATA[data.counter <= 10 && data.counter >= 0]]></computed>");
            expect(xml).toContain("<computed id=\"withOr\"><![CDATA[data.a || data.b]]></computed>");
            // Simple expression without unsafe operators doesn't require CDATA
            expect(xml).toContain("<computed id=\"simpleName\">data.first + ' ' + data.last</computed>");
        });

        it("should not double-wrap CDATA if already wrapped", () => {
            const jsonSource = {
                version: 1,
                computed: {
                    alreadyWrapped: { get: "<![CDATA[data.x < 5]]>" },
                },
                view: { tag: "div" },
            };

            const xml = jsonToXml(jsonSource);
            expect(xml).toContain("<computed id=\"alreadyWrapped\"><![CDATA[data.x < 5]]></computed>");
            expect(xml).not.toContain("<![CDATA[<![CDATA[");
        });

        it("should serialize declarative event shorthands to idiomatic EUIX XML attributes", () => {
            const jsonSource = {
                version: 1,
                view: {
                    tag: "div",
                    children: [
                        {
                            tag: "button",
                            events: { click: { set: "counter=counter+1" } },
                            children: ["+1"],
                        },
                        {
                            tag: "button",
                            events: { click: { toggle: "isOpen" } },
                            children: ["Toggle"],
                        },
                        {
                            tag: "button",
                            events: { click: { mutate: "items.CLEAR" } },
                            children: ["Clear"],
                        },
                        {
                            tag: "button",
                            events: { click: { revalidate: "get_users" } },
                            children: ["Refresh"],
                        },
                        {
                            tag: "button",
                            events: { click: { run: "$data.counter += 5;" } },
                            children: ["Add 5"],
                        },
                        {
                            tag: "button",
                            events: { click: "saveUser" },
                            children: ["Save"],
                        },
                    ],
                },
            };

            const xml = jsonToXml(jsonSource);

            expect(xml).toContain('on_click:set="counter=counter+1"');
            expect(xml).toContain('on_click:toggle="isOpen"');
            expect(xml).toContain('on_click:mutate="items.CLEAR"');
            expect(xml).toContain('on_click:revalidate="get_users"');
            expect(xml).toContain('on_click:run="$data.counter += 5;"');
            expect(xml).toContain('on_click:call="saveUser"');
        });

        it("should serialize input bind shorthand and loop bindings cleanly", () => {
            const jsonSource = {
                version: 1,
                state: { username: "Alice", list: [] },
                view: {
                    tag: "form",
                    children: [
                        { tag: "input", $bind: "username" },
                        {
                            tag: "for_each",
                            for_each: "list",
                            var: "item",
                            key: "id",
                            children: [{ tag: "span", children: ["{item.name}"] }],
                        },
                    ],
                },
            };

            const xml = jsonToXml(jsonSource);

            expect(xml).toContain('<input bind="username" />');
            expect(xml).toContain('items="{data.list}"');
            expect(xml).toContain('var="item"');
            expect(xml).toContain('key="id"');
        });

        it("should serialize rich action definitions and CDATA script steps", () => {
            const jsonSource = {
                version: 1,
                actions: {
                    complexAction: {
                        steps: [
                            { run: "if (x <= 5 && y > 0) { console.log(true); }" },
                            { set: { counter: "counter+1" } },
                            { mutate: { target: "items", operation: "CLEAR" } },
                            { call: "notifyUser", assign: "status" },
                        ],
                    },
                },
                view: { tag: "div" },
            };

            const xml = jsonToXml(jsonSource);

            expect(xml).toContain('<action_def name="complexAction">');
            expect(xml).toContain('<step action="RUN_SCRIPT"><![CDATA[if (x <= 5 && y > 0) { console.log(true); }]]></step>');
            expect(xml).toContain('<step action="SET_STATE" path="counter" value="counter+1" />');
            expect(xml).toContain('<step action="MUTATE_STATE" path="items" operation="CLEAR" />');
            expect(xml).toContain('<step call="notifyUser" assign="status" />');
        });
    });

    describe("2.3 CLI Integration (euix schema --llm)", () => {
        const cliPath = path.resolve(process.cwd(), "bin/euix.js");

        it("should output LLM schema to stdout when --llm is passed", () => {
            const stdout = execSync(`node ${cliPath} schema --llm`, { encoding: "utf8" });
            const parsed = JSON.parse(stdout);

            expect(parsed.$schema).toBe("http://json-schema.org/draft-07/schema#");
            expect(parsed.$defs.StateKey).toBeDefined();
            expect(parsed.$defs.ActionName).toBeDefined();
        });

        it("should output OpenAI structured output format when --openai is passed", () => {
            const stdout = execSync(`node ${cliPath} schema --llm --openai`, { encoding: "utf8" });
            const parsed = JSON.parse(stdout);

            expect(parsed.type).toBe("json_schema");
            expect(parsed.json_schema.strict).toBe(true);
            expect(parsed.json_schema.schema.additionalProperties).toBe(false);
        });

        it("should output Gemini response schema format when --gemini is passed", () => {
            const stdout = execSync(`node ${cliPath} schema --llm --gemini`, { encoding: "utf8" });
            const parsed = JSON.parse(stdout);

            expect(parsed.responseMimeType).toBe("application/json");
            expect(parsed.responseSchema).toBeDefined();
        });

        it("should write strict LLM schema to file with -o", () => {
            const outPath = path.join(tempDir, "llm_strict_schema.json");
            const stdout = execSync(`node ${cliPath} schema --llm --strict -o ${outPath}`, { encoding: "utf8" });

            expect(stdout).toContain("Generated EUIX JSON Schema at");
            expect(fs.existsSync(outPath)).toBe(true);

            const fileContent = fs.readFileSync(outPath, "utf8");
            const parsed = JSON.parse(fileContent);
            expect(parsed.additionalProperties).toBe(false);
            expect(parsed.$defs.StateKey).toBeDefined();
        });
    });
});
