import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildDependencyEdges } from "../src/analysis/dependencies.js";
import {
    createProjectActionContext,
    isDynamicHandler,
    resolveEventHandler,
} from "../src/euix/actionHandlers.js";
import { buildAllowedEngineActions, inferProjectPlugins } from "../src/euix/pluginContext.js";
import { runDiagnostics } from "../src/diagnostics/index.js";
import { buildProject } from "../src/ir/project.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("Action handler resolution", () => {
    it("does not flag built-in actions or shorthands as missing", async () => {
        const cleanTargets = [
            "native/uid-spec-counter.xml",
            "native/watcher-chain.xml",
            "native/api-swr.xml",
            "native/action-composer.xml",
            "plugins/date-formatting.xml",
            "plugins/stream-websocket.xml",
            "plugins/resilience-retry.xml",
            "plugins/animation-transitions.xml",
            "plugins/dialog-modal.xml",
            "multi-component/App.xml",
            "multi-component/Dashboard.xml",
        ];

        for (const target of cleanTargets) {
            const project = await buildProject(fixtures, target);
            buildDependencyEdges(project);
            runDiagnostics(project);
            const errors = project.diagnostics.filter((d) => d.rule.startsWith("EUIX130") && d.severity === "error");
            expect(errors, target).toHaveLength(0);
        }

        const shorthand = await buildProject(fixtures, "native/events-shorthand.xml");
        buildDependencyEdges(shorthand);
        runDiagnostics(shorthand);
        const shorthandMissing = shorthand.diagnostics.filter((d) => d.rule === "EUIX1301" && d.severity === "error");
        expect(shorthandMissing.map((d) => d.message)).toEqual([
            expect.stringContaining("SubmitForm"),
        ]);
    });

    it("scopes plugin actions to detected plugin context", async () => {
        const withDate = await buildProject(fixtures, "plugins/date-formatting.xml");
        const datePlugins = inferProjectPlugins(withDate);
        expect(datePlugins.has("date")).toBe(true);
        expect(buildAllowedEngineActions(datePlugins).has("SET_DATE_LOCALE")).toBe(true);

        const bare = await buildProject(fixtures, "broken/plugin-action-without-markup.xml");
        const barePlugins = inferProjectPlugins(bare);
        expect(barePlugins.has("stream")).toBe(false);
        runDiagnostics(bare);
        expect(bare.diagnostics.some((d) => d.rule === "EUIX1302" && d.message.includes("STREAM_SEND"))).toBe(true);
    });

    it("resolves imported shared action_def modules", async () => {
        const project = await buildProject(fixtures, "plugins/dialog-modal.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        expect([...project.actions.values()].some((a) => a.name === "ConfirmDelete")).toBe(true);
        expect(project.diagnostics.filter((d) => d.rule === "EUIX1301" && d.message.includes("ConfirmDelete"))).toHaveLength(0);
    });

    it("reports dynamic handlers as inferred info, not blocking errors", async () => {
        expect(isDynamicHandler("{data.handlerName}")).toBe(true);

        const project = await buildProject(fixtures, "broken/dynamic-action-handler.xml");
        runDiagnostics(project);

        const hit = project.diagnostics.find((d) => d.message.includes("Dynamic action expression"));
        expect(hit?.rule).toBe("EUIX1301");
        expect(hit?.severity).toBe("info");
        expect(hit?.confidence).toBe("inferred");
    });

    it("reports missing custom actions with actionable guidance", async () => {
        const project = await buildProject(fixtures, "broken/missing-handler.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const hit = project.diagnostics.find((d) => d.rule === "EUIX1301" && d.severity === "error");
        expect(hit).toBeDefined();
        expect(hit!.message).toContain("NonExistentAction");
        expect(hit!.confidence).toBe("confirmed");
    });

    it("flags undefined callback actions separately", async () => {
        const project = await buildProject(fixtures, "native/validation-form.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const cb = project.diagnostics.filter((d) => d.rule === "EUIX1301" && d.severity === "error");
        expect(cb).toHaveLength(1);
        expect(cb[0]!.message).toContain("SubmitRegistration");
    });
});
