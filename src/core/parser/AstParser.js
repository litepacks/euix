/**
 * src/core/parser/AstParser.js
 * High-performance XML parser and AST caching module for EUIX Engine.
 */

import { EUIXXMLParseError } from "./errors.js";

export const _astCache = new Map();
export let _astCacheMaxSize = 500;
export const _astCacheStats = { hits: 0, misses: 0 };

export function _cloneDocument(doc) {
    if (!doc) return null;
    try {
        if (
            typeof document !== "undefined" &&
            document.implementation &&
            typeof document.implementation.createDocument === "function"
        ) {
            const cloned = document.implementation.createDocument(null, null, null);
            if (doc.documentElement) {
                cloned.appendChild(cloned.importNode(doc.documentElement, true));
            }
            return cloned;
        }
        return doc.cloneNode(true);
    } catch (_) {
        return doc.cloneNode(true);
    }
}

export function generateCodeFrame(source, line = 1, col = 1, windowSize = 2) {
    if (!source || typeof source !== "string") return "";
    const lines = source.split("\n");
    const startLine = Math.max(1, line - windowSize);
    const endLine = Math.min(lines.length, line + windowSize);
    const gutterWidth = String(endLine).length;

    let frame = "";
    for (let i = startLine; i <= endLine; i++) {
        const lineContent = lines[i - 1] || "";
        const isTarget = i === line;
        const lineNumStr = String(i).padStart(gutterWidth, " ");
        if (isTarget) {
            frame += `> ${lineNumStr} | ${lineContent}\n`;
            if (col > 0) {
                frame += `  ${" ".repeat(gutterWidth)} | ${" ".repeat(Math.max(0, col - 1))}^\n`;
            }
        } else {
            frame += `  ${lineNumStr} | ${lineContent}\n`;
        }
    }
    return frame;
}

export function parseXmlToAst(xmlString, options = {}) {
    if (!xmlString || typeof xmlString !== "string") return null;

    // 1. Decode HTML named entities dynamically using native DOMParser text/html (zero dictionary / zero bundle bloat)
    let processedXml = xmlString;
    const entityMatches = Array.from(new Set(xmlString.match(/&([a-zA-Z0-9]+);/g) || []));
    if (entityMatches.length > 0 && typeof DOMParser !== "undefined") {
        const nonXmlEntities = entityMatches.filter((e) => !["&amp;", "&lt;", "&gt;", "&quot;", "&apos;"].includes(e));
        if (nonXmlEntities.length > 0) {
            try {
                const htmlDoc = new DOMParser().parseFromString(nonXmlEntities.join("___EUIX_ENT___"), "text/html");
                const decodedList = (htmlDoc.body ? htmlDoc.body.textContent : "").split("___EUIX_ENT___");
                nonXmlEntities.forEach((entity, idx) => {
                    const decoded = decodedList[idx];
                    if (decoded && decoded !== entity) {
                        processedXml = processedXml.replaceAll(entity, decoded);
                    }
                });
            } catch (_) {}
        }
    }

    // 1.5. Protect raw CSS inside <style>...</style> with CDATA if containing special XML characters (<, >, &)
    processedXml = processedXml.replace(/<style(\s[^>]*?)?>([\s\S]*?)<\/style>/gi, (match, attrs, content) => {
        if (!content || content.includes("<![CDATA[")) return match;
        if (/[<>&]/.test(content)) {
            return `<style${attrs || ""}>/*<![CDATA[*/\n${content}\n/*]]>*/</style>`;
        }
        return match;
    });

    // 1.6. Auto-protect raw JS inside RUN_SCRIPT action tags or <script> tags with CDATA
    processedXml = processedXml.replace(
        /(<(?:on_[a-zA-Z0-9_-]+|step)\s+[^>]*?action=["']RUN_SCRIPT["'][^>]*?>)([\s\S]*?)(<\/(?:on_[a-zA-Z0-9_-]+|step)>)/gi,
        (match, openTag, content, closeTag) => {
            if (!content || content.includes("<![CDATA[")) return match;
            if (/[<>&]/.test(content)) {
                return `${openTag}<![CDATA[\n${content}\n]]>${closeTag}`;
            }
            return match;
        }
    );

    // 2. Remove stray closing tags for void elements & ensure self-closing for unclosed void tags
    processedXml = processedXml.replace(
        /<\/(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)>/gi,
        "",
    );
    processedXml = processedXml.replace(
        /<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)(\s[^>]*?)?(?<!\/)>/gi,
        "<$1$2 />",
    );

    // 3. Normalize bare/valueless boolean attributes & escape raw ampersands inside attributes
    processedXml = processedXml.replace(/<([a-zA-Z0-9_-]+)([^>]*?)(\/?)>/g, (match, tagName, attrsStr, selfClose) => {
        if (!attrsStr?.trim()) return match;
        let inQuotes = false;
        let quoteChar = "";
        let newAttrs = "";
        let i = 0;

        while (i < attrsStr.length) {
            const char = attrsStr[i];
            if (inQuotes) {
                if (char === "&" && !/^&(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);/.test(attrsStr.slice(i))) {
                    newAttrs += "&amp;";
                } else {
                    newAttrs += char;
                }
                if (char === quoteChar) inQuotes = false;
                i++;
                continue;
            }
            if (char === '"' || char === "'") {
                inQuotes = true;
                quoteChar = char;
                newAttrs += char;
                i++;
                continue;
            }
            if (/\s/.test(char)) {
                newAttrs += char;
                i++;
                continue;
            }
            if (/[a-zA-Z0-9_\-:]/.test(char)) {
                let name = "";
                while (i < attrsStr.length && /[a-zA-Z0-9_\-:]/.test(attrsStr[i])) {
                    name += attrsStr[i];
                    i++;
                }
                let j = i;
                while (j < attrsStr.length && /\s/.test(attrsStr[j])) j++;
                if (j < attrsStr.length && attrsStr[j] === "=") {
                    newAttrs += name;
                } else {
                    newAttrs += `${name}=""`;
                }
                continue;
            }
            newAttrs += char;
            i++;
        }
        return `<${tagName}${newAttrs}${selfClose ? (newAttrs.endsWith(" ") ? "/>" : " />") : ">"}`;
    });

    // 4. Escape < inside attribute values: ="..." or ='\''...'\''
    let sanitizedXml = processedXml.replace(/=("[^"]*"|'[^']*')/g, (match) => {
        return match.replace(/</g, "&lt;");
    });

    // 5. Escape remaining unescaped ampersands (e.g. raw "&&", "Tom & Jerry", URLs)
    sanitizedXml = sanitizedXml.replace(/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[0-9a-fA-F]+;)/g, "&amp;");

    // 6. Auto-wrap raw script/action tags in CDATA if they contain unescaped code
    sanitizedXml = sanitizedXml.replace(
        /(<(?:on_click|on_mount|on_unmount|on_interval|on_state_change|step|script)[^>]*action=["']RUN_SCRIPT["'][^>]*>)([\s\S]*?)(<\/(?:on_click|on_mount|on_unmount|on_interval|on_state_change|step|script)>)/gi,
        (m, openTag, content, closeTag) => {
            if (content.includes("<![CDATA[")) return m;
            return `${openTag}<![CDATA[${content}]]>${closeTag}`;
        },
    );

    const bypassCache = options && options.bypassCache === true;

    if (!bypassCache && _astCache.has(sanitizedXml)) {
        _astCacheStats.hits++;
        const cachedDoc = _astCache.get(sanitizedXml);
        // Refresh LRU position (delete and re-insert)
        _astCache.delete(sanitizedXml);
        _astCache.set(sanitizedXml, cachedDoc);
        return _cloneDocument(cachedDoc);
    }

    _astCacheStats.misses++;
    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitizedXml, "text/xml");

    const parseError = doc.querySelector("parsererror");
    if (parseError) {
        const errorText = parseError.textContent || "";
        const lineMatch = errorText.match(/line\s+(\d+)/i) || errorText.match(/:(\d+):/);
        const colMatch = errorText.match(/column\s+(\d+)/i) || errorText.match(/:(\d+):(\d+)/);
        const line = lineMatch ? parseInt(lineMatch[1], 10) : 1;
        const col = colMatch ? parseInt(colMatch[colMatch.length - 1], 10) : 1;
        const codeFrame = generateCodeFrame(xmlString, line, col);
        const msg = `[EUIX XML Parse Error] at line ${line}, column ${col}:\n${codeFrame || errorText}`;
        const err = new EUIXXMLParseError(msg, line, col, codeFrame, xmlString);
        if (options && options.silent === true) {
            // Return document if silent
        } else {
            throw err;
        }
    }

    if (!bypassCache && !parseError) {
        if (_astCache.size >= _astCacheMaxSize) {
            const oldestKey = _astCache.keys().next().value;
            if (oldestKey !== undefined) {
                _astCache.delete(oldestKey);
            }
        }
        _astCache.set(sanitizedXml, doc);
    }

    return _cloneDocument(doc);
}

export function clearAstCache() {
    _astCache.clear();
    _astCacheStats.hits = 0;
    _astCacheStats.misses = 0;
}

export function setAstCacheSize(maxSize) {
    if (typeof maxSize === "number" && maxSize > 0) {
        _astCacheMaxSize = maxSize;
        while (_astCache.size > _astCacheMaxSize) {
            const oldestKey = _astCache.keys().next().value;
            if (oldestKey !== undefined) {
                _astCache.delete(oldestKey);
            } else {
                break;
            }
        }
    }
}

export function getAstCacheStats() {
    const total = _astCacheStats.hits + _astCacheStats.misses;
    const hitRatio = total > 0 ? _astCacheStats.hits / total : 0;
    return {
        size: _astCache.size,
        maxSize: _astCacheMaxSize,
        hits: _astCacheStats.hits,
        misses: _astCacheStats.misses,
        hitRatio: parseFloat(hitRatio.toFixed(4)),
    };
}
