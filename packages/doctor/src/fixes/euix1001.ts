import type { Diagnostic, FileFix } from "../ir/types.js";

const UNKNOWN_STATE_RE = /(?:unknown state|writes to unknown state|to state) '([^']+)'/i;

export function collectEuix1001Fixes(diagnostics: Diagnostic[], source: string, file: string): FileFix[] {
    const fixes: FileFix[] = [];
    const seen = new Set<string>();

    for (const diagnostic of diagnostics) {
        if (diagnostic.rule !== "EUIX1001") continue;
        if (diagnostic.file !== file) continue;

        const name = diagnostic.message.match(UNKNOWN_STATE_RE)?.[1];
        if (!name || seen.has(name)) continue;
        seen.add(name);

        const fix = buildStateInsertFix(source, file, name);
        if (fix) fixes.push(fix);
    }

    return fixes;
}

function inferStateType(name: string): { type: string; initial: string } {
    const lower = name.toLowerCase();
    if (lower.startsWith("is_") || lower.startsWith("has_") || lower.startsWith("show_") || lower.includes("open") || lower.includes("visible")) {
        return { type: "boolean", initial: "false" };
    }
    if (lower.includes("count") || lower.includes("num") || lower.includes("qty") || lower.includes("index") || lower.includes("total") || lower.includes("price") || lower.includes("step")) {
        return { type: "number", initial: "0" };
    }
    if (lower.endsWith("list") || lower.endsWith("items") || lower.endsWith("s") && !lower.endsWith("ss")) {
        return { type: "array", initial: "[]" };
    }
    return { type: "string", initial: "" };
}

function buildStateInsertFix(source: string, file: string, name: string): FileFix | undefined {
    const { type, initial } = inferStateType(name);
    const block = `    <state id="${name}" type="${type}">${initial}</state>\n`;

    const dataModel = findElementBlock(source, "data_model");
    if (dataModel) {
        return {
            file,
            rule: "EUIX1001",
            description: `Add <state id="${name}" type="${type}"> to <data_model>`,
            start: dataModel.closeStart,
            end: dataModel.closeStart,
            replacement: block,
        };
    }

    const uidSpec = findElementBlock(source, "uid_spec");
    if (!uidSpec) return undefined;

    return {
        file,
        rule: "EUIX1001",
        description: `Add <data_model> with <state id="${name}" type="${type}">`,
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

    const closeStart = openEnd + closeMatch.index;
    return { openEnd, closeStart };
}
