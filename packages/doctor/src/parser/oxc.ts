import { parseSync } from "oxc-parser";
import { analyzeActionBody, looksLikeEuixTemplateLiteral } from "./expressions.js";

export interface JsExtract {
    file: string;
    scripts: { source: string; start: number; analysis: ReturnType<typeof analyzeActionBody> }[];
    templateLiterals: {
        source: string;
        start: number;
        end: number;
        tagged: boolean;
        tagName?: string;
        isEuix: boolean;
    }[];
}

export function parseJsFile(file: string, source: string): JsExtract {
    const scripts: JsExtract["scripts"] = [];
    const templateLiterals: JsExtract["templateLiterals"] = [];

    try {
        const result = parseSync(file, source, {
            sourceType: "module",
            astType: "ts" as never,
        });

        walkAst(result.program, source, templateLiterals);
    } catch {
        extractWithRegex(source, scripts, templateLiterals);
        return { file, scripts, templateLiterals };
    }

    for (const m of source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
        if (m[1]?.trim()) {
            scripts.push({
                source: m[1],
                start: m.index ?? 0,
                analysis: analyzeActionBody(m[1]),
            });
        }
    }

    return { file, scripts, templateLiterals };
}

function walkAst(node: unknown, source: string, out: JsExtract["templateLiterals"]): void {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;

    if (n.type === "TemplateLiteral" && Array.isArray(n.quasis)) {
        const start = (n.start as number) ?? 0;
        const end = (n.end as number) ?? start;
        const cooked = (n.quasis as { value?: { cooked?: string } }[])
            .map((q) => q.value?.cooked ?? "")
            .join("");
        const parent = n as { tag?: { type?: string; name?: string } };
        const tagged = parent.tag?.type === "Identifier";
        const tagName = tagged ? String(parent.tag?.name ?? "") : undefined;
        const isEuix = tagged ? tagName === "euix" || tagName === "html" : looksLikeEuixTemplateLiteral(cooked);
        if (isEuix || tagged) {
            out.push({ source: cooked, start, end, tagged: !!tagged, tagName, isEuix });
        }
    }

    for (const value of Object.values(n)) {
        if (Array.isArray(value)) value.forEach((child) => walkAst(child, source, out));
        else if (value && typeof value === "object") walkAst(value, source, out);
    }
}

function extractWithRegex(
    source: string,
    _scripts: JsExtract["scripts"],
    templateLiterals: JsExtract["templateLiterals"],
): void {
    for (const m of source.matchAll(/euix\s*`([\s\S]*?)`/g)) {
        templateLiterals.push({
            source: m[1]!,
            start: m.index ?? 0,
            end: (m.index ?? 0) + m[0].length,
            tagged: true,
            tagName: "euix",
            isEuix: true,
        });
    }
    for (const m of source.matchAll(/`([\s\S]*?)`/g)) {
        const body = m[1] ?? "";
        if (looksLikeEuixTemplateLiteral(body)) {
            templateLiterals.push({
                source: body,
                start: m.index ?? 0,
                end: (m.index ?? 0) + m[0].length,
                tagged: false,
                isEuix: true,
            });
        }
    }
}
