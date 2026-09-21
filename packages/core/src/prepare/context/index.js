/**
 * packages/core/src/prepare/context/index.js
 * Generates compact, token-efficient project context summaries for LLM prompt injection.
 */

import fs from "fs";
import path from "path";
import { parseSource } from "../parser/index.js";

/**
 * Recursively scans a directory for EUIX source files (.euix, .euix.json, .xml).
 *
 * @param {string} targetPath
 * @param {string[]} [result=[]]
 * @returns {string[]}
 */
export function scanEuixFiles(targetPath, result = []) {
    if (!fs.existsSync(targetPath)) return result;

    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
        if (/\.(euix|xml|euix\.json)$/i.test(targetPath)) {
            result.push(path.resolve(targetPath));
        }
        return result;
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name.startsWith(".") || entry.name === "node_modules" || entry.name === "dist") {
            continue;
        }
        const fullPath = path.join(targetPath, entry.name);
        if (entry.isDirectory()) {
            scanEuixFiles(fullPath, result);
        } else if (/\.(euix|xml|euix\.json)$/i.test(entry.name)) {
            result.push(fullPath);
        }
    }
    return result;
}

/**
 * Formats a prop definition into a TypeScript-like compact prop signature.
 *
 * @param {string} propName
 * @param {object|string} propDef
 * @returns {string} e.g. "user: object", "isOnline?: boolean"
 */
function formatPropSignature(propName, propDef) {
    if (!propDef || typeof propDef !== "object") {
        return `${propName}?: any`;
    }
    const type = propDef.type || "any";
    const optional = !propDef.required;
    return `${propName}${optional ? "?" : ""}: ${type}`;
}

/**
 * Analyzes parsed EUIX sources and compiles an aggregated project context object.
 *
 * @param {string|string[]} targetPathOrFiles
 * @param {object} [options={}]
 * @param {string} [options.baseDir]
 * @param {"markdown"|"json"} [options.format="markdown"]
 * @returns {Promise<{ text: string, data: object }>}
 */
export async function generateLlmContext(targetPathOrFiles, options = {}) {
    const baseDir = options.baseDir || process.cwd();
    const files = Array.isArray(targetPathOrFiles)
        ? targetPathOrFiles.flatMap((p) => scanEuixFiles(path.resolve(baseDir, p)))
        : scanEuixFiles(path.resolve(baseDir, targetPathOrFiles));

    const componentsMap = new Map();
    const routesMap = new Map();
    const servicesSet = new Set();
    const actionsSet = new Set();
    const statesMap = new Map();

    for (const filePath of files) {
        let content = "";
        try {
            content = fs.readFileSync(filePath, "utf8");
        } catch (_) {
            continue;
        }

        const relFile = path.relative(baseDir, filePath);
        const { source } = parseSource(content, relFile);
        if (!source) continue;

        // 1. Standalone component from file name if applicable
        const baseName = path.basename(filePath).replace(/\.(euix\.json|euix|xml)$/i, "");
        if (source.props && Object.keys(source.props).length > 0) {
            componentsMap.set(baseName, {
                name: baseName,
                file: relFile,
                props: source.props,
            });
        }

        // 2. Defined inline components (<component_def> or source.components)
        if (source.components && typeof source.components === "object") {
            for (const [compName, compDef] of Object.entries(source.components)) {
                if (!componentsMap.has(compName)) {
                    componentsMap.set(compName, {
                        name: compName,
                        file: relFile,
                        props: compDef.props || {},
                    });
                }
            }
        }

        // 3. Routes
        if (source.route && source.route.path) {
            const routePath = source.route.path;
            const paramMatches = routePath.match(/:[a-zA-Z0-9_]+/g) || [];
            const params = paramMatches.map((m) => m.slice(1));
            routesMap.set(routePath, {
                path: routePath,
                params,
                file: relFile,
            });
        }

        // 4. Actions & Services
        if (source.actions && typeof source.actions === "object") {
            for (const [actName, actDef] of Object.entries(source.actions)) {
                actionsSet.add(actName);
                const callTarget = typeof actDef === "object" ? actDef.call : actDef;
                if (callTarget && typeof callTarget === "string" && callTarget.includes(".")) {
                    servicesSet.add(callTarget);
                }
            }
        }

        // 5. States
        if (source.state && typeof source.state === "object") {
            for (const [stName, stVal] of Object.entries(source.state)) {
                if (!statesMap.has(stName)) {
                    let type = typeof stVal;
                    if (Array.isArray(stVal)) type = "array";
                    else if (stVal === null) type = "null";
                    statesMap.set(stName, type);
                }
            }
        }
    }

    const data = {
        components: Array.from(componentsMap.values()).sort((a, b) => a.name.localeCompare(b.name)),
        routes: Array.from(routesMap.values()).sort((a, b) => a.path.localeCompare(b.path)),
        services: Array.from(servicesSet).sort(),
        actions: Array.from(actionsSet).sort(),
        states: Array.from(statesMap.entries())
            .map(([name, type]) => ({ name, type }))
            .sort((a, b) => a.name.localeCompare(b.name)),
    };

    // Format Markdown
    const mdLines = ["# EUIX Project Context"];

    if (data.components.length > 0) {
        mdLines.push("\n## Components");
        for (const comp of data.components) {
            const propKeys = Object.entries(comp.props || {});
            const propsSig = propKeys.length > 0
                ? `{ ${propKeys.map(([k, v]) => formatPropSignature(k, v)).join(", ")} }`
                : "none";
            mdLines.push(`- ${comp.name}(props: ${propsSig}) [${comp.file}]`);
        }
    }

    if (data.routes.length > 0) {
        mdLines.push("\n## Routes");
        for (const r of data.routes) {
            const paramsStr = r.params.length > 0 ? ` (params: ${r.params.join(", ")})` : "";
            mdLines.push(`- ${r.path}${paramsStr}`);
        }
    }

    if (data.services.length > 0 || data.actions.length > 0) {
        mdLines.push("\n## Services & Actions");
        if (data.services.length > 0) {
            mdLines.push(`- Services: ${data.services.join(", ")}`);
        }
        if (data.actions.length > 0) {
            mdLines.push(`- Actions: ${data.actions.join(", ")}`);
        }
    }

    if (data.states.length > 0) {
        mdLines.push("\n## States");
        const stateList = data.states.map((s) => `${s.name} (${s.type})`).join(", ");
        mdLines.push(`- ${stateList}`);
    }

    const text = mdLines.join("\n");
    return {
        text,
        data,
    };
}
