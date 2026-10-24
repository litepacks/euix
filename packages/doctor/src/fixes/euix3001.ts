import type { Diagnostic, FileFix } from "../ir/types.js";

export function collectEuix3001Fixes(diagnostics: Diagnostic[], source: string, file: string): FileFix[] {
    const fixes: FileFix[] = [];

    for (const diagnostic of diagnostics) {
        if (diagnostic.rule !== "EUIX3001") continue;
        if (diagnostic.file !== file) continue;

        // Find the <for_each at the line of the diagnostic
        const lines = source.split("\n");
        const targetLineIndex = diagnostic.line - 1;
        if (targetLineIndex < 0 || targetLineIndex >= lines.length) continue;

        let charOffset = 0;
        for (let i = 0; i < targetLineIndex; i++) {
            charOffset += lines[i]!.length + 1; // +1 for \n
        }

        const lineContent = lines[targetLineIndex]!;
        const forEachIdx = lineContent.indexOf("<for_each");
        if (forEachIdx === -1) continue;

        const tagEndIdx = lineContent.indexOf(">", forEachIdx);
        if (tagEndIdx === -1) continue;

        const insertPos = charOffset + tagEndIdx;
        fixes.push({
            file,
            rule: "EUIX3001",
            description: "Add key=\"id\" to <for_each>",
            start: insertPos,
            end: insertPos,
            replacement: ' key="id"',
        });
    }

    return fixes;
}
