/**
 * packages/core/src/prepare/checkpoint/lastKnownGood.js
 * Checkpoint and Rollback Protection Manager for EUIX AI Development Loop.
 * Maintains LAST_KNOWN_GOOD states and rejects broken AI patches to prevent regressions.
 */

import { applySemanticPatches, deepClone } from "../patch/semanticPatch.js";

/**
 * Checkpoint representation.
 * @typedef {Object} Checkpoint
 * @property {number} version - Monotonically increasing version number
 * @property {string} id - Identifier (e.g. "v17")
 * @property {object} source - Canonical EUIX source
 * @property {number} timestamp - Millisecond epoch
 * @property {object} metadata - Optional notes, patches applied, or stats
 */

export class CheckpointManager {
    /**
     * @param {object} [initialSource=null]
     * @param {object} [initialMetadata={}]
     */
    constructor(initialSource = null, initialMetadata = {}) {
        /** @type {Checkpoint[]} */
        this.checkpoints = [];

        /** @type {Checkpoint|null} */
        this.lastKnownGood = null;

        /** @type {Checkpoint|null} */
        this.current = null;

        /** @type {Array<{ proposedVersion: number, patches: object[], reason: string, diagnostics: object[], timestamp: number }>} */
        this.rejectionLog = [];

        this.versionCounter = 0;

        if (initialSource) {
            this.commitCheckpoint(initialSource, initialMetadata);
        }
    }

    /**
     * Commits a validated, working source as a new verified checkpoint (LAST_KNOWN_GOOD).
     *
     * @param {object} source
     * @param {object} [metadata={}]
     * @returns {Checkpoint}
     */
    commitCheckpoint(source, metadata = {}) {
        this.versionCounter++;
        const version = this.versionCounter;
        const checkpoint = {
            version,
            id: `v${version}`,
            source: deepClone(source),
            timestamp: Date.now(),
            metadata: { ...metadata },
        };

        this.checkpoints.push(checkpoint);
        this.lastKnownGood = checkpoint;
        this.current = checkpoint;

        return checkpoint;
    }

    /**
     * Proposes a set of semantic patches against the current LAST_KNOWN_GOOD state.
     * Evaluates them through a validation function. If validation fails or produces errors,
     * the patches are rejected, the state rolls back to LAST_KNOWN_GOOD, and rejection
     * metadata is stored.
     *
     * @param {Array<object>} patches - List of semantic patch operations
     * @param {Function} validateFn - Async or sync validator returning { isValid: boolean, diagnostics: Array }
     * @param {object} [metadata={}]
     * @returns {Promise<{ accepted: boolean, checkpoint?: Checkpoint, reason?: string, diagnostics?: Array, error?: string }>}
     */
    async proposeAndVerify(patches, validateFn, metadata = {}) {
        const baseSource = this.lastKnownGood ? this.lastKnownGood.source : (this.current ? this.current.source : {});
        const proposedVersion = this.versionCounter + 1;

        // 1. Apply semantic patches
        const patchResult = applySemanticPatches(baseSource, patches);
        if (!patchResult.success) {
            const rejection = {
                proposedVersion,
                patches,
                reason: "PATCH_EXECUTION_FAILED",
                error: patchResult.error,
                diagnostics: [],
                timestamp: Date.now(),
            };
            this.rejectionLog.push(rejection);
            return {
                accepted: false,
                reason: "PATCH_EXECUTION_FAILED",
                error: patchResult.error,
                rejection,
            };
        }

        const candidateSource = patchResult.source;

        // 2. Validate semantics
        let validationResult;
        try {
            validationResult = await validateFn(candidateSource);
        } catch (err) {
            validationResult = { isValid: false, diagnostics: [{ code: "VALIDATION_CRASH", message: err.message, severity: "error" }] };
        }

        const isValid = validationResult?.isValid ?? (validationResult?.errors?.length === 0);
        const diagnostics = validationResult?.diagnostics || validationResult?.errors || [];

        // 3. Reject if invalid
        if (!isValid) {
            const rejection = {
                proposedVersion,
                patches,
                reason: "SEMANTIC_VALIDATION_FAILED",
                diagnostics,
                timestamp: Date.now(),
            };
            this.rejectionLog.push(rejection);

            // Retain last known good
            this.current = this.lastKnownGood;

            return {
                accepted: false,
                reason: "SEMANTIC_VALIDATION_FAILED",
                diagnostics,
                rejection,
            };
        }

        // 4. Accept and commit new checkpoint
        const newCheckpoint = this.commitCheckpoint(candidateSource, {
            ...metadata,
            patchesApplied: patches.length,
            patches,
        });

        return {
            accepted: true,
            checkpoint: newCheckpoint,
            diagnostics,
        };
    }

    /**
     * Explicitly rolls back current state to LAST_KNOWN_GOOD.
     * @returns {Checkpoint|null}
     */
    rollbackToLastKnownGood() {
        this.current = this.lastKnownGood ? deepClone(this.lastKnownGood) : null;
        return this.current;
    }

    /**
     * Returns full checkpoint audit history.
     * @returns {object}
     */
    getAuditReport() {
        return {
            totalCheckpoints: this.checkpoints.length,
            currentVersion: this.current?.id || null,
            lastKnownGoodVersion: this.lastKnownGood?.id || null,
            rejectionsCount: this.rejectionLog.length,
            rejections: this.rejectionLog,
            history: this.checkpoints.map((c) => ({
                id: c.id,
                version: c.version,
                timestamp: c.timestamp,
                metadata: c.metadata,
            })),
        };
    }
}
