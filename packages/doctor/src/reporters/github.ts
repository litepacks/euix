import path from "node:path";
import type { DoctorResult } from "../ir/types.js";

/**
 * Formats diagnostics as GitHub Actions workflow annotations.
 * Syntax: ::(error|warning|notice) file={file},line={line},col={col},title={title}::{message}
 */
export function doctorResultToGithub(result: DoctorResult, cwd = process.cwd()): string {
    const lines: string[] = [];

    for (const d of result.project.diagnostics) {
        const severity = d.severity === "error" ? "error" : d.severity === "warning" ? "warning" : "notice";
        const relPath = path.isAbsolute(d.file) ? path.relative(cwd, d.file) : d.file;
        const msg = d.message.replace(/\r?\n/g, "%0A");
        const title = `[${d.rule}] ${d.category ? `(${d.category})` : ""}`.trim();
        lines.push(`::${severity} file=${relPath},line=${d.line},col=${d.column},title=${title}::${msg}`);
    }

    const errors = result.project.diagnostics.filter((d) => d.severity === "error").length;
    const warnings = result.project.diagnostics.filter((d) => d.severity === "warning").length;
    lines.push(`::notice title=EUIX Doctor Summary::Found ${errors} error(s), ${warnings} warning(s) in ${result.project.files.length} file(s).`);

    return lines.join("\n");
}
