import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { generateSourceSchema } from "../src/prepare/index.js";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

describe("EUIX IDE JSON Schema Subsystem (euix schema & generateSourceSchema)", () => {
    const tempDir = path.resolve(process.cwd(), "tests/temp_schema");

    beforeEach(() => {
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
        if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
    });

    it("should generate a complete, valid Draft-07 JSON Schema object", () => {
        const schema = generateSourceSchema();

        expect(schema).toBeDefined();
        expect(schema.$schema).toBe("http://json-schema.org/draft-07/schema#");
        expect(schema.title).toContain("EUIX Source JSON Specification");
        expect(schema.type).toBe("object");

        // Required keys
        expect(schema.required).toContain("version");
        expect(schema.required).toContain("view");

        // Top level properties
        expect(schema.properties.version).toBeDefined();
        expect(schema.properties.imports).toBeDefined();
        expect(schema.properties.route).toBeDefined();
        expect(schema.properties.props).toBeDefined();
        expect(schema.properties.state).toBeDefined();
        expect(schema.properties.computed).toBeDefined();
        expect(schema.properties.watch).toBeDefined();
        expect(schema.properties.actions).toBeDefined();
        expect(schema.properties.lifecycle).toBeDefined();
        expect(schema.properties.view).toBeDefined();

        // Definitions
        expect(schema.$defs).toBeDefined();
        expect(schema.$defs.ActionDef).toBeDefined();
        expect(schema.$defs.ViewNode).toBeDefined();
    });

    it("should execute CLI schema command and output valid JSON to stdout", () => {
        const cliPath = path.resolve(process.cwd(), "bin/euix.js");
        const stdout = execSync(`node ${cliPath} schema`, { encoding: "utf8" });

        const parsed = JSON.parse(stdout);
        expect(parsed.$schema).toBe("http://json-schema.org/draft-07/schema#");
        expect(parsed.properties.view).toBeDefined();
    });

    it("should execute CLI schema command with -o output flag", () => {
        const cliPath = path.resolve(process.cwd(), "bin/euix.js");
        const outFilePath = path.join(tempDir, "euix.schema.json");

        const stdout = execSync(`node ${cliPath} schema -o ${outFilePath}`, { encoding: "utf8" });
        expect(stdout).toContain("Generated EUIX JSON Schema at");

        expect(fs.existsSync(outFilePath)).toBe(true);
        const fileContent = fs.readFileSync(outFilePath, "utf8");
        const parsed = JSON.parse(fileContent);
        expect(parsed.title).toContain("EUIX Source JSON Specification");
    });

    it("should execute CLI schema --vscode and automatically configure .vscode/settings.json", () => {
        const cliPath = path.resolve(process.cwd(), "bin/euix.js");

        // Run command inside temp project directory
        const stdout = execSync(`node ${cliPath} schema --vscode`, {
            cwd: tempDir,
            encoding: "utf8",
        });

        expect(stdout).toContain("Generated EUIX JSON Schema at: .vscode/euix.schema.json");
        expect(stdout).toContain("Configured VS Code / Cursor settings at: .vscode/settings.json");

        // Verify files exist
        const schemaPath = path.join(tempDir, ".vscode/euix.schema.json");
        const settingsPath = path.join(tempDir, ".vscode/settings.json");

        expect(fs.existsSync(schemaPath)).toBe(true);
        expect(fs.existsSync(settingsPath)).toBe(true);

        const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        expect(Array.isArray(settings["json.schemas"])).toBe(true);

        const entry = settings["json.schemas"].find((s) => s.fileMatch.includes("*.euix.json"));
        expect(entry).toBeDefined();
        expect(entry.url).toBe("./euix.schema.json");
    });
});
