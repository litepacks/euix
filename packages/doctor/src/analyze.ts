import { buildDependencyEdges } from "./analysis/dependencies.js";
import { runDiagnostics } from "./diagnostics/index.js";
import type { EuixProject } from "./ir/types.js";
import { buildProject } from "./ir/project.js";

/** Lightweight analysis entry point for editors and CI integrations. */
export async function analyzeTarget(root: string, target?: string): Promise<EuixProject> {
    const project = await buildProject(root, target);
    buildDependencyEdges(project);
    runDiagnostics(project);
    return project;
}
