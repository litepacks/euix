/**
 * packages/core/src/prepare/resolver/importResolver.js
 * Resolves imported component sources and service references across the dependency graph.
 */

import { DIAGNOSTIC_CODES, createDiagnostic } from "../validator/diagnostics.js";

/**
 * Resolve an import path relative to current file.
 *
 * @param {string} importPath
 * @param {string} [currentFile=""]
 * @returns {string}
 */
export function normalizeImportPath(importPath, currentFile = "") {
    if (!importPath || typeof importPath !== "string") return "";

    // If path is relative and current file exists
    if (importPath.startsWith("./") || importPath.startsWith("../")) {
        if (currentFile && currentFile.includes("/")) {
            const dir = currentFile.slice(0, currentFile.lastIndexOf("/"));
            const parts = (dir + "/" + importPath).split("/");
            const resolvedParts = [];
            for (const part of parts) {
                if (part === "." || part === "") continue;
                if (part === "..") {
                    resolvedParts.pop();
                } else {
                    resolvedParts.push(part);
                }
            }
            return (currentFile.startsWith("/") ? "/" : "") + resolvedParts.join("/");
        }
    }

    return importPath;
}

/**
 * Resolves all imports declared in a source object.
 *
 * @param {object} source
 * @param {object} [options={}]
 * @param {string} [options.currentFile="source.euix.json"]
 * @param {Function} [options.resolveImport] - Custom loader (specifier, currentFile) => object|string
 * @param {Map<string, object>} [loadedRegistry] - Registry tracking circular import graphs
 * @returns {Promise<{ resolvedComponents: Map<string, object>, diagnostics: Array<import('../validator/diagnostics.js').Diagnostic> }>}
 */
export async function resolveImports(source, options = {}, loadedRegistry = new Map()) {
    const diagnostics = [];
    const resolvedComponents = new Map();
    const currentFile = options.currentFile || "source.euix.json";

    if (!source || !source.imports || typeof source.imports !== "object") {
        return { resolvedComponents, diagnostics };
    }

    for (const [alias, spec] of Object.entries(source.imports)) {
        const specifier = typeof spec === "string" ? spec : spec?.src || "";
        const normalized = normalizeImportPath(specifier, currentFile);

        // Check if custom loader provided
        if (typeof options.resolveImport === "function") {
            try {
                if (loadedRegistry.has(normalized)) {
                    resolvedComponents.set(alias, loadedRegistry.get(normalized));
                    continue;
                }

                const loaded = await options.resolveImport(normalized, currentFile);
                if (loaded) {
                    loadedRegistry.set(normalized, loaded);
                    resolvedComponents.set(alias, loaded);
                } else {
                    diagnostics.push(
                        createDiagnostic({
                            code: DIAGNOSTIC_CODES.MISSING_IMPORT,
                            type: "missing-import",
                            file: currentFile,
                            path: `imports.${alias}`,
                            message: `Could not resolve imported source: "${specifier}"`,
                        }),
                    );
                }
            } catch (err) {
                diagnostics.push(
                    createDiagnostic({
                        code: DIAGNOSTIC_CODES.MISSING_IMPORT,
                        type: "import-resolution-failed",
                        file: currentFile,
                        path: `imports.${alias}`,
                        message: `Failed to resolve import "${specifier}": ${err.message}`,
                    }),
                );
            }
        } else if (typeof process !== "undefined" && process.versions && process.versions.node) {
            try {
                const fs = await import("fs");
                const path = await import("path");
                let baseDir = process.cwd();
                if (currentFile && currentFile.includes("/")) {
                    baseDir = path.dirname(path.resolve(process.cwd(), currentFile));
                }
                const candidatePath = path.resolve(baseDir, specifier);
                if (fs.existsSync(candidatePath)) {
                    const rawContent = fs.readFileSync(candidatePath, "utf8");
                    resolvedComponents.set(alias, rawContent);
                } else {
                    if (!specifier.endsWith(".js") && !specifier.endsWith(".ts")) {
                        diagnostics.push(
                            createDiagnostic({
                                code: DIAGNOSTIC_CODES.MISSING_IMPORT,
                                type: "missing-import",
                                file: currentFile,
                                path: `imports.${alias}`,
                                message: `Cannot resolve import "${specifier}". File does not exist on disk.`,
                            }),
                        );
                    }
                }
            } catch (_) {
                // Ignore filesystem resolution fallback error
            }
        }
    }

    return { resolvedComponents, diagnostics };
}
