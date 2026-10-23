/**
 * packages/core/tests/toon_converter_and_context.test.js
 * Comprehensive test suite for TOON (Token-Oriented Object Notation)
 * serializer, parser, data_model state integration, and LLM context generation.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { EUIXEngineCore } from "../src/core/EUIXEngineCore.js";
import {
    jsonToToon,
    toonToJson,
    convert,
    generateLlmContext,
    formatContextToToon,
} from "../src/prepare/index.js";

const tmpDir = path.resolve(process.cwd(), "tests/fixtures/tmp_toon_test");

describe("Phase 1: TOON Format & LLM Context Optimization", () => {
    beforeEach(() => {
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
        fs.mkdirSync(tmpDir, { recursive: true });
    });

    afterEach(() => {
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    describe("1.1 TOON Serialization & Parsing Unit Tests", () => {
        it("should serialize uniform array of objects into compact tabular TOON format", () => {
            const users = [
                { id: 1, name: "Alice", role: "admin", active: true },
                { id: 2, name: "Bob, Jr.", role: "editor", active: false },
                { id: 3, name: 'Charlie "Chuck"', role: "user", active: true },
            ];

            const toon = jsonToToon(users, { rootName: "users" });
            expect(toon).toContain("users[3]{id,name,role,active}:");
            expect(toon).toContain("1,Alice,admin,true");
            expect(toon).toContain('2,"Bob, Jr.",editor,false');
            expect(toon).toContain('3,"Charlie \\"Chuck\\"",user,true');

            // Parse back
            const parsed = toonToJson(toon);
            expect(parsed).toEqual({ users });
        });

        it("should serialize and parse an unnamed top-level array of objects", () => {
            const items = [
                { sku: "A100", price: 19.99, inStock: true },
                { sku: "B200", price: 49.5, inStock: false },
            ];

            const toon = jsonToToon(items);
            expect(toon).toContain("[2]{sku,price,inStock}:");
            expect(toon).toContain("A100,19.99,true");
            expect(toon).toContain("B200,49.5,false");

            const parsed = toonToJson(toon);
            expect(parsed).toEqual(items);
        });

        it("should serialize and parse primitive arrays", () => {
            const tags = ["frontend", "reactive", "compiler"];
            const toon = jsonToToon(tags, { rootName: "tags" });
            expect(toon).toContain("tags[3]:");
            expect(toon).toContain("frontend");
            expect(toon).toContain("compiler");

            const parsed = toonToJson(toon);
            expect(parsed).toEqual({ tags });
        });

        it("should serialize and parse complex multi-key objects with nested data", () => {

            const data = {
                title: "EUIX Framework",
                version: 2,
                isPublished: true,
                contributors: [
                    { id: 101, handle: "ahmet" },
                    { id: 102, handle: "developer" },
                ],
            };

            const toon = jsonToToon(data);
            const parsed = toonToJson(toon);

            expect(parsed.title).toBe("EUIX Framework");
            expect(parsed.version).toBe(2);
            expect(parsed.isPublished).toBe(true);
            expect(parsed.contributors).toHaveLength(2);
            expect(parsed.contributors[0]).toEqual({ id: 101, handle: "ahmet" });
        });

        it("should safely handle null, empty arrays, and comments in TOON", () => {
            const input = `
            # This is a TOON comment
            # Another comment line
            items[0]:

            status: active
            count: 0
            `;

            const parsed = toonToJson(input);
            expect(parsed).toBeDefined();
            expect(parsed.status).toBe("active");
            expect(parsed.count).toBe(0);
        });

        it("should bi-directionally convert between JSON, XML, and TOON via convert()", () => {
            const sourceJson = {
                users: [
                    { id: 1, name: "Alice" },
                    { id: 2, name: "Bob" },
                ],
            };

            // JSON -> TOON
            const toonOut = convert(sourceJson, { targetFormat: "toon" });
            expect(toonOut).toContain("users[2]{id,name}:");

            // TOON -> JSON
            const jsonOut = convert(toonOut, { targetFormat: "json" });
            const parsedBack = JSON.parse(jsonOut);
            expect(parsedBack.users).toHaveLength(2);
            expect(parsedBack.users[0].name).toBe("Alice");

            // TOON -> XML
            const xmlOut = convert(toonOut, { targetFormat: "xml" });
            expect(xmlOut).toContain("<uid_spec>");
        });
    });

    describe("1.2 LLM Context Generation in TOON Format", () => {
        it("should generate compact TOON context with significant token savings", async () => {
            // Write sample component
            fs.writeFileSync(
                path.join(tmpDir, "UserCard.euix.json"),
                JSON.stringify({
                    version: 1,
                    props: {
                        user: { type: "object", required: true },
                        isOnline: { type: "boolean" },
                    },
                    view: { tag: "div", children: ["UserCard"] },
                }),
                "utf8",
            );

            // Write sample component 2
            fs.writeFileSync(
                path.join(tmpDir, "ActionButton.xml"),
                `
                <uid_spec>
                  <component_def name="ActionButton">
                    <param name="label" type="string" required="true" />
                    <param name="variant" type="string" />
                    <button>{props.label}</button>
                  </component_def>
                </uid_spec>
                `,
                "utf8",
            );

            // Write sample component 3
            fs.writeFileSync(
                path.join(tmpDir, "Navbar.xml"),
                `
                <uid_spec>
                  <component_def name="Navbar">
                    <param name="title" type="string" />
                    <nav>{props.title}</nav>
                  </component_def>
                </uid_spec>
                `,
                "utf8",
            );

            // Write sample XML spec with route and state
            fs.writeFileSync(
                path.join(tmpDir, "App.xml"),
                `
                <uid_spec>
                  <route path="/dashboard/:userId" />
                  <data_model>
                    <state id="counter" type="number">0</state>
                    <state id="user_name" type="string">Guest</state>
                    <state id="items" type="array">[]</state>
                    <state id="is_loading" type="boolean">false</state>
                  </data_model>
                  <action_def name="saveUser">
                    <step call="api.save" />
                  </action_def>
                  <action_def name="deleteUser">
                    <step call="api.delete" />
                  </action_def>
                  <div>App</div>
                </uid_spec>
                `,
                "utf8",
            );

            const mdContext = await generateLlmContext(tmpDir, { format: "markdown", baseDir: tmpDir });
            const jsonContext = await generateLlmContext(tmpDir, { format: "json", baseDir: tmpDir });
            const toonContext = await generateLlmContext(tmpDir, { format: "toon", baseDir: tmpDir });


            expect(toonContext.text).toContain("components[3]{name,props,file}:");
            expect(toonContext.text).toContain("UserCard");
            expect(toonContext.text).toContain("ActionButton");
            expect(toonContext.text).toContain("Navbar");
            expect(toonContext.text).toContain("routes[1]{path,params,file}:");
            expect(toonContext.text).toContain("/dashboard/:userId");
            expect(toonContext.text).toContain("states[4]{name,type}:");
            expect(toonContext.text).toContain("counter,number");

            // Verify TOON is more token/character efficient than both JSON and Markdown
            expect(toonContext.text.length).toBeLessThan(jsonContext.text.length);
            expect(toonContext.text.length).toBeLessThan(mdContext.text.length);
        });


        it("should execute CLI context command with --toon flag", () => {
            fs.writeFileSync(
                path.join(tmpDir, "Widget.xml"),
                `
                <uid_spec>
                  <data_model>
                    <state id="status" type="string">idle</state>
                  </data_model>
                  <div>Widget</div>
                </uid_spec>
                `,
                "utf8",
            );

            const stdout = execSync(
                `node "${path.resolve(process.cwd(), "bin/euix.js")}" context "${tmpDir}" --toon`,
                { encoding: "utf8" },
            );

            expect(stdout).toContain("states[1]{name,type}:");
            expect(stdout).toContain("status,string");
        });
    });

    describe("1.3 <data_model> TOON State Integration in EUIX Engine", () => {
        it("should parse <state type='array' format='toon'> during engine mount", () => {
            const xml = `
            <uid_spec>
              <data_model>
                <state id="members" type="array" format="toon">
                  [3]{id,name,role}:
                  10,Alice,Admin
                  20,Bob,Member
                  30,Charlie,Guest
                </state>
                <state id="app_meta" type="object" format="toon">
                  app_name: MyAwesomeApp
                  max_retries: 3
                  debug: true
                </state>
              </data_model>
              <div>
                <h1>Members Count: {data.members.length}</h1>
              </div>
            </uid_spec>
            `;

            const container = document.createElement("div");
            const engine = EUIXEngineCore.mount(xml, container);

            const members = engine.getState("members");
            expect(Array.isArray(members)).toBe(true);
            expect(members).toHaveLength(3);
            expect(members[0]).toEqual({ id: 10, name: "Alice", role: "Admin" });
            expect(members[1]).toEqual({ id: 20, name: "Bob", role: "Member" });
            expect(members[2]).toEqual({ id: 30, name: "Charlie", role: "Guest" });

            const meta = engine.getState("app_meta");
            expect(meta).toEqual({
                app_name: "MyAwesomeApp",
                max_retries: 3,
                debug: true,
            });

            engine.destroy();
        });

        it("should format array states into TOON when useToonForArrays is enabled in convert", () => {
            const jsonSpec = {
                version: 1,
                state: {
                    products: [
                        { id: 1, title: "Book", price: 15 },
                        { id: 2, title: "Pen", price: 2 },
                    ],
                },
                view: { tag: "div", text: "Store" },
            };

            const xmlWithToon = convert(jsonSpec, { targetFormat: "xml", useToonForArrays: true });
            expect(xmlWithToon).toContain('format="toon"');
            expect(xmlWithToon).toContain("products[2]{id,title,price}:");
            expect(xmlWithToon).toContain("1,Book,15");
            expect(xmlWithToon).toContain("2,Pen,2");

            // Mount the generated XML to confirm runtime execution
            const container = document.createElement("div");
            const engine = EUIXEngineCore.mount(xmlWithToon, container);
            const products = engine.getState("products");
            expect(products).toHaveLength(2);
            expect(products[0].title).toBe("Book");
            expect(products[0].price).toBe(15);
            engine.destroy();
        });
    });
});
