import type { EuixProject, FileFix } from "../ir/types.js";
import { collectFixes } from "./index.js";

function fixLineRange(source: string, fix: FileFix): { startLine: number; endLine: number } {
    return {
        startLine: source.slice(0, fix.start).split("\n").length,
        endLine: source.slice(0, fix.end).split("\n").length,
    };
}

/** Attach deterministic fix metadata to diagnostics that support auto-repair. */
export function attachFixesToDiagnostics(project: EuixProject): void {
    const fixes = collectFixes(project, ["EUIX0001", "EUIX1110", "EUIX1102", "EUIX1701"]);

    for (const diag of project.diagnostics) {
        if (!["EUIX0001", "EUIX1110", "EUIX1102", "EUIX1701"].includes(diag.rule)) continue;

        const file = project.files.find((f) => f.path === diag.file);
        if (!file) continue;

        const fix = fixes.find((f) => {
            if (f.file !== diag.file) return false;
            const { startLine, endLine } = fixLineRange(file.source, f);
            return diag.line >= startLine && diag.line <= endLine;
        });
        if (!fix) continue;

        diag.fix = {
            rule: fix.rule,
            description: fix.description,
            edits: [{ start: fix.start, end: fix.end, replacement: fix.replacement }],
        };
    }
}
