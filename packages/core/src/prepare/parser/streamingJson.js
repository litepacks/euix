/**
 * packages/core/src/prepare/parser/streamingJson.js
 * High-performance fault-tolerant streaming partial JSON & XML parser for EUIX.
 * Repairs incomplete LLM token streams in real-time, closing unclosed brackets,
 * quotes, dangling keys, and incomplete primitives to enable live-preview SSR.
 */

import { parseJsonSource } from "./jsonParser.js";
import { parseXmlToJson } from "./xmlToJson.js";
import { renderToString } from "../runtime/ssr.js";
import { DIAGNOSTIC_CODES, createDiagnostic } from "../validator/diagnostics.js";

/**
 * Strips markdown code fences (e.g. ```json ... ``` or unclosed ```json) from stream.
 *
 * @param {string} text
 * @returns {string}
 */
export function stripMarkdownFences(text) {
    if (!text || typeof text !== "string") return "";
    let cleaned = text.trimStart();

    // If starts with markdown code fence
    const fenceMatch = cleaned.match(/^```(?:json|euix|euix\.json|xml|html)?\s*\n?/i);
    if (fenceMatch) {
        cleaned = cleaned.slice(fenceMatch[0].length);
    }

    // Strip trailing closing fence if present
    if (cleaned.endsWith("```")) {
        cleaned = cleaned.slice(0, -3).replace(/\r?\n$/, "");
    }

    return cleaned;
}

/**
 * Repairs a truncated or in-flight streaming JSON string into valid, parseable JSON.
 *
 * @param {string} rawInput
 * @returns {string|null} Repaired valid JSON string, or null if no JSON root found.
 */
export function repairPartialJson(rawInput) {
    if (!rawInput || typeof rawInput !== "string") return null;

    let text = stripMarkdownFences(rawInput).trimStart();
    if (!text) return null;

    // Find the first JSON opening character '{' or '['
    const firstBrace = text.indexOf("{");
    const firstBracket = text.indexOf("[");
    let startIdx = -1;
    if (firstBrace !== -1 && firstBracket !== -1) {
        startIdx = Math.min(firstBrace, firstBracket);
    } else if (firstBrace !== -1) {
        startIdx = firstBrace;
    } else if (firstBracket !== -1) {
        startIdx = firstBracket;
    }

    if (startIdx === -1) {
        return null;
    }

    text = text.slice(startIdx);

    // Fast path: if already valid complete JSON, return directly
    try {
        JSON.parse(text);
        return text;
    } catch (_) {
        // Needs repair
    }

    // Stack keeps track of open containers:
    // { type: '{' | '[', expecting: 'KEY_OR_CLOSE' | 'KEY' | 'COLON' | 'VALUE' | 'VALUE_OR_CLOSE' | 'COMMA_OR_CLOSE', commaPos: number, keyStart: number }
    const stack = [];
    let inString = false;
    let isEscaped = false;
    let stringStart = -1;
    let i = 0;

    while (i < text.length) {
        const char = text[i];

        if (inString) {
            if (isEscaped) {
                isEscaped = false;
            } else if (char === "\\") {
                isEscaped = true;
            } else if (char === '"') {
                inString = false;
                const top = stack[stack.length - 1];
                if (top) {
                    if (top.type === "{" && (top.expecting === "KEY" || top.expecting === "KEY_OR_CLOSE")) {
                        top.expecting = "COLON";
                    } else if (top.expecting === "VALUE" || top.expecting === "VALUE_OR_CLOSE") {
                        top.expecting = "COMMA_OR_CLOSE";
                    }
                }
            }
            i++;
            continue;
        }

        // Outside string
        if (char === '"') {
            inString = true;
            isEscaped = false;
            stringStart = i;
            const top = stack[stack.length - 1];
            if (top && top.type === "{" && (top.expecting === "KEY" || top.expecting === "KEY_OR_CLOSE")) {
                top.keyStart = i;
            }
            i++;
            continue;
        }

        if (char === "{" || char === "[") {
            const containerType = char;
            stack.push({
                type: containerType,
                expecting: containerType === "{" ? "KEY_OR_CLOSE" : "VALUE_OR_CLOSE",
                commaPos: -1,
                keyStart: -1,
            });
            i++;
            continue;
        }

        if (char === "}" || char === "]") {
            if (stack.length > 0) {
                const top = stack[stack.length - 1];
                if ((char === "}" && top.type === "{") || (char === "]" && top.type === "[")) {
                    stack.pop();
                    const newTop = stack[stack.length - 1];
                    if (newTop) {
                        newTop.expecting = "COMMA_OR_CLOSE";
                    }
                }
            }
            i++;
            continue;
        }

        if (char === ":") {
            const top = stack[stack.length - 1];
            if (top && top.type === "{" && top.expecting === "COLON") {
                top.expecting = "VALUE";
            }
            i++;
            continue;
        }

        if (char === ",") {
            const top = stack[stack.length - 1];
            if (top) {
                top.commaPos = i;
                if (top.type === "{") {
                    top.expecting = "KEY";
                    top.keyStart = -1;
                } else if (top.type === "[") {
                    top.expecting = "VALUE";
                }
            }
            i++;
            continue;
        }

        if (/\s/.test(char)) {
            i++;
            continue;
        }

        // Literals: numbers, true, false, null
        const top = stack[stack.length - 1];
        if (top && (top.expecting === "VALUE" || top.expecting === "VALUE_OR_CLOSE")) {
            let j = i;
            while (j < text.length && !/[\s,\}\]]/.test(text[j])) {
                j++;
            }
            const token = text.slice(i, j);
            if (
                token === "true" ||
                token === "false" ||
                token === "null" ||
                /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(token)
            ) {
                top.expecting = "COMMA_OR_CLOSE";
            }
            i = j;
            continue;
        }

        i++;
    }

    // Now resolve stream truncation at the tail of text
    const top = stack[stack.length - 1];

    if (inString) {
        if (top && top.type === "{" && (top.expecting === "KEY" || top.expecting === "KEY_OR_CLOSE")) {
            // Stream truncated while typing an object key: e.g. {"title": "Hello", "wid
            // Truncate back before the incomplete key and its preceding comma
            if (top.commaPos !== -1 && top.commaPos < stringStart) {
                text = text.slice(0, top.commaPos);
            } else {
                text = text.slice(0, stringStart);
            }
            top.expecting = top.commaPos !== -1 ? "COMMA_OR_CLOSE" : "KEY_OR_CLOSE";
        } else {
            // Stream truncated while typing a string value: e.g. {"title": "Hello wo
            // Count trailing backslashes to avoid escaping the closing quote
            let trailingBackslashes = 0;
            let p = text.length - 1;
            while (p >= stringStart && text[p] === "\\") {
                trailingBackslashes++;
                p--;
            }
            if (trailingBackslashes % 2 === 1) {
                text = text.slice(0, -1);
            }
            // Strip broken unicode escape sequence like \u12 at the end
            text = text.replace(/\\u[0-9a-fA-F]{0,3}$/, "");
            text += '"';
            if (top) {
                top.expecting = "COMMA_OR_CLOSE";
            }
        }
        inString = false;
    } else {
        // Outside string: resolve incomplete literals or dangling keys/colons
        text = text.trimEnd();

        // Incomplete booleans and null
        text = text.replace(/(:\s*|,\s*|\[\s*)tru$/i, "$1true");
        text = text.replace(/(:\s*|,\s*|\[\s*)fal$/i, "$1false");
        text = text.replace(/(:\s*|,\s*|\[\s*)nul$/i, "$1null");

        // Incomplete numbers
        text = text.replace(/(:\s*|,\s*|\[\s*)-\s*$/i, "$10");
        text = text.replace(/(:\s*|,\s*|\[\s*)(\d+)\.\s*$/i, "$1$2.0");
        text = text.replace(/(:\s*|,\s*|\[\s*)(\d+[eE][+-]?)\s*$/i, "$1$20");

        // Dangling key without colon: e.g. {"tag": "flex", "key"
        text = text.replace(/,\s*"[^"]*"\s*$/, "");
        text = text.replace(/\{\s*"[^"]*"\s*$/, "{");

        // Dangling key with colon but no value: e.g. {"tag": "flex", "key":
        text = text.replace(/,\s*"[^"]*"\s*:\s*$/, "");
        text = text.replace(/\{\s*"[^"]*"\s*:\s*$/, "{");

        // Dangling trailing comma before closure
        text = text.replace(/,\s*$/, "");
    }

    // Now close all remaining open containers in LIFO order
    for (let k = stack.length - 1; k >= 0; k--) {
        const frame = stack[k];
        if (frame.type === "{") {
            // Ensure no trailing comma right before closing brace
            text = text.replace(/,\s*$/, "");
            text += "}";
        } else if (frame.type === "[") {
            text = text.replace(/,\s*$/, "");
            text += "]";
        }
    }

    // Final safety check
    try {
        JSON.parse(text);
        return text;
    } catch (_) {
        // Clean any accidental invalid trailing commas before brackets/braces
        text = text.replace(/,\s*([\}\]])/g, "$1");
        try {
            JSON.parse(text);
            return text;
        } catch (finalErr) {
            return null;
        }
    }
}

/**
 * Repairs a truncated or streaming XML specification (<uid_spec>...</uid_spec>).
 *
 * @param {string} rawInput
 * @returns {string|null} Repaired valid XML string, or null if no XML detected.
 */
export function repairPartialXml(rawInput) {
    if (!rawInput || typeof rawInput !== "string") return null;

    let text = stripMarkdownFences(rawInput).trim();
    if (!text) return null;

    const startIdx = text.indexOf("<");
    if (startIdx === -1) return null;
    text = text.slice(startIdx);

    // Close incomplete CDATA
    if (text.includes("<![CDATA[") && !text.includes("]]>")) {
        text += "]]>";
    }

    // Close incomplete comment
    if (text.includes("<!--") && !text.includes("-->")) {
        text += "-->";
    }

    // If stream cut in the middle of an attribute: e.g. <flex direction="col
    const lastOpenTagIdx = text.lastIndexOf("<");
    const lastCloseTagIdx = text.lastIndexOf(">");

    if (lastOpenTagIdx > lastCloseTagIdx) {
        // We have an unclosed tag at the tail: <button class="btn
        const incompleteTag = text.slice(lastOpenTagIdx);
        // Check if there is an unclosed quote in the tag
        const quotesCount = (incompleteTag.match(/"/g) || []).length;
        if (quotesCount % 2 === 1) {
            text += '"';
        }

        // If it's an incomplete tag identifier like `<but` or `<on_`
        if (/^<[a-zA-Z0-9_:.-]+$/.test(incompleteTag)) {
            // Strip incomplete opening tag
            text = text.slice(0, lastOpenTagIdx).trimEnd();
        } else {
            // Close the opening tag
            text += ">";
        }
    }

    // Scan all open tags using a tag stack
    const tagStack = [];
    const tagRegex = /<\/?([a-zA-Z0-9_:-]+)([^>]*?)(\/?)>/g;
    let match;

    const VOID_ELEMENTS = new Set(["input", "br", "hr", "img", "meta", "link", "param", "source"]);

    while ((match = tagRegex.exec(text)) !== null) {
        const fullTag = match[0];
        const tagName = match[1];
        const isClosing = fullTag.startsWith("</");
        const isSelfClosing = match[3] === "/" || VOID_ELEMENTS.has(tagName.toLowerCase());

        if (fullTag.startsWith("<!--") || fullTag.startsWith("<![CDATA[")) {
            continue;
        }

        if (isClosing) {
            // Pop matching tag from stack
            const lastIdx = tagStack.lastIndexOf(tagName);
            if (lastIdx !== -1) {
                tagStack.splice(lastIdx, 1);
            }
        } else if (!isSelfClosing) {
            tagStack.push(tagName);
        }
    }

    // Close remaining open tags in LIFO order
    while (tagStack.length > 0) {
        const unclosed = tagStack.pop();
        text += `</${unclosed}>`;
    }

    return text;
}

/**
 * Parses a partial or streaming JSON string into a JavaScript object.
 *
 * @param {string|object} input
 * @param {object} [options={}]
 * @returns {{ data: object|null, isComplete: boolean, repairedJson: string|null, error: Error|null }}
 */
export function parsePartialJson(input, options = {}) {
    if (input === null || input === undefined) {
        return { data: null, isComplete: false, repairedJson: null, error: null };
    }

    if (typeof input === "object") {
        return { data: input, isComplete: true, repairedJson: JSON.stringify(input), error: null };
    }

    if (typeof input !== "string") {
        return {
            data: null,
            isComplete: false,
            repairedJson: null,
            error: new Error(`Expected string or object, got ${typeof input}`),
        };
    }

    const trimmed = input.trim();
    if (!trimmed) {
        return { data: null, isComplete: false, repairedJson: null, error: null };
    }

    // Fast-path: Complete JSON string
    try {
        const direct = JSON.parse(trimmed);
        return { data: direct, isComplete: true, repairedJson: trimmed, error: null };
    } catch (_) {
        // Not a complete JSON, attempt repair
    }

    const repaired = repairPartialJson(trimmed);
    if (!repaired) {
        return {
            data: null,
            isComplete: false,
            repairedJson: null,
            error: new Error("Unable to repair partial JSON: no JSON structure detected."),
        };
    }

    try {
        const data = JSON.parse(repaired);
        return { data, isComplete: false, repairedJson: repaired, error: null };
    } catch (err) {
        return { data: null, isComplete: false, repairedJson: repaired, error: err };
    }
}

/**
 * Universal streaming parser for EUIX. Sniffs JSON or XML streams, repairs them in real-time,
 * and normalizes to a canonical EUIX Source JSON object.
 *
 * @param {string|object} streamInput
 * @param {object} [options={}]
 * @param {string} [options.fileName="streaming.euix"]
 * @returns {{ source: object|null, isComplete: boolean, format: "json"|"xml", diagnostics: Array<import('../validator/diagnostics.js').Diagnostic>, repairedText: string|null }}
 */
export function parseStreamingEuix(streamInput, options = {}) {
    const fileName = options.fileName || "streaming.euix";
    if (streamInput === null || streamInput === undefined) {
        return { source: null, isComplete: false, format: "json", diagnostics: [], repairedText: null };
    }

    let text = typeof streamInput === "string" ? streamInput.trim() : "";
    text = stripMarkdownFences(text).trim();

    const isXml = text.startsWith("<") || text.includes("<uid_spec");

    if (isXml) {
        // Fast-path: complete XML
        const initialRes = parseXmlToJson(text, fileName);
        if (initialRes.source && !initialRes.diagnostics.some((d) => d.severity === "error")) {
            return {
                source: initialRes.source,
                isComplete: true,
                format: "xml",
                diagnostics: initialRes.diagnostics,
                repairedText: text,
            };
        }

        // Repair partial XML
        const repairedXml = repairPartialXml(text);
        if (!repairedXml) {
            return {
                source: null,
                isComplete: false,
                format: "xml",
                diagnostics: initialRes.diagnostics,
                repairedText: null,
            };
        }

        const repairedRes = parseXmlToJson(repairedXml, fileName);
        return {
            source: repairedRes.source,
            isComplete: false,
            format: "xml",
            diagnostics: repairedRes.diagnostics,
            repairedText: repairedXml,
        };
    }

    // Default: JSON stream
    const partialResult = parsePartialJson(text, options);
    if (!partialResult.data) {
        return {
            source: null,
            isComplete: false,
            format: "json",
            diagnostics: [
                createDiagnostic({
                    code: DIAGNOSTIC_CODES.SCHEMA_ERROR,
                    type: "streaming-json-parse-error",
                    file: fileName,
                    path: "",
                    message: partialResult.error ? partialResult.error.message : "Incomplete JSON stream",
                }),
            ],
            repairedText: partialResult.repairedJson,
        };
    }

    const { source, diagnostics } = parseJsonSource(partialResult.data, fileName);
    return {
        source,
        isComplete: partialResult.isComplete,
        format: "json",
        diagnostics,
        repairedText: partialResult.repairedJson,
    };
}

/**
 * Renders an in-flight EUIX stream chunk directly to an HTML string.
 *
 * @param {string|object} streamInput
 * @param {object} [initialData={}]
 * @param {object} [options={}]
 * @returns {{ html: string, isComplete: boolean, format: "json"|"xml", source: object|null, diagnostics: Array<any>, repairedText: string|null }}
 */
export function streamRender(streamInput, initialData = {}, options = {}) {
    const { source, isComplete, format, diagnostics, repairedText } = parseStreamingEuix(streamInput, options);
    if (!source || !source.view) {
        return {
            html: "",
            isComplete,
            format,
            source,
            diagnostics,
            repairedText,
        };
    }

    try {
        const html = renderToString(source, initialData, options);
        return {
            html,
            isComplete,
            format,
            source,
            diagnostics,
            repairedText,
        };
    } catch (err) {
        return {
            html: "",
            isComplete,
            format,
            source,
            diagnostics,
            repairedText,
            renderError: err.message,
        };
    }
}

/**
 * Async generator that consumes a stream of token chunks and yields live-rendered HTML frames.
 *
 * @param {AsyncIterable<string|object>} tokenStream
 * @param {object} [initialData={}]
 * @param {object} [options={}]
 * @returns {AsyncGenerator<{ html: string, isComplete: boolean, format: string, source: object|null }>}
 */
export async function* createEuixStreamRenderer(tokenStream, initialData = {}, options = {}) {
    let accumulated = "";
    for await (const chunk of tokenStream) {
        const text = typeof chunk === "string" ? chunk : (chunk?.text || chunk?.content || "");
        accumulated += text;
        const frame = streamRender(accumulated, initialData, options);
        yield frame;
    }
}
