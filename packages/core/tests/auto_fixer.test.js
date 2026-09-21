import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { applyFixes, fixSource, validateSource, prepare } from "../src/prepare/index.js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

describe("EUIX Auto-Fixer Subsystem (euix check --fix & applyFixes)", () => {
    const tempDir = path.resolve(process.cwd(), "tests/temp_fixer");

    beforeEach(() => {
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should auto-fix typos in JSON object (components, states, actions, routes)", async () => {
        const sourceObj = {
            version: 1,
            route: {
                path: "dashboard", // Missing leading slash
            },
            components: {
                UserCard: {
                    view: {
                        tag: "div",
                        children: ["Card Content"],
                    },
                },
            },
            state: {
                counter: 0,
            },
            actions: {
                increment: {
                    assign: "counter",
                    value: "counter + 1",
                },
            },
            view: {
                tag: "div",
                children: [
                    {
                        component: "UserCrd", // Typo: should be UserCard
                    },
                    {
                        tag: "input",
                        props: {
                            value: {
                                $bind: "counetr", // Typo: should be counter
                            },
                        },
                    },
                    {
                        tag: "button",
                        events: {
                            click: {
                                $action: "incrmnt", // Typo: should be increment
                            },
                        },
                        children: ["+1"],
                    },
                ],
            },
        };

        const result = await fixSource(sourceObj, { currentFile: "TestApp.euix.json" });

        expect(result.modified).toBe(true);
        expect(result.fixesApplied.length).toBe(4);

        // Verify route fix
        expect(result.fixedSource.route.path).toBe("/dashboard");

        // Verify component fix
        expect(result.fixedSource.view.children[0].component).toBe("UserCard");

        // Verify state binding fix
        expect(result.fixedSource.view.children[1].props.value.$bind).toBe("counter");

        // Verify action fix
        expect(result.fixedSource.view.children[2].events.click.$action).toBe("increment");

        // Verify remaining diagnostics have zero errors
        const errors = result.remainingDiagnostics.filter((d) => d.severity === "error");
        expect(errors.length).toBe(0);
    });

    it("should auto-fix typos in JSON string", async () => {
        const jsonStr = JSON.stringify({
            version: 1,
            state: {
                userName: "Guest",
            },
            view: {
                tag: "input",
                props: {
                    value: {
                        $bind: "usrName", // Typo
                    },
                },
            },
        }, null, 2);

        const result = await fixSource(jsonStr, { currentFile: "Input.json" });

        expect(result.modified).toBe(true);
        expect(typeof result.fixedSource).toBe("string");
        const parsed = JSON.parse(result.fixedSource);
        expect(parsed.view.props.value.$bind).toBe("userName");
    });

    it("should auto-fix typos and CDATA in XML template string", async () => {
        const xml = `<uid_spec>
  <data_model>
    <state id="user_score" type="number">10</state>
  </data_model>
  <action_def name="boost_score">
    <step if="user_score < 100">
      <path>data.user_score</path>
      <value>{data.user_score + 10}</value>
    </step>
  </action_def>
  <container>
    <input bind="user_scor" />
    <button on_click:call="boost_scor">Boost</button>
  </container>
</uid_spec>`;

        const result = await fixSource(xml, { currentFile: "App.xml" });

        expect(result.modified).toBe(true);
        expect(typeof result.fixedSource).toBe("string");
        expect(result.fixedSource).toContain('bind="user_score"');
        expect(result.fixedSource).toContain('on_click:call="boost_score"');
    });

    it("should not modify source when there are no fixable diagnostics", async () => {
        const validSource = {
            version: 1,
            state: {
                count: 0,
            },
            actions: {
                add: {
                    assign: "count",
                    value: "count + 1",
                },
            },
            view: {
                tag: "button",
                events: {
                    click: {
                        $action: "add",
                    },
                },
                children: ["+1"],
            },
        };

        const result = await fixSource(validSource, { currentFile: "Valid.json" });
        expect(result.modified).toBe(false);
        expect(result.fixesApplied.length).toBe(0);
    });

    it("should execute CLI check --dry-run without modifying file", () => {
        const cliPath = path.resolve(process.cwd(), "bin/euix.js");
        const filePath = path.join(tempDir, "Typo.json");

        const initialContent = JSON.stringify({
            version: 1,
            state: { count: 0 },
            view: {
                tag: "input",
                props: { value: { $bind: "cunt" } }, // Typo
            },
        }, null, 2);

        fs.writeFileSync(filePath, initialContent, "utf8");

        const dryRunOutput = execSync(`node ${cliPath} check ${filePath} --fix --dry-run`, {
            encoding: "utf8",
        });

        expect(dryRunOutput).toContain("[DRY-RUN] Would apply");
        expect(dryRunOutput).toContain("Replaced unknown state binding");

        // Verify file was NOT modified
        const fileAfterDryRun = fs.readFileSync(filePath, "utf8");
        expect(fileAfterDryRun).toBe(initialContent);
    });

    it("should execute CLI check --fix and modify file to resolve errors", () => {
        const cliPath = path.resolve(process.cwd(), "bin/euix.js");
        const filePath = path.join(tempDir, "TypoFix.json");

        const initialContent = JSON.stringify({
            version: 1,
            state: { count: 0 },
            view: {
                tag: "input",
                props: { value: { $bind: "cunt" } }, // Typo
            },
        }, null, 2);

        fs.writeFileSync(filePath, initialContent, "utf8");

        const fixOutput = execSync(`node ${cliPath} check ${filePath} --fix`, {
            encoding: "utf8",
        });

        expect(fixOutput).toContain("Applied 1 fix(es)");
        expect(fixOutput).toContain("0 errors found");

        // Verify file was modified
        const fileAfterFix = fs.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(fileAfterFix);
        expect(parsed.view.props.value.$bind).toBe("count");
    });

    it("should execute CLI fix alias command", () => {
        const cliPath = path.resolve(process.cwd(), "bin/euix.js");
        const filePath = path.join(tempDir, "FixAlias.json");

        const initialContent = JSON.stringify({
            version: 1,
            state: { activeUser: "Alice" },
            view: {
                tag: "input",
                props: { value: { $bind: "actveUser" } }, // Typo
            },
        }, null, 2);

        fs.writeFileSync(filePath, initialContent, "utf8");

        const fixOutput = execSync(`node ${cliPath} fix ${filePath}`, {
            encoding: "utf8",
        });

        expect(fixOutput).toContain("Applied 1 fix(es)");
        expect(fixOutput).toContain("0 errors found");

        const fileAfterFix = fs.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(fileAfterFix);
        expect(parsed.view.props.value.$bind).toBe("activeUser");
    });
});
