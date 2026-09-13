import { detectComputedCycles, detectWatcherCycles } from "../analysis/dependencies.js";
import type { Diagnostic, EuixProject } from "../ir/types.js";

export function runDiagnostics(project: EuixProject): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const stateNames = new Set([...project.states.values()].map((s) => s.name));

    for (const state of project.states.values()) {
        if (state.writers.length === 0 && state.readers.length === 0 && state.bindingConsumers.length === 0) {
            diagnostics.push(diag("EUIX1002", "warning", `Unused state '${state.name}'`, state.file, state.location.line, state.location.column, "inferred"));
        }
        if (state.readers.length > 0 && state.writers.length === 0 && !state.initialValue) {
            diagnostics.push(diag("STATE-READONLY", "info", `State '${state.name}' is read but never written`, state.file, state.location.line, state.location.column, "inferred"));
        }
    }

    for (const computed of project.computed.values()) {
        for (const dep of computed.dependencies) {
            const depName = dep.replace(/^data\./, "");
            if (!stateNames.has(depName) && ![...project.computed.values()].some((c) => c.name === depName)) {
                diagnostics.push(diag("EUIX1102", "error", `Computed '${computed.name}' depends on unknown '${dep}'`, computed.file, computed.location.line, computed.location.column, "confirmed", [computed.id]));
            }
        }
        if (computed.dependents.length === 0) {
            diagnostics.push(diag("COMPUTED-UNUSED", "warning", `Computed '${computed.name}' is never consumed`, computed.file, computed.location.line, computed.location.column, "inferred"));
        }
    }

    for (const cycle of detectComputedCycles(project)) {
        const names = cycle.map((id) => project.computed.get(id)?.name ?? id).join(" → ");
        const first = project.computed.get(cycle[0]!);
        diagnostics.push(diag("EUIX1101", "error", `Computed dependency cycle detected: ${names}`, first?.file ?? project.root, first?.location.line ?? 1, first?.location.column ?? 1, "confirmed"));
    }

    for (const watch of project.watchers.values()) {
        const watched = watch.path.replace(/^data\./, "");
        if (watch.writes.some((w) => w.replace(/^data\./, "") === watched)) {
            diagnostics.push(diag(
                "EUIX1201",
                "warning",
                `Watcher on '${watched}' writes its own dependency (reactive loop)`,
                watch.file,
                watch.location.line,
                watch.location.column,
                "confirmed",
                [watch.id],
            ));
        }
    }

    for (const cycle of detectWatcherCycles(project)) {
        const names = cycle.map((id) => project.watchers.get(id)?.name ?? id).join(" → ");
        const first = project.watchers.get(cycle[0]!);
        diagnostics.push(diag("WATCH-CYCLE", "warning", `Watcher chain cycle detected: ${names}`, first?.file ?? project.root, first?.location.line ?? 1, first?.location.column ?? 1, "confirmed"));
    }

    for (const event of project.events.values()) {
        const actionExists = [...project.actions.values()].some(
            (a) => a.componentId === event.componentId && a.name === event.handler,
        );
        if (!actionExists) {
            diagnostics.push(diag("EUIX1301", "error", `Event handler '${event.handler}' not found for ${event.name}`, event.file, event.location.line, event.location.column, "confirmed"));
        }
    }

    for (const api of project.apiCalls.values()) {
        if (!api.errorHandled) {
            diagnostics.push(diag("EUIX1501", "warning", `API '${api.method} ${api.url}' may leave loading state active on failure`, api.file, api.location.line, api.location.column, "inferred", [api.actionId]));
        }
        if (!api.responseConsumed) {
            diagnostics.push(diag("API-UNUSED", "info", `API response from '${api.url}' may be unused`, api.file, api.location.line, api.location.column, "inferred"));
        }
    }

    for (const action of project.actions.values()) {
        for (const write of action.writes) {
            const name = write.replace(/^data\./, "");
            if (!stateNames.has(name)) {
                diagnostics.push(diag("EUIX1001", "error", `Action '${action.name}' writes unknown state '${write}'`, action.file, action.location.line, action.location.column, "confirmed"));
            }
        }
    }

    for (const ref of project.componentRefs.values()) {
        if (!ref.resolvedComponentId) {
            const target = ref.refName ?? ref.srcPath ?? "unknown";
            diagnostics.push(
                diag(
                    "EUIX1401",
                    "error",
                    `Component reference '${target}' could not be resolved in '${ref.parentComponentName}'`,
                    ref.file,
                    ref.location.line,
                    ref.location.column,
                    ref.srcPath ? "confirmed" : "inferred",
                    [ref.id],
                ),
            );
            continue;
        }
        for (const missingProp of ref.missingRequiredProps) {
            diagnostics.push(
                diag(
                    "EUIX1402",
                    "error",
                    `Missing required prop '${missingProp}' for component '${ref.resolvedComponentName}' in '${ref.parentComponentName}'`,
                    ref.file,
                    ref.location.line,
                    ref.location.column,
                    "confirmed",
                    [ref.id],
                ),
            );
        }
        for (const mismatch of ref.propTypeMismatches) {
            diagnostics.push(
                diag(
                    "EUIX1403",
                    "error",
                    `Prop '${mismatch.prop}' on '${ref.resolvedComponentName}' expects ${mismatch.expected}, got ${mismatch.inferred}`,
                    ref.file,
                    ref.location.line,
                    ref.location.column,
                    "inferred",
                    [ref.id],
                ),
            );
        }
    }

    project.diagnostics = diagnostics;
    return diagnostics;
}

function diag(
    rule: string,
    severity: Diagnostic["severity"],
    message: string,
    file: string,
    line: number,
    column: number,
    confidence: Diagnostic["confidence"],
    relatedIds?: string[],
): Diagnostic {
    return {
        id: `${rule}:${file}:${line}:${column}`,
        rule,
        severity,
        message,
        file,
        line,
        column,
        confidence,
        relatedIds,
    };
}
