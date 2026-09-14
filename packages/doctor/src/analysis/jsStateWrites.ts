import path from "node:path";
import type { EuixProject } from "../ir/types.js";

/** set('field') / setState('field') / engine.setState('field') in JS/TS sources. */
export function extractJsSetCalls(source: string): string[] {
    const writes = new Set<string>();
    for (const m of source.matchAll(/\b(?:setState|\$?engine\.setState)\s*\(\s*['"]([\w.]+)['"]/g)) {
        if (m[1]) writes.add(m[1]!.replace(/^data\./, ""));
    }
    for (const m of source.matchAll(/(?<![\w.$])\bset\s*\(\s*['"]([\w.]+)['"]/g)) {
        if (m[1]) writes.add(m[1]!.replace(/^data\./, ""));
    }
    return [...writes];
}

const JS_KINDS = new Set(["js", "ts", "tsx", "jsx", "mjs", "cjs"]);

export function linkJsStateWrites(project: EuixProject): void {
    const stateNames = new Set([...project.states.values()].map((s) => s.name));
    if (stateNames.size === 0) return;

    for (const file of project.files) {
        if (!JS_KINDS.has(file.kind)) continue;
        const label = `js:${path.basename(file.path)}`;
        for (const stateName of extractJsSetCalls(file.source)) {
            if (!stateNames.has(stateName)) continue;
            for (const state of project.states.values()) {
                if (state.name !== stateName) continue;
                if (!state.writers.includes(label)) state.writers.push(label);
            }
        }
    }
}

/** Bindings/readers for states referenced only from JS (same name match). */
export function linkJsStateReads(project: EuixProject): void {
    const stateNames = new Set([...project.states.values()].map((s) => s.name));
    if (stateNames.size === 0) return;

    for (const file of project.files) {
        if (!JS_KINDS.has(file.kind)) continue;
        const label = `js:${path.basename(file.path)}`;
        for (const stateName of stateNames) {
            const readPattern = new RegExp(`\\b(?:getState|get|\\$data\\.${stateName}|['"]${stateName}['"])\\b`);
            if (!readPattern.test(file.source)) continue;
            for (const state of project.states.values()) {
                if (state.name !== stateName) continue;
                if (!state.readers.includes(label)) state.readers.push(label);
            }
        }
    }
}
