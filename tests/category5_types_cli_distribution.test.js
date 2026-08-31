import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { generateXSDSchema, generateJsonSchema, generateComponentTypes, compileXmlToJs } from "../src/compiler/index.js";

describe("Category 5: TypeScript Definitions, CLI & Distribution Suite", () => {
    describe("1. Type Definitions & Declarations", () => {
        it("should have comprehensive TypeScript declaration files", () => {
            const typesDir = path.resolve(process.cwd(), "types");
            expect(fs.existsSync(typesDir)).toBe(true);

            const coreDts = fs.readFileSync(path.join(typesDir, "core.d.ts"), "utf8");
            expect(coreDts).toContain("EUIXMutationOperation");
            expect(coreDts).toContain("REVERSE");
            expect(coreDts).toContain("SORT");
            expect(coreDts).toContain("clearApiCache");
            expect(coreDts).toContain("getApiStatus");

            const serverDts = fs.readFileSync(path.join(typesDir, "server.d.ts"), "utf8");
            expect(serverDts).toContain("renderToString");
            expect(serverDts).toContain("components?: Record<string, string | EUIXAstNode>;");
        });
    });

    describe("2. CLI Tooling Execution", () => {
        const binPath = path.resolve(process.cwd(), "bin/euix.js");

        it("should output CLI version with --version flag", () => {
            const out = execSync(`node "${binPath}" --version`, { encoding: "utf8" });
            expect(out).toMatch(/^v\d+\.\d+\.\d+/);
        });

        it("should output XML schema definition via schema:xsd command", () => {
            const out = execSync(`node "${binPath}" schema:xsd`, { encoding: "utf8" });
            expect(out).toContain('<?xml version="1.0" encoding="UTF-8"?>');
            expect(out).toContain('<xs:schema');
            expect(out).toContain('name="uid_spec"');
        });

        it("should output JSON schema validator via schema:json command", () => {
            const out = execSync(`node "${binPath}" schema:json`, { encoding: "utf8" });
            const parsed = JSON.parse(out);
            expect(parsed.$schema).toContain("json-schema.org");
            expect(parsed.title).toBe("EUIX XML UI Specification Schema");
        });
    });

    describe("3. Package Exports & Modular Distribution", () => {
        it("should define valid subpath exports in package.json", () => {
            const pkgPath = path.resolve(process.cwd(), "package.json");
            const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

            expect(pkg.exports).toBeDefined();
            expect(pkg.exports["."]).toBeDefined();
            expect(pkg.exports["./core"]).toBeDefined();
            expect(pkg.exports["./api"]).toBeDefined();
            expect(pkg.exports["./server"]).toBeDefined();
            expect(pkg.exports["./composer"]).toBeDefined();
            expect(pkg.exports["./storage"]).toBeDefined();
            expect(pkg.exports["./devtools"]).toBeDefined();
        });
    });
});
