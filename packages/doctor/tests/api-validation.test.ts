import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildDependencyEdges, detectWatcherCycles } from "../src/analysis/dependencies.js";
import { runDiagnostics } from "../src/diagnostics/index.js";
import { buildProject } from "../src/ir/project.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("API & watcher validation", () => {
    it("does not report false watcher cycles for api.* paths", async () => {
        const project = await buildProject(fixtures, "native/api-watchers-no-cycle.xml");
        buildDependencyEdges(project);
        const cycles = detectWatcherCycles(project);
        expect(cycles.length).toBe(0);
    });

    it("reports real data-state watcher cycles", async () => {
        const project = await buildProject(fixtures, "broken/watcher-data-cycle.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);
        expect(project.diagnostics.some((d) => d.rule === "WATCH-CYCLE")).toBe(true);
    });

    it("reports EUIX1701 for unknown api watcher paths", async () => {
        const project = await buildProject(fixtures, "broken/api-watch-unknown.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);
        expect(project.diagnostics.some((d) => d.rule === "EUIX1701" && d.message.includes("missing_endpoint"))).toBe(
            true,
        );
    });

    it("reports EUIX1702 for unknown REVALIDATE_API tags", async () => {
        const project = await buildProject(fixtures, "broken/revalidate-unknown-tag.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);
        expect(project.diagnostics.some((d) => d.rule === "EUIX1702" && d.message.includes("ghost_endpoint"))).toBe(
            true,
        );
    });

    it("tracks JS controller set() calls against XML states", async () => {
        const project = await buildProject(fixtures, "native/js-state-bridge");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const rows = [...project.states.values()].find((s) => s.name === "tableRows");
        const loading = [...project.states.values()].find((s) => s.name === "tableLoading");
        expect(rows?.writers.some((w) => w.startsWith("js:"))).toBe(true);
        expect(loading?.writers.some((w) => w.startsWith("js:"))).toBe(true);
        expect(project.diagnostics.filter((d) => d.rule === "EUIX1002" && d.message.includes("tableRows"))).toHaveLength(
            0,
        );
    });

    it("treats api.* bindings as endpoint consumption", async () => {
        const project = await buildProject(fixtures, "native/api-swr.xml");
        buildDependencyEdges(project);
        expect([...project.apiCalls.values()].every((a) => a.responseConsumed || a.url.includes("stream"))).toBe(true);
    });
});
