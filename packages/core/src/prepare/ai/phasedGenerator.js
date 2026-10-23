/**
 * packages/core/src/prepare/ai/phasedGenerator.js
 * Multi-Phase AI Generation Orchestrator for EUIX.
 *
 * Enforces explicit separation of concerns:
 *   PLAN → SKELETON → STATE → ACTIONS → BINDINGS → COMPILE → RENDER
 * Each phase produces a small artifact validated before proceeding to the next.
 */

import { analyzeSource } from "../analyzer/index.js";
import { normalizeToRuntimeIR } from "../normalizer/index.js";
import { renderToString } from "../runtime/ssr.js";
import { CheckpointManager } from "../checkpoint/lastKnownGood.js";
import { printCanonicalXml, printCanonicalJson } from "../printer/canonicalPrinter.js";

export const GENERATION_PHASES = {
    PLAN: "PLAN",
    SKELETON: "SKELETON",
    STATE: "STATE",
    ACTIONS: "ACTIONS",
    BINDINGS: "BINDINGS",
    COMPILE: "COMPILE",
    RENDER: "RENDER",
};

/**
 * Result of executing a generation phase.
 * @typedef {Object} PhaseResult
 * @property {string} phase - Phase name
 * @property {boolean} success - Whether this phase passed validation
 * @property {object} artifact - Output artifact of this phase
 * @property {Array<import('../validator/diagnostics.js').Diagnostic>} diagnostics - Diagnostics emitted
 * @property {string|null} stopReason - Reason if phase execution halted
 */

export class PhasedGenerationPipeline {
    /**
     * @param {object} [options={}]
     */
    constructor(options = {}) {
        this.options = options;
        this.currentPhase = null;
        this.checkpointManager = new CheckpointManager();
        this.phaseArtifacts = new Map();
        this.history = [];
    }

    /**
     * Executes the PLAN phase.
     * Extracts required UI structure, states, and actions from a user prompt.
     *
     * @param {string|object} planSpec - Structured plan or user intent
     * @returns {PhaseResult}
     */
    stepPlan(planSpec) {
        this.currentPhase = GENERATION_PHASES.PLAN;

        let plan = planSpec;
        if (typeof planSpec === "string") {
            plan = {
                intent: planSpec,
                statesNeeded: [],
                actionsNeeded: [],
                uiBlocks: [],
            };
        }

        const diagnostics = [];
        if (!plan || typeof plan !== "object") {
            diagnostics.push({
                code: "INVALID_PLAN",
                message: "Plan must be a non-null specification object.",
                severity: "error",
            });
        }

        const success = diagnostics.length === 0;
        const result = {
            phase: GENERATION_PHASES.PLAN,
            success,
            artifact: plan,
            diagnostics,
            stopReason: success ? null : "Plan specification failed validation",
        };

        this.phaseArtifacts.set(GENERATION_PHASES.PLAN, plan);
        this.history.push(result);
        return result;
    }

    /**
     * Executes the SKELETON phase.
     * Builds and validates the layout view tree without unhooked handlers.
     *
     * @param {object} viewTree - Canonical view node tree
     * @returns {Promise<PhaseResult>}
     */
    async stepSkeleton(viewTree) {
        this.currentPhase = GENERATION_PHASES.SKELETON;

        const candidateSource = {
            version: 1,
            state: {},
            actions: {},
            view: viewTree,
        };

        const analysis = await analyzeSource(candidateSource, { file: "skeleton.euix" });
        // In skeleton phase, UNKNOWN_STATE / UNKNOWN_ACTION in view are tolerated as warnings,
        // but schema or structural syntax errors halt the pipeline.
        const structuralErrors = analysis.diagnostics.filter(
            (d) => d.code === "EUIX200" || d.code === "UNCLOSED_EXPRESSION" || d.code === "MALFORMED_EXPRESSION"
        );

        const success = structuralErrors.length === 0;
        const result = {
            phase: GENERATION_PHASES.SKELETON,
            success,
            artifact: viewTree,
            diagnostics: structuralErrors,
            stopReason: success ? null : "Skeleton contains structural or expression syntax errors",
        };

        if (success) {
            this.phaseArtifacts.set(GENERATION_PHASES.SKELETON, viewTree);
        }
        this.history.push(result);
        return result;
    }

    /**
     * Executes the STATE phase.
     * Integrates and validates the data model against the skeleton.
     *
     * @param {object} stateModel - Map of state keys to initial values
     * @returns {Promise<PhaseResult>}
     */
    async stepState(stateModel) {
        this.currentPhase = GENERATION_PHASES.STATE;

        const skeleton = this.phaseArtifacts.get(GENERATION_PHASES.SKELETON) || null;
        const candidateSource = {
            version: 1,
            state: stateModel || {},
            actions: {},
            view: skeleton,
        };

        const analysis = await analyzeSource(candidateSource, { file: "state.euix" });
        const stateErrors = analysis.diagnostics.filter(
            (d) => d.code === "EUIX214" || d.code === "DUPLICATE_STATE" || d.path?.startsWith("state")
        );

        const success = stateErrors.length === 0;
        const result = {
            phase: GENERATION_PHASES.STATE,
            success,
            artifact: stateModel,
            diagnostics: stateErrors,
            stopReason: success ? null : "State declarations contain duplicate identifiers or schema errors",
        };

        if (success) {
            this.phaseArtifacts.set(GENERATION_PHASES.STATE, stateModel);
        }
        this.history.push(result);
        return result;
    }

    /**
     * Executes the ACTIONS phase.
     * Integrates and validates action definitions ensuring every write targets a valid state.
     *
     * @param {object} actionsModel - Map of action names to action definitions
     * @returns {Promise<PhaseResult>}
     */
    async stepActions(actionsModel) {
        this.currentPhase = GENERATION_PHASES.ACTIONS;

        const skeleton = this.phaseArtifacts.get(GENERATION_PHASES.SKELETON) || null;
        const state = this.phaseArtifacts.get(GENERATION_PHASES.STATE) || {};
        const candidateSource = {
            version: 1,
            state,
            actions: actionsModel || {},
            view: skeleton,
        };

        const analysis = await analyzeSource(candidateSource, { file: "actions.euix" });
        const actionErrors = analysis.diagnostics.filter(
            (d) => d.code === "EUIX216" || d.code === "INVALID_WRITE" || d.code === "EUIX215" || d.code === "DUPLICATE_ACTION"
        );

        const success = actionErrors.length === 0;
        const result = {
            phase: GENERATION_PHASES.ACTIONS,
            success,
            artifact: actionsModel,
            diagnostics: actionErrors,
            stopReason: success ? null : "Action definitions write to undeclared states or contain duplicate names",
        };

        if (success) {
            this.phaseArtifacts.set(GENERATION_PHASES.ACTIONS, actionsModel);
        }
        this.history.push(result);
        return result;
    }

    /**
     * Executes the BINDINGS phase.
     * Integrates all pieces into a complete application and validates all references.
     *
     * @param {object} completeSource - Complete source containing state, actions, and wired view
     * @returns {Promise<PhaseResult>}
     */
    async stepBindings(completeSource) {
        this.currentPhase = GENERATION_PHASES.BINDINGS;

        const analysis = await analyzeSource(completeSource, { file: "app.euix" });
        const blockingErrors = analysis.errors;

        const success = blockingErrors.length === 0;
        const result = {
            phase: GENERATION_PHASES.BINDINGS,
            success,
            artifact: completeSource,
            diagnostics: analysis.diagnostics,
            stopReason: success ? null : `Validation halted with ${blockingErrors.length} blocking error(s)`,
        };

        if (success) {
            this.phaseArtifacts.set(GENERATION_PHASES.BINDINGS, completeSource);
            this.checkpointManager.commitCheckpoint(completeSource, { phase: "BINDINGS_VERIFIED" });
        }
        this.history.push(result);
        return result;
    }

    /**
     * Compiles the verified application into deterministic Runtime IR.
     * @returns {PhaseResult}
     */
    stepCompile() {
        this.currentPhase = GENERATION_PHASES.COMPILE;
        const source = this.checkpointManager.lastKnownGood?.source || this.phaseArtifacts.get(GENERATION_PHASES.BINDINGS);

        if (!source) {
            return {
                phase: GENERATION_PHASES.COMPILE,
                success: false,
                artifact: null,
                diagnostics: [{ code: "MISSING_SOURCE", message: "Cannot compile without verified source", severity: "error" }],
                stopReason: "Missing source",
            };
        }

        try {
            const ir = normalizeToRuntimeIR(source);
            const result = {
                phase: GENERATION_PHASES.COMPILE,
                success: true,
                artifact: ir,
                diagnostics: [],
                stopReason: null,
            };
            this.phaseArtifacts.set(GENERATION_PHASES.COMPILE, ir);
            this.history.push(result);
            return result;
        } catch (err) {
            const result = {
                phase: GENERATION_PHASES.COMPILE,
                success: false,
                artifact: null,
                diagnostics: [{ code: "COMPILE_ERROR", message: err.message, severity: "error" }],
                stopReason: err.message,
            };
            this.history.push(result);
            return result;
        }
    }

    /**
     * Server-side renders the application to verify render tree integrity without DOM errors.
     * @returns {PhaseResult}
     */
    stepRender() {
        this.currentPhase = GENERATION_PHASES.RENDER;
        const source = this.checkpointManager.lastKnownGood?.source || this.phaseArtifacts.get(GENERATION_PHASES.BINDINGS);

        if (!source) {
            return {
                phase: GENERATION_PHASES.RENDER,
                success: false,
                artifact: null,
                diagnostics: [{ code: "MISSING_SOURCE", message: "Cannot render without source", severity: "error" }],
                stopReason: "Missing source",
            };
        }

        try {
            const html = renderToString(source, source.state || {});
            const result = {
                phase: GENERATION_PHASES.RENDER,
                success: true,
                artifact: { html },
                diagnostics: [],
                stopReason: null,
            };
            this.phaseArtifacts.set(GENERATION_PHASES.RENDER, html);
            this.history.push(result);
            return result;
        } catch (err) {
            const result = {
                phase: GENERATION_PHASES.RENDER,
                success: false,
                artifact: null,
                diagnostics: [{ code: "RENDER_ERROR", message: err.message, severity: "error" }],
                stopReason: err.message,
            };
            this.history.push(result);
            return result;
        }
    }
}
