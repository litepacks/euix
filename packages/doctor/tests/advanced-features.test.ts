import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildDependencyEdges } from "../src/analysis/dependencies.js";
import { runDiagnostics } from "../src/diagnostics/index.js";
import { buildProject } from "../src/ir/project.js";
import { applyFixes, collectEuix1001Fixes, collectEuix3001Fixes, collectEuix1501Fixes } from "../src/fixes/index.js";
import { doctorResultToGithub } from "../src/reporters/github.js";
import { parseDoctorArgs } from "../src/cli/main.js";
import { runDoctor } from "../src/doctor.js";

function createTempProject(files: Record<string, string>): { dir: string; cleanup: () => void } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "doctor-test-"));
    for (const [relPath, content] of Object.entries(files)) {
        const full = path.join(dir, relPath);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, content, "utf8");
    }
    return {
        dir,
        cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
    };
}

describe("Item 1: HTML Island Architecture & Static Validation", () => {
    it("reports EUIX0101 when template selector does not exist", async () => {
        const { dir, cleanup } = createTempProject({
            "index.html": `<!DOCTYPE html>
<html>
<body>
  <div data-euix="#non-existent-template"></div>
</body>
</html>`,
        });

        try {
            const project = await buildProject(dir);
            buildDependencyEdges(project);
            runDiagnostics(project);

            const hit = project.diagnostics.find((d) => d.rule === "EUIX0101");
            expect(hit).toBeDefined();
            expect(hit?.message).toContain("non-existent-template");
        } finally {
            cleanup();
        }
    });

    it("reports EUIX0102 when data-props contains invalid JSON", async () => {
        const { dir, cleanup } = createTempProject({
            "index.html": `<!DOCTYPE html>
<html>
<body>
  <template id="card"><uid_spec><text>Hello</text></uid_spec></template>
  <div data-euix="#card" data-props="{ bad_json: true, }"></div>
</body>
</html>`,
        });

        try {
            const project = await buildProject(dir);
            buildDependencyEdges(project);
            runDiagnostics(project);

            const hit = project.diagnostics.find((d) => d.rule === "EUIX0102");
            expect(hit).toBeDefined();
            expect(hit?.message).toContain("JSON");
        } finally {
            cleanup();
        }
    });
});

describe("Item 2: Extended Auto-Fixes (--fix)", () => {
    it("collects and applies EUIX1001 auto-fix for write to unknown state", async () => {
        const xml = `<uid_spec>
  <data_model>
    <state id="count" type="number">0</state>
  </data_model>
  <button on_click:set="is_active=true">Activate</button>
</uid_spec>`;

        const { dir, cleanup } = createTempProject({ "App.xml": xml });

        try {
            let project = await buildProject(dir, path.join(dir, "App.xml"));
            buildDependencyEdges(project);
            runDiagnostics(project);

            expect(project.diagnostics.some((d) => d.rule === "EUIX1001")).toBe(true);

            const res = applyFixes(project, { rules: ["EUIX1001"] });
            expect(res.fixesApplied).toBe(1);

            const updated = fs.readFileSync(path.join(dir, "App.xml"), "utf8");
            expect(updated).toContain('<state id="is_active" type="boolean">false</state>');

            // Re-run diagnostics to verify issue is resolved
            project = await buildProject(dir, path.join(dir, "App.xml"));
            buildDependencyEdges(project);
            runDiagnostics(project);
            expect(project.diagnostics.filter((d) => d.rule === "EUIX1001")).toHaveLength(0);
        } finally {
            cleanup();
        }
    });

    it("collects and applies EUIX3001 auto-fix for missing for_each key", async () => {
        const xml = `<uid_spec>
  <data_model>
    <state id="items" type="array">[{"id": 1, "name": "Item 1"}]</state>
  </data_model>
  <for_each items="{data.items}" var="item">
    <span>{item.name}</span>
  </for_each>
</uid_spec>`;

        const { dir, cleanup } = createTempProject({ "List.xml": xml });

        try {
            let project = await buildProject(dir, path.join(dir, "List.xml"));
            buildDependencyEdges(project);
            runDiagnostics(project);

            expect(project.diagnostics.some((d) => d.rule === "EUIX3001")).toBe(true);

            const res = applyFixes(project, { rules: ["EUIX3001"] });
            expect(res.fixesApplied).toBe(1);

            const updated = fs.readFileSync(path.join(dir, "List.xml"), "utf8");
            expect(updated).toContain('key="id"');

            project = await buildProject(dir, path.join(dir, "List.xml"));
            buildDependencyEdges(project);
            runDiagnostics(project);
            expect(project.diagnostics.filter((d) => d.rule === "EUIX3001")).toHaveLength(0);
        } finally {
            cleanup();
        }
    });

    it("collects and applies EUIX1501 auto-fix for unhandled api errors", async () => {
        const xml = `<uid_spec>
  <api_config>
    <api_endpoint id="fetch_users" url="/api/users" method="GET" />
  </api_config>
</uid_spec>`;

        const { dir, cleanup } = createTempProject({ "Api.xml": xml });

        try {
            let project = await buildProject(dir, path.join(dir, "Api.xml"));
            buildDependencyEdges(project);
            runDiagnostics(project);

            expect(project.diagnostics.some((d) => d.rule === "EUIX1501")).toBe(true);

            const res = applyFixes(project, { rules: ["EUIX1501"] });
            expect(res.fixesApplied).toBe(1);

            const updated = fs.readFileSync(path.join(dir, "Api.xml"), "utf8");
            expect(updated).toContain('error="fetch_users_error"');
        } finally {
            cleanup();
        }
    });
});

describe("Item 3: Performance & Memory Rules", () => {
    it("reports EUIX3001 when for_each is missing key", async () => {
        const xml = `<uid_spec>
  <for_each items="{data.list}" var="x">
    <div>{x}</div>
  </for_each>
</uid_spec>`;
        const { dir, cleanup } = createTempProject({ "Loop.xml": xml });
        try {
            const project = await buildProject(dir);
            runDiagnostics(project);
            const diag = project.diagnostics.find((d) => d.rule === "EUIX3001");
            expect(diag).toBeDefined();
            expect(diag?.category).toBe("performance");
        } finally {
            cleanup();
        }
    });

    it("reports EUIX3003 when embedded state is excessively large", async () => {
        const largeString = "x".repeat(2500);
        const xml = `<uid_spec>
  <data_model>
    <state id="huge_data" type="string">${largeString}</state>
  </data_model>
</uid_spec>`;
        const { dir, cleanup } = createTempProject({ "Huge.xml": xml });
        try {
            const project = await buildProject(dir);
            runDiagnostics(project);
            const diag = project.diagnostics.find((d) => d.rule === "EUIX3003");
            expect(diag).toBeDefined();
            expect(diag?.message).toContain("huge_data");
        } finally {
            cleanup();
        }
    });
});

describe("Item 4: Action Shorthand Checking", () => {
    it("reports EUIX1310 when toggling non-boolean state", async () => {
        const xml = `<uid_spec>
  <data_model>
    <state id="user_name" type="string">John</state>
  </data_model>
  <button on_click:toggle="user_name">Toggle</button>
</uid_spec>`;
        const { dir, cleanup } = createTempProject({ "Toggle.xml": xml });
        try {
            const project = await buildProject(dir);
            runDiagnostics(project);
            const diag = project.diagnostics.find((d) => d.rule === "EUIX1310");
            expect(diag).toBeDefined();
            expect(diag?.message).toContain("user_name");
        } finally {
            cleanup();
        }
    });

    it("reports EUIX1311 when performing arithmetic on string state", async () => {
        const xml = `<uid_spec>
  <data_model>
    <state id="code" type="string">100</state>
  </data_model>
  <button on_click:set="code={data.code + 1}">Increment</button>
</uid_spec>`;
        const { dir, cleanup } = createTempProject({ "Math.xml": xml });
        try {
            const project = await buildProject(dir);
            runDiagnostics(project);
            const diag = project.diagnostics.find((d) => d.rule === "EUIX1311");
            expect(diag).toBeDefined();
            expect(diag?.message).toContain("code");
        } finally {
            cleanup();
        }
    });

    it("reports EUIX1702 when on_click:revalidate points to missing endpoint", async () => {
        const xml = `<uid_spec>
  <button on_click:revalidate="missing_endpoint">Refresh</button>
</uid_spec>`;
        const { dir, cleanup } = createTempProject({ "Reval.xml": xml });
        try {
            const project = await buildProject(dir);
            runDiagnostics(project);
            const diag = project.diagnostics.find((d) => d.rule === "EUIX1702");
            expect(diag).toBeDefined();
            expect(diag?.message).toContain("missing_endpoint");
        } finally {
            cleanup();
        }
    });
});

describe("Item 5: Accessibility (A11y) Checks", () => {
    it("reports EUIX4001 when a button has no text and no aria-label", async () => {
        const xml = `<uid_spec>
  <button class="icon-btn"></button>
</uid_spec>`;
        const { dir, cleanup } = createTempProject({ "A11yBtn.xml": xml });
        try {
            const project = await buildProject(dir);
            runDiagnostics(project);
            const diag = project.diagnostics.find((d) => d.rule === "EUIX4001");
            expect(diag).toBeDefined();
            expect(diag?.category).toBe("a11y");
        } finally {
            cleanup();
        }
    });

    it("reports EUIX4002 when non-interactive element has click handler without role/tabindex", async () => {
        const xml = `<uid_spec>
  <div on_click:set="count=1">Click me</div>
</uid_spec>`;
        const { dir, cleanup } = createTempProject({ "A11yDiv.xml": xml });
        try {
            const project = await buildProject(dir);
            runDiagnostics(project);
            const diag = project.diagnostics.find((d) => d.rule === "EUIX4002");
            expect(diag).toBeDefined();
            expect(diag?.message).toContain("role=\"button\"");
        } finally {
            cleanup();
        }
    });

    it("reports EUIX4003 when an input has no accessible label or aria-label", async () => {
        const xml = `<uid_spec>
  <input type="text" bind="name" />
</uid_spec>`;
        const { dir, cleanup } = createTempProject({ "A11yInput.xml": xml });
        try {
            const project = await buildProject(dir);
            runDiagnostics(project);
            const diag = project.diagnostics.find((d) => d.rule === "EUIX4003");
            expect(diag).toBeDefined();
            expect(diag?.message).toContain("accessible name");
        } finally {
            cleanup();
        }
    });
});

describe("Item 6: DX & CLI Enhancements", () => {
    it("parses --format=github, --github, and --watch correctly", () => {
        const opts1 = parseDoctorArgs(["--github"]);
        expect((opts1 as any).github).toBe(true);

        const opts2 = parseDoctorArgs(["--format=github"]);
        expect((opts2 as any).format).toBe("github");
        expect((opts2 as any).github).toBe(true);

        const opts3 = parseDoctorArgs(["--watch"]);
        expect((opts3 as any).watch).toBe(true);
    });

    it("formats GitHub Actions annotations correctly", async () => {
        const xml = `<uid_spec>
  <button class="empty-btn"></button>
</uid_spec>`;
        const { dir, cleanup } = createTempProject({ "Gh.xml": xml });
        try {
            const result = await runDoctor({ root: dir, target: "Gh.xml", test: false });
            const output = doctorResultToGithub(result, dir);

            expect(output).toContain("::warning file=Gh.xml,line=");
            expect(output).toContain("[EUIX4001]");
            expect(output).toContain("::notice title=EUIX Doctor Summary::");
        } finally {
            cleanup();
        }
    });
});
