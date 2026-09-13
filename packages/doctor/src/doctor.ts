import { buildDependencyEdges } from "./analysis/dependencies.js";
import { buildComplexityMetrics, buildHealthScore } from "./analysis/risk.js";
import { computeBehaviorCoverage } from "./coverage/behavior.js";
import { runDiagnostics } from "./diagnostics/index.js";
import { generateFuzzScenarios } from "./fuzz/semantic.js";
import { buildBehaviorGraph, buildBehaviorPaths } from "./graph/behavior.js";
import type { DoctorOptions, DoctorResult } from "./ir/types.js";
import { buildProject } from "./ir/project.js";
import { buildMemoryReport } from "./memory/analyzer.js";
import { generateAllScenarios } from "./scenarios/generator.js";
import { executeScenarios } from "./runner/simulator.js";

export async function runDoctor(options: DoctorOptions): Promise<DoctorResult> {
    const started = performance.now();
    const project = await buildProject(options.root, options.target);
    buildDependencyEdges(project);
    runDiagnostics(project);

    const behaviorGraph = buildBehaviorGraph(project);
    const behaviorPaths = buildBehaviorPaths(project);
    let scenarios = generateAllScenarios(project, behaviorPaths);

    if (options.fuzz) {
        scenarios = [...scenarios, ...generateFuzzScenarios(scenarios, options.seed ?? Date.now())];
    }

    let testResults = options.test || options.fuzz ? executeScenarios(project, scenarios) : [];
    const coverage = computeBehaviorCoverage(
        behaviorPaths,
        testResults,
    );
    const complexity = buildComplexityMetrics(project, behaviorPaths.length);
    const failed = testResults.filter((r) => !r.passed).length;
    const health = buildHealthScore(project, coverage.percentage, failed);
    const memory =
        options.memory && (options.test || options.fuzz)
            ? buildMemoryReport(complexity.filter((c) => c.risk === "HIGH" || c.risk === "CRITICAL").length, options.repeat ?? 1)
            : null;

    return {
        project,
        behaviorGraph,
        behaviorPaths,
        scenarios,
        testResults,
        coverage,
        complexity,
        health,
        memory,
        durationMs: performance.now() - started,
    };
}
