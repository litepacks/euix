import type { EuixProject, StateInfo } from "../ir/types.js";
import { isSameFile } from "../utils/paths.js";

export function findStateInScope(
    project: EuixProject,
    componentId: string,
    stateName: string,
): StateInfo | undefined {
    const exact = [...project.states.values()].find(
        (s) => s.componentId === componentId && s.name === stateName,
    );
    if (exact) return exact;

    const component = project.components.get(componentId);
    if (component) {
        const sameFile = [...project.states.values()].find(
            (s) => isSameFile(s.file, component.file) && s.name === stateName,
        );
        if (sameFile) return sameFile;
    }

    // Fallback: resolve from shared root or project states
    return [...project.states.values()].find((s) => s.name === stateName);
}

export function resolveStateId(
    project: EuixProject,
    componentId: string,
    depName: string,
): string | undefined {
    return findStateInScope(project, componentId, depName)?.id;
}

export function unwrapBinding(value: string): string | null {
    const trimmed = value.trim();
    const match = trimmed.match(/^\{(.+)\}$/);
    return match ? match[1]!.trim() : trimmed;
}

/** Mark states written by declarative SET_STATE / RUN_SCRIPT event handlers. */
export function linkEventStateWrites(project: EuixProject): void {
    for (const event of project.events.values()) {
        for (const write of event.stateWrites) {
            const stateName = write.replace(/^data\./, "");
            const state = findStateInScope(project, event.componentId, stateName);
            if (!state) continue;
            const label = `${event.target}@${event.eventType}`;
            if (!state.writers.includes(label)) state.writers.push(label);
        }
    }
}

/** Mark parent states passed as props to child components as consumed. */
export function linkPropPassStateReaders(project: EuixProject): void {
    for (const ref of project.componentRefs.values()) {
        for (const [propName, rawValue] of Object.entries(ref.propValues)) {
            const expr = unwrapBinding(rawValue);
            if (!expr) continue;

            const dataMatch = expr.match(/^data\.([a-zA-Z_][\w]*)/);
            if (!dataMatch) continue;

            const state = findStateInScope(project, ref.parentComponentId, dataMatch[1]!);
            if (!state) continue;

            const label = ref.resolvedComponentName
                ? `prop:${ref.resolvedComponentName}.${propName}`
                : `prop:${propName}`;
            if (!state.readers.includes(label)) state.readers.push(label);
        }
    }
}
