/** Standalone EUIX0001 fix collector (no @euix/doctor import — safe for extension bundle). */

export interface FileFix {
    file: string;
    rule: string;
    description: string;
    start: number;
    end: number;
    replacement: string;
}

const XML_UNSAFE_IN_SCRIPT = [/<=/g, />=/g, /&&/g];
const BLOCK_PATTERN = /(<(computed|step|on_[a-z_]+)\b([^>]*)>)([\s\S]*?)(<\/\2>)/gi;

export function collectEuix0001Fixes(source: string, file: string): FileFix[] {
    const fixes: FileFix[] = [];

    for (const match of source.matchAll(BLOCK_PATTERN)) {
        const openTag = match[1] ?? "";
        const tagName = (match[2] ?? "").toLowerCase();
        const attrs = match[3] ?? "";
        const body = match[4] ?? "";
        const closeTag = match[5] ?? "";

        if (/^\s*<!\[CDATA\[/m.test(body.trim())) continue;
        if (!isFixableBlock(tagName, attrs, body)) continue;
        if (!hasUnsafeScriptToken(body) && !shouldWrapInlineRunScript(tagName, attrs, body)) continue;

        const normalizedBody = decodeXmlEntitiesInScript(body);
        const inner = normalizedBody.replace(/^\r?\n?/, "\n").replace(/\r?\n?$/, "\n");
        const replacement = `${openTag}<![CDATA[${inner}]]>${closeTag}`;

        fixes.push({
            file,
            rule: "EUIX0001",
            description: `Wrap <${tagName}> body in CDATA`,
            start: match.index ?? 0,
            end: (match.index ?? 0) + match[0].length,
            replacement,
        });
    }

    return fixes;
}

function isFixableBlock(tagName: string, attrs: string, body: string): boolean {
    if (tagName === "computed") return true;
    if (tagName === "step" || tagName.startsWith("on_")) {
        const action = attrs.match(/\baction="([^"]+)"/i)?.[1]?.toUpperCase() ?? "";
        if (action && action !== "RUN_SCRIPT") return false;
        if (/<\w+/i.test(body.trim())) return false;
        return true;
    }
    return false;
}

function hasUnsafeScriptToken(body: string): boolean {
    const decoded = decodeXmlEntitiesInScript(body);
    return XML_UNSAFE_IN_SCRIPT.some((pattern) => {
        pattern.lastIndex = 0;
        return pattern.test(decoded);
    });
}

function shouldWrapInlineRunScript(tagName: string, attrs: string, body: string): boolean {
    const trimmed = body.trim();
    if (!trimmed || /^\s*<\w+/m.test(trimmed)) return false;

    if (tagName === "step") {
        return attrs.match(/\baction="([^"]+)"/i)?.[1]?.toUpperCase() === "RUN_SCRIPT";
    }

    if (tagName.startsWith("on_")) {
        const action = attrs.match(/\baction="([^"]+)"/i)?.[1]?.toUpperCase() ?? "";
        return !action || action === "RUN_SCRIPT";
    }

    return false;
}

function decodeXmlEntitiesInScript(body: string): string {
    return body
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
}
