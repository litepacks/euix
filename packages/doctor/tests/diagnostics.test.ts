import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { detectComputedCycles, detectWatcherCycles, buildDependencyEdges } from "../src/analysis/dependencies.js";
import { runDiagnostics } from "../src/diagnostics/index.js";
import { buildProject } from "../src/ir/project.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("Diagnostics", () => {
    it("detects watcher self-cycle", async () => {
        const project = await buildProject(fixtures, "watch-loop.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        expect(project.diagnostics.some((d) => d.rule === "EUIX1201")).toBe(true);
    });

    it("detects unknown event handler", async () => {
        const project = await buildProject(fixtures, "simple-component.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);
        expect(project.diagnostics.filter((d) => d.rule === "EUIX1301")).toHaveLength(0);
    });
});
