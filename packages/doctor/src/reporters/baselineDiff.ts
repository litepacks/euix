import type { Diagnostic } from "../ir/types.js";
import {
    type BaselineEntry,
    diagnosticFingerprint,
    entryFingerprint,
    entryFromDiagnostic,
} from "./baseline.js";

export interface BaselineDiff {
    newDiagnostics: Diagnostic[];
    fixed: BaselineEntry[];
    unchanged: number;
}

export function diffAgainstBaseline(
    diagnostics: Diagnostic[],
    baseline: BaselineEntry[],
    root: string,
): BaselineDiff {
    const current = new Set(diagnostics.map((d) => diagnosticFingerprint(d, root)));
    const baselineSet = new Set(baseline.map(entryFingerprint));

    const newDiagnostics = diagnostics.filter((d) => !baselineSet.has(diagnosticFingerprint(d, root)));
    const fixed = baseline.filter((entry) => !current.has(entryFingerprint(entry)));

    return {
        newDiagnostics,
        fixed,
        unchanged: baseline.length - fixed.length,
    };
}

export function printBaselineDiff(diff: BaselineDiff, root: string): void {
    console.log("\nBaseline diff\n");
    console.log(`  Fixed since baseline:   ${diff.fixed.length}`);
    console.log(`  New diagnostics:      ${diff.newDiagnostics.length}`);
    console.log(`  Unchanged (baseline): ${diff.unchanged}`);

    if (diff.fixed.length > 0) {
        console.log("\nFixed:");
        for (const entry of diff.fixed.slice(0, 20)) {
            console.log(`  - [${entry.rule}] ${entry.file}:${entry.line} ${entry.message}`);
        }
        if (diff.fixed.length > 20) console.log(`  … and ${diff.fixed.length - 20} more`);
    }

    if (diff.newDiagnostics.length > 0) {
        console.log("\nNew:");
        for (const diagnostic of diff.newDiagnostics.slice(0, 20)) {
            const entry = entryFromDiagnostic(diagnostic, root);
            console.log(`  + [${entry.rule}] ${entry.file}:${entry.line} ${entry.message}`);
        }
        if (diff.newDiagnostics.length > 20) console.log(`  … and ${diff.newDiagnostics.length - 20} more`);
    }

    console.log("");
}
