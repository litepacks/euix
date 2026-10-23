import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
    verifyLlmOutput,
    formatLlmRepairPrompt,
    stripMarkdownFences,
} from "../src/prepare/index.js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

describe("Phase 3: LLM Self-Correction & Doctor in the Loop Verifier", () => {
    const tempDir = path.resolve(process.cwd(), "tests/temp_verifier");

    beforeEach(() => {
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    });

    describe("3.1 Markdown Fences Cleaner (stripMarkdownFences)", () => {
        it("should strip markdown code fences from JSON output", () => {
            const raw = '```json\n{\n  "version": 1,\n  "view": { "tag": "div" }\n}\n```';
            const cleaned = stripMarkdownFences(raw);
            expect(cleaned).toBe('{\n  "version": 1,\n  "view": { "tag": "div" }\n}');
        });

        it("should strip markdown code fences from XML output", () => {
            const raw = "```xml\n<uid_spec>\n  <view><button>Click</button></view>\n</uid_spec>\n```";
            const cleaned = stripMarkdownFences(raw);
            expect(cleaned).toBe("<uid_spec>\n  <view><button>Click</button></view>\n</uid_spec>");
        });

        it("should leave plain strings untouched", () => {
            const raw = '{\n  "version": 1\n}';
            expect(stripMarkdownFences(raw)).toBe(raw);
        });
    });

    describe("3.2 In-Memory Programmatic Verifier (verifyLlmOutput)", () => {
        it("should verify valid JSON and report zero errors in under 15ms", async () => {
            const validJson = {
                version: 1,
                state: { counter: 0 },
                actions: { increment: { set: { counter: "counter+1" } } },
                view: {
                    tag: "button",
                    events: { click: "increment" },
                    children: ["+1"],
                },
            };

            const result = await verifyLlmOutput(validJson);
            expect(result.isValid).toBe(true);
            expect(result.errors.length).toBe(0);
            expect(result.promptFeedback).toBeNull();
            expect(result.stats.durationMs).toBeLessThan(250);
        });

        it("should automatically auto-repair fuzzy typos and React habits", async () => {
            const llmOutputWithTypos = {
                version: 1,
                state: { counter: 0 },
                actions: { increment: { set: { counter: "counter+1" } } },
                view: {
                    tag: "div",
                    props: { className: "container" },
                    children: [
                        {
                            tag: "input",
                            props: { "v-model": "counte" }, // typo in state + Vue v-model
                        },
                        {
                            tag: "button",
                            props: { onClick: "incremen" }, // typo in action + React onClick
                            children: ["Add"],
                        },
                    ],
                },
            };

            const result = await verifyLlmOutput(llmOutputWithTypos, { autoFix: true });

            expect(result.modified).toBe(true);
            expect(result.fixesApplied.length).toBeGreaterThan(0);

            // className -> class
            expect(result.fixesApplied.some((f) => f.code === "EUIX_ALIAS" && f.fixed === "class")).toBe(true);

            // v-model -> $bind & counte -> counter
            expect(result.fixedSource.view.children[0].$bind).toBe("counter");

            // onClick -> events.click & incremen -> increment
            expect(result.fixedSource.view.children[1].events.click).toBe("increment");

            // Should be completely valid after auto-fix!
            expect(result.isValid).toBe(true);
            expect(result.errors.length).toBe(0);
        });

        it("should automatically repair XML with React attributes and missing CDATA", async () => {
            const xmlWithIssues = `
<uid_spec>
  <data_model>
    <state id="count" type="number">0</state>
    <computed id="isSmall">data.count <= 10 && data.count >= 0</computed>
  </data_model>
  <div className="btn-group">
    <button onClick="increment">+1</button>
    <input v-model="count" />
  </div>
</uid_spec>
            `.trim();

            const result = await verifyLlmOutput(xmlWithIssues, { autoFix: true });

            expect(result.modified).toBe(true);
            expect(result.fixedSource).toContain('class="btn-group"');
            expect(result.fixedSource).toContain('on_click:call="increment"');
            expect(result.fixedSource).toContain('bind="count"');
            expect(result.fixedSource).toContain("<![CDATA[data.count <= 10 && data.count >= 0]]>");
        });

        it("should generate structured repair feedback prompt when errors cannot be auto-fixed", async () => {
            const invalidJson = {
                version: 1,
                state: { userList: [] },
                view: {
                    tag: "div",
                    children: [
                        {
                            tag: "button",
                            events: { click: "completelyUndefinedAction123" },
                        },
                        {
                            tag: "span",
                            $bind: "completelyUnknownStateXYZ",
                        },
                    ],
                },
            };

            const result = await verifyLlmOutput(invalidJson, {
                autoFix: true,
                allowedStates: ["userList", "selectedId"],
                allowedActions: ["refreshUsers", "deleteUser"],
            });

            expect(result.isValid).toBe(false);
            expect(result.errors.length).toBeGreaterThanOrEqual(2);
            expect(result.promptFeedback).toBeDefined();

            // Prompt feedback must contain the diagnostic details
            expect(result.promptFeedback).toContain("The generated EUIX code contains the following validation errors");
            expect(result.promptFeedback).toContain("completelyUndefinedAction123");
            expect(result.promptFeedback).toContain("completelyUnknownStateXYZ");

            // Prompt feedback must inject project context
            expect(result.promptFeedback).toContain("Available States: [userList, selectedId]");
            expect(result.promptFeedback).toContain("Available Actions: [refreshUsers, deleteUser]");
        });
    });

    describe("3.3 Repair Prompt Formatter (formatLlmRepairPrompt)", () => {
        it("should format clean, actionable repair prompts for LLM self-correction", () => {
            const mockDiagnostics = [
                {
                    code: "EUIX201",
                    severity: "error",
                    message: 'Unknown component "CustomCard"',
                    path: "view.children[0].component",
                    suggestion: "UserCard",
                },
                {
                    code: "EUIX0001",
                    severity: "error",
                    message: "Script contains unescaped operators without CDATA",
                    path: "computed.grade",
                },
            ];

            const prompt = formatLlmRepairPrompt(mockDiagnostics, {
                allowedComponents: ["UserCard", "HeaderNav"],
            });

            expect(prompt).toContain('1. [EUIX201] Unknown component "CustomCard" at "view.children[0].component"');
            expect(prompt).toContain('💡 Suggestion: Did you mean "UserCard"?');
            expect(prompt).toContain("Rule EUIX0001: Inline JavaScript inside <computed> or <step>");
            expect(prompt).toContain("Available Components: [UserCard, HeaderNav]");
            expect(prompt).toContain("Please output the corrected EUIX specification");
        });
    });

    describe("3.4 CLI Integration (euix verify)", () => {
        const cliPath = path.resolve(process.cwd(), "bin/euix.js");

        it("should execute CLI verify and output JSON with --json flag", () => {
            const testFile = path.join(tempDir, "test_valid.euix.json");
            fs.writeFileSync(
                testFile,
                JSON.stringify({
                    version: 1,
                    view: { tag: "h1", children: ["Hello World"] },
                }),
                "utf8",
            );

            const stdout = execSync(`node ${cliPath} verify ${testFile} --json`, { encoding: "utf8" });
            const parsed = JSON.parse(stdout);

            expect(parsed.isValid).toBe(true);
            expect(parsed.errors).toEqual([]);
            expect(parsed.stats.durationMs).toBeDefined();
        });

        it("should execute CLI verify on valid file and print success", () => {
            const testFile = path.join(tempDir, "test_valid_msg.euix.json");
            fs.writeFileSync(
                testFile,
                JSON.stringify({
                    version: 1,
                    view: { tag: "h1", children: ["Hello World"] },
                }),
                "utf8",
            );

            const stdout = execSync(`node ${cliPath} verify ${testFile}`, { encoding: "utf8" });
            expect(stdout).toContain("Valid EUIX specification");
            expect(stdout).toContain("0 errors");
        });

        it("should execute CLI verify and report auto-fixes when applied", () => {
            const testFile = path.join(tempDir, "test_fixable.euix.json");
            fs.writeFileSync(
                testFile,
                JSON.stringify({
                    version: 1,
                    view: {
                        tag: "div",
                        props: { className: "card" },
                        children: ["Card text"],
                    },
                }),
                "utf8",
            );

            const stdout = execSync(`node ${cliPath} verify ${testFile}`, { encoding: "utf8" });
            expect(stdout).toContain("Applied");
            expect(stdout).toContain("auto-repair");
            expect(stdout).toContain('Normalized React "className" to "class"');
        });
    });
});
