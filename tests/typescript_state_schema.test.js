// @vitest-environment node
import { describe, it, expect } from "vitest";
import { execSync } from "child_process";
import fs from "fs";
import path from "path";

describe("TypeScript State Schema & Types Suite", () => {
    it("exports valid TypeScript definition files for core, plugins, and main bundle", () => {
        const rootDir = process.cwd();
        const indexDts = path.join(rootDir, "types/index.d.ts");
        const coreDts = path.join(rootDir, "types/core.d.ts");
        const pluginsDts = path.join(rootDir, "types/plugins.d.ts");

        expect(fs.existsSync(indexDts)).toBe(true);
        expect(fs.existsSync(coreDts)).toBe(true);
        expect(fs.existsSync(pluginsDts)).toBe(true);

        const coreContent = fs.readFileSync(coreDts, "utf8");
        expect(coreContent).toContain("class EUIXEngineCore<TState");
        expect(coreContent).toContain("getState<K extends keyof TState>(key: K): TState[K]");
        expect(coreContent).toContain("setState<K extends keyof TState>");
        expect(coreContent).toContain("ErrorBoundaryController");
        expect(coreContent).toContain("BindingModifiers");

        const indexContent = fs.readFileSync(indexDts, "utf8");
        expect(indexContent).toContain("class EUIXEngine<TState");
    });

    it("verifies strong type checking with tsc compiler across generic state schemas", () => {
        const typeTestPath = path.join(process.cwd(), "tests/types/state_schema.test-d.ts");
        expect(fs.existsSync(typeTestPath)).toBe(true);

        const localTsc = path.join(process.cwd(), "node_modules/.bin/tsc");
        const tscCmd = fs.existsSync(localTsc) ? `"${localTsc}"` : "npx -p typescript tsc";
        const output = execSync(`${tscCmd} --noEmit`, {
            cwd: process.cwd(),
            encoding: "utf8"
        });
        expect(output).toBe("");
    });
});
