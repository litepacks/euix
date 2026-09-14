import fs from "node:fs";
import type { ApplyFixesResult, EuixProject, FileFix } from "../ir/types.js";
import { collectEuix0001Fixes } from "./euix0001.js";
import { collectEuix1110Fixes } from "./euix1110.js";
import { collectEuix1701Fixes } from "./euix1701.js";

export { collectEuix0001Fixes } from "./euix0001.js";

const ALL_FIX_RULES = ["EUIX0001", "EUIX1110", "EUIX1102", "EUIX1701"] as const;

export function collectFixes(project: EuixProject, rules?: string[]): FileFix[] {
    const allowed = new Set(rules ?? [...ALL_FIX_RULES]);
    const fixes: FileFix[] = [];

    for (const file of project.files) {
        if (file.kind !== "xml" && file.kind !== "html") continue;
        if (allowed.has("EUIX0001")) {
            fixes.push(...collectEuix0001Fixes(file.source, file.path));
        }
        if (allowed.has("EUIX1110") || allowed.has("EUIX1102")) {
            fixes.push(...collectEuix1110Fixes(project.diagnostics, file.source, file.path));
        }
        if (allowed.has("EUIX1701")) {
            fixes.push(...collectEuix1701Fixes(project.diagnostics, file.source, file.path));
        }
    }

    return dedupeFixes(fixes);
}

export function applyFixes(
    project: EuixProject,
    options?: { rules?: string[]; dryRun?: boolean },
): ApplyFixesResult {
    const fixes = collectFixes(project, options?.rules);

    if (options?.dryRun || fixes.length === 0) {
        return {
            filesChanged: new Set(fixes.map((f) => f.file)).size,
            fixesApplied: fixes.length,
            fixes,
        };
    }

    const byFile = new Map<string, FileFix[]>();
    for (const fix of fixes) {
        const list = byFile.get(fix.file) ?? [];
        list.push(fix);
        byFile.set(fix.file, list);
    }

    let applied = 0;
    for (const [filePath, fileFixes] of byFile) {
        let source = fs.readFileSync(filePath, "utf8");
        for (const fix of fileFixes.sort((a, b) => b.start - a.start)) {
            source = source.slice(0, fix.start) + fix.replacement + source.slice(fix.end);
            applied++;
        }
        fs.writeFileSync(filePath, source, "utf8");
    }

    return {
        filesChanged: byFile.size,
        fixesApplied: applied,
        fixes,
    };
}

function dedupeFixes(fixes: FileFix[]): FileFix[] {
    const seen = new Set<string>();
    const out: FileFix[] = [];
    for (const fix of fixes) {
        const key = `${fix.file}:${fix.start}:${fix.end}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(fix);
    }
    return out;
}
