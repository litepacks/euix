import type { Diagnostic, FileFix } from "../ir/types.js";

export function collectEuix1501Fixes(diagnostics: Diagnostic[], source: string, file: string): FileFix[] {
    const fixes: FileFix[] = [];
    const seen = new Set<string>();
    const lines = source.split("\n");

    for (const diagnostic of diagnostics) {
        if (diagnostic.rule !== "EUIX1501") continue;
        if (diagnostic.file !== file) continue;

        // Try to identify from line or message
        let tagOrId = "api";
        const lineIdx = diagnostic.line - 1;
        const lineContent = lines[lineIdx] ?? "";

        const idMatch = lineContent.match(/\b(?:id|tag)=["']([^"']+)["']/i);
        if (idMatch?.[1]) {
            tagOrId = idMatch[1];
        } else {
            const urlMatch = diagnostic.message.match(/API\s+\w+\s+(\S+)/i);
            if (urlMatch?.[1]) {
                tagOrId = urlMatch[1].replace(/[^a-zA-Z0-9_]/g, "_").replace(/^_+|_+$/g, "");
            }
        }

        if (seen.has(tagOrId)) continue;
        seen.add(tagOrId);

        // Find <api_endpoint in the source at diagnostic.line or matching tag/id
        let targetMatch: RegExpExecArray | null = null;
        const re = new RegExp(`<api_endpoint\\b[^>]*>`, "gi");
        let m: RegExpExecArray | null;
        let charOffset = 0;
        for (let i = 0; i < lineIdx; i++) {
            charOffset += (lines[i]?.length ?? 0) + 1;
        }

        while ((m = re.exec(source)) !== null) {
            const tagContent = m[0];
            if (tagContent.includes("error=")) continue;
            // Prefer match near line offset
            if (Math.abs(m.index - charOffset) < 300 || (idMatch?.[1] && tagContent.includes(idMatch[1]))) {
                targetMatch = m;
                break;
            }
            if (!targetMatch) {
                targetMatch = m;
            }
        }

        if (!targetMatch) continue;

        const tagContent = targetMatch[0];
        const isSelfClosing = tagContent.endsWith("/>");
        const insertPos = isSelfClosing ? targetMatch.index + tagContent.length - 2 : targetMatch.index + tagContent.length - 1;

        fixes.push({
            file,
            rule: "EUIX1501",
            description: `Add error="${tagOrId}_error" to <api_endpoint>`,
            start: insertPos,
            end: insertPos,
            replacement: ` error="${tagOrId}_error"`,
        });
    }

    return fixes;
}
