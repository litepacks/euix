/**
 * packages/core/src/prepare/parser/jsonParser.js
 * Parses JSON source strings or normalizes JS objects into canonical EUIX Source JSON.
 */

import { DIAGNOSTIC_CODES, createDiagnostic } from "../validator/diagnostics.js";

/**
 * Parse a JSON string or validate an object into an EUIX Source JSON representation.
 *
 * @param {string|object} input
 * @param {string} [fileName="source.euix.json"]
 * @returns {{ source: object|null, diagnostics: Array<import('../validator/diagnostics.js').Diagnostic> }}
 */
export function parseJsonSource(input, fileName = "source.euix.json") {
    const diagnostics = [];

    if (input === null || input === undefined) {
        diagnostics.push(
            createDiagnostic({
                code: DIAGNOSTIC_CODES.SCHEMA_ERROR,
                type: "parse-error",
                file: fileName,
                path: "",
                message: "Source input is empty.",
            }),
        );
        return { source: null, diagnostics };
    }

    let parsed = input;

    if (typeof input === "string") {
        const trimmed = input.trim();
        if (!trimmed) {
            diagnostics.push(
                createDiagnostic({
                    code: DIAGNOSTIC_CODES.SCHEMA_ERROR,
                    type: "parse-error",
                    file: fileName,
                    path: "",
                    message: "Source string is empty.",
                }),
            );
            return { source: null, diagnostics };
        }

        try {
            parsed = JSON.parse(trimmed);
        } catch (err) {
            // Extract line and column if available from SyntaxError
            const lineColMatch = err.message.match(/at position (\d+)/i);
            diagnostics.push(
                createDiagnostic({
                    code: DIAGNOSTIC_CODES.SCHEMA_ERROR,
                    type: "json-syntax-error",
                    file: fileName,
                    path: lineColMatch ? `pos:${lineColMatch[1]}` : "",
                    message: `Invalid JSON syntax: ${err.message}`,
                }),
            );
            return { source: null, diagnostics };
        }
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        diagnostics.push(
            createDiagnostic({
                code: DIAGNOSTIC_CODES.SCHEMA_ERROR,
                type: "invalid-root",
                file: fileName,
                path: "",
                message: "EUIX source root must be a JSON object.",
            }),
        );
        return { source: null, diagnostics };
    }

    // Canonical normalization of top-level fields
    const source = {
        version: typeof parsed.version === "number" ? parsed.version : 1,
        imports: parsed.imports && typeof parsed.imports === "object" ? { ...parsed.imports } : {},
        route: parsed.route ? (typeof parsed.route === "string" ? { path: parsed.route } : { ...parsed.route }) : null,
        props: parsed.props && typeof parsed.props === "object" ? { ...parsed.props } : {},
        state: parsed.state && typeof parsed.state === "object" ? { ...parsed.state } : {},
        computed: parsed.computed && typeof parsed.computed === "object" ? { ...parsed.computed } : {},
        watch: parsed.watch && typeof parsed.watch === "object" ? { ...parsed.watch } : {},
        actions: parsed.actions && typeof parsed.actions === "object" ? { ...parsed.actions } : {},
        lifecycle: parsed.lifecycle && typeof parsed.lifecycle === "object" ? { ...parsed.lifecycle } : { mount: [], unmount: [] },
        provide: parsed.provide && typeof parsed.provide === "object" ? { ...parsed.provide } : {},
        inject: parsed.inject || null,
        components: parsed.components && typeof parsed.components === "object" ? { ...parsed.components } : {},
        view: parsed.view || null,
    };

    return { source, diagnostics };
}
