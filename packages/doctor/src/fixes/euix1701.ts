import type { Diagnostic, FileFix } from "../ir/types.js";

const UNKNOWN_API_TAG_RE = /unknown API tag '([^']+)'/;

export function collectEuix1701Fixes(diagnostics: Diagnostic[], source: string, file: string): FileFix[] {
    const fixes: FileFix[] = [];
    const seen = new Set<string>();

    for (const diagnostic of diagnostics) {
        if (diagnostic.rule !== "EUIX1701") continue;
        if (diagnostic.file !== file) continue;
        const tag = diagnostic.message.match(UNKNOWN_API_TAG_RE)?.[1];
        if (!tag || seen.has(tag)) continue;
        seen.add(tag);

        const fix = buildApiEndpointInsertFix(source, file, tag);
        if (fix) fixes.push(fix);
    }

    return fixes;
}

function buildApiEndpointInsertFix(source: string, file: string, tag: string): FileFix | undefined {
    const line = `    <api_endpoint id="${tag}" tag="${tag}" url="/${tag}" />\n`;
    const apiConfig = findElementBlock(source, "api_config");
    if (apiConfig) {
        return {
            file,
            rule: "EUIX1701",
            description: `Add <api_endpoint tag="${tag}">`,
            start: apiConfig.closeStart,
            end: apiConfig.closeStart,
            replacement: line,
        };
    }

    const uidSpec = findElementBlock(source, "uid_spec");
    if (!uidSpec) return undefined;

    return {
        file,
        rule: "EUIX1701",
        description: `Add <api_config> with <api_endpoint tag="${tag}">`,
        start: uidSpec.openEnd,
        end: uidSpec.openEnd,
        replacement: `\n  <api_config base_url="/api">\n${line}  </api_config>`,
    };
}

function findElementBlock(
    source: string,
    tagName: string,
): { openEnd: number; closeStart: number } | undefined {
    const openRe = new RegExp(`<${tagName}\\b[^>]*>`, "i");
    const openMatch = openRe.exec(source);
    if (!openMatch) return undefined;

    const openEnd = openMatch.index + openMatch[0].length;
    const closeRe = new RegExp(`</${tagName}>`, "i");
    const closeMatch = closeRe.exec(source.slice(openEnd));
    if (!closeMatch) return undefined;

    return { openEnd, closeStart: openEnd + closeMatch.index };
}
