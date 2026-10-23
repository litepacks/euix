/**
 * packages/core/src/prepare/validator/diagnostics.js
 * Machine-readable diagnostics format and Levenshtein "Did you mean?" suggestion engine.
 */

export const DIAGNOSTIC_CODES = {
    // Expression & Syntax
    UNCLOSED_EXPRESSION: "EUIX010",
    UNEXPECTED_CLOSING_BRACE: "EUIX011",
    MALFORMED_EXPRESSION: "EUIX012",

    // Structural & Semantic Schema
    SCHEMA_ERROR: "EUIX200",
    UNKNOWN_COMPONENT: "EUIX201",
    UNKNOWN_STATE: "EUIX202",
    UNKNOWN_ACTION: "EUIX203",
    INVALID_BINDING: "EUIX204",
    INVALID_ROUTE: "EUIX205",
    MISSING_IMPORT: "EUIX206",
    DUPLICATE_IDENTIFIER: "EUIX207",
    CIRCULAR_COMPUTED: "EUIX208",
    CIRCULAR_WATCH: "EUIX209",
    INVALID_LIFECYCLE: "EUIX210",
    INVALID_PROP: "EUIX211",
    UNDEFINED_SERVICE: "EUIX212",

    // Extended Semantic Codes
    UNKNOWN_COMPUTED: "EUIX213",
    DUPLICATE_STATE: "EUIX214",
    DUPLICATE_ACTION: "EUIX215",
    INVALID_WRITE: "EUIX216",
    UNRESOLVED_REFERENCE: "EUIX217",
    UNUSED_STATE: "EUIX218",
    UNUSED_ACTION: "EUIX219",

    // Runtime Feedback
    RUNTIME_ERROR: "EUIX500",
    ACTION_EXECUTION_FAILED: "EUIX501",
    STATE_WRITE_FAILED: "EUIX502",
    COMPUTED_FAILED: "EUIX503",
    WATCH_FAILED: "EUIX504",
    BINDING_FAILED: "EUIX505",
};

/**
 * Standardized machine-readable diagnostic item.
 *
 * @typedef {Object} Diagnostic
 * @property {string} code - Diagnostic code (e.g. "EUIX201" or "UNKNOWN_ACTION")
 * @property {string} [type] - Diagnostic type (e.g. "unknown-action")
 * @property {"error"|"warning"|"info"} [severity="error"]
 * @property {string} [name] - Symbol or identifier name
 * @property {number} [line] - 1-indexed source line number
 * @property {number} [column] - 1-indexed source column number
 * @property {string} [nodeId] - View or AST node identifier
 * @property {string} [expression] - Substring of erroneous expression
 * @property {string} [file="source.euix.json"] - Filename or virtual path
 * @property {string} [path=""] - JSON path or source location
 * @property {string} message - Human-readable explanation
 * @property {string|null} [suggestion] - Optional "Did you mean?" suggestion
 */

/**
 * Create a structured machine-readable diagnostic.
 *
 * @param {Diagnostic} options
 * @returns {Diagnostic}
 */
export function createDiagnostic({
    code,
    type,
    severity = "error",
    name = undefined,
    line = undefined,
    column = undefined,
    nodeId = undefined,
    expression = undefined,
    file = "source.euix.json",
    path = "",
    message,
    suggestion = null,
}) {
    const diag = {
        code,
        type: type || code.toLowerCase().replace(/_/g, "-"),
        severity,
        file,
        path,
        message,
    };

    if (name !== undefined) diag.name = name;
    if (line !== undefined) diag.line = line;
    if (column !== undefined) diag.column = column;
    if (nodeId !== undefined) diag.nodeId = nodeId;
    if (expression !== undefined) diag.expression = expression;
    if (suggestion !== null && suggestion !== undefined) {
        diag.suggestion = suggestion;
    }
    return diag;
}

/**
 * Computes the Levenshtein distance between two strings.
 *
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshteinDistance(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    const row = new Int32Array(b.length + 1);
    for (let j = 0; j <= b.length; j++) row[j] = j;

    for (let i = 1; i <= a.length; i++) {
        let prev = i;
        const charA = a.charCodeAt(i - 1);
        for (let j = 1; j <= b.length; j++) {
            const val = charA === b.charCodeAt(j - 1)
                ? row[j - 1]
                : Math.min(row[j - 1], prev, row[j]) + 1;
            row[j - 1] = prev;
            prev = val;
        }
        row[b.length] = prev;
    }

    return row[b.length];
}

/**
 * Finds the closest candidate string within a maximum edit distance threshold.
 *
 * @param {string} query
 * @param {Iterable<string>} candidates
 * @param {number} [maxDistance=3]
 * @returns {string|null}
 */
export function findClosestMatch(query, candidates, maxDistance = 3) {
    if (!query || !candidates) return null;
    const lowerQuery = query.toLowerCase();
    let bestCandidate = null;
    let bestDistance = maxDistance + 1;

    for (const candidate of candidates) {
        if (!candidate || typeof candidate !== "string") continue;
        const lowerCand = candidate.toLowerCase();
        if (lowerCand === lowerQuery) return candidate;

        // Substring / prefix boost
        if (lowerCand.startsWith(lowerQuery) || lowerQuery.startsWith(lowerCand)) {
            const diff = Math.abs(lowerCand.length - lowerQuery.length);
            if (diff <= maxDistance && diff < bestDistance) {
                bestDistance = diff;
                bestCandidate = candidate;
                continue;
            }
        }

        const dist = levenshteinDistance(lowerQuery, lowerCand);
        if (dist <= maxDistance && dist < bestDistance) {
            bestDistance = dist;
            bestCandidate = candidate;
        }
    }

    return bestCandidate;
}
