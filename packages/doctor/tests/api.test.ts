import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildDependencyEdges } from "../src/analysis/dependencies.js";
import { runDiagnostics } from "../src/diagnostics/index.js";
import { buildProject } from "../src/ir/project.js";
import { generateApiScenarios } from "../src/scenarios/generator.js";
import { executeScenarios } from "../src/runner/simulator.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("API milestone", () => {
    it("extracts fetch API call and state writes", async () => {
        const project = await buildProject(fixtures, "api.xml");
        buildDependencyEdges(project);

        const loadUser = [...project.actions.values()].find((a) => a.name === "loadUser");
        expect(loadUser?.writes).toEqual(expect.arrayContaining(["loading", "user"]));

        const api = [...project.apiCalls.values()][0];
        expect(api?.url).toBe("/api/user");
        expect(api?.urlConfidence).toBe("confirmed");
    });

    it("warns about missing API error path", async () => {
        const project = await buildProject(fixtures, "api.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        expect(project.diagnostics.some((d) => d.rule === "EUIX1501")).toBe(true);
    });

    it("generates API scenarios including failure paths", async () => {
        const project = await buildProject(fixtures, "api.xml");
        buildDependencyEdges(project);
        const scenarios = generateApiScenarios(project);
        expect(scenarios.some((s) => String(s.name).includes("500"))).toBe(true);
        expect(scenarios.some((s) => String(s.name).includes("network"))).toBe(true);

        const failure = scenarios.find((s) => String(s.name).includes("500"));
        const results = executeScenarios(project, failure ? [failure] : []);
        expect(results[0]?.passed).toBe(false);
    });
});
