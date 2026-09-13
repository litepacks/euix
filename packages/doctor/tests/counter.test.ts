import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildDependencyEdges } from "../src/analysis/dependencies.js";
import { runDiagnostics } from "../src/diagnostics/index.js";
import { buildBehaviorPaths } from "../src/graph/behavior.js";
import { buildProject } from "../src/ir/project.js";
import { generateAllScenarios } from "../src/scenarios/generator.js";
import { executeScenarios, simulateComponent, simulateEvent } from "../src/runner/simulator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(__dirname, "../fixtures");

describe("Counter milestone", () => {
    it("builds semantic IR from simple-component.xml", async () => {
        const project = await buildProject(fixtures, "simple-component.xml");
        buildDependencyEdges(project);

        const count = [...project.states.values()].find((s) => s.name === "count");
        const double = [...project.computed.values()].find((c) => c.name === "double");
        const increment = [...project.actions.values()].find((a) => a.name === "increment");

        expect(count?.initialValue).toBe("0");
        expect(double?.dependencies).toContain("count");
        expect(increment?.writes).toContain("count");
        expect(increment?.writes).toContain("count");
        expect(count?.writers).toContain("increment");
        expect(double?.dependencies).toContain("count");
    });

    it("connects event → action → state → computed → binding flow", async () => {
        const project = await buildProject(fixtures, "simple-component.xml");
        buildDependencyEdges(project);
        const paths = buildBehaviorPaths(project);

        expect(paths.length).toBeGreaterThan(0);
        const path = paths[0]!;
        expect(path.nodes.length).toBeGreaterThanOrEqual(3);
    });

    it("simulates increment click behavior", async () => {
        const project = await buildProject(fixtures, "simple-component.xml");
        buildDependencyEdges(project);

        const sim = simulateComponent(project, "Counter");
        expect(sim.values.get("count")).toBe(0);
        expect(sim.values.get("double")).toBe(0);

        simulateEvent(project, "Counter", "increment", sim);
        expect(sim.values.get("count")).toBe(1);
        expect(sim.values.get("double")).toBe(2);
    });

    it("runs generated flow test for increment", async () => {
        const project = await buildProject(fixtures, "simple-component.xml");
        buildDependencyEdges(project);
        const paths = buildBehaviorPaths(project);
        const scenarios = generateAllScenarios(project, paths);
        const flow = scenarios.find((s) => s.name === "Counter.increment");
        expect(flow).toBeDefined();

        const results = executeScenarios(project, flow ? [flow] : []);
        expect(results[0]?.passed).toBe(true);
        expect(results[0]?.message).toContain("count 0 → 1");
    });
});
