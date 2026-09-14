import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { collectEditorSymbols } from "../src/editor/symbols.js";
import { buildDependencyEdges } from "../src/analysis/dependencies.js";
import { runDiagnostics } from "../src/diagnostics/index.js";
import { buildProject } from "../src/ir/project.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("Editor symbols", () => {
    it("exports state and api symbols for uid_spec fixtures", async () => {
        const project = await buildProject(fixtures, "broken/api-watch-unknown.xml");
        buildDependencyEdges(project);
        runDiagnostics(project);

        const symbols = collectEditorSymbols(
            project,
            path.join(fixtures, "broken/api-watch-unknown.xml"),
        );
        const names = symbols.map((s) => `${s.kind}:${s.name}`);
        expect(names).toContain("api:known");
    });
});
