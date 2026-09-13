import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildDependencyEdges } from "../src/analysis/dependencies.js";
import { runDiagnostics } from "../src/diagnostics/index.js";
import { buildProject } from "../src/ir/project.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

function listFixtures(dir: string, ext: string[]): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...listFixtures(full, ext));
        else if (ext.some((e) => entry.name.endsWith(e))) out.push(full);
    }
    return out.sort();
}

describe("Fixture coverage", () => {
    it("discovers all fixture files", () => {
        const files = listFixtures(fixtures, [".xml", ".html", ".js"]);
        expect(files.length).toBeGreaterThanOrEqual(35);
    });

    it("builds full fixtures project without errors", async () => {
        const project = await buildProject(fixtures);
        buildDependencyEdges(project);

        expect(project.files.length).toBeGreaterThanOrEqual(35);
        expect(project.components.size).toBeGreaterThanOrEqual(30);
        expect(project.states.size).toBeGreaterThan(20);
        expect(project.actions.size).toBeGreaterThan(10);
        expect(project.events.size).toBeGreaterThan(10);
        expect(project.bindings.size).toBeGreaterThan(20);
        expect(project.apiCalls.size).toBeGreaterThan(5);
        expect(project.routes.size).toBeGreaterThan(0);
    });

    it("covers native EUIX features", async () => {
        const project = await buildProject(fixtures, "native");
        buildDependencyEdges(project);

        expect([...project.states.values()].some((s) => s.name === "count")).toBe(true);
        expect([...project.computed.values()].some((c) => c.name === "double")).toBe(true);
        expect([...project.watchers.values()].length).toBeGreaterThan(1);
        expect([...project.routes.values()].length).toBeGreaterThan(1);
        expect([...project.slots.values()].length).toBeGreaterThan(0);
        expect([...project.actions.values()].some((a) => a.parameters.length > 0)).toBe(true);
    });

    it("covers plugin fixtures", async () => {
        const project = await buildProject(fixtures, "plugins");
        buildDependencyEdges(project);

        const apiCalls = [...project.apiCalls.values()];
        expect(apiCalls.some((a) => a.method === "WEBSOCKET")).toBe(true);
        expect(apiCalls.some((a) => a.method === "SSE")).toBe(true);
        expect(apiCalls.some((a) => a.url.includes("/search/repositories") || a.url.includes("/prices"))).toBe(true);

        const actions = [...project.actions.values()];
        expect(actions.some((a) => a.runtimeEffectIds.includes("WebSocket"))).toBe(true);
        expect(actions.some((a) => a.runtimeEffectIds.includes("EventSource"))).toBe(true);
        expect(actions.some((a) => a.storageEffects.includes("localStorage"))).toBe(true);
        expect(actions.some((a) => a.calls.includes("VALIDATE_FORM") || a.name.includes("task"))).toBe(true);
    });

    it("covers runtime JS fixtures", async () => {
        const project = await buildProject(fixtures, "runtime");
        buildDependencyEdges(project);

        const actions = [...project.actions.values()];
        expect(actions.some((a) => a.runtimeEffectIds.includes("WebSocket"))).toBe(true);
        expect(actions.some((a) => a.runtimeEffectIds.includes("EventSource"))).toBe(true);
        expect(actions.some((a) => a.runtimeEffectIds.includes("setInterval"))).toBe(true);
        expect(actions.some((a) => a.runtimeEffectIds.includes("setTimeout"))).toBe(true);
        expect(actions.some((a) => a.awaits > 0)).toBe(true);
    });

    it("covers multi-component composition", async () => {
        const project = await buildProject(fixtures, "multi-component");
        buildDependencyEdges(project);

        const names = [...project.components.values()].map((c) => c.name);
        expect(names).toContain("App");
        expect(names).toContain("Header");
        expect(names).toContain("Dashboard");
        expect([...project.props.values()].some((p) => p.name === "user" && p.required)).toBe(true);
    });

    it("detects broken fixture diagnostics", async () => {
        const project = await buildProject(fixtures, "broken");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const rules = project.diagnostics.map((d) => d.rule);
        expect(rules).toContain("EUIX1201");
        expect(rules.some((r) => r.startsWith("EUIX1"))).toBe(true);
    });

    it("parses embedded template literals and HTML apps", async () => {
        const project = await buildProject(fixtures);
        const fromJs = [...project.components.values()].filter((c) => c.file.includes("template-literal"));
        const fromHtml = [...project.components.values()].filter((c) => c.file.includes("full-dashboard"));
        expect(fromJs.length).toBeGreaterThan(0);
        expect(fromHtml.length).toBeGreaterThan(0);
    });
});
