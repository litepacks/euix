/**
 * packages/core/src/prepare/validator/diagnostics.js
 * Machine-readable diagnostics format and Levenshtein "Did you mean?" suggestion engine.
 */

export const DIAGNOSTIC_CODES = {
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
};

/**
 * Standardized machine-readable diagnostic item.
 *
 * @typedef {Object} Diagnostic
 * @property {string} code - Diagnostic code (e.g. "EUIX201")
 * @property {string} type - Diagnostic type (e.g. "unknown-component")
 * @property {string} file - Filename or virtual path
 * @property {string} path - JSON path or source location (e.g. "view.component")
 * @property {string} message - Human-readable explanation
 * @property {string|null} [suggestion] - Optional "Did you mean?" suggestion
 * @property {"error"|"warning"|"info"} [severity="error"]
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
    file = "source.euix.json",
    path = "",
    message,
    suggestion = null,
    severity = "error",
}) {
    const diag = {
        code,
        type,
        file,
        path,
        message,
        severity,
    };
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
