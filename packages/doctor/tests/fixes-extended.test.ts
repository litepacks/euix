import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildDependencyEdges } from "../src/analysis/dependencies.js";
import { runDiagnostics } from "../src/diagnostics/index.js";
import { applyFixes, collectFixes } from "../src/fixes/index.js";
import { buildProject } from "../src/ir/project.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("Extended auto-fixes", () => {
    it("collects EUIX1701 fix for unknown API watcher tag", async () => {
        const project = await buildProject(fixtures, "broken/api-watch-unknown.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const fixes = collectFixes(project, ["EUIX1701"]);
        expect(fixes.some((f) => f.replacement.includes('tag="missing_endpoint"'))).toBe(true);
    });

    it("applies EUIX1701 fix and clears the diagnostic", async () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-fix-1701-"));
        const dest = path.join(tmp, "api-watch-unknown.xml");
        fs.copyFileSync(path.join(fixtures, "broken/api-watch-unknown.xml"), dest);

        let project = await buildProject(tmp, dest);
        buildDependencyEdges(project);
        runDiagnostics(project);
        expect(project.diagnostics.some((d) => d.rule === "EUIX1701")).toBe(true);

        applyFixes(project, { rules: ["EUIX1701"] });
        const updated = fs.readFileSync(dest, "utf8");
        expect(updated).toContain('tag="missing_endpoint"');

        project = await buildProject(tmp, dest);
        buildDependencyEdges(project);
        runDiagnostics(project);
        expect(project.diagnostics.some((d) => d.rule === "EUIX1701")).toBe(false);
    });
});
