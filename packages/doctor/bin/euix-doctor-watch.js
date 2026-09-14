#!/usr/bin/env node
/**
 * Watch EUIX sources and re-run doctor on change.
 * Usage: node euix-doctor-watch.js <workspaceRoot> [targetFileOrDir]
 */
import fs from "node:fs";
import path from "node:path";
import { buildDependencyEdges } from "../dist/analysis/dependencies.js";
import { runDiagnostics } from "../dist/diagnostics/index.js";
import { buildProject } from "../dist/ir/project.js";

const root = path.resolve(process.argv[2] ?? process.cwd());
const target = process.argv[3] ? path.resolve(root, process.argv[3]) : root;

let timer;
let running = false;

async function analyzeOnce() {
    if (running) return;
    running = true;
    try {
        const relTarget = path.relative(root, target) || undefined;
        const project = await buildProject(root, relTarget === "" ? undefined : relTarget);
        buildDependencyEdges(project);
        runDiagnostics(project);
        const errors = project.diagnostics.filter((d) => d.severity === "error").length;
        const warnings = project.diagnostics.filter((d) => d.severity === "warning").length;
        const stamp = new Date().toLocaleTimeString();
        process.stdout.write(`[${stamp}] EUIX Doctor — ${errors} error(s), ${warnings} warning(s)\n`);
        for (const diagnostic of project.diagnostics.filter((d) => d.severity === "error").slice(0, 10)) {
            process.stdout.write(
                `  ${path.relative(root, diagnostic.file)}:${diagnostic.line} ${diagnostic.rule} ${diagnostic.message}\n`,
            );
        }
    } catch (err) {
        process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    } finally {
        running = false;
    }
}

function schedule() {
    clearTimeout(timer);
    timer = setTimeout(() => void analyzeOnce(), 300);
}

process.stdout.write(`Watching ${target} …\n`);
await analyzeOnce();

fs.watch(target, { recursive: true }, schedule);

process.on("SIGINT", () => process.exit(0));
