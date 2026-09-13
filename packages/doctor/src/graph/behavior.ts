import type { BehaviorGraph, BehaviorPath, EuixProject, GraphEdge, GraphNode } from "../ir/types.js";

export function buildBehaviorGraph(project: EuixProject): BehaviorGraph {
    const nodes = new Map<string, GraphNode>();
    const edges: GraphEdge[] = [];

    const addNode = (id: string, label: string, type: string) => {
        if (!nodes.has(id)) nodes.set(id, { id, label, type });
    };

    for (const comp of project.components.values()) {
        addNode(comp.id, comp.name, "component");
    }
    for (const state of project.states.values()) {
        addNode(state.id, state.name, "state");
    }
    for (const computed of project.computed.values()) {
        addNode(computed.id, computed.name, "computed");
    }
    for (const action of project.actions.values()) {
        addNode(action.id, action.name, "action");
    }
    for (const event of project.events.values()) {
        addNode(event.id, event.name, "event");
    }
    for (const binding of project.bindings.values()) {
        addNode(binding.id, binding.target, "binding");
    }
    for (const api of project.apiCalls.values()) {
        addNode(api.id, `${api.method} ${api.url}`, "api");
    }
    for (const route of project.routes.values()) {
        addNode(route.id, route.path, "route");
    }

    for (const edge of project.dependencies) {
        edges.push({ from: edge.from, to: edge.to, label: edge.kind });
    }

    return { nodes: [...nodes.values()], edges };
}

export function buildBehaviorPaths(project: EuixProject): BehaviorPath[] {
    const paths: BehaviorPath[] = [];

    for (const event of project.events.values()) {
        const action = [...project.actions.values()].find(
            (a) => a.componentId === event.componentId && a.name === event.handler,
        );
        if (!action) continue;

        const nodes = [event.id, action.id];
        const edgeLabels = [`${event.id}->${action.id}`];

        for (const write of action.writes) {
            const state = [...project.states.values()].find(
                (s) => s.componentId === action.componentId && s.name === write.replace(/^data\./, ""),
            );
            if (state) {
                nodes.push(state.id);
                edgeLabels.push(`${action.id}->${state.id}`);
                for (const computed of project.computed.values()) {
                    if (computed.componentId === action.componentId && computed.dependencies.includes(state.name)) {
                        nodes.push(computed.id);
                        edgeLabels.push(`${state.id}->${computed.id}`);
                        const binding = [...project.bindings.values()].find(
                            (b) => b.componentId === action.componentId && b.dependencies.includes(computed.name),
                        );
                        if (binding) {
                            nodes.push(binding.id);
                            edgeLabels.push(`${computed.id}->${binding.id}`);
                        }
                    }
                }
            }
        }

        for (const apiId of action.apiCallIds) {
            nodes.push(apiId);
            edgeLabels.push(`${action.id}->${apiId}`);
        }

        paths.push({
            id: `path:${event.id}`,
            name: `${event.componentName}.${event.handler}`,
            nodes,
            edges: edgeLabels,
            componentName: event.componentName,
            source: "discovered",
        });
    }

    return paths;
}

export function renderBehaviorGraphText(graph: BehaviorGraph, project: EuixProject): string {
    const label = (id: string) => graph.nodes.find((n) => n.id === id)?.label ?? id;
    const lines: string[] = [];
    const seen = new Set<string>();

    for (const edge of graph.edges) {
        const key = `${edge.from}->${edge.to}`;
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push(`${label(edge.from)}`);
        lines.push(`  ↓ ${edge.label ?? ""}`.trimEnd());
        lines.push(`${label(edge.to)}`);
        lines.push("");
    }

    if (lines.length === 0) {
        for (const comp of project.components.values()) lines.push(comp.name);
    }

    return lines.join("\n").trim();
}
