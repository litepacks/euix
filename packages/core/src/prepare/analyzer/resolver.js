/**
 * packages/core/src/prepare/analyzer/resolver.js
 * Resolves references against the Symbol Table and emits machine-readable diagnostics
 * for unknown states, unknown actions, invalid writes, and unresolved references.
 */

import { createDiagnostic, DIAGNOSTIC_CODES, findClosestMatch } from "../validator/diagnostics.js";

const BUILT_IN_ACTIONS = new Set([
    "SET_STATE",
    "MUTATE_STATE",
    "TOGGLE_STATE",
    "REVALIDATE_API",
    "RUN_SCRIPT",
    "RESET_STATE",
    "NAVIGATE",
    "EMIT",
    "FOCUS",
    "TOAST",
    "ALERT",
    "CONFIRM",
]);

/**
 * Resolves all symbol references across states, actions, computed properties,
 * watchers, and bindings. Emits structured diagnostics for any unresolved symbols.
 *
 * @param {import('./symbolTable.js').SymbolTable} symbolTable
 * @param {object} [options={}]
 * @param {string} [options.file="source.euix"]
 * @returns {Array<import('../validator/diagnostics.js').Diagnostic>}
 */
export function resolveReferences(symbolTable, options = {}) {
    const diagnostics = [];
    const fileName = options.file || "source.euix";

    const stateNames = Array.from(symbolTable.states.keys());
    const actionNames = Array.from(symbolTable.actions.keys());
    const computedNames = Array.from(symbolTable.computed.keys());
    const propNames = Array.from(symbolTable.props);
    const validValueNames = [...stateNames, ...computedNames, ...propNames];

    // 1. Resolve Bindings
    for (const binding of symbolTable.bindings) {
        if (binding.type === "event") {
            const actionName = binding.target;
            if (!actionName) continue;

            const isBuiltIn = BUILT_IN_ACTIONS.has(actionName.toUpperCase());
            if (!isBuiltIn && !symbolTable.hasAction(actionName)) {
                const suggestion = findClosestMatch(actionName, actionNames);
                diagnostics.push(
                    createDiagnostic({
                        code: DIAGNOSTIC_CODES.UNKNOWN_ACTION || "UNKNOWN_ACTION",
                        type: "unknown-action",
                        name: actionName,
                        nodeId: binding.nodeId,
                        file: fileName,
                        path: binding.path,
                        line: binding.line,
                        column: binding.column,
                        message: `Unknown action "${actionName}" referenced in event binding.${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
                        suggestion: suggestion ? `Declare action "${actionName}" or use "${suggestion}".` : `Declare action "${actionName}".`,
                        severity: "error",
                    }),
                );
            }
        } else {
            // State / Prop / Computed binding
            const targetName = binding.target;
            if (!targetName) continue;

            // Strip array indices: items[0] -> items
            const rootTarget = targetName.split(".")[0].split("[")[0];

            if (!symbolTable.hasStateOrValue(rootTarget)) {
                const suggestion = findClosestMatch(rootTarget, validValueNames);
                diagnostics.push(
                    createDiagnostic({
                        code: DIAGNOSTIC_CODES.UNKNOWN_STATE || "UNKNOWN_STATE",
                        type: "unknown-state",
                        name: rootTarget,
                        nodeId: binding.nodeId,
                        file: fileName,
                        path: binding.path,
                        line: binding.line,
                        column: binding.column,
                        expression: targetName,
                        message: `Unknown state "${rootTarget}" referenced in binding.${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
                        suggestion: suggestion ? `Define <state id="${rootTarget}"> or use "${suggestion}".` : `Define <state id="${rootTarget}">.`,
                        severity: "error",
                    }),
                );
            }
        }
    }

    // 2. Resolve Action Writes & Reads
    for (const [actionName, action] of symbolTable.actions.entries()) {
        // Check state writes: Must target declared state
        for (const writtenState of action.writes) {
            if (!symbolTable.states.has(writtenState)) {
                const suggestion = findClosestMatch(writtenState, stateNames);
                diagnostics.push(
                    createDiagnostic({
                        code: DIAGNOSTIC_CODES.INVALID_WRITE || "INVALID_WRITE",
                        type: "invalid-write",
                        name: writtenState,
                        file: fileName,
                        path: `actions.${actionName}`,
                        line: action.line,
                        column: action.column,
                        message: `Action "${actionName}" writes to undeclared state "${writtenState}".${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
                        suggestion: suggestion ? `Define <state id="${writtenState}"> or write to "${suggestion}".` : `Define <state id="${writtenState}"> in <data_model>.`,
                        severity: "error",
                    }),
                );
            }
        }

        // Check state reads
        for (const readSymbol of action.reads) {
            if (!symbolTable.hasStateOrValue(readSymbol)) {
                const suggestion = findClosestMatch(readSymbol, validValueNames);
                diagnostics.push(
                    createDiagnostic({
                        code: DIAGNOSTIC_CODES.UNRESOLVED_REFERENCE || "UNRESOLVED_REFERENCE",
                        type: "unresolved-reference",
                        name: readSymbol,
                        file: fileName,
                        path: `actions.${actionName}`,
                        line: action.line,
                        column: action.column,
                        message: `Action "${actionName}" reads undeclared symbol "${readSymbol}".${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
                        suggestion: suggestion ? `Did you mean "${suggestion}"?` : null,
                        severity: "error",
                    }),
                );
            }
        }
    }

    // 3. Resolve Computed Dependencies
    for (const [compName, comp] of symbolTable.computed.entries()) {
        for (const dep of comp.deps) {
            if (!symbolTable.hasStateOrValue(dep)) {
                const suggestion = findClosestMatch(dep, validValueNames);
                diagnostics.push(
                    createDiagnostic({
                        code: DIAGNOSTIC_CODES.UNKNOWN_COMPUTED || "UNKNOWN_COMPUTED",
                        type: "unknown-computed-dependency",
                        name: dep,
                        file: fileName,
                        path: `computed.${compName}`,
                        line: comp.line,
                        column: comp.column,
                        message: `Computed property "${compName}" references undeclared dependency "${dep}".${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
                        suggestion: suggestion ? `Did you mean "${suggestion}"?` : null,
                        severity: "error",
                    }),
                );
            }
        }
    }

    // 4. Resolve Watchers
    for (const [wTarget, watcher] of symbolTable.watchers.entries()) {
        const cleanTarget = wTarget.replace(/^(?:data\.|\$data\.)/, "");
        const isApiRef = cleanTarget.startsWith("api.") || cleanTarget.startsWith("$api.");

        if (!isApiRef && !symbolTable.hasStateOrValue(cleanTarget)) {
            const suggestion = findClosestMatch(cleanTarget, validValueNames);
            diagnostics.push(
                createDiagnostic({
                    code: DIAGNOSTIC_CODES.UNKNOWN_STATE || "UNKNOWN_STATE",
                    type: "unknown-watched-state",
                    name: cleanTarget,
                    file: fileName,
                    path: `watch.${wTarget}`,
                    line: watcher.line,
                    column: watcher.column,
                    message: `Watcher targets unknown state "${cleanTarget}".${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
                    suggestion: suggestion ? `Did you mean "${suggestion}"?` : null,
                    severity: "error",
                }),
            );
        }

        if (watcher.action) {
            const isBuiltIn = BUILT_IN_ACTIONS.has(watcher.action.toUpperCase());
            if (!isBuiltIn && !symbolTable.hasAction(watcher.action)) {
                const suggestion = findClosestMatch(watcher.action, actionNames);
                diagnostics.push(
                    createDiagnostic({
                        code: DIAGNOSTIC_CODES.UNKNOWN_ACTION || "UNKNOWN_ACTION",
                        type: "unknown-watcher-action",
                        name: watcher.action,
                        file: fileName,
                        path: `watch.${wTarget}`,
                        line: watcher.line,
                        column: watcher.column,
                        message: `Watcher on "${wTarget}" references undefined action "${watcher.action}".${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
                        suggestion: suggestion ? `Did you mean "${suggestion}"?` : null,
                        severity: "error",
                    }),
                );
            } else {
                // Check if action mutates the watched target -> causes infinite watcher cycle
                const actionDef = symbolTable.actions.get(watcher.action);
                if (actionDef && actionDef.writes.has(cleanTarget)) {
                    diagnostics.push(
                        createDiagnostic({
                            code: DIAGNOSTIC_CODES.CIRCULAR_WATCH || "CIRCULAR_WATCH",
                            type: "watcher-self-loop",
                            name: cleanTarget,
                            file: fileName,
                            path: `watch.${wTarget}`,
                            message: `Watcher on "${wTarget}" triggers action "${watcher.action}" which mutates "${cleanTarget}", creating an infinite loop.`,
                            severity: "error",
                        }),
                    );
                }
            }
        }
    }

    // 5. Detect Unused States & Actions
    for (const [stName, st] of symbolTable.states.entries()) {
        if (st.reads.size === 0 && st.writes.size === 0) {
            diagnostics.push(
                createDiagnostic({
                    code: DIAGNOSTIC_CODES.UNUSED_STATE || "UNUSED_STATE",
                    type: "unused-state",
                    name: stName,
                    file: fileName,
                    path: `state.${stName}`,
                    message: `State variable "${stName}" is declared in state but never read, written, bound, or watched.`,
                    severity: "info",
                }),
            );
        }
    }

    for (const [actName, act] of symbolTable.actions.entries()) {
        const isTriggered = symbolTable.bindings.some((b) => b.type === "event" && b.target === actName) ||
            Array.from(symbolTable.watchers.values()).some((w) => w.action === actName);

        if (!isTriggered) {
            diagnostics.push(
                createDiagnostic({
                    code: DIAGNOSTIC_CODES.UNUSED_ACTION || "UNUSED_ACTION",
                    type: "unused-action",
                    name: actName,
                    file: fileName,
                    path: `actions.${actName}`,
                    message: `Action "${actName}" is defined but never referenced in any event or watcher.`,
                    severity: "info",
                }),
            );
        }
    }

    return diagnostics;
}
