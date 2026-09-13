import type { BehaviorPath, EuixProject, TestScenario } from "../ir/types.js";

export function generateSmokeScenarios(project: EuixProject): TestScenario[] {
    const scenarios: TestScenario[] = [];

    for (const comp of project.components.values()) {
        scenarios.push({
            id: `smoke:${comp.id}`,
            name: `${comp.name} smoke`,
            componentName: comp.name,
            pathId: comp.id,
            kind: "smoke",
            steps: [
                { kind: "init" },
                { kind: "assert", expected: { parses: true } },
                { kind: "assert", expected: { states: comp.stateIds.length } },
                { kind: "assert", expected: { actions: comp.actionIds.length } },
            ],
        });
    }

    return scenarios;
}

export function generateFlowScenarios(_project: EuixProject, paths: BehaviorPath[]): TestScenario[] {
    const scenarios: TestScenario[] = [];

    for (const path of paths) {
        scenarios.push({
            id: `flow:${path.id}`,
            name: path.name,
            componentName: path.componentName,
            pathId: path.id,
            kind: "flow",
            steps: [{ kind: "event", target: path.name.split(".")[1] }, { kind: "assert" }],
        });
    }

    return scenarios;
}

export function generateApiScenarios(project: EuixProject): TestScenario[] {
    const scenarios: TestScenario[] = [];
    const statuses = [200, 400, 401, 404, 500, "network", "invalid-json"];

    for (const api of project.apiCalls.values()) {
        for (const status of statuses) {
            scenarios.push({
                id: `api:${api.id}:${status}`,
                name: `${api.actionName} API ${status}`,
                componentName: api.componentName,
                pathId: api.actionId,
                kind: "api",
                steps: [
                    { kind: "action", target: api.actionName },
                    { kind: "api", payload: { status, url: api.url } },
                    { kind: "assert" },
                ],
            });
        }
    }

    return scenarios;
}

export function generateAllScenarios(project: EuixProject, paths: BehaviorPath[]): TestScenario[] {
    return [
        ...generateSmokeScenarios(project),
        ...generateFlowScenarios(project, paths),
        ...generateApiScenarios(project),
    ];
}
