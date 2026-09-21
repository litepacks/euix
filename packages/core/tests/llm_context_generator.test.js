/**
 * packages/core/tests/llm_context_generator.test.js
 * Test suite for EUIX LLM Context Generator (euix context).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { generateLlmContext } from "../src/prepare/index.js";

const tmpDir = path.resolve(process.cwd(), "tests/fixtures/tmp_context");

describe("EUIX LLM Context Generator (euix context)", () => {
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

    it("should scan directory and extract components, props, routes, actions, services, and states", async () => {
        // Component 1: UserCard.euix.json
        fs.writeFileSync(
            path.join(tmpDir, "UserCard.euix.json"),
            JSON.stringify(
                {
                    version: 1,
                    props: {
                        user: { type: "object", required: true },
                        isOnline: { type: "boolean", required: false },
                    },
                    view: { tag: "div", children: ["UserCard"] },
                },
                null,
                2,
            ),
            "utf8",
        );

        // Component 2: ActionButton.xml
        fs.writeFileSync(
            path.join(tmpDir, "ActionButton.xml"),
            `
            <uid_spec>
              <component_def name="ActionButton">
                <button>{props.label}</button>
              </component_def>
            </uid_spec>
            `,
            "utf8",
        );

        // Main App with routes, actions, and services: App.euix.json
        fs.writeFileSync(
            path.join(tmpDir, "App.euix.json"),
            JSON.stringify(
                {
                    version: 1,
                    route: {
                        path: "/users/:id",
                    },
                    state: {
                        currentUser: null,
                        theme: "dark",
                        count: 42,
                    },
                    actions: {
                        fetchUser: { call: "api.getUser", args: [{ $route: "params.id" }] },
                        toggleTheme: { call: "theme.toggle" },
                        localAction: { call: "reset" },
                    },
                    view: {
                        tag: "div",
                        children: ["App Content"],
                    },
                },
                null,
                2,
            ),
            "utf8",
        );

        const result = await generateLlmContext(tmpDir, { baseDir: tmpDir });
        expect(result).toBeDefined();
        expect(result.text).toBeDefined();
        expect(result.data).toBeDefined();

        // Check structured data
        const { components, routes, services, actions, states } = result.data;

        // Components
        expect(components.length).toBeGreaterThanOrEqual(2);
        const userCard = components.find((c) => c.name === "UserCard");
        expect(userCard).toBeDefined();
        expect(userCard.props.user.type).toBe("object");
        expect(userCard.props.user.required).toBe(true);

        const actionBtn = components.find((c) => c.name === "ActionButton");
        expect(actionBtn).toBeDefined();

        // Routes
        expect(routes).toHaveLength(1);
        expect(routes[0].path).toBe("/users/:id");
        expect(routes[0].params).toEqual(["id"]);

        // Services & Actions
        expect(services).toContain("api.getUser");
        expect(services).toContain("theme.toggle");
        expect(actions).toContain("fetchUser");
        expect(actions).toContain("toggleTheme");
        expect(actions).toContain("localAction");

        // States
        expect(states.some((s) => s.name === "currentUser")).toBe(true);
        expect(states.some((s) => s.name === "theme")).toBe(true);
        expect(states.some((s) => s.name === "count")).toBe(true);

        // Check Prompt Markdown output
        expect(result.text).toContain("# EUIX Project Context");
        expect(result.text).toContain("## Components");
        expect(result.text).toContain("UserCard(props: { user: object, isOnline?: boolean })");
        expect(result.text).toContain("## Routes");
        expect(result.text).toContain("/users/:id (params: id)");
        expect(result.text).toContain("## Services & Actions");
        expect(result.text).toContain("Services: api.getUser, theme.toggle");
        expect(result.text).toContain("Actions: fetchUser, localAction, toggleTheme");
        expect(result.text).toContain("## States");
        expect(result.text).toContain("currentUser");
    });

    it("should handle empty or non-existent directories gracefully without throwing", async () => {
        const nonExistent = path.join(tmpDir, "does_not_exist");
        const result = await generateLlmContext(nonExistent, { baseDir: tmpDir });
        expect(result.data.components).toEqual([]);
        expect(result.data.routes).toEqual([]);
        expect(result.data.services).toEqual([]);
        expect(result.data.actions).toEqual([]);
        expect(result.data.states).toEqual([]);
        expect(result.text).toBe("# EUIX Project Context");
    });

    it("should execute CLI context command with stdout, --json, and -o options", () => {
        fs.writeFileSync(
            path.join(tmpDir, "SimpleCard.euix.json"),
            JSON.stringify(
                {
                    version: 1,
                    props: { title: { type: "string", required: true } },
                    state: { active: true },
                    view: { tag: "div", children: ["SimpleCard"] },
                },
                null,
                2,
            ),
            "utf8",
        );

        // 1. CLI default (markdown stdout)
        const stdoutOut = execSync(`node ./bin/euix.js context "${tmpDir}"`, { encoding: "utf8" });
        expect(stdoutOut).toContain("# EUIX Project Context");
        expect(stdoutOut).toContain("SimpleCard(props: { title: string })");
        expect(stdoutOut).toContain("active (boolean)");

        // 2. CLI with --json
        const jsonOut = execSync(`node ./bin/euix.js context "${tmpDir}" --json`, { encoding: "utf8" });
        const parsedJson = JSON.parse(jsonOut.trim());
        expect(parsedJson.components).toHaveLength(1);
        expect(parsedJson.components[0].name).toBe("SimpleCard");
        expect(parsedJson.states[0].name).toBe("active");

        // 3. CLI with -o output file
        const outputFile = path.join(tmpDir, "llm_context.md");
        execSync(`node ./bin/euix.js context "${tmpDir}" -o "${outputFile}"`, { encoding: "utf8" });
        expect(fs.existsSync(outputFile)).toBe(true);
        const fileContent = fs.readFileSync(outputFile, "utf8");
        expect(fileContent).toContain("# EUIX Project Context");
        expect(fileContent).toContain("SimpleCard(props: { title: string })");
    });
});
