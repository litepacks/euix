import { renderBehaviorGraphText } from "../graph/behavior.js";
import type { ComponentInfo, DoctorOptions, DoctorResult, EuixProject } from "../ir/types.js";

export function printDoctorReport(result: DoctorResult, options: DoctorOptions): void {
    const { project } = result;
    const totalLines = project.files.reduce((n, f) => n + f.lines, 0);
    const totalBytes = project.files.reduce((n, f) => n + f.bytes, 0);

    console.log("\nEUIX Doctor\n");
    console.log(`Scanning ${project.root}...\n`);
    console.log(`${project.files.length} files`);
    console.log(`${totalLines.toLocaleString()} lines`);
    console.log(`${Math.round(totalBytes / 1024)} KB\n`);
    console.log(`Components       ${project.components.size}`);
    console.log(`States           ${project.states.size}`);
    console.log(`Computed         ${project.computed.size}`);
    console.log(`Watchers         ${project.watchers.size}`);
    console.log(`Actions          ${project.actions.size}`);
    console.log(`Routes           ${project.routes.size}`);
    console.log(`API calls        ${project.apiCalls.size}\n`);

    const errors = project.diagnostics.filter((d) => d.severity === "error").length;
    const warnings = project.diagnostics.filter((d) => d.severity === "warning").length;
    const info = project.diagnostics.filter((d) => d.severity === "info").length;

    console.log("Diagnostics\n");
    console.log(`Errors                ${errors}`);
    console.log(`Warnings              ${warnings}`);
    console.log(`Info                  ${info}\n`);

    if (project.diagnostics.length > 0) {
        for (const d of project.diagnostics.slice(0, 20)) {
            console.log(`[${d.rule}] ${d.message} (${d.file}:${d.line})`);
        }
        if (project.diagnostics.length > 20) console.log(`... +${project.diagnostics.length - 20} more`);
        console.log("");
    }

    if (options.graph || options.flows) {
        console.log("Behavior Graph\n");
        console.log(renderBehaviorGraphText(result.behaviorGraph, project));
        console.log("");
    }

    if (options.test || options.fuzz) {
        console.log("Testing discovered flows...\n");
        for (const tr of result.testResults.slice(0, 30)) {
            console.log(`${tr.passed ? "✓" : "✗"} ${tr.name}${tr.message ? ` — ${tr.message}` : ""}`);
        }
        if (result.testResults.length > 30) console.log(`... +${result.testResults.length - 30} more`);
        console.log("");
    }

    console.log("Behavior\n");
    console.log(`Paths                ${result.coverage.pathsDiscovered}`);
    console.log(`Generated tests      ${result.scenarios.length}`);
    console.log(`Executed             ${result.testResults.length}`);
    console.log(`Behavior Coverage    ${result.coverage.percentage}% (heuristic)\n`);

    if (result.memory) {
        console.log("Memory\n");
        console.log(`Peak delta       +${Math.round(result.memory.peakDeltaBytes / 1024)} KB`);
        if (result.memory.postGcDeltaBytes != null) {
            console.log(`Post-GC delta    +${Math.round(result.memory.postGcDeltaBytes / 1024)} KB`);
        }
        console.log(`Classification: ${result.memory.classification}\n`);
    }

    console.log(`Health Score          ${result.health.score}/100`);
    for (const c of result.health.contributors) {
        console.log(`  ${c.label}: ${c.impact}`);
    }
    console.log(`\n${project.files.length} files analyzed in ${Math.round(result.durationMs)}ms\n`);
}

export function printInspectReport(project: EuixProject, componentName: string): void {
    const comp = [...project.components.values()].find((c) => c.name === componentName);
    if (!comp) {
        console.error(`Component not found: ${componentName}`);
        return;
    }

    console.log(`\n${comp.name}\n`);
    printComponentDetail(project, comp);
}

function printComponentDetail(project: EuixProject, comp: ComponentInfo): void {
    const file = project.files.find((f) => f.path === comp.file);
    console.log("Component");
    console.log(`  ${file?.lines ?? "?"} lines\n`);

    console.log("State");
    for (const id of comp.stateIds) {
        const s = project.states.get(id);
        if (s) console.log(`  ${s.name}${s.initialValue != null ? ` = ${s.initialValue}` : ""}`);
    }
    console.log("");

    console.log("Computed");
    for (const id of comp.computedIds) {
        const c = project.computed.get(id);
        if (c) console.log(`  ${c.name}\n    depends on ${c.dependencies.join(", ") || "(none)"}`);
    }
    console.log("");

    console.log("Actions");
    for (const id of comp.actionIds) {
        const a = project.actions.get(id);
        if (a) {
            console.log(`  ${a.name}`);
            if (a.writes.length) console.log(`    writes: ${a.writes.join(", ")}`);
            if (a.apiCallIds.length) {
                for (const apiId of a.apiCallIds) {
                    const api = project.apiCalls.get(apiId);
                    if (api) console.log(`    API: ${api.method} ${api.url}`);
                }
            }
        }
    }
    console.log("");

    console.log("Events");
    for (const id of comp.eventIds) {
        const e = project.events.get(id);
        if (e) console.log(`  ${e.eventType} → ${e.handler}`);
    }
    console.log("");

    const paths = comp.eventIds.length;
    console.log(`Behavior paths\n  ${paths}\n`);
    console.log(`Risk\n  ${paths > 3 ? "HIGH" : "LOW"}\n`);

    const warnings = project.diagnostics.filter((d) => d.file === comp.file);
    if (warnings.length) {
        console.log("Warnings");
        for (const w of warnings) console.log(`  ${w.message}`);
    }
}
