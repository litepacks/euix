import { linkApiBindingRefs } from "./apiRefs.js";
import { linkJsStateReads, linkJsStateWrites } from "./jsStateWrites.js";
import { linkEventStateWrites, linkPropPassStateReaders, resolveStateId } from "./stateScope.js";
export { detectWatcherCycles, watcherSelfLoop } from "./watcherGraph.js";
import { buildCompositionEdges } from "../euix/composition.js";
import { extractApiTagRefs } from "../parser/expressions.js";
import { findApiCallByTag } from "./apiRefs.js";
import type { DependencyEdge, EuixProject } from "../ir/types.js";

export function buildDependencyEdges(project: EuixProject): DependencyEdge[] {
    const edges: DependencyEdge[] = [];

    for (const computed of project.computed.values()) {
        for (const dep of computed.dependencies) {
            const depName = dep.replace(/^data\./, "");
            const stateId = resolveStateId(project, computed.componentId, depName);
            if (stateId) {
                edges.push({
                    from: computed.id,
                    to: stateId,
                    kind: "depends",
                    confidence: "confirmed",
                });
                const state = project.states.get(stateId);
                if (state) state.computedDependents.push(computed.name);
            }
        }
    }

    for (const action of project.actions.values()) {
        for (const write of action.writes) {
            const stateId = resolveStateId(project, action.componentId, write.replace(/^data\./, ""));
            if (stateId) {
                edges.push({ from: action.id, to: stateId, kind: "write", confidence: "confirmed" });
                project.states.get(stateId)?.writers.push(action.name);
            }
        }
        for (const read of action.reads) {
            const stateId = resolveStateId(project, action.componentId, read.replace(/^data\./, ""));
            if (stateId) {
                edges.push({ from: action.id, to: stateId, kind: "read", confidence: "confirmed" });
                project.states.get(stateId)?.readers.push(action.name);
            }
        }
        for (const apiId of action.apiCallIds) {
            edges.push({ from: action.id, to: apiId, kind: "api", confidence: "confirmed" });
        }
    }

    for (const event of project.events.values()) {
        const action = [...project.actions.values()].find(
            (a) =>
                a.componentId === event.componentId &&
                (a.name === event.handler || a.name === `__api__${event.handler}`),
        );
        if (action) {
            edges.push({ from: event.id, to: action.id, kind: "triggers", confidence: "confirmed" });
            event.handlerKind = "action";
        } else if (event.handlerKind === "action") {
            edges.push({ from: event.id, to: event.handler, kind: "triggers", confidence: "inferred" });
        }
    }

    for (const binding of project.bindings.values()) {
        for (const dep of binding.dependencies) {
            const depName = dep.replace(/^data\./, "");
            const computed = [...project.computed.values()].find(
                (c) => c.componentId === binding.componentId && c.name === depName,
            );
            const stateId = resolveStateId(project, binding.componentId, depName);
            if (computed) {
                edges.push({ from: binding.id, to: computed.id, kind: "binds", confidence: "confirmed" });
                computed.dependents.push(binding.target);
            } else if (stateId) {
                edges.push({ from: binding.id, to: stateId, kind: "binds", confidence: "confirmed" });
                project.states.get(stateId)?.bindingConsumers.push(binding.target);
            }
        }
        for (const apiTag of extractApiTagRefs(binding.expression)) {
            const api = findApiCallByTag(project, apiTag);
            if (api) {
                edges.push({ from: binding.id, to: api.id, kind: "binds", confidence: "confirmed" });
            }
        }
    }

    for (const watch of project.watchers.values()) {
        const watched = watch.path.replace(/^data\./, "");
        const stateId = resolveStateId(project, watch.componentId, watched);
        if (stateId) {
            edges.push({ from: watch.id, to: stateId, kind: "read", confidence: "confirmed" });
            project.states.get(stateId)?.watcherDependents.push(watch.name);
        }
        for (const write of watch.writes) {
            const writeName = write.replace(/^data\./, "");
            const writeId = resolveStateId(project, watch.componentId, writeName);
            if (writeId) {
                edges.push({ from: watch.id, to: writeId, kind: "write", confidence: "confirmed" });
                project.states.get(writeId)?.writers.push(`watch:${watch.name || watch.path}`);
            }
        }
    }

    linkEventStateWrites(project);
    linkPropPassStateReaders(project);
    linkApiBindingRefs(project);
    linkJsStateWrites(project);
    linkJsStateReads(project);
    buildCompositionEdges(project, edges);

    project.dependencies = edges;
    return edges;
}

export function detectComputedCycles(project: EuixProject): string[][] {
    const graph = new Map<string, string[]>();
    for (const c of project.computed.values()) {
        graph.set(
            c.id,
            c.dependencies
                .map((d) => [...project.computed.values()].find((x) => x.name === d)?.id)
                .filter((x): x is string => !!x),
        );
    }
    return findCycles(graph);
}

function findCycles(graph: Map<string, string[]>): string[][] {
    const cycles: string[][] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();

    function dfs(node: string, path: string[]): void {
        if (visiting.has(node)) {
            const idx = path.indexOf(node);
            if (idx >= 0) cycles.push(path.slice(idx).concat(node));
            return;
        }
        if (visited.has(node)) return;
        visiting.add(node);
        path.push(node);
        for (const next of graph.get(node) ?? []) dfs(next, path);
        path.pop();
        visiting.delete(node);
        visited.add(node);
    }

    for (const node of graph.keys()) dfs(node, []);
    return cycles;
}
