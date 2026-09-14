import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildDependencyEdges } from "../src/analysis/dependencies.js";
import { runDiagnostics } from "../src/diagnostics/index.js";
import { buildProject } from "../src/ir/project.js";
import { extractEngineSetStateWrites } from "../src/parser/expressions.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("State tracking improvements", () => {
    it("parses $engine.setState from RUN_SCRIPT bodies", () => {
        expect(extractEngineSetStateWrites("$engine.setState('tableRows', []);")).toEqual(["tableRows"]);
        expect(extractEngineSetStateWrites("setState('data.page', 'x')")).toEqual(["page"]);
    });

    it("tracks if condition= bindings, SET_STATE paths, and watch setState writes", async () => {
        const project = await buildProject(fixtures, "native/state-tracking.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const tab = [...project.states.values()].find((s) => s.name === "tab");
        const count = [...project.states.values()].find((s) => s.name === "count");

        expect(tab?.bindingConsumers.length).toBeGreaterThan(0);
        expect(tab?.writers.length).toBeGreaterThan(0);
        expect(count?.writers.length).toBeGreaterThan(0);
        expect(project.diagnostics.filter((d) => d.rule === "EUIX1002" && d.message.includes("'tab'"))).toHaveLength(0);
        expect(project.diagnostics.filter((d) => d.rule === "EUIX1002" && d.message.includes("'count'"))).toHaveLength(0);
    });

    it("includes actionable hints on diagnostics", async () => {
        const project = await buildProject(fixtures, "broken/missing-handler.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const hit = project.diagnostics.find((d) => d.rule === "EUIX1301" && d.severity === "error");
        expect(hit?.hint).toBeTruthy();
        expect(hit!.hint!.length).toBeGreaterThan(10);
    });
});
