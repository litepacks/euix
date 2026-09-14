import type { Diagnostic, EuixProject } from "../ir/types.js";
import { ruleHint } from "../diagnostics/messages.js";
import {
    findElements,
    makeLocation,
    parseHtmlDocument,
    parseXmlDocument,
    type ParsedDocument,
    type ParsedElement,
} from "../parser/xml.js";

/** Tags whose body must be plain text/JS — no nested XML elements (except whitelisted). */
const INLINE_JS_TAGS = new Set(["computed"]);

const SCRIPT_STEP_ALLOWED = new Set([
    "path",
    "value",
    "operation",
    "arg",
    "tag",
    "body",
    "where",
    "fields",
    "param",
    "return",
]);

const SCRIPT_EVENT_TAGS = new Set([
    "on_click",
    "on_change",
    "on_submit",
    "on_mount",
    "on_unmount",
    "on_interval",
    "on_state_change",
    "on_keyup",
    "on_keydown",
    "on_visible",
    "on_update",
]);

/** Sequences that break EUIXEngine's strict XML parser when not wrapped in CDATA. */
const XML_UNSAFE_IN_SCRIPT = [
    { pattern: /<=/g, token: "<=" },
    { pattern: />=/g, token: ">=" },
    { pattern: /&&/g, token: "&&" },
];

export function validateXmlScriptSafety(project: EuixProject): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const file of project.files) {
        if (file.kind !== "xml" && file.kind !== "html") continue;
        const doc = file.kind === "html" ? parseHtmlDocument(file.path, file.source) : parseXmlDocument(file.path, file.source);
        diagnostics.push(...validateDocumentScriptBlocks(doc));
        diagnostics.push(...scanRawScriptTokens(file.source, file.path));
    }

    return diagnostics;
}

function validateDocumentScriptBlocks(doc: ParsedDocument): Diagnostic[] {
    const out: Diagnostic[] = [];

    for (const el of findElements(doc.root, INLINE_JS_TAGS)) {
        for (const child of el.children) {
            if (child.type !== "element") continue;
            out.push(
                xmlScriptDiag(
                    doc,
                    el,
                    `Nested <${child.tagName}> inside <${el.tagName}> — inline JS was parsed as XML markup. ` +
                        `Wrap the script body in <![CDATA[ ... ]]> so operators like '<=' stay valid JavaScript.`,
                ),
            );
        }
    }

    for (const el of findElements(doc.root, new Set(["step"]))) {
        for (const child of el.children) {
            if (child.type !== "element") continue;
            if (SCRIPT_STEP_ALLOWED.has(child.tagName)) continue;
            out.push(
                xmlScriptDiag(
                    doc,
                    el,
                    `Unexpected <${child.tagName}> inside <step> — wrap RUN_SCRIPT bodies in <![CDATA[ ... ]]>.`,
                ),
            );
        }
    }

    for (const el of findElements(doc.root, SCRIPT_EVENT_TAGS)) {
        const action = el.attributes.action?.toUpperCase() ?? "";
        if (action && action !== "RUN_SCRIPT" && action !== "SET_STATE" && action !== "RB") continue;
        for (const child of el.children) {
            if (child.type !== "element") continue;
            if (SCRIPT_STEP_ALLOWED.has(child.tagName)) continue;
            out.push(
                xmlScriptDiag(
                    doc,
                    el,
                    `Unexpected <${child.tagName}> inside <${el.tagName}> — wrap inline script in <![CDATA[ ... ]]>.`,
                ),
            );
        }
    }

    return out;
}

function scanRawScriptTokens(source: string, file: string): Diagnostic[] {
    const out: Diagnostic[] = [];
    const blockPattern = /(<(computed|step|on_[a-z_]+)\b[^>]*>)([\s\S]*?)(<\/\2>)/gi;

    for (const match of source.matchAll(blockPattern)) {
        const openTag = match[1] ?? "";
        const tagName = (match[2] ?? "").toLowerCase();
        const body = match[3] ?? "";
        if (/^\s*<!\[CDATA\[/m.test(body.trim())) continue;

        let unsafeHit: { token: string; index: number } | undefined;
        for (const { pattern, token } of XML_UNSAFE_IN_SCRIPT) {
            pattern.lastIndex = 0;
            const hit = pattern.exec(body);
            if (!hit) continue;
            unsafeHit = { token, index: hit.index };
            break;
        }

        if (unsafeHit) {
            out.push(
                xmlUnsafeScriptDiag(
                    source,
                    file,
                    tagName,
                    match,
                    body,
                    unsafeHit.index,
                    unsafeHit.token,
                ),
            );
            continue;
        }

        if (shouldRecommendCdata(tagName, openTag, body)) {
            out.push(xmlMissingCdataDiag(source, file, tagName, match, body));
        }
    }

    return out;
}

function shouldRecommendCdata(tagName: string, openTag: string, body: string): boolean {
    if (!isInlineScriptBody(body)) return false;

    if (tagName === "step") {
        return readAction(openTag) === "RUN_SCRIPT";
    }

    if (SCRIPT_EVENT_TAGS.has(tagName)) {
        const action = readAction(openTag);
        return !action || action === "RUN_SCRIPT";
    }

    return false;
}

function readAction(openTag: string): string {
    return openTag.match(/\baction="([^"]+)"/i)?.[1]?.toUpperCase() ?? "";
}

function isInlineScriptBody(body: string): boolean {
    const trimmed = body.trim();
    if (!trimmed) return false;
    if (/^\s*<\w+/m.test(trimmed)) return false;
    return true;
}

function xmlUnsafeScriptDiag(
    source: string,
    file: string,
    tagName: string,
    match: RegExpMatchArray,
    body: string,
    tokenIndex: number,
    token: string,
): Diagnostic {
    const absolute = (match.index ?? 0) + (match[0].indexOf(body)) + tokenIndex;
    const { line, column } = lineColumnAt(source, absolute);

    return {
        id: `EUIX0001:${file}:${line}:${column}`,
        rule: "EUIX0001",
        severity: "error",
        message:
            `XML-unsafe '${token}' in <${tagName}> body — EUIXEngine will fail to parse this file. ` +
            `Wrap the script in <![CDATA[ ... ]]> instead of escaping operators in JavaScript.`,
        hint: ruleHint("EUIX0001"),
        file,
        line,
        column,
        confidence: "confirmed",
    };
}

function xmlMissingCdataDiag(
    source: string,
    file: string,
    tagName: string,
    match: RegExpMatchArray,
    body: string,
): Diagnostic {
    const bodyStart = (match.index ?? 0) + match[0].indexOf(body);
    const { line, column } = lineColumnAt(source, bodyStart);

    return {
        id: `EUIX0001:${file}:${line}:${column}`,
        rule: "EUIX0001",
        severity: "warning",
        message:
            `Inline JavaScript in <${tagName}> without CDATA — wrap the script in <![CDATA[ ... ]]> ` +
            `so future operators like '<=' or '&&' do not break XML parsing.`,
        hint: ruleHint("EUIX0001"),
        file,
        line,
        column,
        confidence: "confirmed",
    };
}

function lineColumnAt(source: string, offset: number): { line: number; column: number } {
    const before = source.slice(0, offset);
    return {
        line: before.split("\n").length,
        column: (before.split("\n").pop()?.length ?? 0) + 1,
    };
}

function xmlScriptDiag(doc: ParsedDocument, el: ParsedElement, message: string): Diagnostic {
    const loc = makeLocation(doc.file, doc.source, el.start, el.end);
    return {
        id: `EUIX0001:${doc.file}:${loc.line}:${loc.column}`,
        rule: "EUIX0001",
        severity: "error",
        message,
        hint: ruleHint("EUIX0001"),
        file: doc.file,
        line: loc.line,
        column: loc.column,
        confidence: "confirmed",
    };
}
