/**
 * packages/core/src/prepare/analyzer/index.js
 * Unified EUIX Analysis Pipeline.
 *
 * Sequence:
 *   parse(source)
 *   → normalize(ast)
 *   → buildSymbols(ast)
 *   → resolveReferences(ast)
 *   → validate(ast)
 *   → diagnostics
 *
 * Shared by AI generation, euix doctor, unit tests, and editor tooling.
 */

import { parseSource } from "../parser/index.js";
import { resolveSource } from "../resolver/index.js";
import { validateSource as runSemanticValidation } from "../validator/index.js";
import { buildSymbolTable, SymbolTable } from "./symbolTable.js";
import { resolveReferences } from "./resolver.js";
import { buildDependencyGraph, DependencyGraph } from "./dependencyGraph.js";

/**
 * Result of the unified analysis pipeline.
 *
 * @typedef {Object} AnalysisResult
 * @property {object|null} source - Canonical EUIX source representation
 * @property {"xml"|"json"} format - Source format detected
 * @property {SymbolTable} symbolTable - Extracted symbol table
 * @property {DependencyGraph} dependencyGraph - State/Action/View dependency graph
 * @property {Array<import('../validator/diagnostics.js').Diagnostic>} diagnostics - All diagnostics
 * @property {Array<import('../validator/diagnostics.js').Diagnostic>} errors - Error-level diagnostics
 * @property {Array<import('../validator/diagnostics.js').Diagnostic>} warnings - Warning-level diagnostics
 * @property {Array<import('../validator/diagnostics.js').Diagnostic>} info - Info-level diagnostics
 * @property {boolean} isValid - True if 0 error diagnostics exist
 * @property {number} durationMs - Analysis duration in milliseconds
 */

/**
 * Runs the unified analysis pipeline on any EUIX source.
 *
 * @param {string|object} source - Raw XML, JSON string, or JSON object
 * @param {object} [options={}]
 * @param {string} [options.file="source.euix"]
 * @param {boolean} [options.includeUnused=false] - Whether to report unused states/actions as info/warnings
 * @returns {Promise<AnalysisResult>}
 */
export async function analyzeSource(source, options = {}) {
    const started = performance.now();
    const fileName = options.file || options.currentFile || "source.euix";
    const allDiagnostics = [];

    // 1. parse(source)
    const { source: canonicalSource, format, diagnostics: parseDiagnostics } = parseSource(source, fileName);
    allDiagnostics.push(...parseDiagnostics);

    if (!canonicalSource) {
        const errors = allDiagnostics.filter((d) => d.severity === "error");
        return {
            source: null,
            format: format || "json",
            symbolTable: new SymbolTable(),
            dependencyGraph: new DependencyGraph(),
            diagnostics: allDiagnostics,
            errors,
            warnings: allDiagnostics.filter((d) => d.severity === "warning"),
            info: allDiagnostics.filter((d) => d.severity === "info"),
            isValid: false,
            durationMs: Math.round((performance.now() - started) * 100) / 100,
        };
    }

    // 2. normalize(ast) & scope resolution
    const { scope, route, diagnostics: scopeDiagnostics } = await resolveSource(canonicalSource, options);
    allDiagnostics.push(...scopeDiagnostics);

    // 3. buildSymbols(ast)
    const { symbolTable, diagnostics: symbolDiagnostics } = buildSymbolTable(canonicalSource, {
        file: fileName,
    });
    allDiagnostics.push(...symbolDiagnostics);

    // 4. resolveReferences(ast)
    const refDiagnostics = resolveReferences(symbolTable, { file: fileName });
    if (!options.includeUnused) {
        // Filter out unused info diagnostics if caller didn't request them
        allDiagnostics.push(...refDiagnostics.filter((d) => d.severity === "error" || d.severity === "warning"));
    } else {
        allDiagnostics.push(...refDiagnostics);
    }

    // 5. validate(ast) - Additional semantic rules (circular computed, schema, route checks)
    const validationDiagnostics = runSemanticValidation(canonicalSource, scope, fileName);
    for (const vd of validationDiagnostics) {
        // Avoid duplicate diagnostics with same code & path
        const alreadyReported = allDiagnostics.some((d) => d.code === vd.code && d.path === vd.path);
        if (!alreadyReported) {
            allDiagnostics.push(vd);
        }
    }

    // 6. Build Dependency Graph
    const dependencyGraph = buildDependencyGraph(symbolTable, canonicalSource);

    const errors = allDiagnostics.filter((d) => d.severity === "error");
    const warnings = allDiagnostics.filter((d) => d.severity === "warning");
    const info = allDiagnostics.filter((d) => d.severity === "info");

    return {
        source: canonicalSource,
        format,
        symbolTable,
        dependencyGraph,
        diagnostics: allDiagnostics,
        errors,
        warnings,
        info,
        isValid: errors.length === 0,
        durationMs: Math.round((performance.now() - started) * 100) / 100,
    };
}

export { SymbolTable, buildSymbolTable } from "./symbolTable.js";
export { resolveReferences } from "./resolver.js";
export { DependencyGraph, buildDependencyGraph } from "./dependencyGraph.js";
