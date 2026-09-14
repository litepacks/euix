import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildDependencyEdges } from "../src/analysis/dependencies.js";
import { runDiagnostics } from "../src/diagnostics/index.js";
import { buildProject } from "../src/ir/project.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

async function analyzeSource(source: string) {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-var-"));
    const file = path.join(tmp, "App.xml");
    fs.writeFileSync(file, source);
    const project = await buildProject(path.dirname(file), file);
    buildDependencyEdges(project);
    return runDiagnostics(project);
}

describe("Unknown variable references", () => {
    it("flags unknown refs in template bindings", async () => {
        const diagnostics = await analyzeSource(`<uid_spec>
  <data_model><state id="count" type="number">0</state></data_model>
  <p id="label">{data.count + data.missing}</p>
</uid_spec>`);

        const hits = diagnostics.filter((d) => d.rule === "EUIX1110");
        expect(hits.some((d) => d.message.includes("'missing'"))).toBe(true);
    });

    it("flags bare binding names that are not defined in the component", async () => {
        const diagnostics = await analyzeSource(`<component name="Demo">
  <state name="a" value="1" />
  <div><p>{z}</p></div>
</component>`);

        const hits = diagnostics.filter((d) => d.rule === "EUIX1110");
        expect(hits.some((d) => d.message.includes("'z'"))).toBe(true);
    });

    it("flags unknown refs in computed bodies even when deps attribute is explicit", async () => {
        const diagnostics = await analyzeSource(`<uid_spec>
  <data_model><state id="count" type="number">0</state></data_model>
  <computed id="bad" deps="count">{data.ghost + 1}</computed>
</uid_spec>`);

        const hits = diagnostics.filter((d) => d.rule === "EUIX1102");
        expect(hits.some((d) => d.message.includes("'ghost'"))).toBe(true);
    });

    it("keeps EUIX1102 for broken computed-cycle fixture", async () => {
        const project = await buildProject(fixtures, "broken/computed-cycle.xml");
        buildDependencyEdges(project);
        const diagnostics = runDiagnostics(project);

        const hits = diagnostics.filter((d) => d.rule === "EUIX1102");
        expect(hits.some((d) => d.message.includes("'c'"))).toBe(true);
    });
});
