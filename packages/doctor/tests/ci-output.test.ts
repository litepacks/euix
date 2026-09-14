import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildDependencyEdges } from "../src/analysis/dependencies.js";
import { runDiagnostics } from "../src/diagnostics/index.js";
import { runDoctor } from "../src/doctor.js";
import { buildProject } from "../src/ir/project.js";
import { applyBaseline, loadBaseline, saveBaseline } from "../src/reporters/baseline.js";
import { doctorResultToSarif } from "../src/reporters/sarif.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("CI output & extended rules", () => {
    it("reports EUIX0001 for <= inside computed without CDATA", async () => {
        const project = await buildProject(fixtures, "broken/xml-unsafe-computed.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const hits = project.diagnostics.filter((d) => d.rule === "EUIX0001");
        expect(hits.length).toBeGreaterThan(0);
        expect(hits.some((d) => d.message.includes("<="))).toBe(true);
        expect(hits.some((d) => d.hint?.includes("CDATA"))).toBe(true);
        expect(hits.some((d) => d.hint?.includes("do not escape JS operators"))).toBe(true);
        expect(hits.every((d) => d.severity === "error")).toBe(true);
    });

    it("exports EUIX0001 in SARIF for xml-unsafe computed fixtures", async () => {
        const result = await runDoctor({ root: fixtures, target: "broken/xml-unsafe-computed.xml", test: false });
        const sarif = JSON.parse(doctorResultToSarif(result));
        const ruleIds = sarif.runs[0].tool.driver.rules.map((r: { id: string }) => r.id);
        expect(ruleIds).toContain("EUIX0001");
        const euix0001 = sarif.runs[0].results.find((r: { ruleId: string }) => r.ruleId === "EUIX0001");
        expect(euix0001).toBeDefined();
        expect(euix0001.fixes?.[0]?.description?.text).toContain("CDATA");
    });

    it("reports EUIX1901 for WebMCP tools with missing actions", async () => {
        const project = await buildProject(fixtures, "plugins/webmcp-tools.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        expect(project.diagnostics.some((d) => d.rule === "EUIX1901" && d.message.includes("list_tasks"))).toBe(
            true,
        );
        expect(project.diagnostics.some((d) => d.rule === "EUIX1901" && d.message.includes("create_task"))).toBe(
            false,
        );
    });

    it("reports EUIX2001 when router has no outlet", async () => {
        const project = await buildProject(fixtures, "broken/router-no-outlet.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);
        expect(project.diagnostics.some((d) => d.rule === "EUIX2001")).toBe(true);
    });

    it("reports EUIX2002 for links to unknown routes", async () => {
        const project = await buildProject(fixtures, "broken/router-bad-link.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);
        expect(project.diagnostics.some((d) => d.rule === "EUIX2002" && d.message.includes("/dashboard"))).toBe(
            true,
        );
    });

    it("exports SARIF with rule metadata", async () => {
        const result = await runDoctor({ root: fixtures, target: "broken/router-no-outlet.xml", test: false });
        const sarif = JSON.parse(doctorResultToSarif(result));
        expect(sarif.version).toBe("2.1.0");
        expect(sarif.runs[0].tool.driver.rules.length).toBeGreaterThan(0);
        expect(sarif.runs[0].results.length).toBeGreaterThan(0);
    });

    it("baseline suppresses known diagnostics", async () => {
        const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-baseline-"));
        const baselinePath = path.join(tmp, ".doctor-baseline.json");
        const project = await buildProject(fixtures, "plugins/webmcp-tools.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        saveBaseline(baselinePath, project.diagnostics, fixtures);
        const loaded = loadBaseline(baselinePath);
        expect(loaded.length).toBe(project.diagnostics.length);

        const { visible, suppressed } = applyBaseline(project.diagnostics, loaded, fixtures);
        expect(suppressed).toBe(project.diagnostics.length);
        expect(visible).toHaveLength(0);
    });
});
