/**
 * packages/core/tests/prepare_ir_layer.test.js
 * Comprehensive test suite for EUIX JSON IR, prepare layer, validation diagnostics, and runtime execution.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import {
    prepare,
    mount,
    inspect,
    validateSource,
    clearPrepareCache,
    globalPrepareCache,
    PreparedApp,
    EUIXPrepareError,
} from "../src/prepare/index.js";
import { EUIXEngine } from "../src/EUIXEngine.js";

const tmpDir = path.resolve(process.cwd(), "tests/fixtures/tmp_prepare");

describe("EUIX JSON Intermediate Representation & Prepare Layer", () => {
    beforeEach(() => {
        clearPrepareCache();
        document.body.innerHTML = '<div id="app"></div>';
    });

    afterEach(() => {
        clearPrepareCache();
        if (fs.existsSync(tmpDir)) {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        }
    });

    // 1. JSON source parse
    it("should parse a valid JSON source object and string into canonical representation", async () => {
        const sourceJson = {
            version: 1,
            state: {
                counter: 0,
                username: "Guest",
            },
            actions: {
                increment: { call: "counter.inc" },
            },
            view: {
                tag: "div",
                children: [
                    { $bind: "username" },
                    {
                        tag: "button",
                        events: { click: { $action: "increment" } },
                        children: ["+1"],
                    },
                ],
            },
        };

        const app = await prepare(sourceJson);
        expect(app).toBeInstanceOf(PreparedApp);
        expect(app.ir).toBeDefined();
        expect(app.ir.irVersion).toBe(1);
        expect(app.ir.states).toHaveLength(2);
        expect(app.ir.states.map((s) => s.name)).toEqual(["counter", "username"]);
        expect(app.diagnostics).toHaveLength(0);

        // Parse from string
        const appFromString = await prepare(JSON.stringify(sourceJson), { bypassCache: true });
        expect(appFromString.ir.states).toHaveLength(2);
    });

    // 2. XML / mevcut EUIX syntax -> Source Representation
    it("should convert XML (<uid_spec>) into canonical JSON source and equivalent Runtime IR", async () => {
        const xmlSource = `
        <uid_spec>
          <data_model>
            <state id="user" type="string">Alice</state>
            <state id="score" type="number">100</state>
            <computed id="greeting">{data.user}</computed>
          </data_model>
          <action_def name="resetScore">
            <step call="reset" />
          </action_def>
          <div class="user-box">
            <h1>{data.user}</h1>
            <button on_click:call="resetScore">Reset</button>
          </div>
        </uid_spec>
        `;

        const app = await prepare(xmlSource);
        expect(app.diagnostics).toHaveLength(0);
        expect(app.ir.states).toHaveLength(2);
        expect(app.ir.states.find((s) => s.name === "user").initial).toBe("Alice");
        expect(app.ir.states.find((s) => s.name === "score").initial).toBe(100);
        expect(app.ir.computed).toHaveLength(1);
        expect(app.ir.actions).toHaveLength(1);
        expect(app.ir.actions[0].name).toBe("resetScore");
        expect(app.ir.view.tag).toBe("div");
    });

    // 3. Component import resolution
    it("should resolve component imports via resolveImport hook", async () => {
        const source = {
            imports: {
                UserCard: "./components/UserCard.euix",
            },
            state: { user: "Bob" },
            view: {
                component: "UserCard",
                props: { user: { $bind: "user" } },
            },
        };

        const resolvedMap = new Map();
        const app = await prepare(source, {
            resolveImport: (spec) => {
                resolvedMap.set(spec, true);
                return { view: { tag: "span", children: ["UserCard Mock"] } };
            },
        });

        expect(resolvedMap.has("./components/UserCard.euix")).toBe(true);
        expect(app.ir.components).toHaveLength(1);
        expect(app.ir.components[0].name).toBe("UserCard");
        expect(app.diagnostics).toHaveLength(0);
    });

    // 4. Nested import resolution
    it("should resolve nested imports recursively", async () => {
        const parentSource = {
            imports: {
                ChildComp: "./Child.euix.json",
            },
            view: { component: "ChildComp" },
        };

        const loadedFiles = [];
        const app = await prepare(parentSource, {
            currentFile: "Parent.euix.json",
            resolveImport: async (spec) => {
                loadedFiles.push(spec);
                if (spec.includes("Child")) {
                    return {
                        imports: { GrandChild: "./GrandChild.euix.json" },
                        view: { component: "GrandChild" },
                    };
                }
                return { view: { tag: "p", children: ["GrandChild Content"] } };
            },
        });

        expect(loadedFiles).toContain("./Child.euix.json");
        expect(app.ir.components).toHaveLength(1);
        expect(app.ir.components[0].name).toBe("ChildComp");
    });

    // 5. Unknown component diagnostic with Levenshtein suggestion
    it("should emit EUIX201 diagnostic with suggestion for misspelled component", async () => {
        const source = {
            components: {
                UserCard: { view: { tag: "div" } },
                Button: { view: { tag: "button" } },
            },
            view: {
                component: "UserCrad", // Misspelled!
            },
        };

        const app = await prepare(source);
        const err = app.diagnostics.find((d) => d.code === "EUIX201");
        expect(err).toBeDefined();
        expect(err.type).toBe("unknown-component");
        expect(err.message).toContain('Unknown component "UserCrad". Did you mean "UserCard"?');
        expect(err.suggestion).toBe("UserCard");

        // Another suggestion test: Buton -> Button
        const sourceBtn = {
            components: { Button: { view: { tag: "button" } } },
            view: { component: "Buton" },
        };
        const appBtn = await prepare(sourceBtn);
        const errBtn = appBtn.diagnostics.find((d) => d.code === "EUIX201");
        expect(errBtn.suggestion).toBe("Button");
    });

    // 6. Unknown state diagnostic with suggestion
    it("should emit EUIX202 diagnostic with suggestion for unknown state binding", async () => {
        const source = {
            state: {
                username: "Alice",
                counter: 10,
            },
            view: {
                tag: "span",
                props: {
                    name: { $bind: "usernmae" }, // Misspelled!
                },
            },
        };

        const app = await prepare(source);
        const err = app.diagnostics.find((d) => d.code === "EUIX202");
        expect(err).toBeDefined();
        expect(err.type).toBe("unknown-state");
        expect(err.suggestion).toBe("username");
    });

    // 7. Unknown action diagnostic with suggestion
    it("should emit EUIX203 diagnostic with suggestion for unknown action reference", async () => {
        const source = {
            actions: {
                saveProfile: { call: "api.save" },
            },
            view: {
                tag: "button",
                events: {
                    click: { $action: "saveProfle" }, // Misspelled!
                },
            },
        };

        const app = await prepare(source);
        const err = app.diagnostics.find((d) => d.code === "EUIX203");
        expect(err).toBeDefined();
        expect(err.type).toBe("unknown-action");
        expect(err.suggestion).toBe("saveProfile");
    });

    // 8. Invalid binding syntax diagnostic
    it("should emit EUIX204 diagnostic for empty or invalid binding", async () => {
        const source = {
            state: { active: true },
            view: {
                tag: "div",
                props: {
                    status: { $bind: "" },
                },
            },
        };

        const app = await prepare(source);
        const err = app.diagnostics.find((d) => d.code === "EUIX204");
        expect(err).toBeDefined();
        expect(err.type).toBe("invalid-binding");
    });

    // 9. Route parameter binding
    it("should normalize route parameters and resolve $route in action args", async () => {
        const source = {
            route: {
                path: "/users/:id/posts/:slug",
            },
            actions: {
                loadPost: {
                    call: "api.getPost",
                    args: [{ $route: "params.id" }, { $route: "params.slug" }],
                },
            },
        };

        const app = await prepare(source);
        expect(app.ir.route).toBeDefined();
        expect(app.ir.route.params).toEqual(["id", "slug"]);
        expect(app.ir.actions[0].args[0]).toEqual({ type: "route", param: "params.id" });
        expect(app.ir.actions[0].args[1]).toEqual({ type: "route", param: "params.slug" });
    });

    // 10. Circular dependency detection
    it("should detect circular dependencies in computed properties (EUIX208)", async () => {
        const source = {
            computed: {
                a: { deps: ["b"], get: "{data.b} + 1" },
                b: { deps: ["a"], get: "{data.a} + 1" },
            },
        };

        const app = await prepare(source);
        const err = app.diagnostics.find((d) => d.code === "EUIX208");
        expect(err).toBeDefined();
        expect(err.message).toContain("Circular dependency detected");
    });

    it("should detect self-loop watcher cycle (EUIX209)", async () => {
        const source = {
            state: { count: 0 },
            watch: {
                count: { action: "incrementCount" },
            },
            actions: {
                incrementCount: { call: "inc", assign: "count" },
            },
        };

        const app = await prepare(source);
        const err = app.diagnostics.find((d) => d.code === "EUIX209");
        expect(err).toBeDefined();
        expect(err.type).toBe("watcher-self-loop");
    });

    // 11. Lifecycle action resolution
    it("should detect undefined actions in lifecycle hooks (EUIX210)", async () => {
        const source = {
            actions: { initApp: { call: "init" } },
            lifecycle: {
                mount: [{ $action: "initAapp" }], // Typo!
            },
        };

        const app = await prepare(source);
        const err = app.diagnostics.find((d) => d.code === "EUIX210");
        expect(err).toBeDefined();
        expect(err.type).toBe("unknown-lifecycle-action");
        expect(err.suggestion).toBe("initApp");
    });

    // 12. Undefined service import in action call
    it("should emit EUIX212 when action calls service that is not imported", async () => {
        const source = {
            imports: {
                userApi: "./services/userApi.js",
            },
            actions: {
                fetchPosts: { call: "postApi.getPosts" }, // postApi not imported!
            },
        };

        const app = await prepare(source);
        const err = app.diagnostics.find((d) => d.code === "EUIX212");
        expect(err).toBeDefined();
        expect(err.type).toBe("undefined-service");
        expect(err.message).toContain("service \"postApi\" is not imported");
    });

    // 13. Parity: JSON and EUIX XML produce identical IR structure
    it("should generate equivalent Runtime IR from both XML and JSON formats", async () => {
        const xml = `
        <uid_spec>
          <data_model>
            <state id="count" type="number">42</state>
          </data_model>
          <action_def name="inc">
            <step call="increment" />
          </action_def>
          <div>
            <span>{data.count}</span>
            <button on_click:call="inc">+1</button>
          </div>
        </uid_spec>
        `;

        const json = {
            state: { count: 42 },
            actions: { inc: { call: "increment" } },
            view: {
                tag: "div",
                children: [
                    { tag: "span", children: [{ $bind: "count" }] },
                    { tag: "button", events: { click: { $action: "inc" } }, children: ["+1"] },
                ],
            },
        };

        const appXml = await prepare(xml, { bypassCache: true });
        const appJson = await prepare(json, { bypassCache: true });

        expect(appXml.ir.states[0].name).toBe(appJson.ir.states[0].name);
        expect(appXml.ir.states[0].initial).toBe(appJson.ir.states[0].initial);
        expect(appXml.ir.actions[0].name).toBe(appJson.ir.actions[0].name);
        expect(appXml.ir.actions[0].call).toBe(appJson.ir.actions[0].call);
    });

    // 14. Deterministic prepare output
    it("should produce deterministic, byte-for-byte identical IR across multiple prepare runs", async () => {
        const source = {
            state: { z: 1, a: 2, m: 3 },
            actions: { b: { call: "b" }, a: { call: "a" } },
            components: { CompB: {}, CompA: {} },
        };

        const app1 = await prepare(source, { bypassCache: true });
        const app2 = await prepare(source, { bypassCache: true });

        const json1 = JSON.stringify(app1.toJSON());
        const json2 = JSON.stringify(app2.toJSON());
        expect(json1).toBe(json2);
    });

    // 15. Memory Cache Hit
    it("should hit memory cache on subsequent calls with identical source", async () => {
        const source = { state: { counter: 1 } };

        const initialMisses = globalPrepareCache.stats.misses;
        const initialHits = globalPrepareCache.stats.hits;

        await prepare(source);
        expect(globalPrepareCache.stats.misses).toBe(initialMisses + 1);

        // Second call with same source
        await prepare(source);
        expect(globalPrepareCache.stats.hits).toBe(initialHits + 1);
    });

    // 16. Strict Mode error throwing
    it("should throw EUIXPrepareError in strict mode on validation error", async () => {
        const invalidSource = {
            view: { component: "UnknownComponent" },
        };

        await expect(prepare(invalidSource, { strict: true })).rejects.toThrowError(EUIXPrepareError);
    });

    // 17. Runtime Execution: mountPrepared and interaction
    it("should mount prepared application into DOM and update reactively on interaction", async () => {
        const source = {
            state: {
                counter: 10,
                name: "EUIX",
            },
            actions: {
                increment: { call: "counter.inc" },
            },
            view: {
                tag: "div",
                props: { class: "app-wrapper" },
                children: [
                    {
                        tag: "h1",
                        children: [{ $bind: "name" }],
                    },
                    {
                        tag: "span",
                        props: { id: "count-display" },
                        children: [{ $bind: "counter" }],
                    },
                    {
                        tag: "button",
                        props: { id: "btn-inc" },
                        events: { click: { $action: "increment" } },
                        children: ["Click Me"],
                    },
                ],
            },
        };

        const app = await prepare(source);
        const container = document.getElementById("app");

        // Universal mount API: mount(app, container)
        const engine = mount(app, container, {
            actions: {
                increment: (_, { $data }) => {
                    $data.counter = $data.counter + 1;
                },
            },
        });

        expect(engine).toBeDefined();
        expect(container.querySelector("h1").textContent.trim()).toBe("EUIX");
        expect(container.querySelector("#count-display").textContent.trim()).toBe("10");

        // Trigger click action
        const btn = container.querySelector("#btn-inc");
        btn.click();
        await new Promise((r) => setTimeout(r, 10));

        // Check reactive update
        expect(engine.getState("counter")).toBe(11);
        expect(container.querySelector("#count-display").textContent.trim()).toBe("11");
    });

    // 18. CLI commands execution via bin/euix.js
    it("should execute CLI commands check, prepare, and inspect correctly", () => {
        fs.mkdirSync(tmpDir, { recursive: true });

        const validFile = path.join(tmpDir, "ValidApp.euix.json");
        const invalidFile = path.join(tmpDir, "InvalidApp.euix.json");
        const outputFile = path.join(tmpDir, "ValidApp.ir.json");

        fs.writeFileSync(
            validFile,
            JSON.stringify(
                {
                    version: 1,
                    state: { user: "Ahmet" },
                    actions: { save: { call: "save" } },
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

        fs.writeFileSync(
            invalidFile,
            JSON.stringify(
                {
                    view: { component: "MissingComponent" },
                },
                null,
                2,
            ),
            "utf8",
        );

        // 1. CLI: check valid file -> exit code 0
        const checkValidOut = execSync(`node ./bin/euix.js check "${validFile}"`, { encoding: "utf8" });
        expect(checkValidOut).toContain("0 errors found");

        // 2. CLI: check invalid file -> exit code 1
        let errorCaught = false;
        try {
            execSync(`node ./bin/euix.js check "${invalidFile}"`, { encoding: "utf8", stdio: "pipe" });
        } catch (err) {
            errorCaught = true;
            expect(err.stdout || err.stderr).toContain("EUIX201");
        }
        expect(errorCaught).toBe(true);

        // 3. CLI: prepare with --json output
        const prepareOut = execSync(`node ./bin/euix.js prepare "${validFile}" --json`, { encoding: "utf8" });
        const parsedIr = JSON.parse(prepareOut.trim());
        expect(parsedIr.irVersion).toBe(1);
        expect(parsedIr.states[0].name).toBe("user");

        // 4. CLI: prepare with -o output file
        execSync(`node ./bin/euix.js prepare "${validFile}" -o "${outputFile}"`, { encoding: "utf8" });
        expect(fs.existsSync(outputFile)).toBe(true);
        const savedIr = JSON.parse(fs.readFileSync(outputFile, "utf8"));
        expect(savedIr.states[0].name).toBe("user");

        // 5. CLI: inspect
        const inspectOut = execSync(`node ./bin/euix.js inspect "${validFile}"`, { encoding: "utf8" });
        expect(inspectOut).toContain("Inspection Report");
        expect(inspectOut).toContain("States (1): user");
        expect(inspectOut).toContain("Actions (1): save");
        expect(inspectOut).toContain("Bindings (1):");
        expect(inspectOut).toContain("[state] view.children[0] -> user");
    });

    // 19. Additional validations: EUIX205, EUIX206, EUIX207, EUIX211, and provide/inject
    it("should emit EUIX205 for invalid route path or duplicate route params", async () => {
        const source = {
            route: { path: "users/:id/:id" }, // Missing leading slash and duplicate param!
        };
        const app = await prepare(source);
        const diags = app.diagnostics.filter((d) => d.code === "EUIX205");
        expect(diags.length).toBeGreaterThanOrEqual(1);
    });

    it("should emit EUIX206 for missing or unresolved import file", async () => {
        const source = {
            imports: {
                NonExistent: "./does_not_exist.euix",
            },
            view: { component: "NonExistent" },
        };
        const app = await prepare(source, {
            currentFile: "test.euix.json",
        });
        const err = app.diagnostics.find((d) => d.code === "EUIX206");
        expect(err).toBeDefined();
        expect(err.message).toContain("Cannot resolve import");
    });

    it("should emit EUIX207 for duplicate state and computed identifier", async () => {
        const source = {
            state: { count: 1 },
            computed: { count: { deps: [], get: "2" } }, // Duplicate name!
        };
        const app = await prepare(source);
        const err = app.diagnostics.find((d) => d.code === "EUIX207");
        expect(err).toBeDefined();
        expect(err.type).toBe("duplicate-identifier");
        expect(err.message).toContain('Identifier "count" is already declared');
    });

    it("should emit EUIX211 when required component prop is missing", async () => {
        const source = {
            components: {
                UserProfile: {
                    props: {
                        userId: { type: "string", required: true },
                    },
                    view: { tag: "div" },
                },
            },
            view: {
                component: "UserProfile",
                props: {}, // Missing required userId prop!
            },
        };
        const app = await prepare(source);
        const err = app.diagnostics.find((d) => d.code === "EUIX211");
        expect(err).toBeDefined();
        expect(err.type).toBe("missing-required-prop");
        expect(err.message).toContain('Component "UserProfile" requires prop "userId"');
    });

    it("should support provide/inject and allow binding to injected state", async () => {
        const source = {
            provide: {
                theme: "dark",
            },
            inject: ["theme"],
            view: {
                tag: "div",
                props: { class: { $bind: "theme" } },
            },
        };
        const app = await prepare(source);
        expect(app.diagnostics).toHaveLength(0);
        expect(app.ir.provide.theme).toBe("dark");
        expect(app.ir.inject).toEqual(["theme"]);

        // Inspect should list bindings and injected variables
        const inspected = await inspect(source);
        expect(inspected.bindings).toHaveLength(1);
        expect(inspected.bindings[0].target).toBe("theme");
    });

    // 20. Parser and Format Robustness
    it("should emit EUIX200 for malformed JSON syntax", async () => {
        const brokenJson = '{ version: 1, "state": { broken ';
        const app = await prepare(brokenJson);
        const err = app.diagnostics.find((d) => d.code === "EUIX200");
        expect(err).toBeDefined();
        expect(err.type).toBe("json-syntax-error");
        expect(err.message).toContain("Invalid JSON syntax");
    });

    it("should emit EUIX200 for empty or whitespace-only source strings", async () => {
        const emptyApp = await prepare("   \n\t  ");
        const err = emptyApp.diagnostics.find((d) => d.code === "EUIX200");
        expect(err).toBeDefined();
        expect(err.type).toBe("parse-error");
    });

    it("should emit EUIX200 for non-object root inputs (arrays or primitives)", async () => {
        const arrayApp = await prepare([1, 2, 3]);
        const err = arrayApp.diagnostics.find((d) => d.code === "EUIX200");
        expect(err).toBeDefined();
        expect(err.type).toBe("invalid-root");

        const numApp = await prepare(42);
        expect(numApp.diagnostics.find((d) => d.code === "EUIX200")).toBeDefined();
    });

    it("should emit EUIX200 for malformed XML templates", async () => {
        const brokenXml = "<uid_spec><unclosed_tag><div>content</div>";
        const app = await prepare(brokenXml);
        const err = app.diagnostics.find((d) => d.code === "EUIX200");
        expect(err).toBeDefined();
    });

    // 21. Complex Scoping & Directives
    it("should resolve deep nested state path bindings without false positives", async () => {
        const source = {
            state: {
                user: {
                    profile: {
                        address: {
                            city: "Istanbul",
                        },
                    },
                },
            },
            view: {
                tag: "span",
                children: [{ $bind: "user.profile.address.city" }],
            },
        };
        const app = await prepare(source);
        expect(app.diagnostics).toHaveLength(0);
        expect(app.ir.states).toHaveLength(1);
        expect(app.ir.states[0].name).toBe("user");
    });

    it("should recognize for_each loop variables (var & index) as valid local variables", async () => {
        const source = {
            state: {
                todos: [{ id: 1, text: "Buy milk" }],
            },
            view: {
                tag: "for_each",
                var: "todo",
                index: "idx",
                props: { items: { $bind: "todos" } },
                children: [
                    { tag: "span", children: [{ $bind: "idx" }] },
                    { tag: "p", children: [{ $bind: "todo.text" }] },
                ],
            },
        };
        const app = await prepare(source);
        expect(app.diagnostics).toHaveLength(0);
    });

    it("should support nested for_each loops with outer and inner scoped variables", async () => {
        const source = {
            state: {
                categories: [{ id: 1, name: "Books", items: ["Fiction"] }],
            },
            view: {
                tag: "for_each",
                var: "category",
                children: [
                    { tag: "h2", children: [{ $bind: "category.name" }] },
                    {
                        tag: "for_each",
                        var: "item",
                        children: [
                            { tag: "span", children: [{ $bind: "category.name" }] },
                            { tag: "span", children: [{ $bind: "item" }] },
                        ],
                    },
                ],
            },
        };
        const app = await prepare(source);
        expect(app.diagnostics).toHaveLength(0);
    });

    it("should support component definition with $prop directive", async () => {
        const source = {
            components: {
                Card: {
                    props: { title: { type: "string" } },
                    view: {
                        tag: "div",
                        children: [{ $prop: "title" }],
                    },
                },
            },
            view: {
                component: "Card",
                props: { title: "My Card" },
            },
        };
        const app = await prepare(source);
        expect(app.diagnostics).toHaveLength(0);
        expect(app.ir.components).toHaveLength(1);
    });

    // 22. Advanced Dependency Cycle & Circular Imports
    it("should detect 3-node transitive computed cycles (a -> b -> c -> a)", async () => {
        const source = {
            computed: {
                a: { deps: ["b"], get: "{data.b} + 1" },
                b: { deps: ["c"], get: "{data.c} + 1" },
                c: { deps: ["a"], get: "{data.a} + 1" },
            },
        };
        const app = await prepare(source);
        const err = app.diagnostics.find((d) => d.code === "EUIX208");
        expect(err).toBeDefined();
        expect(err.type).toBe("circular-computed-dependency");
        expect(err.message).toContain("Circular dependency detected");
    });

    it("should detect self-referencing computed properties (a -> a)", async () => {
        const source = {
            computed: {
                selfRef: { deps: ["selfRef"], get: "{data.selfRef} + 1" },
            },
        };
        const app = await prepare(source);
        const err = app.diagnostics.find((d) => d.code === "EUIX208");
        expect(err).toBeDefined();
        expect(err.message).toContain("selfRef -> selfRef");
    });

    it("should gracefully resolve circular component imports without call stack overflow", async () => {
        const compA = {
            imports: { CompB: "./CompB.euix.json" },
            view: { tag: "div", children: ["Component A"] },
        };
        const compB = {
            imports: { CompA: "./CompA.euix.json" },
            view: { tag: "div", children: ["Component B"] },
        };

        const app = await prepare(compA, {
            currentFile: "CompA.euix.json",
            resolveImport: async (spec) => {
                if (spec.includes("CompB")) return compB;
                if (spec.includes("CompA")) return compA;
                return null;
            },
        });
        expect(app.diagnostics).toHaveLength(0);
        expect(app.ir.components.length).toBeGreaterThanOrEqual(1);
    });

    // 23. Levenshtein Distance & Suggestion Boundaries
    it("should NOT provide suggestion if distance is too high (> 3)", async () => {
        const source = {
            components: {
                UserCard: { view: { tag: "div" } },
            },
            view: {
                component: "CompletelyUnrelatedZebra",
            },
        };
        const app = await prepare(source);
        const err = app.diagnostics.find((d) => d.code === "EUIX201");
        expect(err).toBeDefined();
        expect(err.suggestion).toBeUndefined();
    });

    it("should provide case-insensitive suggestion for component typo", async () => {
        const source = {
            components: {
                UserProfile: { view: { tag: "div" } },
            },
            view: {
                component: "userprofile",
            },
        };
        const app = await prepare(source);
        const err = app.diagnostics.find((d) => d.code === "EUIX201");
        expect(err).toBeDefined();
        expect(err.suggestion).toBe("UserProfile");
    });

    // 24. Provide / Inject Validation Edge Cases
    it("should emit EUIX202 when provide binds to an unknown state", async () => {
        const source = {
            provide: {
                theme: { $bind: "non_existent_theme_state" },
            },
            view: { tag: "div" },
        };
        const app = await prepare(source);
        const err = app.diagnostics.find((d) => d.code === "EUIX202");
        expect(err).toBeDefined();
        expect(err.type).toBe("unknown-provided-state");
        expect(err.message).toContain('Provided value for "theme" binds to unknown state "non_existent_theme_state"');
    });

    // 25. Cache Invalidation and Isolation
    it("should isolate cache entries and allow complete cache clearing", async () => {
        const src1 = { state: { v: 1 } };
        const src2 = { state: { v: 2 } };

        await prepare(src1);
        await prepare(src2);
        expect(globalPrepareCache.size).toBe(2);

        clearPrepareCache();
        expect(globalPrepareCache.size).toBe(0);
        expect(globalPrepareCache.stats.hits).toBe(0);
        expect(globalPrepareCache.stats.misses).toBe(0);
    });

    // 26. CLI Edge Cases
    it("should fail gracefully when CLI check runs on non-existent path", () => {
        let errCaught = false;
        try {
            execSync("node ./bin/euix.js check non_existent_directory_xyz", { encoding: "utf8", stdio: "pipe" });
        } catch (err) {
            errCaught = true;
            expect(err.stdout || err.stderr).toContain("Path does not exist");
        }
        expect(errCaught).toBe(true);
    });

    it("should fail gracefully when CLI prepare runs without input file", () => {
        let errCaught = false;
        try {
            execSync("node ./bin/euix.js prepare", { encoding: "utf8", stdio: "pipe" });
        } catch (err) {
            errCaught = true;
            expect(err.stdout || err.stderr).toContain("Input file required");
        }
        expect(errCaught).toBe(true);
    });

    it("should handle inspect on minimal empty source gracefully", async () => {
        const minimalSource = {
            version: 1,
            view: { tag: "div", children: ["Hello"] },
        };
        const inspected = await inspect(minimalSource);
        expect(inspected.route).toBeNull();
        expect(inspected.states).toEqual([]);
        expect(inspected.actions).toEqual([]);
        expect(inspected.components).toEqual([]);
        expect(inspected.diagnostics).toEqual([]);
        expect(inspected.bindings).toEqual([]);
    });
});
