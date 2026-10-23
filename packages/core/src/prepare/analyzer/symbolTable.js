/**
 * packages/core/src/prepare/analyzer/symbolTable.js
 * Builds a comprehensive symbol table from canonical EUIX source.
 * Tracks state declarations, action definitions, computed properties,
 * watchers, bindings, and component-local variables.
 */

import { parseTemplateAst } from "../parser/expressionAst.js";
import { createDiagnostic, DIAGNOSTIC_CODES, findClosestMatch } from "../validator/diagnostics.js";
const JS_GLOBAL_KEYWORDS = new Set([
    "true", "false", "null", "undefined", "NaN", "Infinity",
    "Math", "Date", "Number", "String", "Boolean", "Array", "Object", "JSON", "RegExp",
    "parseInt", "parseFloat", "isNaN", "isFinite", "console", "window",
    "arguments", "typeof", "instanceof", "in", "void", "delete", "this",
]);

const DATA_SCOPES = new Set(["data", "$data", "state", "$state"]);
const OTHER_SCOPES = new Set([
    "props", "$props", "ctx", "$ctx", "local", "$local",
    "api", "$api", "route", "$route", "item", "$item",
    "$index", "$first", "$last",
]);

/**
 * Extracts read/write identifiers from action definitions.
 *
 * @param {any} actionDef
 * @returns {{ reads: Set<string>, writes: Set<string>, calls: Set<string> }}
 */
export function extractActionReadsAndWrites(actionDef) {
    const reads = new Set();
    const writes = new Set();
    const calls = new Set();

    if (!actionDef) return { reads, writes, calls };

    // String action: e.g. "increment"
    if (typeof actionDef === "string") {
        calls.add(actionDef);
        return { reads, writes, calls };
    }

    if (typeof actionDef !== "object") return { reads, writes, calls };

    // 1. Shorthand: set
    if (actionDef.set && typeof actionDef.set === "object") {
        for (const [k, v] of Object.entries(actionDef.set)) {
            const cleanKey = k.replace(/^(?:data\.|\$data\.)/, "");
            writes.add(cleanKey);
            if (typeof v === "string") {
                const { ast } = parseTemplateAst(v);
                for (const node of ast) {
                    if (node.type === "expression") {
                        extractExpressionStateReads(node.body).forEach((r) => reads.add(r));
                    }
                }
            }
        }
    }

    // 2. Shorthand: toggle
    if (actionDef.toggle && typeof actionDef.toggle === "string") {
        const cleanKey = actionDef.toggle.replace(/^(?:data\.|\$data\.)/, "");
        writes.add(cleanKey);
        reads.add(cleanKey);
    }

    // 3. Shorthand: mutate
    if (actionDef.mutate) {
        const path = typeof actionDef.mutate === "string"
            ? actionDef.mutate
            : actionDef.mutate?.path || actionDef.mutate?.target;
        if (path) {
            const cleanKey = path.split(".")[0].replace(/^(?:data\.|\$data\.)/, "");
            writes.add(cleanKey);
        }
    }

    // 4. Assign / Target (e.g. from XML <step assign="count" />)
    if (actionDef.assign) {
        const cleanKey = actionDef.assign.replace(/^(?:data\.|\$data\.)/, "");
        writes.add(cleanKey);
    }

    // 5. Explicit writes array
    if (Array.isArray(actionDef.writes)) {
        actionDef.writes.forEach((w) => writes.add(w.replace(/^(?:data\.|\$data\.)/, "")));
    }

    // 6. Explicit reads array
    if (Array.isArray(actionDef.reads)) {
        actionDef.reads.forEach((r) => reads.add(r.replace(/^(?:data\.|\$data\.)/, "")));
    }

    // 7. Call / Handler
    if (actionDef.call && typeof actionDef.call === "string") {
        calls.add(actionDef.call);
    }

    // 8. Script body: run / script
    const scriptBody = actionDef.run || actionDef.script || actionDef.body;
    if (typeof scriptBody === "string") {
        // Find $data.foo = ..., data.foo = ...
        for (const m of scriptBody.matchAll(/(?:\$data|data)\.([a-zA-Z_$][\w$]*)\s*(?:=|\+\+|--|\+=|-=)/g)) {
            if (m[1]) writes.add(m[1]);
        }
        // Find $engine.setState('foo', ...)
        for (const m of scriptBody.matchAll(/(?:\$engine|engine|this)\.setState\(\s*['"](?:data\.)?([a-zA-Z_$][\w$]*)['"]/g)) {
            if (m[1]) writes.add(m[1]);
        }
        // Explicit reads: $data.foo or data.foo
        for (const m of scriptBody.matchAll(/(?:\$data|data)\.([a-zA-Z_$][\w$]*)/g)) {
            if (m[1] && !writes.has(m[1])) reads.add(m[1]);
        }
    }

    return { reads, writes, calls };
}

/**
 * Extracts state identifiers read by a template expression.
 *
 * @param {string} expr
 * @returns {string[]}
 */
export function extractExpressionStateReads(expr) {
    const reads = new Set();
    if (!expr || typeof expr !== "string") return [];

    const cleaned = expr
        .replace(/'(?:[^'\\]|\\.)*'/g, " '' ")
        .replace(/"(?:[^"\\]|\\.)*"/g, ' "" ')
        .replace(/`[\s\S]*?`/g, ' "" ')
        .replace(/(?:[{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, " ");

    const tokenRegex = /(?:^|[^.\w$])([A-Za-z_$][\w$]*)/g;
    let match;
    while ((match = tokenRegex.exec(cleaned)) !== null) {
        const id = match[1];
        if (!id) continue;

        // Check if prefixed by data. or $data. or state.
        const restIndex = match.index + match[0].length;
        const remainder = cleaned.slice(restIndex);
        if (DATA_SCOPES.has(id)) {
            const propMatch = remainder.match(/^\.([A-Za-z_$][\w$]*)/);
            if (propMatch && propMatch[1]) {
                reads.add(propMatch[1]);
            }
            continue;
        }

        if (OTHER_SCOPES.has(id) || JS_GLOBAL_KEYWORDS.has(id)) continue;

        reads.add(id);
    }

    return [...reads];
}

/**
 * Symbol table class representing all symbols in an EUIX application.
 */
export class SymbolTable {
    constructor() {
        /** @type {Map<string, { name: string, type: string, default: any, line?: number, column?: number, reads: Set<string>, writes: Set<string> }>} */
        this.states = new Map();

        /** @type {Map<string, { name: string, reads: Set<string>, writes: Set<string>, calls: Set<string>, raw: any, line?: number, column?: number }>} */
        this.actions = new Map();

        /** @type {Map<string, { name: string, deps: string[], expr: string, reads: Set<string>, line?: number, column?: number }>} */
        this.computed = new Map();

        /** @type {Map<string, { target: string, action: string, line?: number, column?: number }>} */
        this.watchers = new Map();

        /** @type {Array<{ type: string, property: string, target: string, nodeId?: string, path: string, line?: number, column?: number }>} */
        this.bindings = [];

        /** @type {Map<string, { name: string, props: Map<string, any>, view: any }>} */
        this.components = new Map();

        /** @type {Set<string>} */
        this.props = new Set();

        /** @type {Set<string>} */
        this.services = new Set();

        /** @type {Map<string, string>} */
        this.imports = new Map();
    }

    /**
     * Checks if a state or computed or prop symbol exists.
     * @param {string} name
     * @returns {boolean}
     */
    hasStateOrValue(name) {
        return this.states.has(name) || this.computed.has(name) || this.props.has(name);
    }

    /**
     * Checks if an action symbol exists.
     * @param {string} name
     * @returns {boolean}
     */
    hasAction(name) {
        return this.actions.has(name);
    }

    /**
     * Serializes symbol table into a compact representation for AI or inspection.
     * @returns {object}
     */
    toJSON() {
        const stateObj = {};
        for (const [k, v] of this.states.entries()) {
            stateObj[k] = { type: v.type, default: v.default, reads: Array.from(v.reads), writes: Array.from(v.writes) };
        }

        const actionObj = {};
        for (const [k, v] of this.actions.entries()) {
            actionObj[k] = { reads: Array.from(v.reads), writes: Array.from(v.writes), calls: Array.from(v.calls) };
        }

        const computedObj = {};
        for (const [k, v] of this.computed.entries()) {
            computedObj[k] = { deps: v.deps, expr: v.expr };
        }

        return {
            states: stateObj,
            actions: actionObj,
            computed: computedObj,
            props: Array.from(this.props),
            components: Array.from(this.components.keys()),
            bindingsCount: this.bindings.length,
        };
    }
}

/**
 * Builds a SymbolTable from a canonical EUIX Source representation.
 *
 * @param {object} source - Canonical EUIX source object
 * @param {object} [options={}]
 * @returns {{ symbolTable: SymbolTable, diagnostics: Array<import('../validator/diagnostics.js').Diagnostic> }}
 */
export function buildSymbolTable(source, options = {}) {
    const table = new SymbolTable();
    const diagnostics = [];
    const fileName = options.file || "source.euix";

    if (!source || typeof source !== "object") {
        return { symbolTable: table, diagnostics };
    }

    // 1. Ingest Props
    if (source.props && typeof source.props === "object") {
        for (const [pKey, pVal] of Object.entries(source.props)) {
            table.props.add(pKey);
        }
    }

    // 2. Ingest States & Detect Duplicate State
    if (source.state && typeof source.state === "object") {
        for (const [sKey, sVal] of Object.entries(source.state)) {
            if (table.states.has(sKey)) {
                diagnostics.push(
                    createDiagnostic({
                        code: DIAGNOSTIC_CODES.DUPLICATE_STATE || "DUPLICATE_STATE",
                        type: "duplicate-state",
                        name: sKey,
                        file: fileName,
                        path: `state.${sKey}`,
                        message: `Duplicate state declaration "${sKey}".`,
                    }),
                );
            }

            let type = typeof sVal;
            if (sVal === null) type = "object";
            else if (Array.isArray(sVal)) type = "array";

            table.states.set(sKey, {
                name: sKey,
                type,
                default: sVal,
                reads: new Set(),
                writes: new Set(),
            });
        }
    }

    // 3. Ingest Computed & Check Collisions
    if (source.computed && typeof source.computed === "object") {
        for (const [cKey, cVal] of Object.entries(source.computed)) {
            if (table.states.has(cKey)) {
                diagnostics.push(
                    createDiagnostic({
                        code: DIAGNOSTIC_CODES.DUPLICATE_IDENTIFIER || "DUPLICATE_IDENTIFIER",
                        type: "duplicate-identifier",
                        name: cKey,
                        file: fileName,
                        path: `computed.${cKey}`,
                        message: `Computed property "${cKey}" collides with state of the same name.`,
                    }),
                );
            }

            const deps = Array.isArray(cVal?.deps)
                ? cVal.deps
                : typeof cVal === "string"
                ? (cVal.match(/\{data\.([a-zA-Z0-9_]+)\}/g) || []).map((m) => m.replace(/^\{data\.|\}$/g, ""))
                : [];

            const expr = typeof cVal === "string" ? cVal : cVal?.get || "";
            const exprReads = new Set(deps);
            extractExpressionStateReads(expr).forEach((r) => exprReads.add(r));

            table.computed.set(cKey, {
                name: cKey,
                deps,
                expr,
                reads: exprReads,
            });

            // Mark reads in state
            for (const r of exprReads) {
                if (table.states.has(r)) {
                    table.states.get(r).reads.add(`computed:${cKey}`);
                }
            }
        }
    }

    // 4. Ingest Actions & Detect Duplicate Actions
    if (source.actions && typeof source.actions === "object") {
        for (const [aKey, aVal] of Object.entries(source.actions)) {
            if (table.actions.has(aKey)) {
                diagnostics.push(
                    createDiagnostic({
                        code: DIAGNOSTIC_CODES.DUPLICATE_ACTION || "DUPLICATE_ACTION",
                        type: "duplicate-action",
                        name: aKey,
                        file: fileName,
                        path: `actions.${aKey}`,
                        message: `Duplicate action definition "${aKey}".`,
                    }),
                );
            }

            const { reads, writes, calls } = extractActionReadsAndWrites(aVal);
            table.actions.set(aKey, {
                name: aKey,
                reads,
                writes,
                calls,
                raw: aVal,
            });

            // Update state reads and writes
            for (const r of reads) {
                if (table.states.has(r)) {
                    table.states.get(r).reads.add(`action:${aKey}`);
                }
            }
            for (const w of writes) {
                if (table.states.has(w)) {
                    table.states.get(w).writes.add(`action:${aKey}`);
                }
            }
        }
    }

    // 5. Ingest Watchers
    if (source.watch && typeof source.watch === "object") {
        for (const [wTarget, wDef] of Object.entries(source.watch)) {
            const actionName = typeof wDef === "string" ? wDef : wDef?.action;
            table.watchers.set(wTarget, {
                target: wTarget,
                action: actionName || "",
            });
            const cleanTarget = wTarget.replace(/^(?:data\.|\$data\.)/, "");
            if (table.states.has(cleanTarget)) {
                table.states.get(cleanTarget).reads.add(`watch:${wTarget}`);
            }
        }
    }

    // 6. Ingest Components
    if (source.components && typeof source.components === "object") {
        for (const [compName, compDef] of Object.entries(source.components)) {
            table.components.set(compName, {
                name: compName,
                props: new Map(Object.entries(compDef.props || {})),
                view: compDef.view,
            });
        }
    }

    // 7. Traverse View Tree to Collect Bindings
    function traverseView(node, currentPath = "view", localVars = new Set()) {
        if (!node) return;

        // String node with template expressions
        if (typeof node === "string") {
            const { ast, diagnostics: exprDiags } = parseTemplateAst(node, { file: fileName, path: currentPath });
            diagnostics.push(...exprDiags);

            for (const child of ast) {
                if (child.type === "expression") {
                    const reads = extractExpressionStateReads(child.body);
                    for (const r of reads) {
                        if (!localVars.has(r)) {
                            table.bindings.push({
                                type: "interpolation",
                                property: "text",
                                target: r,
                                path: currentPath,
                                line: child.loc?.line,
                                column: child.loc?.column,
                            });
                            if (table.states.has(r)) {
                                table.states.get(r).reads.add(`view:${currentPath}`);
                            }
                        }
                    }
                }
            }
            return;
        }

        if (Array.isArray(node)) {
            node.forEach((c, idx) => traverseView(c, `${currentPath}[${idx}]`, localVars));
            return;
        }

        if (typeof node !== "object") return;

        const nodeId = node.id || node.props?.id || null;

        // Two-way state binding: { "$bind": "count" }
        if (node.$bind !== undefined) {
            const cleanTarget = String(node.$bind).replace(/^(?:data\.|\$data\.)/, "");
            table.bindings.push({
                type: "two-way",
                property: "bind",
                target: cleanTarget,
                nodeId,
                path: currentPath,
            });
            if (table.states.has(cleanTarget)) {
                table.states.get(cleanTarget).reads.add(`bind:${currentPath}`);
                table.states.get(cleanTarget).writes.add(`bind:${currentPath}`);
            }
            return;
        }

        // Action binding: { "$action": "increment" }
        if (node.$action !== undefined) {
            table.bindings.push({
                type: "event",
                property: "action",
                target: String(node.$action),
                nodeId,
                path: currentPath,
            });
            return;
        }

        // Loop directive scoping: for_each
        let nextLocals = localVars;
        if (node.tag === "for_each" || node.for_each || node.items) {
            nextLocals = new Set(localVars);
            const varName = node.var || "item";
            nextLocals.add(varName);
            if (node.index) nextLocals.add(node.index);
        }

        // Props traversal
        if (node.props && typeof node.props === "object") {
            for (const [propKey, propVal] of Object.entries(node.props)) {
                if (typeof propVal === "string") {
                    const { ast, diagnostics: pDiags } = parseTemplateAst(propVal, {
                        file: fileName,
                        path: `${currentPath}.props.${propKey}`,
                    });
                    diagnostics.push(...pDiags);

                    for (const child of ast) {
                        if (child.type === "expression") {
                            const reads = extractExpressionStateReads(child.body);
                            for (const r of reads) {
                                if (!nextLocals.has(r)) {
                                    table.bindings.push({
                                        type: "prop",
                                        property: propKey,
                                        target: r,
                                        nodeId,
                                        path: `${currentPath}.props.${propKey}`,
                                        line: child.loc?.line,
                                        column: child.loc?.column,
                                    });
                                    if (table.states.has(r)) {
                                        table.states.get(r).reads.add(`prop:${propKey}`);
                                    }
                                }
                            }
                        }
                    }
                } else {
                    traverseView(propVal, `${currentPath}.props.${propKey}`, nextLocals);
                }
            }
        }

        // Events traversal
        if (node.events && typeof node.events === "object") {
            for (const [evtKey, evtVal] of Object.entries(node.events)) {
                const actionName = typeof evtVal === "object" ? evtVal?.$action || evtVal?.action : evtVal;
                if (actionName && typeof actionName === "string") {
                    table.bindings.push({
                        type: "event",
                        property: evtKey,
                        target: actionName,
                        nodeId,
                        path: `${currentPath}.events.${evtKey}`,
                    });
                }
            }
        }

        // Children traversal
        if (Array.isArray(node.children)) {
            node.children.forEach((child, idx) => {
                traverseView(child, `${currentPath}.children[${idx}]`, nextLocals);
            });
        }
    }

    if (source.view) {
        traverseView(source.view, "view", new Set());
    }

    return { symbolTable: table, diagnostics };
}
