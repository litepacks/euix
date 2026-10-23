/**
 * packages/core/src/prepare/runtime/feedback.js
 * Runtime Feedback Collector for EUIX.
 * Converts execution errors (action failure, state write failure, computed failure)
 * into standardized machine-readable diagnostics for the AI repair loop.
 */

import { createDiagnostic, DIAGNOSTIC_CODES } from "../validator/diagnostics.js";

export class RuntimeFeedbackCollector {
    constructor() {
        /** @type {Array<import('../validator/diagnostics.js').Diagnostic>} */
        this.diagnostics = [];
    }

    /**
     * Records an action execution failure.
     * @param {string} actionName
     * @param {Error|string} error
     * @param {object} [context={}]
     */
    recordActionFailure(actionName, error, context = {}) {
        const message = error instanceof Error ? error.message : String(error);
        this.diagnostics.push(
            createDiagnostic({
                code: DIAGNOSTIC_CODES.ACTION_EXECUTION_FAILED || "ACTION_EXECUTION_FAILED",
                type: "action-execution-failed",
                name: actionName,
                path: context.path || `actions.${actionName}`,
                message: `Runtime failure during execution of action "${actionName}": ${message}`,
                severity: "error",
                suggestion: `Verify action "${actionName}" arguments and state reads/writes.`,
            }),
        );
    }

    /**
     * Records a state write failure.
     * @param {string} statePath
     * @param {Error|string} error
     */
    recordStateWriteFailure(statePath, error) {
        const message = error instanceof Error ? error.message : String(error);
        this.diagnostics.push(
            createDiagnostic({
                code: DIAGNOSTIC_CODES.STATE_WRITE_FAILED || "STATE_WRITE_FAILED",
                type: "state-write-failed",
                name: statePath,
                path: `state.${statePath}`,
                message: `Failed to write state "${statePath}": ${message}`,
                severity: "error",
            }),
        );
    }

    /**
     * Records a computed evaluation failure.
     * @param {string} computedName
     * @param {Error|string} error
     */
    recordComputedFailure(computedName, error) {
        const message = error instanceof Error ? error.message : String(error);
        this.diagnostics.push(
            createDiagnostic({
                code: DIAGNOSTIC_CODES.COMPUTED_FAILED || "COMPUTED_FAILED",
                type: "computed-failed",
                name: computedName,
                path: `computed.${computedName}`,
                message: `Runtime failure evaluating computed "${computedName}": ${message}`,
                severity: "error",
            }),
        );
    }

    /**
     * Records a binding evaluation failure.
     * @param {string} bindingTarget
     * @param {Error|string} error
     * @param {string} [nodeId]
     */
    recordBindingFailure(bindingTarget, error, nodeId = null) {
        const message = error instanceof Error ? error.message : String(error);
        this.diagnostics.push(
            createDiagnostic({
                code: DIAGNOSTIC_CODES.BINDING_FAILED || "BINDING_FAILED",
                type: "binding-failed",
                name: bindingTarget,
                nodeId,
                message: `Failed to evaluate binding "${bindingTarget}": ${message}`,
                severity: "error",
            }),
        );
    }

    /**
     * Returns all collected runtime diagnostics.
     * @returns {Array<import('../validator/diagnostics.js').Diagnostic>}
     */
    getDiagnostics() {
        return [...this.diagnostics];
    }

    /**
     * Clears all recorded diagnostics.
     */
    clear() {
        this.diagnostics = [];
    }
}
