/**
 * packages/core/tests/converter.test.js
 * Test suite for EUIX Bi-directional Converter (euix convert).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { convert, jsonToXml, xmlToJson, prepare } from "../src/prepare/index.js";

const tmpDir = path.resolve(process.cwd(), "tests/fixtures/tmp_converter");

describe("EUIX Bi-directional Converter (euix convert)", () => {
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

    it("should convert canonical JSON to formatted EUIX XML (<uid_spec>)", () => {
        const sourceJson = {
            version: 1,
            imports: {
                UserCard: "./components/UserCard.euix",
            },
            route: {
                path: "/users/:id",
            },
            state: {
                count: 10,
                name: "EUIX",
                isActive: true,
                items: ["a", "b"],
            },
            computed: {
                greeting: { deps: ["name"], get: "{data.name} App" },
            },
            watch: {
                count: { action: "onCountChange" },
            },
            actions: {
                onCountChange: { call: "console.log" },
                increment: { call: "count.inc", assign: "count" },
            },
            lifecycle: {
                mount: [{ $action: "onCountChange" }],
                unmount: [{ $action: "onCountChange" }],
            },
            components: {
                Header: {
                    view: {
                        tag: "h1",
                        children: ["Header Title"],
                    },
                },
            },
            view: {
                tag: "div",
                props: { class: "container" },
                children: [
                    { tag: "span", children: [{ $bind: "name" }] },
                    {
                        tag: "button",
                        events: { click: { $action: "increment" } },
                        children: ["+1"],
                    },
                ],
            },
        };

        const xml = jsonToXml(sourceJson);
        expect(xml).toContain("<uid_spec>");
        expect(xml).toContain('</uid_spec>');
        expect(xml).toContain('<import name="UserCard" src="./components/UserCard.euix" />');
        expect(xml).toContain('<route path="/users/:id" />');
        expect(xml).toContain('<state id="count" type="number">10</state>');
        expect(xml).toContain('<state id="name" type="string">EUIX</state>');
        expect(xml).toContain('<state id="isActive" type="boolean">true</state>');
        expect(xml).toContain('<computed id="greeting" deps="name">{data.name} App</computed>');
        expect(xml).toContain('<watch path="count" action="onCountChange" />');
        expect(xml).toContain('<action_def name="increment">');
        expect(xml).toContain('<step call="count.inc" assign="count" />');
        expect(xml).toContain('<lifecycle>');
        expect(xml).toContain('<on_mount action="onCountChange" />');
        expect(xml).toContain('<component_def name="Header">');
        expect(xml).toContain('<span');
        expect(xml).toContain('{data.name}');
        expect(xml).toContain('on_click:call="increment"');
    });

    it("should convert EUIX XML into canonical JSON representation", () => {
        const xmlSource = `
        <uid_spec>
          <data_model>
            <state id="user" type="string">Bob</state>
            <state id="score" type="number">100</state>
            <computed id="displayUser">{data.user}</computed>
          </data_model>
          <action_def name="reset">
            <step call="resetScore" />
          </action_def>
          <div class="score-card">
            <h1>{data.user}</h1>
            <button on_click:call="reset">Reset</button>
          </div>
        </uid_spec>
        `;

        const json = xmlToJson(xmlSource);
        expect(json).toBeDefined();
        expect(json.state.user).toBe("Bob");
        expect(json.state.score).toBe(100);
        expect(json.actions.reset).toBeDefined();
        expect(json.view.tag).toBe("div");
    });

    it("should round-trip JSON -> XML -> JSON with high fidelity", () => {
        const originalJson = {
            version: 1,
            state: {
                counter: 42,
                title: "Converter Test",
            },
            actions: {
                inc: { call: "counter.inc" },
            },
            view: {
                tag: "div",
                children: [
                    { tag: "span", children: [{ $bind: "title" }] },
                    { tag: "button", events: { click: { $action: "inc" } }, children: ["+1"] },
                ],
            },
        };

        const generatedXml = jsonToXml(originalJson);
        const parsedBackJson = xmlToJson(generatedXml);

        expect(parsedBackJson.state.counter).toBe(originalJson.state.counter);
        expect(parsedBackJson.state.title).toBe(originalJson.state.title);
        expect(parsedBackJson.actions.inc).toBeDefined();
        expect(parsedBackJson.view.tag).toBe("div");
    });

    it("should auto-detect and convert via convert() API", () => {
        const json = { state: { theme: "light" }, view: { tag: "p", children: ["Hello"] } };
        const xmlOutput = convert(json);
        expect(xmlOutput).toContain("<uid_spec>");
        expect(xmlOutput).toContain('<state id="theme" type="string">light</state>');

        const jsonOutput = convert(xmlOutput);
        const parsed = JSON.parse(jsonOutput);
        expect(parsed.state.theme).toBe("light");
    });

    it("should execute CLI convert command for JSON -> XML and XML -> JSON", () => {
        const jsonFile = path.join(tmpDir, "App.euix.json");
        const xmlFile = path.join(tmpDir, "App.euix");
        const roundTripJsonFile = path.join(tmpDir, "App.roundtrip.json");

        fs.writeFileSync(
            jsonFile,
            JSON.stringify(
                {
                    version: 1,
                    state: { user: "Alice" },
                    actions: { save: { call: "saveUser" } },
                    view: {
                        tag: "div",
                        children: [{ $bind: "user" }],
                    },
                },
                null,
                2,
            ),
            "utf8",
        );

        // 1. CLI: JSON -> XML stdout
        const stdoutXml = execSync(`node ./bin/euix.js convert "${jsonFile}"`, { encoding: "utf8" });
        expect(stdoutXml).toContain("<uid_spec>");
        expect(stdoutXml).toContain('<state id="user" type="string">Alice</state>');

        // 2. CLI: JSON -> XML with -o flag
        execSync(`node ./bin/euix.js convert "${jsonFile}" -o "${xmlFile}"`, { encoding: "utf8" });
        expect(fs.existsSync(xmlFile)).toBe(true);
        const savedXml = fs.readFileSync(xmlFile, "utf8");
        expect(savedXml).toContain("<uid_spec>");

        // 3. CLI: XML -> JSON with -o flag
        execSync(`node ./bin/euix.js convert "${xmlFile}" -o "${roundTripJsonFile}"`, { encoding: "utf8" });
        expect(fs.existsSync(roundTripJsonFile)).toBe(true);
        const savedJson = JSON.parse(fs.readFileSync(roundTripJsonFile, "utf8"));
        expect(savedJson.state.user).toBe("Alice");
    });

    it("should allow prepared execution on converted XML", async () => {
        const sourceJson = {
            state: { count: 5 },
            actions: { inc: { call: "inc" } },
            view: { tag: "span", children: [{ $bind: "count" }] },
        };

        const xml = jsonToXml(sourceJson);
        const app = await prepare(xml);
        expect(app.diagnostics).toHaveLength(0);
        expect(app.ir.states[0].initial).toBe(5);
        expect(app.ir.actions[0].name).toBe("inc");
    });
});
