import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildDependencyEdges } from "../src/analysis/dependencies.js";
import { collectEditorReferences } from "../src/editor/references.js";
import { runDiagnostics } from "../src/diagnostics/index.js";
import { buildProject } from "../src/ir/project.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("Editor references", () => {
    it("includes api watcher and endpoint references", async () => {
        const file = path.join(fixtures, "broken/api-watch-unknown.xml");
        const project = await buildProject(fixtures, "broken/api-watch-unknown.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const refs = collectEditorReferences(project, file);
        expect(refs.some((r) => r.symbolName === "known" && r.usageKind === "definition")).toBe(true);
        expect(refs.some((r) => r.symbolName === "missing_endpoint" && r.usageKind === "watch")).toBe(true);
    });
});
