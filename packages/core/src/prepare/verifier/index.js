/**
 * packages/core/src/prepare/verifier/index.js
 * In-memory verifier and repair prompt generator for LLM agent loops ("Doctor in the Loop").
 * Validates generated EUIX code in milliseconds without real DOM or network overhead.
 */

import { validateSource, analyzeSource } from "../index.js";
import { applyFixes } from "../fixer/index.js";
import { generateLlmContext } from "../context/index.js";
import { autoRepairSource } from "../ai/repairEngine.js";

/**
 * Strips markdown code block fences (```json ... ``` or ```xml ... ```) from LLM output.
 *
 * @param {string} text
 * @returns {string} Cleaned code string
 */
export function stripMarkdownFences(text) {
    if (typeof text !== "string") return text;
    const trimmed = text.trim();
    const codeBlockMatch = trimmed.match(/^```(?:json|xml|html|euix)?\s*([\s\S]*?)\s*```$/i);
    if (codeBlockMatch) {
        return codeBlockMatch[1].trim();
    }
    return trimmed;
}

/**
 * Formats a structured, high-context repair prompt from diagnostics for LLM self-correction.
 *
 * @param {Array<import('../validator/diagnostics.js').Diagnostic>} diagnostics
 * @param {object} [options={}]
 * @param {string[]} [options.allowedStates=[]]
 * @param {string[]} [options.allowedActions=[]]
 * @param {string[]} [options.allowedComponents=[]]
 * @param {string[]} [options.allowedRoutes=[]]
 * @returns {string} Prompt string to feed back to the LLM
 */
export function formatLlmRepairPrompt(diagnostics, options = {}) {
    const errors = diagnostics.filter((d) => d.severity === "error");
    if (errors.length === 0) return "";

    const lines = [
        "The generated EUIX code contains the following validation errors that must be corrected:",
        "",
    ];

    errors.forEach((err, idx) => {
        const pathInfo = err.path ? ` at "${err.path}"` : "";
        lines.push(`${idx + 1}. [${err.code || "EUIX_ERROR"}] ${err.message}${pathInfo}`);
        if (err.suggestion) {
            lines.push(`   💡 Suggestion: Did you mean "${err.suggestion}"?`);
        }
        if (err.code === "EUIX0001" || err.type === "xml-script-cdata") {
            lines.push("   💡 Rule EUIX0001: Inline JavaScript inside <computed> or <step> containing comparison/logical operators (<, >, &, <=, >=, &&, ||) must be wrapped in <![CDATA[ ... ]]>.");
        }
    });

    // Append context regarding known valid entities if available
    const contextSections = [];
    if (options.allowedStates && options.allowedStates.length > 0) {
        contextSections.push(`- Available States: [${options.allowedStates.join(", ")}]`);
    }
    if (options.allowedActions && options.allowedActions.length > 0) {
        contextSections.push(`- Available Actions: [${options.allowedActions.join(", ")}]`);
    }
    if (options.allowedComponents && options.allowedComponents.length > 0) {
        contextSections.push(`- Available Components: [${options.allowedComponents.join(", ")}]`);
    }
    if (options.allowedRoutes && options.allowedRoutes.length > 0) {
        contextSections.push(`- Available Routes: [${options.allowedRoutes.join(", ")}]`);
    }

    if (contextSections.length > 0) {
        lines.push("");
        lines.push("Known Valid Entities in Project:");
        lines.push(...contextSections);
    }

    lines.push("");
    lines.push("Please output the corrected EUIX specification adhering strictly to these rules.");

    return lines.join("\n");
}

/**
 * Programmatically validates LLM-generated code or JSON in-memory with automatic self-repair capabilities.
 *
 * @param {string|object} llmOutput - Raw output from LLM (JSON object, JSON string, or XML string, with or without markdown fences)
 * @param {object} [options={}]
 * @param {boolean} [options.autoFix=true] - Whether to attempt automatic fuzzy and syntax repairs
 * @param {string} [options.projectPath] - Path to scan for project context (states, actions, components)
 * @param {string[]} [options.allowedStates]
 * @param {string[]} [options.allowedActions]
 * @param {string[]} [options.allowedComponents]
 * @param {string[]} [options.allowedRoutes]
 * @param {string} [options.currentFile="generated.euix"]
 * @returns {Promise<object>} Verification result with diagnostics, auto-fix results, and feedback prompt
 */
export async function verifyLlmOutput(llmOutput, options = {}) {
    const startTime = performance.now();
    const currentFile = options.currentFile || "generated.euix";
    const autoFix = options.autoFix !== false;

    let rawSource = llmOutput;
    if (typeof rawSource === "string") {
        rawSource = stripMarkdownFences(rawSource);
    }

    let currentSource = rawSource;
    let fixesApplied = [];
    let modified = false;

    // 1. Optionally apply auto-fixer first
    if (autoFix) {
        const fixResult = await applyFixes(currentSource, null, { currentFile });
        if (fixResult.modified) {
            currentSource = fixResult.fixedSource;
            fixesApplied = fixResult.fixesApplied;
            modified = true;
        }
    }

    // 2. Validate current source using unified analyzer
    let analysis = await analyzeSource(currentSource, { file: currentFile });
    
    // 3. Auto-repair SAFE issues if autoFix is enabled
    if (autoFix && analysis.errors.length > 0) {
        const repairRes = autoRepairSource(analysis.source || currentSource, analysis.errors, analysis.symbolTable, { allowProbable: false });
        if (repairRes.appliedPatches.length > 0) {
            currentSource = repairRes.repairedSource;
            modified = true;
            for (const p of repairRes.appliedPatches) {
                fixesApplied.push({
                    code: p.diagnostic.code,
                    message: p.explanation,
                    fixed: p.diagnostic.name || p.diagnostic.expression,
                });
            }
            analysis = await analyzeSource(currentSource, { file: currentFile });
        }
    }

    const diagnostics = analysis.diagnostics;
    const errors = analysis.errors;
    const warnings = analysis.warnings;
    const isValid = errors.length === 0;

    // 4. Resolve context entity suggestions for repair prompt
    let allowedStates = options.allowedStates ? [...options.allowedStates] : [];
    let allowedActions = options.allowedActions ? [...options.allowedActions] : [];
    let allowedComponents = options.allowedComponents ? [...options.allowedComponents] : [];
    let allowedRoutes = options.allowedRoutes ? [...options.allowedRoutes] : [];

    if (options.projectPath) {
        try {
            const ctx = await generateLlmContext(options.projectPath);
            if (ctx?.data) {
                if (allowedStates.length === 0 && ctx.data.states) {
                    allowedStates = ctx.data.states.map((s) => s.name);
                }
                if (allowedActions.length === 0 && ctx.data.actions) {
                    allowedActions = [...ctx.data.actions];
                }
                if (allowedComponents.length === 0 && ctx.data.components) {
                    allowedComponents = ctx.data.components.map((c) => c.name);
                }
                if (allowedRoutes.length === 0 && ctx.data.routes) {
                    allowedRoutes = ctx.data.routes.map((r) => r.path);
                }
            }
        } catch (_) {}
    }

    // 5. Generate structured feedback prompt if validation errors exist
    let promptFeedback = null;
    if (!isValid) {
        promptFeedback = formatLlmRepairPrompt(errors, {
            allowedStates,
            allowedActions,
            allowedComponents,
            allowedRoutes,
        });
    }

    const totalTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

    return {
        isValid,
        source: rawSource,
        fixedSource: modified ? currentSource : null,
        modified,
        fixesApplied,
        symbolTable: analysis.symbolTable,
        dependencyGraph: analysis.dependencyGraph,
        diagnostics,
        errors,
        warnings,
        promptFeedback,
        stats: {
            durationMs: totalTimeMs,
            totalDiagnostics: diagnostics.length,
            errorCount: errors.length,
            warningCount: warnings.length,
            fixCount: fixesApplied.length,
        },
    };
}
