import type { ComplexityMetrics, EuixProject, HealthScore } from "../ir/types.js";

export function buildComplexityMetrics(project: EuixProject, behaviorPathCount: number): ComplexityMetrics[] {
    const metrics: ComplexityMetrics[] = [];

    for (const comp of project.components.values()) {
        const file = project.files.find((f) => f.path === comp.file);
        const actions = comp.actionIds.map((id) => project.actions.get(id)).filter(Boolean);
        metrics.push({
            targetId: comp.id,
            targetKind: "component",
            lines: file?.lines ?? 0,
            bytes: file?.bytes ?? 0,
            states: comp.stateIds.length,
            computed: comp.computedIds.length,
            watchers: comp.watcherIds.length,
            actions: comp.actionIds.length,
            branches: actions.reduce((n, a) => n + (a?.branches ?? 0), 0),
            loops: actions.reduce((n, a) => n + (a?.loops ?? 0), 0),
            awaits: actions.reduce((n, a) => n + (a?.awaits ?? 0), 0),
            externalEffects: actions.reduce((n, a) => n + (a?.apiCallIds.length ?? 0) + (a?.runtimeEffectIds.length ?? 0), 0),
            dependencyDepth: comp.dependencies.length,
            behaviorPaths: behaviorPathCount,
            risk: scoreRisk(comp.stateIds.length, comp.actionIds.length, behaviorPathCount, actions.some((a) => (a?.awaits ?? 0) > 0)),
        });
    }

    return metrics;
}

function scoreRisk(states: number, actions: number, paths: number, asyncAction: boolean): ComplexityMetrics["risk"] {
    const score = states + actions + paths + (asyncAction ? 5 : 0);
    if (score >= 40) return "CRITICAL";
    if (score >= 25) return "HIGH";
    if (score >= 12) return "MEDIUM";
    return "LOW";
}

export function buildHealthScore(project: EuixProject, coveragePct: number, failedTests: number): HealthScore {
    const errors = project.diagnostics.filter((d) => d.severity === "error").length;
    const warnings = project.diagnostics.filter((d) => d.severity === "warning").length;

    let score = 100;
    const contributors: HealthScore["contributors"] = [];

    if (errors > 0) {
        const impact = Math.min(40, errors * 10);
        score -= impact;
        contributors.push({ label: `${errors} error diagnostics`, impact: -impact });
    }
    if (warnings > 0) {
        const impact = Math.min(20, warnings * 2);
        score -= impact;
        contributors.push({ label: `${warnings} warnings`, impact: -impact });
    }
    if (failedTests > 0) {
        const impact = Math.min(25, failedTests * 5);
        score -= impact;
        contributors.push({ label: `${failedTests} failed generated tests`, impact: -impact });
    }
    const covImpact = Math.round((100 - coveragePct) * 0.2);
    if (covImpact > 0) {
        score -= covImpact;
        contributors.push({ label: `Behavior coverage ${coveragePct}%`, impact: -covImpact });
    }

    return { score: Math.max(0, score), contributors };
}
