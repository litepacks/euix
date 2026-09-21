/**
 * packages/core/src/prepare/parser/index.js
 * Unified format sniffer and parser dispatching to JSON or XML converter.
 */

import { parseJsonSource } from "./jsonParser.js";
import { parseXmlToJson } from "./xmlToJson.js";
import { DIAGNOSTIC_CODES, createDiagnostic } from "../validator/diagnostics.js";

/**
 * Sniff input format and parse into canonical EUIX Source JSON.
 *
 * @param {string|object} input
 * @param {string} [fileName="source.euix"]
 * @returns {{ source: object|null, format: "json"|"xml", diagnostics: Array<import('../validator/diagnostics.js').Diagnostic> }}
 */
export function parseSource(input, fileName = "source.euix") {
    if (input === null || input === undefined) {
        return {
            source: null,
            format: "json",
            diagnostics: [
                createDiagnostic({
                    code: DIAGNOSTIC_CODES.SCHEMA_ERROR,
                    type: "empty-source",
                    file: fileName,
                    path: "",
                    message: "Input source cannot be empty or null.",
                }),
            ],
        };
    }

    // Direct object input
    if (typeof input === "object") {
        const { source, diagnostics } = parseJsonSource(input, fileName);
        return { source, format: "json", diagnostics };
    }

    if (typeof input === "string") {
        const trimmed = input.trim();
        const isXml = trimmed.startsWith("<") || trimmed.includes("<uid_spec");
        if (isXml) {
            const { source, diagnostics } = parseXmlToJson(trimmed, fileName);
            return { source, format: "xml", diagnostics };
        }

        // Otherwise treat as JSON string
        const { source, diagnostics } = parseJsonSource(trimmed, fileName);
        return { source, format: "json", diagnostics };
    }

    return {
        source: null,
        format: "json",
        diagnostics: [
            createDiagnostic({
                code: DIAGNOSTIC_CODES.SCHEMA_ERROR,
                type: "unsupported-source-type",
                file: fileName,
                path: "",
                message: `Unsupported source type: ${typeof input}. Expected object or string.`,
            }),
        ],
    };
}
