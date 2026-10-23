/**
 * packages/core/src/prepare/ai/repairEngine.js
 * Repair Confidence Classifier and Minimal Repair Generator for EUIX.
 * Classifies issues into SAFE, PROBABLE, and AMBIGUOUS tiers.
 * Prevents AI from inventing fake business logic for ambiguous actions.
 */

import { applySemanticPatches } from "../patch/semanticPatch.js";

/**
 * Classifies the repair confidence for a given diagnostic.
 *
 * @param {import('../validator/diagnostics.js').Diagnostic} diagnostic
 * @param {import('../analyzer/symbolTable.js').SymbolTable} symbolTable
 * @param {object} source
 * @returns {{"confidence": "SAFE"|"PROBABLE"|"AMBIGUOUS", "patches": object[], "explanation": string}}
 */
export function classifyDiagnosticRepair(diagnostic, symbolTable, source) {
    const code = diagnostic.code || "";
    const name = diagnostic.name || "";
    const expr = diagnostic.expression || "";

    // 1. SAFE: Syntax and expression formatting errors
    if (code === "EUIX010" || code === "UNCLOSED_EXPRESSION") {
        const closed = expr.endsWith("}") ? expr : `${expr}}`;
        return {
            confidence: "SAFE",
            patches: [
                {
                    op: "replace-expression",
                    path: diagnostic.path,
                    expression: closed,
                },
            ],
            explanation: `Safely closed unclosed expression "${expr}" to "${closed}".`,
        };
    }

    if (code === "EUIX011" || code === "UNEXPECTED_CLOSING_BRACE") {
        return {
            confidence: "SAFE",
            patches: [
                {
                    op: "replace-expression",
                    path: diagnostic.path,
                    expression: "",
                },
            ],
            explanation: "Safely stripped unexpected stray closing brace.",
        };
    }

    if (code === "EUIX012" || code === "MALFORMED_EXPRESSION") {
        if (expr.startsWith("{{") && expr.endsWith("}}")) {
            const normalized = `{${expr.slice(2, -2).trim()}}`;
            return {
                confidence: "SAFE",
                patches: [
                    {
                        op: "replace-expression",
                        path: diagnostic.path,
                        expression: normalized,
                    },
                ],
                explanation: `Normalized double braces "${expr}" into standard EUIX expression "${normalized}".`,
            };
        }
    }

    // 2. PROBABLE: Missing state referenced in template with inferrable type
    if (code === "EUIX202" || code === "UNKNOWN_STATE" || code === "EUIX216" || code === "INVALID_WRITE") {
        if (name) {
            // Infer type based on naming patterns or expression context
            let inferredType = "string";
            let inferredDefault = "";

            if (/count|num|idx|index|total|page|step|qty|quantity|amount|price|rating/i.test(name)) {
                inferredType = "number";
                inferredDefault = 0;
            } else if (/is[A-Z]|has[A-Z]|open|active|loading|visible|checked|disabled/i.test(name)) {
                inferredType = "boolean";
                inferredDefault = false;
            } else if (/list|items|data|records|users|posts|array|tags|cards/i.test(name)) {
                inferredType = "array";
                inferredDefault = [];
            }

            return {
                confidence: "PROBABLE",
                patches: [
                    {
                        op: "add-state",
                        name,
                        initial: inferredDefault,
                        type: inferredType,
                    },
                ],
                explanation: `Inferred missing state "${name}" as type "${inferredType}" with initial value ${JSON.stringify(inferredDefault)}.`,
            };
        }
    }

    // 3. Simple action patterns: e.g. toggleX where state x exists -> PROBABLE
    if (code === "EUIX203" || code === "UNKNOWN_ACTION") {
        if (name.startsWith("toggle") && name.length > 6) {
            const possibleState = name[6].toLowerCase() + name.slice(7);
            if (symbolTable.states.has(possibleState)) {
                return {
                    confidence: "PROBABLE",
                    patches: [
                        {
                            op: "add-action",
                            name,
                            toggle: possibleState,
                            writes: [possibleState],
                            reads: [possibleState],
                        },
                    ],
                    explanation: `Inferred action "${name}" as a state toggle on "${possibleState}".`,
                };
            }
        }

        // AMBIGUOUS: Complex business actions (submitPayment, checkout, processOrder)
        return {
            confidence: "AMBIGUOUS",
            patches: [],
            explanation: `Action "${name}" contains custom business logic. Cannot automatically infer implementation without hallucinating requirements.`,
        };
    }

    return {
        confidence: "AMBIGUOUS",
        patches: [],
        explanation: `Diagnostic [${code}] requires human or AI plan specification.`,
    };
}

/**
 * Resolves safe and probable diagnostics automatically on a source.
 * Only SAFE repairs are applied automatically unless allowProbable is set to true.
 *
 * @param {object} source - Canonical EUIX source
 * @param {Array<import('../validator/diagnostics.js').Diagnostic>} diagnostics
 * @param {import('../analyzer/symbolTable.js').SymbolTable} symbolTable
 * @param {object} [options={}]
 * @param {boolean} [options.allowProbable=false]
 * @returns {{ repairedSource: object, appliedPatches: object[], unresolvedDiagnostics: object[] }}
 */
export function autoRepairSource(source, diagnostics, symbolTable, options = {}) {
    const allowProbable = options.allowProbable === true;
    const appliedPatches = [];
    const unresolvedDiagnostics = [];

    let currentSource = source;

    for (const diag of diagnostics) {
        const { confidence, patches, explanation } = classifyDiagnosticRepair(diag, symbolTable, currentSource);

        if (confidence === "SAFE" || (confidence === "PROBABLE" && allowProbable)) {
            if (patches.length > 0) {
                const patchRes = applySemanticPatches(currentSource, patches);
                if (patchRes.success) {
                    currentSource = patchRes.source;
                    appliedPatches.push({
                        diagnostic: diag,
                        confidence,
                        explanation,
                        patches,
                    });
                    continue;
                }
            }
        }

        unresolvedDiagnostics.push({
            diagnostic: diag,
            confidence,
            explanation,
        });
    }

    return {
        repairedSource: currentSource,
        appliedPatches,
        unresolvedDiagnostics,
    };
}
