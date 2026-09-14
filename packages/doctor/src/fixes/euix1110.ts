import type { Diagnostic, FileFix } from "../ir/types.js";

const UNKNOWN_VAR_RE = /(?:Unknown variable|depends on unknown) '([^']+)'/;

export function collectEuix1110Fixes(diagnostics: Diagnostic[], source: string, file: string): FileFix[] {
    const fixes: FileFix[] = [];
    const seen = new Set<string>();

    for (const diagnostic of diagnostics) {
        if (diagnostic.rule !== "EUIX1110" && diagnostic.rule !== "EUIX1102") continue;
        if (diagnostic.file !== file) continue;
        const name = diagnostic.message.match(UNKNOWN_VAR_RE)?.[1];
        if (!name || seen.has(name)) continue;
        seen.add(name);

        const fix = buildStateInsertFix(source, file, name);
        if (fix) fixes.push(fix);
    }

    return fixes;
}

function buildStateInsertFix(source: string, file: string, name: string): FileFix | undefined {
    const block = `    <state id="${name}" type="string"></state>\n`;
    const dataModel = findElementBlock(source, "data_model");
    if (dataModel) {
        return {
            file,
            rule: "EUIX1110",
            description: `Add <state id="${name}">`,
            start: dataModel.closeStart,
            end: dataModel.closeStart,
            replacement: block,
        };
    }

    const uidSpec = findElementBlock(source, "uid_spec");
    if (!uidSpec) return undefined;

    return {
        file,
        rule: "EUIX1110",
        description: `Add <data_model> with <state id="${name}">`,
        start: uidSpec.openEnd,
        end: uidSpec.openEnd,
        replacement: `\n  <data_model>\n${block}  </data_model>`,
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
