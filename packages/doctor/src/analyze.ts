import path from "node:path";
import { buildDependencyEdges } from "./analysis/dependencies.js";
import { runDiagnostics } from "./diagnostics/index.js";
import type { EuixFile, EuixProject } from "./ir/types.js";
import { expandComposition, finalizeCompositionRefs } from "./euix/composition.js";
import { inferProjectPlugins } from "./euix/pluginContext.js";
import { buildProject, createEmptyProject, ingestFile } from "./ir/project.js";
import { fileKind } from "./scanner/index.js";
import { canonicalFilePath } from "./utils/paths.js";

/** Lightweight analysis entry point for editors and CI integrations. */
export async function analyzeTarget(root: string, target?: string): Promise<EuixProject> {
    const project = await buildProject(root, target);
    buildDependencyEdges(project);
    runDiagnostics(project);
    return project;
}

/** Analyze in-memory buffer content (for unsaved editor documents). */
export async function analyzeFileContent(root: string, filePath: string, source: string): Promise<EuixProject> {
    const resolved = path.resolve(filePath);
    const kind = fileKind(path.extname(resolved).toLowerCase());
    if (!kind) {
        throw new Error(`Unsupported EUIX source: ${resolved}`);
    }

    const project = createEmptyProject(root);
    const file: EuixFile = {
        path: canonicalFilePath(resolved),
        kind,
        source,
        bytes: Buffer.byteLength(source, "utf8"),
        lines: source.split("\n").length,
    };
    project.files = [file];
    ingestFile(project, file);
    expandComposition(project);
    finalizeCompositionRefs(project);
    project.activePlugins = [...inferProjectPlugins(project)];
    buildDependencyEdges(project);
    runDiagnostics(project);
    return project;
}
