import type { FileFix } from "./euix0001.js";

const UNKNOWN_VAR_RE = /(?:Unknown variable|depends on unknown) '([^']+)'/;
const UNKNOWN_API_TAG_RE = /unknown API tag '([^']+)'/;

export function buildStateInsertFix(source: string, file: string, name: string): FileFix | undefined {
    const block = `    <state id="${name}" type="string"></state>\n`;
    const dataModel = findElementBlock(source, "data_model");
    if (dataModel) {
        const insertAt = dataModel.closeStart;
        return {
            file,
            rule: "EUIX1110",
            description: `Add <state id="${name}">`,
            start: insertAt,
            end: insertAt,
            replacement: block,
        };
    }

    const uidSpec = findElementBlock(source, "uid_spec");
    if (!uidSpec) return undefined;

    const insertAt = uidSpec.openEnd;
    const wrapper = `\n  <data_model>\n${block}  </data_model>`;
    return {
        file,
        rule: "EUIX1110",
        description: `Add <data_model> with <state id="${name}">`,
        start: insertAt,
        end: insertAt,
        replacement: wrapper,
    };
}

export function buildApiEndpointInsertFix(source: string, file: string, tag: string): FileFix | undefined {
    const line = `    <api_endpoint id="${tag}" tag="${tag}" url="/${tag}" />\n`;
    const apiConfig = findElementBlock(source, "api_config");
    if (apiConfig) {
        const insertAt = apiConfig.closeStart;
        return {
            file,
            rule: "EUIX1701",
            description: `Add <api_endpoint tag="${tag}">`,
            start: insertAt,
            end: insertAt,
            replacement: line,
        };
    }

    const uidSpec = findElementBlock(source, "uid_spec");
    if (!uidSpec) return undefined;

    const insertAt = uidSpec.openEnd;
    const wrapper = `\n  <api_config base_url="/api">\n${line}  </api_config>`;
    return {
        file,
        rule: "EUIX1701",
        description: `Add <api_config> with <api_endpoint tag="${tag}">`,
        start: insertAt,
        end: insertAt,
        replacement: wrapper,
    };
}

export function extractUnknownVariableName(message: string): string | undefined {
    return message.match(UNKNOWN_VAR_RE)?.[1];
}

export function extractUnknownApiTag(message: string): string | undefined {
    return message.match(UNKNOWN_API_TAG_RE)?.[1];
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

    return {
        openEnd,
        closeStart: openEnd + closeMatch.index,
    };
}
