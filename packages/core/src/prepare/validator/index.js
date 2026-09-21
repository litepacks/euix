/**
 * packages/core/src/prepare/validator/index.js
 * Comprehensive semantic validator with machine-readable diagnostics and intelligent suggestions.
 */

import { validateSchema } from "../schema/index.js";
import {
    DIAGNOSTIC_CODES,
    createDiagnostic,
    findClosestMatch,
} from "./diagnostics.js";
import { isStateAccessible } from "../resolver/scopeResolver.js";

/**
 * Validates computed property dependency graph for circular references.
 *
 * @param {object} computedMap
 * @param {string} fileName
 * @returns {Array<import('./diagnostics.js').Diagnostic>}
 */
function checkCircularComputed(computedMap, fileName) {
    const diagnostics = [];
    if (!computedMap || typeof computedMap !== "object") return diagnostics;

    const graph = new Map();
    for (const [key, val] of Object.entries(computedMap)) {
        const deps = Array.isArray(val?.deps)
            ? val.deps
            : typeof val === "string"
            ? (val.match(/\{data\.([a-zA-Z0-9_]+)\}/g) || []).map((m) => m.replace(/^\{data\.|\}$/g, ""))
            : [];
        graph.set(key, deps);
    }

    const visited = new Set();
    const recStack = new Set();

    function detectCycle(node, path = []) {
        visited.add(node);
        recStack.add(node);
        path.push(node);

        const deps = graph.get(node) || [];
        for (const dep of deps) {
            if (!graph.has(dep)) continue;
            if (!visited.has(dep)) {
                if (detectCycle(dep, [...path])) return true;
            } else if (recStack.has(dep)) {
                diagnostics.push(
                    createDiagnostic({
                        code: DIAGNOSTIC_CODES.CIRCULAR_COMPUTED,
                        type: "circular-computed-dependency",
                        file: fileName,
                        path: `computed.${node}`,
                        message: `Circular dependency detected in computed properties: ${[...path, dep].join(" -> ")}`,
                    }),
                );
                return true;
            }
        }

        recStack.delete(node);
        return false;
    }

    for (const key of graph.keys()) {
        if (!visited.has(key)) {
            detectCycle(key);
        }
    }

    return diagnostics;
}

/**
 * Validates watcher definitions for self-loops and circular triggers.
 *
 * @param {object} watchMap
 * @param {object} actionsMap
 * @param {string} fileName
 * @returns {Array<import('./diagnostics.js').Diagnostic>}
 */
function checkCircularWatchers(watchMap, actionsMap, fileName) {
    const diagnostics = [];
    if (!watchMap || typeof watchMap !== "object") return diagnostics;

    for (const [watchedPath, watchDef] of Object.entries(watchMap)) {
        const actionName = typeof watchDef === "string" ? watchDef : watchDef?.action;
        if (!actionName) continue;

        const action = actionsMap?.[actionName];
        if (action && (action.assign === watchedPath || action.set?.[watchedPath] !== undefined)) {
            diagnostics.push(
                createDiagnostic({
                    code: DIAGNOSTIC_CODES.CIRCULAR_WATCH,
                    type: "watcher-self-loop",
                    file: fileName,
                    path: `watch.${watchedPath}`,
                    message: `Watcher on "${watchedPath}" triggers action "${actionName}" which directly mutates "${watchedPath}". This will cause an infinite loop.`,
                }),
            );
        }
    }

    return diagnostics;
}

/**
 * Validates a view node recursively against scopes.
 *
 * @param {any} node
 * @param {import('../resolver/scopeResolver.js').ResolvedScope} scope
 * @param {string} fileName
 * @param {string} currentPath
 * @param {Set<string>} localVars
 * @param {Array<import('./diagnostics.js').Diagnostic>} diagnostics
 */
function validateViewNode(node, scope, fileName, currentPath, localVars, diagnostics) {
    if (!node) return;

    // Direct binding object: { "$bind": "user.name" }
    if (typeof node === "object" && node.$bind !== undefined) {
        const bindPath = String(node.$bind);
        if (!bindPath) {
            diagnostics.push(
                createDiagnostic({
                    code: DIAGNOSTIC_CODES.INVALID_BINDING,
                    type: "invalid-binding",
                    file: fileName,
                    path: currentPath,
                    message: "State binding expression cannot be empty.",
                }),
            );
            return;
        }

        if (!isStateAccessible(bindPath, scope, localVars)) {
            const rootIdent = bindPath.split(".")[0].split("[")[0].trim();
            const candidates = [...scope.states, ...scope.computed, ...scope.props];
            const suggestion = findClosestMatch(rootIdent, candidates);
            diagnostics.push(
                createDiagnostic({
                    code: DIAGNOSTIC_CODES.UNKNOWN_STATE,
                    type: "unknown-state",
                    file: fileName,
                    path: currentPath,
                    message: `Unknown state "${rootIdent}" referenced in binding.${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
                    suggestion,
                }),
            );
        }
        return;
    }

    // Direct action object: { "$action": "loadUser" }
    if (typeof node === "object" && node.$action !== undefined) {
        const actionName = String(node.$action);
        if (!scope.actions.has(actionName)) {
            const suggestion = findClosestMatch(actionName, scope.actions);
            diagnostics.push(
                createDiagnostic({
                    code: DIAGNOSTIC_CODES.UNKNOWN_ACTION,
                    type: "unknown-action",
                    file: fileName,
                    path: currentPath,
                    message: `Unknown action "${actionName}".${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
                    suggestion,
                }),
            );
        }
        return;
    }

    if (Array.isArray(node)) {
        node.forEach((child, idx) => {
            validateViewNode(child, scope, fileName, `${currentPath}[${idx}]`, localVars, diagnostics);
        });
        return;
    }

    if (typeof node !== "object") return;

    // Component validation
    if (node.component) {
        const compName = node.component;
        if (!scope.components.has(compName)) {
            const suggestion = findClosestMatch(compName, scope.components);
            diagnostics.push(
                createDiagnostic({
                    code: DIAGNOSTIC_CODES.UNKNOWN_COMPONENT,
                    type: "unknown-component",
                    file: fileName,
                    path: `${currentPath}.component`,
                    message: `Unknown component "${compName}".${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
                    suggestion,
                }),
            );
        } else {
            // Check required props if component definition is available
            const compDef = scope.componentsMap ? scope.componentsMap.get(compName) : null;
            if (compDef && compDef.props && typeof compDef.props === "object") {
                const passedProps = node.props || {};
                for (const [pName, pDef] of Object.entries(compDef.props)) {
                    if (pDef && typeof pDef === "object" && pDef.required && passedProps[pName] === undefined) {
                        diagnostics.push(
                            createDiagnostic({
                                code: DIAGNOSTIC_CODES.INVALID_PROP,
                                type: "missing-required-prop",
                                file: fileName,
                                path: `${currentPath}.props.${pName}`,
                                message: `Component "${compName}" requires prop "${pName}", but it was not provided.`,
                            }),
                        );
                    }
                }
            }
        }
    }

    // Loop directive scoping: for_each or tag === "for_each"
    let childLocalVars = localVars;
    if (node.tag === "for_each" || node.for_each) {
        const varName = node.var || "item";
        childLocalVars = new Set(localVars);
        childLocalVars.add(varName);
        if (node.index) childLocalVars.add(node.index);
    }

    // Validate props & bindings
    if (node.props && typeof node.props === "object") {
        for (const [propKey, propVal] of Object.entries(node.props)) {
            validateViewNode(propVal, scope, fileName, `${currentPath}.props.${propKey}`, childLocalVars, diagnostics);
        }
    }

    // Validate events
    if (node.events && typeof node.events === "object") {
        for (const [evtName, handler] of Object.entries(node.events)) {
            const actionName = typeof handler === "object" ? handler?.$action || handler?.action : handler;
            if (actionName && typeof actionName === "string" && !scope.actions.has(actionName)) {
                const suggestion = findClosestMatch(actionName, scope.actions);
                diagnostics.push(
                    createDiagnostic({
                        code: DIAGNOSTIC_CODES.UNKNOWN_ACTION,
                        type: "unknown-action",
                        file: fileName,
                        path: `${currentPath}.events.${evtName}`,
                        message: `Unknown action "${actionName}" assigned to "${evtName}" event.${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
                        suggestion,
                    }),
                );
            }
        }
    }

    // Validate children
    if (Array.isArray(node.children)) {
        node.children.forEach((child, idx) => {
            validateViewNode(child, scope, fileName, `${currentPath}.children[${idx}]`, childLocalVars, diagnostics);
        });
    }
}

/**
 * Comprehensive semantic validation for EUIX Source JSON.
 *
 * @param {object} source
 * @param {import('../resolver/scopeResolver.js').ResolvedScope} scope
 * @param {string} [fileName="source.euix.json"]
 * @returns {Array<import('./diagnostics.js').Diagnostic>}
 */
export function validateSource(source, scope, fileName = "source.euix.json") {
    const diagnostics = [];

    // 1. Structural Schema Validation
    const schemaErrors = validateSchema(source, fileName);
    for (const err of schemaErrors) {
        diagnostics.push(
            createDiagnostic({
                code: err.code || DIAGNOSTIC_CODES.SCHEMA_ERROR,
                type: "schema-error",
                file: fileName,
                path: err.path,
                message: err.message,
            }),
        );
    }

    if (!source || typeof source !== "object") return diagnostics;

    // 1.5 Duplicate Identifier Validation
    if (source.state && source.computed) {
        for (const stKey of Object.keys(source.state)) {
            if (source.computed[stKey] !== undefined) {
                diagnostics.push(
                    createDiagnostic({
                        code: DIAGNOSTIC_CODES.DUPLICATE_IDENTIFIER,
                        type: "duplicate-identifier",
                        file: fileName,
                        path: `computed.${stKey}`,
                        message: `Identifier "${stKey}" is already declared in state. Computed properties cannot collide with state keys.`,
                    }),
                );
            }
        }
    }
    if (source.props && source.state) {
        for (const propKey of Object.keys(source.props)) {
            if (source.state[propKey] !== undefined) {
                diagnostics.push(
                    createDiagnostic({
                        code: DIAGNOSTIC_CODES.DUPLICATE_IDENTIFIER,
                        type: "duplicate-identifier",
                        file: fileName,
                        path: `state.${propKey}`,
                        message: `State property "${propKey}" collides with declared prop of the same name.`,
                    }),
                );
            }
        }
    }

    // 1.6 Route Validity Validation
    if (source.route) {
        const routePath = typeof source.route === "string" ? source.route : source.route.path;
        if (!routePath || typeof routePath !== "string") {
            diagnostics.push(
                createDiagnostic({
                    code: DIAGNOSTIC_CODES.INVALID_ROUTE,
                    type: "invalid-route",
                    file: fileName,
                    path: "route.path",
                    message: "Route definition must have a valid string path.",
                }),
            );
        } else if (!routePath.startsWith("/")) {
            diagnostics.push(
                createDiagnostic({
                    code: DIAGNOSTIC_CODES.INVALID_ROUTE,
                    type: "invalid-route",
                    file: fileName,
                    path: "route.path",
                    message: `Route path "${routePath}" must start with a leading slash ("/").`,
                }),
            );
        } else {
            const segments = routePath.split("/");
            const seenParams = new Set();
            for (const seg of segments) {
                if (seg.startsWith(":")) {
                    const pName = seg.slice(1);
                    if (!pName) {
                        diagnostics.push(
                            createDiagnostic({
                                code: DIAGNOSTIC_CODES.INVALID_ROUTE,
                                type: "invalid-route",
                                file: fileName,
                                path: "route.path",
                                message: `Route path "${routePath}" contains an empty parameter definition.`,
                            }),
                        );
                    } else if (seenParams.has(pName)) {
                        diagnostics.push(
                            createDiagnostic({
                                code: DIAGNOSTIC_CODES.INVALID_ROUTE,
                                type: "duplicate-route-param",
                                file: fileName,
                                path: "route.path",
                                message: `Route path "${routePath}" contains duplicate parameter ":${pName}".`,
                            }),
                        );
                    } else {
                        seenParams.add(pName);
                    }
                }
            }
        }
    }

    // 1.7 Provide Validation
    if (source.provide && typeof source.provide === "object") {
        for (const [k, v] of Object.entries(source.provide)) {
            if (v && typeof v === "object" && v.$bind) {
                if (!isStateAccessible(v.$bind, scope)) {
                    diagnostics.push(
                        createDiagnostic({
                            code: DIAGNOSTIC_CODES.UNKNOWN_STATE,
                            type: "unknown-provided-state",
                            file: fileName,
                            path: `provide.${k}`,
                            message: `Provided value for "${k}" binds to unknown state "${v.$bind}".`,
                        }),
                    );
                }
            }
        }
    }

    // 2. Circular Dependencies
    diagnostics.push(...checkCircularComputed(source.computed, fileName));
    diagnostics.push(...checkCircularWatchers(source.watch, source.actions, fileName));

    // 3. Lifecycle Action Validation
    if (source.lifecycle?.mount && Array.isArray(source.lifecycle.mount)) {
        source.lifecycle.mount.forEach((step, idx) => {
            const actionName = typeof step === "string" ? step : step?.$action || step?.call;
            if (actionName && !scope.actions.has(actionName)) {
                const suggestion = findClosestMatch(actionName, scope.actions);
                diagnostics.push(
                    createDiagnostic({
                        code: DIAGNOSTIC_CODES.INVALID_LIFECYCLE,
                        type: "unknown-lifecycle-action",
                        file: fileName,
                        path: `lifecycle.mount[${idx}]`,
                        message: `Lifecycle mount references undefined action "${actionName}".${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
                        suggestion,
                    }),
                );
            }
        });
    }

    // 4. Action Services & Function Calls Validation
    if (source.actions && typeof source.actions === "object") {
        for (const [actName, actDef] of Object.entries(source.actions)) {
            if (typeof actDef === "object" && actDef !== null && typeof actDef.call === "string") {
                const callTarget = actDef.call;
                if (callTarget.includes(".")) {
                    const serviceName = callTarget.split(".")[0];
                    const isBuiltin = ["console", "window", "Math", "Date", "JSON", "params", "route", "$route"].includes(serviceName);
                    if (!isBuiltin && !scope.services.has(serviceName) && !scope.importMap.has(serviceName) && !scope.states.has(serviceName)) {
                        const candidates = [...scope.services, ...scope.importMap.keys()];
                        const suggestion = findClosestMatch(serviceName, candidates);
                        diagnostics.push(
                            createDiagnostic({
                                code: DIAGNOSTIC_CODES.UNDEFINED_SERVICE,
                                type: "undefined-service",
                                file: fileName,
                                path: `actions.${actName}.call`,
                                message: `Action "${actName}" calls "${callTarget}", but service "${serviceName}" is not imported.${suggestion ? ` Did you mean "${suggestion}"?` : ""}`,
                                suggestion,
                            }),
                        );
                    }
                }
            }
        }
    }

    // 5. Recursive View Validation
    if (source.view) {
        validateViewNode(source.view, scope, fileName, "view", new Set(), diagnostics);
    }

    return diagnostics;
}

export { DIAGNOSTIC_CODES, createDiagnostic, findClosestMatch };
