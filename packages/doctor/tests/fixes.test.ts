import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildDependencyEdges } from "../src/analysis/dependencies.js";
import { runDiagnostics } from "../src/diagnostics/index.js";
import { applyFixes, collectEuix0001Fixes } from "../src/fixes/index.js";
import { buildProject } from "../src/ir/project.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

function copyFixtureToTemp(name: string): string {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-fix-"));
    const src = path.join(fixtures, name);
    const dest = path.join(tmp, path.basename(name));
    fs.copyFileSync(src, dest);
    return dest;
}

describe("Auto-fix (EUIX0001)", () => {
    it("collects CDATA wrap fix for unsafe computed blocks", () => {
        const source = fs.readFileSync(path.join(fixtures, "broken/xml-unsafe-computed.xml"), "utf8");
        const fixes = collectEuix0001Fixes(source, "app.xml");
        expect(fixes).toHaveLength(1);
        expect(fixes[0]!.replacement).toContain("<![CDATA[");
        expect(fixes[0]!.replacement).toContain("<= 2");
        expect(fixes[0]!.replacement).not.toContain("&lt;=");
    });

    it("decodes entity-escaped operators when wrapping in CDATA", () => {
        const source = `<uid_spec><data_model><computed id="x" deps="n">
  if ($data.n &lt;= 2) return 'few';
</computed></data_model></uid_spec>`;
        const fixes = collectEuix0001Fixes(source, "app.xml");
        expect(fixes).toHaveLength(1);
        expect(fixes[0]!.replacement).toContain("if ($data.n <= 2)");
    });

    it("applies fix and clears EUIX0001 diagnostics", async () => {
        const file = copyFixtureToTemp("broken/xml-unsafe-computed.xml");
        const root = path.dirname(file);

        let project = await buildProject(root, file);
        buildDependencyEdges(project);
        runDiagnostics(project);
        expect(project.diagnostics.some((d) => d.rule === "EUIX0001")).toBe(true);
        expect(project.diagnostics.find((d) => d.rule === "EUIX0001")?.fix).toBeDefined();

        const result = applyFixes(project, { rules: ["EUIX0001"] });
        expect(result.fixesApplied).toBe(1);

        const updated = fs.readFileSync(file, "utf8");
        expect(updated).toContain("<![CDATA[");
        expect(updated).toContain("<= 2");

        project = await buildProject(root, file);
        buildDependencyEdges(project);
        runDiagnostics(project);
        expect(project.diagnostics.filter((d) => d.rule === "EUIX0001")).toHaveLength(0);
    });

    it("collects CDATA wrap fix for inline RUN_SCRIPT step without unsafe operators", () => {
        const source = fs.readFileSync(path.join(fixtures, "broken/api-watch-unknown.xml"), "utf8");
        const fixes = collectEuix0001Fixes(source, "app.xml");
        expect(fixes.some((f) => f.replacement.includes("<![CDATA[") && f.replacement.includes("$engine.setState"))).toBe(
            true,
        );
    });

    it("dry-run does not write files", async () => {
        const file = copyFixtureToTemp("broken/xml-unsafe-computed.xml");
        const before = fs.readFileSync(file, "utf8");
        const project = await buildProject(path.dirname(file), file);
        buildDependencyEdges(project);
        runDiagnostics(project);

        const result = applyFixes(project, { rules: ["EUIX0001"], dryRun: true });
        expect(result.fixesApplied).toBe(1);
        expect(fs.readFileSync(file, "utf8")).toBe(before);
    });
});
