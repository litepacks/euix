import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildDependencyEdges } from "../src/analysis/dependencies.js";
import { runDiagnostics } from "../src/diagnostics/index.js";
import { buildProject } from "../src/ir/project.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("XML script safety (EUIX0001)", () => {
    it("flags <= inside computed blocks", async () => {
        const project = await buildProject(fixtures, "broken/xml-unsafe-computed.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const hits = project.diagnostics.filter((d) => d.rule === "EUIX0001");
        expect(hits.length).toBeGreaterThan(0);
        expect(hits.some((d) => d.message.includes("<="))).toBe(true);
        expect(hits.some((d) => d.message.includes("CDATA"))).toBe(true);
        expect(hits.some((d) => d.hint?.includes("do not escape JS operators as XML entities"))).toBe(true);
        expect(hits.every((d) => d.severity === "error")).toBe(true);
    });

    it("allows <= inside CDATA-wrapped computed blocks", async () => {
        const project = await buildProject(fixtures, "native/xml-safe-computed-cdata.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);
        expect(project.diagnostics.filter((d) => d.rule === "EUIX0001")).toHaveLength(0);
    });

    it("allows plain computed without comparison operators", async () => {
        const project = await buildProject(fixtures, "native/uid-spec-counter.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);
        expect(project.diagnostics.filter((d) => d.rule === "EUIX0001")).toHaveLength(0);
    });

    it("warns when RUN_SCRIPT step body is inline JS without CDATA", async () => {
        const project = await buildProject(fixtures, "broken/api-watch-unknown.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const hits = project.diagnostics.filter((d) => d.rule === "EUIX0001");
        expect(hits.some((d) => d.severity === "warning" && d.message.includes("without CDATA"))).toBe(true);
        expect(hits.some((d) => d.line === 4)).toBe(true);
    });
});
