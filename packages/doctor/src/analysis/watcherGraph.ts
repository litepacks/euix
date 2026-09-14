import type { EuixProject, WatchInfo } from "../ir/types.js";

export function isApiWatchPath(path: string): boolean {
    const normalized = path.replace(/^data\./, "");
    return normalized.startsWith("api.");
}

export function apiTagFromWatchPath(path: string): string | null {
    const normalized = path.replace(/^data\./, "");
    const match = normalized.match(/^api\.([^.]+)\./);
    return match?.[1] ?? null;
}

/** State names written via $engine.setState in watcher step bodies. */
export function watcherStateWrites(watch: WatchInfo, project: EuixProject): string[] {
    const stateNames = new Set([...project.states.values()].map((s) => s.name));
    return watch.writes.filter((write) => stateNames.has(write.replace(/^data\./, "")));
}

export function detectWatcherCycles(project: EuixProject): string[][] {
    const graph = new Map<string, string[]>();

    for (const watch of project.watchers.values()) {
        const targets = new Set<string>();
        for (const write of watcherStateWrites(watch, project)) {
            const stateName = write.replace(/^data\./, "");
            for (const other of project.watchers.values()) {
                if (other.id === watch.id) continue;
                if (isApiWatchPath(other.path)) continue;
                const watched = other.path.replace(/^data\./, "");
                if (watched === stateName) targets.add(other.id);
            }
        }
        if (targets.size > 0) graph.set(watch.id, [...targets]);
    }

    return findCycles(graph);
}

/** True when a watcher mutates the same reactive path it observes (data state only). */
export function watcherSelfLoop(watch: WatchInfo, project: EuixProject): boolean {
    if (isApiWatchPath(watch.path)) return false;
    const watched = watch.path.replace(/^data\./, "");
    return watcherStateWrites(watch, project).some((w) => w.replace(/^data\./, "") === watched);
}

export function extractRevalidateApiTags(source: string): string[] {
    const tags = new Set<string>();
    for (const m of source.matchAll(/\brevalidateApi\s*\(\s*['"]([^'"]+)['"]/g)) {
        if (m[1]) tags.add(m[1]!);
    }
    return [...tags];
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
    return dedupeCycles(cycles);
}

function dedupeCycles(cycles: string[][]): string[][] {
    const seen = new Set<string>();
    const out: string[][] = [];
    for (const cycle of cycles) {
        const normalized = normalizeCycle(cycle);
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        out.push(cycle);
    }
    return out;
}

function normalizeCycle(cycle: string[]): string {
    const core = cycle.slice(0, -1);
    if (core.length === 0) return cycle.join("→");
    const min = [...core].sort()[0]!;
    const idx = core.indexOf(min);
    const rotated = [...core.slice(idx), ...core.slice(0, idx)];
    return rotated.join("→");
}
