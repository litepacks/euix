import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { formatEuixXml } from "../src/format/xmlFormat.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "../fixtures");

describe("EUIX XML formatter", () => {
    it("indents nested uid_spec documents", () => {
        const source = `<uid_spec><data_model><state id="count" type="number">0</state></data_model></uid_spec>`;
        const formatted = formatEuixXml(source);
        expect(formatted).toContain("<uid_spec>\n");
        expect(formatted).toContain('  <data_model>\n');
        expect(formatted).toContain('    <state id="count" type="number">0</state>');
    });

    it("preserves CDATA blocks with indentation", () => {
        const source = fs.readFileSync(path.join(fixtures, "native/xml-safe-computed-cdata.xml"), "utf8");
        const formatted = formatEuixXml(source);
        expect(formatted).toContain("<![CDATA[");
        expect(formatted).toContain("<= 2");
    });

    it("formats broken api-watch fixture without losing script body", () => {
        const source = fs.readFileSync(path.join(fixtures, "broken/api-watch-unknown.xml"), "utf8");
        const formatted = formatEuixXml(source);
        expect(formatted).toContain('action="RUN_SCRIPT"');
        expect(formatted).toContain("$engine.setState");
    });

    it("is idempotent on already formatted output", () => {
        const source = formatEuixXml(
            fs.readFileSync(path.join(fixtures, "broken/api-watch-unknown.xml"), "utf8"),
        );
        expect(formatEuixXml(source)).toBe(source);
    });
});
