#!/usr/bin/env node
/**
 * Pre-commit hook: analyze staged EUIX XML/HTML files and exit 1 on errors.
 * Usage: node euix-doctor-pre-commit.js [repoRoot]
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { buildDependencyEdges } from "../dist/analysis/dependencies.js";
import { runDiagnostics } from "../dist/diagnostics/index.js";
import { buildProject } from "../dist/ir/project.js";

const root = path.resolve(process.argv[2] ?? process.cwd());

function stagedEuixFiles() {
    try {
        const out = execSync("git diff --cached --name-only --diff-filter=ACMR", {
            cwd: root,
            encoding: "utf8",
        });
        return out
            .split("\n")
            .map((f) => f.trim())
            .filter((f) => f && /\.(xml|html|htm)$/i.test(f))
            .map((f) => path.resolve(root, f));
    } catch {
        return [];
    }
}

const files = stagedEuixFiles();
if (files.length === 0) {
    process.exit(0);
}

let errors = 0;
for (const file of files) {
    const project = await buildProject(root, file);
    buildDependencyEdges(project);
    runDiagnostics(project);
    const fileErrors = project.diagnostics.filter((d) => d.severity === "error");
    for (const diagnostic of fileErrors) {
        errors++;
        process.stderr.write(
            `${path.relative(root, diagnostic.file)}:${diagnostic.line}:${diagnostic.column} ${diagnostic.rule} ${diagnostic.message}\n`,
        );
    }
}

process.exit(errors > 0 ? 1 : 0);
