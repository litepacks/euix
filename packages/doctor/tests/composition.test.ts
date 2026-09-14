import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildDependencyEdges } from "../src/analysis/dependencies.js";
import { runDiagnostics } from "../src/diagnostics/index.js";
import { buildProject } from "../src/ir/project.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("Composition & imports", () => {
    it("links App → Header/Dashboard in multi-component folder", async () => {
        const project = await buildProject(fixtures, "multi-component");
        buildDependencyEdges(project);

        const app = [...project.components.values()].find((c) => c.name === "App");
        expect(app?.childComponentNames).toEqual(expect.arrayContaining(["Header", "Dashboard"]));
        expect(app?.childComponentIds.length).toBeGreaterThanOrEqual(2);

        const composeEdges = project.dependencies.filter((e) => e.kind === "composes");
        expect(composeEdges.length).toBeGreaterThanOrEqual(2);
    });

    it("auto-imports sibling components when scanning a single App file", async () => {
        const appFile = path.join(fixtures, "multi-component/App.xml");
        const project = await buildProject(fixtures, appFile);
        buildDependencyEdges(project);

        const names = [...project.components.values()].map((c) => c.name);
        expect(names).toContain("App");
        expect(names).toContain("Header");
        expect(names).toContain("Dashboard");
        expect(project.files.length).toBeGreaterThan(1);
    });

    it("resolves component src imports", async () => {
        const project = await buildProject(fixtures, "native/error-boundary.xml");
        buildDependencyEdges(project);

        const refs = [...project.componentRefs.values()];
        const chartRef = refs.find((r) => r.srcPath?.includes("BrokenChart.xml"));
        expect(chartRef?.resolvedComponentName).toBe("BrokenChart");
        expect(project.diagnostics.some((d) => d.rule === "EUIX1401" && d.message.includes("BrokenChart"))).toBe(false);
    });

    it("reports missing required props across composition", async () => {
        const project = await buildProject(fixtures, "multi-component/App.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const headerRef = [...project.componentRefs.values()].find((r) => r.resolvedComponentName === "Header");
        expect(headerRef?.propsPassed).toContain("user");
        expect(headerRef?.missingRequiredProps).toHaveLength(0);
    });

    it("collects prop types on multi-component children", async () => {
        const project = await buildProject(fixtures, "multi-component/App.xml");

        const headerUser = [...project.props.values()].find((p) => p.componentName === "Header" && p.name === "user");
        const dashboardUser = [...project.props.values()].find((p) => p.componentName === "Dashboard" && p.name === "user");

        expect(headerUser?.type).toBe("object");
        expect(dashboardUser?.type).toBe("object");
    });

    it("accepts matching object prop bindings in multi-component App", async () => {
        const project = await buildProject(fixtures, "multi-component/App.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const refs = [...project.componentRefs.values()].filter((r) =>
            r.resolvedComponentName === "Header" || r.resolvedComponentName === "Dashboard",
        );

        expect(refs.length).toBeGreaterThanOrEqual(2);
        for (const ref of refs) {
            expect(ref.propTypeMismatches).toHaveLength(0);
        }
        expect(project.diagnostics.some((d) => d.rule === "EUIX1403")).toBe(false);
    });

    it("reports prop type mismatch when App passes string state to object prop", async () => {
        const project = await buildProject(fixtures, "multi-component/App-invalid-prop.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const headerRef = [...project.componentRefs.values()].find((r) => r.resolvedComponentName === "Header");
        expect(headerRef?.propTypeMismatches).toEqual(
            expect.arrayContaining([expect.objectContaining({ prop: "user", expected: "object", inferred: "string" })]),
        );
        expect(project.diagnostics.some((d) => d.rule === "EUIX1403" && d.message.includes("Header"))).toBe(true);
    });

    it("reports prop type mismatches for literal values", async () => {
        const project = await buildProject(fixtures, "broken/prop-type-mismatch.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        expect(project.diagnostics.some((d) => d.rule === "EUIX1403" && d.message.includes("count"))).toBe(true);
    });

    it("reports prop type mismatches for state bindings", async () => {
        const project = await buildProject(fixtures, "broken/prop-state-type-mismatch.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        expect(project.diagnostics.some((d) => d.rule === "EUIX1403" && d.message.includes("user"))).toBe(true);
    });

    it("does not duplicate sibling imports on case-insensitive filesystems", async () => {
        const project = await buildProject(fixtures, "multi-component/App.xml");

        const headerComponents = [...project.components.values()].filter((c) => c.name === "Header");
        const dashboardComponents = [...project.components.values()].filter((c) => c.name === "Dashboard");

        expect(headerComponents).toHaveLength(1);
        expect(dashboardComponents).toHaveLength(1);
        expect(project.files).toHaveLength(3);
    });

    it("treats prop-passed and conditional states as used in multi-component App", async () => {
        const project = await buildProject(fixtures, "multi-component/App.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const unused = project.diagnostics.filter((d) => d.rule === "EUIX1002").map((d) => d.message);
        expect(unused.some((m) => m.includes("'user'"))).toBe(false);
        expect(unused.some((m) => m.includes("'page'"))).toBe(false);
    });

    it("detects api plugin from imported Dashboard endpoints", async () => {
        const project = await buildProject(fixtures, "multi-component/App.xml");

        expect(project.activePlugins).toContain("api");
    });

    it("reports unresolved component references", async () => {
        const project = await buildProject(fixtures, "multi-component/App.xml");
        const ghostRef = {
            id: "compref:test",
            parentComponentId: [...project.components.values()][0]!.id,
            parentComponentName: "App",
            kind: "custom-tag" as const,
            refName: "GhostWidget",
            srcPath: null,
            resolvedComponentId: null,
            resolvedComponentName: null,
            resolvedFile: null,
            propsPassed: [],
            propValues: {},
            missingRequiredProps: [],
            propTypeMismatches: [],
            file: "test.xml",
            location: { file: "test.xml", start: 0, end: 1, line: 1, column: 1 },
        };
        project.componentRefs.set(ghostRef.id, ghostRef);
        runDiagnostics(project);

        expect(project.diagnostics.some((d) => d.rule === "EUIX1401" && d.message.includes("GhostWidget"))).toBe(true);
    });
});
