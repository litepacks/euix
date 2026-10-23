/**
 * packages/core/src/prepare/ai/contextBuilder.js
 * Builds minimal, targeted AI repair context.
 * Drastically reduces prompt tokens and prevents hallucinated full-file rewrites.
 */

import { findNode } from "../patch/semanticPatch.js";

const ALLOWED_OPERATIONS_MAP = {
    EUIX010: ["replace-expression"], // UNCLOSED_EXPRESSION
    EUIX011: ["replace-expression"], // UNEXPECTED_CLOSING_BRACE
    EUIX012: ["replace-expression"], // MALFORMED_EXPRESSION
    UNCLOSED_EXPRESSION: ["replace-expression"],
    UNEXPECTED_CLOSING_BRACE: ["replace-expression"],
    MALFORMED_EXPRESSION: ["replace-expression"],

    EUIX202: ["add-state", "update-binding", "replace-expression"], // UNKNOWN_STATE
    UNKNOWN_STATE: ["add-state", "update-binding", "replace-expression"],

    EUIX203: ["add-action", "update-binding"], // UNKNOWN_ACTION
    UNKNOWN_ACTION: ["add-action", "update-binding"],

    EUIX216: ["add-state", "update-action"], // INVALID_WRITE
    INVALID_WRITE: ["add-state", "update-action"],

    EUIX217: ["add-state", "add-computed", "update-action", "replace-expression"], // UNRESOLVED_REFERENCE
    UNRESOLVED_REFERENCE: ["add-state", "add-computed", "update-action", "replace-expression"],

    EUIX214: ["remove-state", "update-state"], // DUPLICATE_STATE
    DUPLICATE_STATE: ["remove-state", "update-state"],

    EUIX215: ["remove-action", "update-action"], // DUPLICATE_ACTION
    DUPLICATE_ACTION: ["remove-action", "update-action"],

    EUIX207: ["remove-state", "remove-computed"], // DUPLICATE_IDENTIFIER
    DUPLICATE_IDENTIFIER: ["remove-state", "remove-computed"],

    EUIX208: ["update-computed", "remove-computed"], // CIRCULAR_COMPUTED
    CIRCULAR_COMPUTED: ["update-computed", "remove-computed"],

    EUIX209: ["update-action", "update-binding"], // CIRCULAR_WATCH
    CIRCULAR_WATCH: ["update-action", "update-binding"],
};

/**
 * Builds a compact, targeted context snippet for an LLM to resolve a specific diagnostic.
 *
 * @param {import('../validator/diagnostics.js').Diagnostic} diagnostic
 * @param {object} source - Canonical EUIX source
 * @param {import('../analyzer/symbolTable.js').SymbolTable} symbolTable
 * @param {import('../analyzer/dependencyGraph.js').DependencyGraph} [dependencyGraph]
 * @returns {object} Targeted repair context
 */
export function buildTargetedRepairContext(diagnostic, source, symbolTable, dependencyGraph = null) {
    const diagCode = diagnostic.code || "UNKNOWN_ERROR";
    const allowedOperations = ALLOWED_OPERATIONS_MAP[diagCode] || [
        "add-state",
        "update-state",
        "add-action",
        "update-action",
        "update-binding",
        "replace-expression",
    ];

    // 1. Locate relevant AST node
    let targetNode = null;
    let parentSummary = null;

    if (diagnostic.path) {
        const found = findNode(source, diagnostic.path);
        if (found) {
            targetNode = found.node;
            if (found.parent) {
                parentSummary = {
                    tag: found.parent.tag || found.parent.component || "container",
                    id: found.parent.id || found.parent.props?.id || null,
                };
            }
        }
    }

    if (!targetNode && diagnostic.nodeId) {
        const found = findNode(source, diagnostic.nodeId);
        if (found) {
            targetNode = found.node;
        }
    }

    // 2. Select relevant symbol subset (not the entire project)
    const availableStates = Array.from(symbolTable.states.keys()).slice(0, 15);
    const availableActions = Array.from(symbolTable.actions.keys()).slice(0, 15);
    const availableComputed = Array.from(symbolTable.computed.keys()).slice(0, 10);

    return {
        diagnostic: {
            code: diagCode,
            type: diagnostic.type,
            name: diagnostic.name || null,
            message: diagnostic.message,
            path: diagnostic.path || null,
            line: diagnostic.line || null,
            column: diagnostic.column || null,
            expression: diagnostic.expression || null,
            suggestion: diagnostic.suggestion || null,
        },
        targetNode: targetNode || (diagnostic.name ? `<${diagnostic.name} />` : null),
        parentNode: parentSummary,
        availableSymbols: {
            states: availableStates,
            actions: availableActions,
            computed: availableComputed,
        },
        allowedOperations,
        instructions: "Return ONLY a JSON array of minimal semantic patch operations to fix this diagnostic without rewriting other code.",
    };
}
