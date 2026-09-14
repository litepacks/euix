#!/usr/bin/env node
/**
 * Lightweight analyze entry for editor extensions (stdout JSON, no test scenarios).
 * Usage: node euix-doctor-analyze.js <workspaceRoot> [targetFileOrDir]
 */
import path from "node:path";
import { analyzeFileContent, analyzeTarget } from "../dist/analyze.js";
import { collectEditorReferences } from "../dist/editor/references.js";
import { collectEditorSymbols } from "../dist/editor/symbols.js";

async function readStdin() {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    return Buffer.concat(chunks).toString("utf8");
}

const args = process.argv.slice(2);
const useStdin = args.includes("--stdin");
const positional = args.filter((a) => !a.startsWith("--"));
const root = positional[0];
const target = positional[1];

if (!root) {
    console.error("Usage: euix-doctor-analyze.js <workspaceRoot> [target] [--stdin]");
    process.exit(2);
}

try {
    const project =
        useStdin && target
            ? await analyzeFileContent(root, target, await readStdin())
            : await analyzeTarget(root, target);
    const resolvedTarget = target ? path.resolve(root, target) : undefined;
    process.stdout.write(
        JSON.stringify({
            root: project.root,
            diagnostics: project.diagnostics,
            symbols: collectEditorSymbols(project, resolvedTarget),
            references: collectEditorReferences(project, resolvedTarget),
            stats: {
                files: project.files.length,
                components: project.components.size,
                states: project.states.size,
                errors: project.diagnostics.filter((d) => d.severity === "error").length,
                warnings: project.diagnostics.filter((d) => d.severity === "warning").length,
            },
        }),
    );
} catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(message);
    process.exit(1);
}
