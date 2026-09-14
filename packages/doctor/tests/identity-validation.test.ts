import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildDependencyEdges } from "../src/analysis/dependencies.js";
import { runDiagnostics } from "../src/diagnostics/index.js";
import { buildProject } from "../src/ir/project.js";
import { diffAgainstBaseline, printBaselineDiff } from "../src/reporters/baselineDiff.js";
import { loadBaseline, saveBaseline } from "../src/reporters/baseline.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

async function analyzeSource(source: string) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-id-"));
    const file = path.join(tmp, "App.xml");
    fs.writeFileSync(file, source);
    const project = await buildProject(path.dirname(file), file);
    buildDependencyEdges(project);
    return runDiagnostics(project);
}

describe("Identity & src validation", () => {
    it("reports EUIX1120 for duplicate state ids", async () => {
        const project = await buildProject(fixtures, "broken/duplicate-state-id.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const hits = project.diagnostics.filter((d) => d.rule === "EUIX1120");
        expect(hits.some((d) => d.message.includes("'count'"))).toBe(true);
    });

    it("reports EUIX1703 for duplicate api_endpoint tags", async () => {
        const project = await buildProject(fixtures, "broken/duplicate-api-tag.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const hits = project.diagnostics.filter((d) => d.rule === "EUIX1703");
        expect(hits.some((d) => d.message.includes("'fetch_data'"))).toBe(true);
    });

    it("reports EUIX1404 when src file is missing", async () => {
        const project = await buildProject(fixtures, "broken/missing-src.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const hits = project.diagnostics.filter((d) => d.rule === "EUIX1404");
        expect(hits.some((d) => d.message.includes("not found"))).toBe(true);
    });

    it("reports EUIX1404 when src file has no component", async () => {
        const project = await buildProject(fixtures, "broken/invalid-src-no-component.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const hits = project.diagnostics.filter((d) => d.rule === "EUIX1404");
        expect(hits.some((d) => d.message.includes("defines no EUIX component"))).toBe(true);
    });

    it("reports EUIX1103 for unknown explicit computed deps", async () => {
        const diagnostics = await analyzeSource(`<uid_spec>
  <data_model><state id="count" type="number">0</state></data_model>
  <computed id="bad" deps="count,missing">{data.count}</computed>
</uid_spec>`);

        const hits = diagnostics.filter((d) => d.rule === "EUIX1103");
        expect(hits.some((d) => d.message.includes("'missing'"))).toBe(true);
    });

    it("baseline diff reports fixed and new diagnostics", async () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-diff-"));
        const baselinePath = path.join(tmp, ".doctor-baseline.json");
        const project = await buildProject(fixtures, "broken/duplicate-state-id.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const baselineOnly = project.diagnostics.filter((d) => d.rule !== "EUIX1120");
        saveBaseline(baselinePath, baselineOnly, fixtures);

        const diff = diffAgainstBaseline(project.diagnostics, loadBaseline(baselinePath), fixtures);
        expect(diff.newDiagnostics.some((d) => d.rule === "EUIX1120")).toBe(true);
        expect(diff.fixed).toHaveLength(0);

        expect(() => printBaselineDiff(diff, fixtures)).not.toThrow();
    });
});
