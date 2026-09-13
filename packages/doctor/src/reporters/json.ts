import type { DoctorResult } from "../ir/types.js";

export function doctorResultToJson(result: DoctorResult): string {
    const { project } = result;
    return JSON.stringify(
        {
            project: {
                root: project.root,
                fileCount: project.files.length,
                lines: project.files.reduce((n, f) => n + f.lines, 0),
            },
            files: project.files.map((f) => ({ path: f.path, kind: f.kind, lines: f.lines, bytes: f.bytes })),
            components: [...project.components.values()],
            states: [...project.states.values()],
            computed: [...project.computed.values()],
            watchers: [...project.watchers.values()],
            actions: [...project.actions.values()],
            routes: [...project.routes.values()],
            apiCalls: [...project.apiCalls.values()],
            effects: [...project.runtimeEffects, ...project.storageEffects],
            behaviorPaths: result.behaviorPaths,
            behaviorGraph: result.behaviorGraph,
            scenarios: result.scenarios,
            testResults: result.testResults,
            runtimeResources: project.runtimeEffects,
            memory: result.memory,
            diagnostics: project.diagnostics,
            coverage: result.coverage,
            complexity: result.complexity,
            health: result.health,
            durationMs: result.durationMs,
        },
        null,
        2,
    );
}
