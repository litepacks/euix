import type { EuixProject, WatchInfo } from "../ir/types.js";
import { extractApiTagRefs } from "../parser/expressions.js";
import { apiTagFromWatchPath, extractRevalidateApiTags } from "./watcherGraph.js";

export function findApiCallByTag(project: EuixProject, tag: string) {
    return [...project.apiCalls.values()].find((api) => api.actionName === tag);
}

export function knownApiTags(project: EuixProject): Set<string> {
    return new Set([...project.apiCalls.values()].map((api) => api.actionName));
}

/** Mark endpoints referenced in {api.tag.loading} style bindings as consumed. */
export function linkApiBindingRefs(project: EuixProject): void {
    for (const binding of project.bindings.values()) {
        for (const tag of extractApiTagRefs(binding.expression)) {
            const api = findApiCallByTag(project, tag);
            if (api) api.responseConsumed = true;
        }
    }
}

export function collectRevalidateApiTags(project: EuixProject): string[] {
    const tags = new Set<string>();

    for (const event of project.events.values()) {
        if (event.handler.toUpperCase() !== "REVALIDATE_API") continue;
        if (event.revalidateTag) tags.add(event.revalidateTag);
    }

    for (const watch of project.watchers.values()) {
        for (const tag of extractRevalidateApiTags(watch.body)) tags.add(tag);
    }

    for (const action of project.actions.values()) {
        for (const tag of extractRevalidateApiTags(action.body)) tags.add(tag);
    }

    return [...tags];
}

export function collectUnknownApiWatchPaths(project: EuixProject): { watch: WatchInfo; tag: string }[] {
    const known = knownApiTags(project);
    const unknown: { watch: WatchInfo; tag: string }[] = [];
    for (const watch of project.watchers.values()) {
        const tag = apiTagFromWatchPath(watch.path);
        if (!tag || known.has(tag)) continue;
        unknown.push({ watch, tag });
    }
    return unknown;
}

export function collectUnknownRevalidateTags(project: EuixProject): string[] {
    const known = knownApiTags(project);
    return collectRevalidateApiTags(project).filter((tag) => !known.has(tag));
}
