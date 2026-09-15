import path from "node:path";
import { renderBehaviorGraphText } from "../graph/behavior.js";
import type { ComponentInfo, Diagnostic, DoctorOptions, DoctorResult, EuixProject } from "../ir/types.js";

const SEVERITY_LABEL: Record<Diagnostic["severity"], string> = {
    error: "ERROR",
    warning: "WARN",
    info: "INFO",
};

export function printDoctorReport(result: DoctorResult, options: DoctorOptions, suppressedBaseline = 0): void {
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
    console.log(`API calls        ${project.apiCalls.size}`);
    if (project.activePlugins?.length) {
        console.log(`Active plugins   ${project.activePlugins.join(", ")}`);
    }
    console.log("");

    const errors = project.diagnostics.filter((d) => d.severity === "error");
    const warnings = project.diagnostics.filter((d) => d.severity === "warning");
    const info = project.diagnostics.filter((d) => d.severity === "info");

    console.log("Diagnostics\n");
    console.log(`Errors                ${errors.length}`);
    console.log(`Warnings              ${warnings.length}`);
    console.log(`Info                  ${info.length}`);
    if (suppressedBaseline > 0) {
        console.log(`Baseline suppressed   ${suppressedBaseline}`);
    }
    console.log("");

    if (project.diagnostics.length > 0) {
        printDiagnosticSummary(project.diagnostics);
        console.log("");
        printDiagnosticList(project.diagnostics, project, 25);
        console.log("");
    } else {
        console.log("No issues found.\n");
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

function printDiagnosticSummary(diagnostics: Diagnostic[]): void {
    const byRule = new Map<string, number>();
    for (const d of diagnostics) {
        byRule.set(d.rule, (byRule.get(d.rule) ?? 0) + 1);
    }
    const parts = [...byRule.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([rule, count]) => `${rule} ×${count}`);
    console.log(`By rule: ${parts.join("  ·  ")}`);
}

function printDiagnosticList(diagnostics: Diagnostic[], project: EuixProject, limit: number): void {
    const sorted = [...diagnostics].sort((a, b) => severityRank(a.severity) - severityRank(b.severity));
    const fileSources = new Map(project.files.map((f) => [f.path, f.source]));

    for (const d of sorted.slice(0, limit)) {
        const loc = formatLocation(d.file, d.line, d.column);
        const category = d.category ? ` [${d.category.toUpperCase()}]` : "";
        console.log(`[${d.rule}] ${SEVERITY_LABEL[d.severity]}${category}  ${d.message}`);
        console.log(`         at ${loc}${d.confidence !== "confirmed" ? ` (${d.confidence})` : ""}`);

        const source = fileSources.get(d.file);
        if (source) {
            const frame = renderCodeFrame(source, d.line, d.column);
            if (frame) {
                console.log(frame);
            }
        }

        if (d.hint) {
            console.log(`         💡 Fix: ${d.hint}`);
        }
        if (d.fix) {
            console.log(`         🔧 Auto-fix available (run with --fix)`);
        }
        console.log("");
    }
    if (sorted.length > limit) {
        console.log(`... +${sorted.length - limit} more (use --json for full export, --html for interactive dashboard)`);
    }
}

export function renderCodeFrame(source: string, targetLine: number, targetCol: number, context = 1): string | null {
    const lines = source.split("\n");
    if (targetLine < 1 || targetLine > lines.length) return null;

    const start = Math.max(0, targetLine - 1 - context);
    const end = Math.min(lines.length, targetLine + context);
    const output: string[] = [];

    const lineNumWidth = String(end).length;

    for (let i = start; i < end; i++) {
        const currentLineNum = i + 1;
        const lineContent = lines[i] ?? "";
        const isTarget = currentLineNum === targetLine;
        const prefix = isTarget ? " > " : "   ";
        const paddedNum = String(currentLineNum).padStart(lineNumWidth, " ");
        output.push(`         ${prefix}${paddedNum} | ${lineContent}`);

        if (isTarget) {
            const indent = " ".repeat(lineNumWidth);
            const colPointer = " ".repeat(Math.max(0, targetCol - 1)) + "^";
            output.push(`         ${indent}   | ${colPointer}`);
        }
    }

    return output.join("\n");
}

function severityRank(severity: Diagnostic["severity"]): number {
    if (severity === "error") return 0;
    if (severity === "warning") return 1;
    return 2;
}

function formatLocation(file: string, line: number, column?: number): string {
    const base = path.basename(file);
    return column ? `${base}:${line}:${column}` : `${base}:${line}`;
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
        for (const w of warnings) {
            console.log(`  [${w.rule}] ${w.message}`);
            if (w.hint) console.log(`    → ${w.hint}`);
        }
    }
}
