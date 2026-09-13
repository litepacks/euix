export { analyzeTarget } from "./analyze.js";
export { expandComposition, resolveImportPath } from "./euix/composition.js";
export { runDoctor } from "./doctor.js";
export { runDoctorCli, parseDoctorArgs } from "./cli/main.js";
export { buildDependencyEdges } from "./analysis/dependencies.js";
export { runDiagnostics } from "./diagnostics/index.js";
export { buildProject, createEmptyProject } from "./ir/project.js";
export { scanProject } from "./scanner/index.js";
export type * from "./ir/types.js";
