/**
 * packages/core/src/prepare/ai/devLoop.js
 * End-to-End AI-Assisted EUIX Development Loop.
 *
 * Implements:
 *   User Intent → Plan → Skeleton → State → Actions → Bindings
 *   → Analyze → Compile → Render → Observe → Semantic Patch → Re-analyze
 *
 * Guarantees:
 *   - Rollback to LAST_KNOWN_GOOD on invalid patches
 *   - Iteration limit to prevent infinite repair loops
 *   - Minimal targeted AI context
 *   - Pre-runtime deterministic validation
 */

import { analyzeSource } from "../analyzer/index.js";
import { normalizeToRuntimeIR } from "../normalizer/index.js";
import { renderToString } from "../runtime/ssr.js";
import { CheckpointManager } from "../checkpoint/lastKnownGood.js";
import { autoRepairSource } from "./repairEngine.js";
import { buildTargetedRepairContext } from "./contextBuilder.js";
import { printCanonicalXml, printCanonicalJson } from "../printer/canonicalPrinter.js";
import { RuntimeFeedbackCollector } from "../runtime/feedback.js";

/**
 * Runs the deterministic AI development loop.
 *
 * @param {object} options
 * @param {string} [options.prompt] - User prompt
 * @param {object|string} [options.source] - Initial source if editing existing code
 * @param {Function} [options.aiRepairHandler] - Optional async callback to request semantic patches from LLM: (context) => Promise<patches[]>
 * @param {number} [options.maxIterations=5] - Maximum repair loop iterations
 * @param {boolean} [options.allowProbable=true] - Whether to auto-apply PROBABLE inferences
 * @param {boolean} [options.autoApplySafe=true] - Whether to auto-apply SAFE syntax repairs
 * @returns {Promise<object>} Complete development loop result
 */
export async function runDevelopmentLoop(options = {}) {
    const maxIterations = options.maxIterations || 5;
    const allowProbable = options.allowProbable !== false;
    const feedback = new RuntimeFeedbackCollector();
    const history = [];

    let currentSource = options.source || null;

    // Parse string if needed
    if (typeof currentSource === "string") {
        const analyzed = await analyzeSource(currentSource);
        currentSource = analyzed.source;
    }

    if (!currentSource) {
        currentSource = {
            version: 1,
            state: {},
            actions: {},
            view: { tag: "div", children: [] },
        };
    }

    const checkpointManager = new CheckpointManager(currentSource, { note: "Initial Input" });

    let iteration = 0;
    let isSuccessful = false;
    let finalIr = null;
    let finalHtml = "";
    let finalAnalysis = null;

    while (iteration < maxIterations) {
        iteration++;
        const iterRecord = { iteration, patchesApplied: [], diagnosticsBefore: [], diagnosticsAfter: [] };

        // 1. Analyze
        finalAnalysis = await analyzeSource(currentSource, { includeUnused: false });
        iterRecord.diagnosticsBefore = [...finalAnalysis.diagnostics];

        // 2. Auto-repair SAFE and PROBABLE diagnostics first
        if (options.autoApplySafe !== false && finalAnalysis.errors.length > 0) {
            const repairResult = autoRepairSource(
                currentSource,
                finalAnalysis.errors,
                finalAnalysis.symbolTable,
                { allowProbable }
            );

            if (repairResult.appliedPatches.length > 0) {
                currentSource = repairResult.repairedSource;
                iterRecord.patchesApplied.push(...repairResult.appliedPatches);
                // Re-analyze after deterministic local repairs
                finalAnalysis = await analyzeSource(currentSource, { includeUnused: false });
            }
        }

        // 3. If errors remain and an AI repair handler is provided, query targeted repair patches
        if (finalAnalysis.errors.length > 0 && typeof options.aiRepairHandler === "function") {
            const blockingError = finalAnalysis.errors[0];
            const targetedContext = buildTargetedRepairContext(
                blockingError,
                currentSource,
                finalAnalysis.symbolTable,
                finalAnalysis.dependencyGraph
            );

            try {
                const proposedPatches = await options.aiRepairHandler(targetedContext);
                if (Array.isArray(proposedPatches) && proposedPatches.length > 0) {
                    const verifyRes = await checkpointManager.proposeAndVerify(
                        proposedPatches,
                        async (patchedSource) => analyzeSource(patchedSource)
                    );

                    if (verifyRes.accepted) {
                        currentSource = verifyRes.checkpoint.source;
                        iterRecord.patchesApplied.push(...proposedPatches);
                        finalAnalysis = await analyzeSource(currentSource);
                    } else {
                        iterRecord.rejectedPatches = proposedPatches;
                        iterRecord.rejectionReason = verifyRes.reason;
                    }
                }
            } catch (err) {
                iterRecord.handlerError = err.message;
            }
        }

        iterRecord.diagnosticsAfter = [...finalAnalysis.diagnostics];
        history.push(iterRecord);

        // 4. Check if blocking diagnostics still exist
        if (finalAnalysis.errors.length > 0) {
            continue; // Retry next iteration
        }

        // 5. Compile to Runtime IR
        try {
            finalIr = normalizeToRuntimeIR(currentSource);
        } catch (err) {
            feedback.recordBindingFailure("RuntimeIR", err);
            continue;
        }

        // 6. Render Check (SSR / DOM)
        try {
            finalHtml = renderToString(currentSource, currentSource.state || {});
        } catch (err) {
            feedback.recordBindingFailure("SSR", err);
            continue;
        }

        // 7. Success! Commit checkpoint and break
        checkpointManager.commitCheckpoint(currentSource, { iteration, note: "Validated & Rendered" });
        isSuccessful = true;
        break;
    }

    return {
        success: isSuccessful,
        iterationsRun: iteration,
        maxIterationsReached: iteration >= maxIterations && !isSuccessful,
        source: currentSource,
        xml: printCanonicalXml(currentSource),
        json: printCanonicalJson(currentSource),
        ir: finalIr,
        html: finalHtml,
        diagnostics: finalAnalysis?.diagnostics || [],
        errors: finalAnalysis?.errors || [],
        symbolTable: finalAnalysis?.symbolTable || null,
        dependencyGraph: finalAnalysis?.dependencyGraph || null,
        checkpointManager,
        audit: checkpointManager.getAuditReport(),
        history,
    };
}
