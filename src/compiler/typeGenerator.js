/**
 * src/compiler/typeGenerator.js
 * Inactive and AST-based TypeScript Type Definition (.d.ts) Generator for EUIX XML templates.
 */

import { compileXmlToAst } from "./index.js";

/**
 * Converts EUIX state/param type string to TypeScript type.
 * @param {string} type
 * @returns {string} TypeScript type string
 */
function toTsType(type) {
    switch ((type || "").toLowerCase()) {
        case "number":
            return "number";
        case "boolean":
            return "boolean";
        case "array":
            return "Array<any>";
        case "object":
            return "Record<string, any>";
        case "string":
        default:
            return "string";
    }
}

/**
 * Capitalizes first letter of string.
 * @param {string} str
 * @returns {string}
 */
function toPascalCase(str) {
    if (!str) return "Component";
    return str
        .replace(/[-_]([a-z])/g, (_, c) => c.toUpperCase())
        .replace(/^[a-z]/, (c) => c.toUpperCase())
        .replace(/[^a-zA-Z0-9]/g, "");
}

/**
 * Extracts all state, action, stream, and endpoint definitions from AST or XML string and generates TypeScript definitions.
 * @param {string} xmlString
 * @param {object} [options]
 * @param {string} [options.componentName]
 * @returns {string} TypeScript declaration file content (.d.ts)
 */
export function generateComponentTypes(xmlString, options = {}) {
    const ast = compileXmlToAst(xmlString);
    if (!ast) {
        throw new Error("Invalid XML string provided for TypeScript type generation");
    }

    // Determine component name
    let rootNode = ast;
    if (ast.tag === "root" && ast.children?.length > 0) {
        rootNode = ast.children[0];
    }

    const componentName =
        options.componentName ||
        rootNode.attrs?.name ||
        rootNode.attrs?.id ||
        (rootNode.tag === "component_def" ? "CustomComponent" : "App");

    const pascalName = toPascalCase(componentName);

    const states = [];
    const computeds = [];
    const actions = [];
    const endpoints = [];
    const streams = [];
    const props = [];

    // Traverse AST
    function traverse(node) {
        if (!node || typeof node !== "object") return;

        const tag = (node.tag || "").toLowerCase();

        // 1. States
        if (tag === "state" && node.attrs?.id) {
            states.push({
                id: node.attrs.id,
                type: toTsType(node.attrs.type),
                scope: node.attrs.scope || "local",
            });
        }

        // 2. Computed
        if (tag === "computed" && node.attrs?.id) {
            computeds.push({
                id: node.attrs.id,
                type: toTsType(node.attrs.type || "string"),
            });
        }

        // 3. Action Workflows
        if (tag === "action_def" && node.attrs?.name) {
            const params = [];
            if (node.children) {
                node.children.forEach((child) => {
                    if (child.tag === "param" && child.attrs?.name) {
                        params.push({
                            name: child.attrs.name,
                            type: toTsType(child.attrs.type),
                            required: child.attrs.required === "true",
                            default: child.attrs.default,
                        });
                    }
                });
            }
            actions.push({
                name: node.attrs.name,
                params,
            });
        }

        // 4. API Endpoints
        if (tag === "api_endpoint" && (node.attrs?.id || node.attrs?.tag)) {
            endpoints.push({
                id: node.attrs.id || node.attrs.tag,
                target: node.attrs.target || node.attrs.bind_target,
                url: node.attrs.url,
                method: node.attrs.method || "GET",
            });
        }

        // 5. Streams
        if ((tag === "api_stream" || tag === "websocket" || tag === "sse") && node.attrs?.id) {
            streams.push({
                id: node.attrs.id,
                target: node.attrs.target,
                type: node.attrs.type || (tag === "sse" ? "sse" : "ws"),
            });
        }

        // Recursive children traversal
        if (node.children && Array.isArray(node.children)) {
            node.children.forEach((child) => {
                if (typeof child === "object") traverse(child);
            });
        }
    }

    traverse(rootNode);

    // Build State Interface
    const stateLines = states.map((s) => `    ${s.id}: ${s.type};`);
    computeds.forEach((c) => stateLines.push(`    ${c.id}: ${c.type};`));
    if (stateLines.length === 0) {
        stateLines.push("    [key: string]: any;");
    }

    // Build Actions Interface
    const actionLines = actions.map((a) => {
        if (a.params.length === 0) {
            return `    ${a.name}: () => Promise<any>;`;
        }
        const paramFields = a.params
            .map((p) => `${p.name}${p.required ? "" : "?"}: ${p.type}`)
            .join("; ");
        return `    ${a.name}: (args: { ${paramFields} }) => Promise<any>;`;
    });
    if (actionLines.length === 0) {
        actionLines.push("    [actionName: string]: (args?: Record<string, any>) => Promise<any>;");
    }

    // Build Output TypeScript definition
    return `/**
 * Generated by EUIX TypeScript Generator
 * Component: ${pascalName}
 */

import type { EUIXEngineCore } from "euixjs/core";

export interface ${pascalName}State {
${stateLines.join("\n")}
}

export interface ${pascalName}Actions {
${actionLines.join("\n")}
}

export interface ${pascalName}Props {
    [propName: string]: any;
}

export type ${pascalName}Engine = EUIXEngineCore & {
    getState<K extends keyof ${pascalName}State>(key: K): ${pascalName}State[K];
    setState<K extends keyof ${pascalName}State>(key: K, value: ${pascalName}State[K]): void;
    mutateState<K extends keyof ${pascalName}State>(
        path: K,
        operation: "PUSH" | "UNSHIFT" | "POP" | "SHIFT" | "REMOVE" | "CLEAR" | "REVERSE" | "SWAP",
        value?: any,
        options?: Record<string, any>
    ): void;
    executeAction<A extends keyof ${pascalName}Actions>(
        actionName: A,
        ...args: Parameters<${pascalName}Actions[A]>
    ): ReturnType<${pascalName}Actions[A]>;
};

export default ${pascalName}Engine;
`;
}
