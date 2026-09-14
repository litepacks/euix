import fs from "node:fs";
import path from "node:path";
import type { Diagnostic } from "../ir/types.js";

export interface BaselineFile {
    version: 1;
    generatedAt: string;
    entries: BaselineEntry[];
}

export interface BaselineEntry {
    rule: string;
    file: string;
    line: number;
    message: string;
}

export function diagnosticFingerprint(d: Diagnostic, root: string): string {
    const file = path.relative(root, d.file).replace(/\\/g, "/");
    return `${d.rule}|${file}|${d.line}|${d.message}`;
}

export function entryFromDiagnostic(d: Diagnostic, root: string): BaselineEntry {
    return {
        rule: d.rule,
        file: path.relative(root, d.file).replace(/\\/g, "/"),
        line: d.line,
        message: d.message,
    };
}

export function entryFingerprint(entry: BaselineEntry): string {
    return `${entry.rule}|${entry.file}|${entry.line}|${entry.message}`;
}

export function loadBaseline(filePath: string): BaselineEntry[] {
    if (!fs.existsSync(filePath)) return [];
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as BaselineFile | BaselineEntry[];
    if (Array.isArray(raw)) return raw;
    return raw.entries ?? [];
}

export function saveBaseline(filePath: string, diagnostics: Diagnostic[], root: string): void {
    const payload: BaselineFile = {
        version: 1,
        generatedAt: new Date().toISOString(),
        entries: diagnostics.map((d) => entryFromDiagnostic(d, root)),
    };
    const abs = path.resolve(filePath);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export function applyBaseline(
    diagnostics: Diagnostic[],
    baseline: BaselineEntry[],
    root: string,
): { visible: Diagnostic[]; suppressed: number } {
    if (baseline.length === 0) return { visible: diagnostics, suppressed: 0 };
    const known = new Set(baseline.map(entryFingerprint));
    const visible = diagnostics.filter((d) => !known.has(diagnosticFingerprint(d, root)));
    return { visible, suppressed: diagnostics.length - visible.length };
}
