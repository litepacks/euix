import { describe, expect, it } from "vitest";
import path from "node:path";
import { generateHtmlReport } from "../src/reporters/html.js";
import { renderCodeFrame } from "../src/reporters/terminal.js";
import { parseDoctorArgs } from "../src/cli/main.js";
import { runDoctor } from "../src/doctor.js";

const FIXTURES_DIR = path.resolve(__dirname, "../fixtures");

describe("HTML Reporter & Enhanced Explanations", () => {
    it("parses CLI args for html and report options", () => {
        const defaultHtml = parseDoctorArgs(["--html"]);
        expect((defaultHtml as any).html).toBe(true);

        const customHtml = parseDoctorArgs(["--html=custom-report.html"]);
        expect((customHtml as any).html).toBe("custom-report.html");

        const aliasReport = parseDoctorArgs(["--report=out.html", "--open"]);
        expect((aliasReport as any).html).toBe("out.html");
        expect((aliasReport as any).openReport).toBe(true);
    });

    it("renders code frames with line numbers and pointer", () => {
        const source = `<uid_spec>\n  <state id="count" type="number">0</state>\n  <button on_click="increment">+1</button>\n</uid_spec>`;
        const frame = renderCodeFrame(source, 3, 11);
        expect(frame).not.toBeNull();
        expect(frame).toContain("3 |   <button on_click=\"increment\">+1</button>");
        expect(frame).toContain("^");
    });

    it("generates a complete, interactive HTML report with metadata and security escaping", async () => {
        const result = await runDoctor({
            root: FIXTURES_DIR,
            target: path.join(FIXTURES_DIR, "simple-component.xml"),
            test: true,
        });

        const html = generateHtmlReport(result);

        expect(html).toContain("<!DOCTYPE html>");
        expect(html).toContain("EUIX Doctor");
        expect(html).toContain("Health Score");
        expect(html).toContain("Architecture Surface");
        expect(html).toContain("Behavior Coverage");
        expect(html).toContain("id=\"doctor-data\"");
        expect(html).toContain("type=\"application/json\"");
        expect(html).toContain("tab-diagnostics");
        expect(html).toContain("tab-components");
        expect(html).toContain("tab-tests");
        expect(html).toContain("tab-catalog");

        // Verify JSON data payload is embedded safely
        expect(html).toContain("\"projectRoot\"");
        expect(html).toContain("\"health\"");
    });

    it("includes rich explanations and risk descriptions when diagnostics exist", async () => {
        const result = await runDoctor({
            root: FIXTURES_DIR,
            target: path.join(FIXTURES_DIR, "broken/missing-handler.xml"),
            test: true,
        });

        expect(result.project.diagnostics.length).toBeGreaterThan(0);
        const diag = result.project.diagnostics.find((d) => d.rule === "EUIX1301");
        expect(diag).toBeDefined();
        expect(diag?.category).toBe("action");
        expect(diag?.explanation).toBeDefined();
        expect(diag?.explanation).toContain("Solution:");

        const html = generateHtmlReport(result);
        expect(html).toContain("EUIX1301");
        expect(html).toContain("action");
        expect(html).toContain("Why this happened &amp; Risk");
    });
});
