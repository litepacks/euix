import { extractBindingsFromText, extractExpressionRefs } from "../parser/expressions.js";
import type { Diagnostic, EuixProject } from "../ir/types.js";
import { getRuleCategory, getRuleExplanation, ruleHint } from "../diagnostics/messages.js";

const SCOPED_ACTION_VARS = new Set([
    "args",
    "$args",
    "event",
    "$event",
    "$evt",
    "item",
    "$item",
    "index",
    "$index",
    "$first",
    "$last",
    "ctx",
    "$ctx",
    "local",
    "$local",
    "payload",
    "$payload",
    "data",
    "$data",
    "props",
    "$props",
    "api",
    "$api",
    "engine",
    "$engine",
    "slotProps",
    "newValue",
    "oldValue",
    "prevValue",
    "value",
    "$newValue",
    "$oldValue",
    "$prevValue",
    "$error",
    "error",
    "$loading",
    "loading",
    "SET_STATE",
    "MUTATE_STATE",
    "REVALIDATE_API",
    "EXECUTE_ACTION",
    "RUN_SCRIPT",
    "MAP_PAN",
    "DIALOG_OPEN",
    "COLLAPSE_TOGGLE",
    "$el",
    "parent",
    "$parent",
    "timer",
    "hl",
    "b",
    "_hl_attempts",
    "_hl_timer",
    "date",
    "$date",
    "storage",
    "$storage",
    "router",
    "$router",
    "chart",
    "$chart",
    "leaf",
    "map",
    "spatial_map",
    "EUIXEngineCore",
    "EUIXRouterPlugin",
    "EUIXChartPlugin",
    "EUIXComposerPlugin",
    "EUIXApiPlugin",
    "EUIXStoragePlugin",
    "EUIXDatePlugin",
    "EUIXLeafletPlugin",
    "EUIXCollapsePlugin",
    "EUIXDialogPlugin",
    "EUIXDevTools",
    "EUIXEngine",
]);

export function validateUnknownVariables(project: EuixProject): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const seen = new Set<string>();

    for (const comp of project.components.values()) {
        const symbols = componentSymbols(project, comp.id);
        const templateScope = collectTemplateScopeSymbols(project, comp);

        for (const binding of project.bindings.values()) {
            if (binding.componentId !== comp.id) continue;
            const bindingSymbols = new Set(templateScope);
            for (const m of binding.expression.matchAll(/\b(?:const|let|var|function|catch)\s*\(?\s*([A-Za-z_$][\w$]*)/g)) {
                if (m[1]) bindingSymbols.add(m[1]);
            }
            for (const m of binding.expression.matchAll(/\b([A-Za-z_$][\w$]*)\s*=>/g)) {
                if (m[1]) bindingSymbols.add(m[1]);
            }
            for (const m of binding.expression.matchAll(/\(\s*([A-Za-z_$][\w$,\s]*)\s*\)\s*=>/g)) {
                if (m[1]) {
                    for (const p of m[1].split(",")) {
                        const trimmed = p.trim();
                        if (trimmed) bindingSymbols.add(trimmed);
                    }
                }
            }
            for (const ref of extractExpressionRefs(binding.expression.replace(/\$data\./g, "data."))) {
                pushUnknownRef(diagnostics, seen, {
                    ref,
                    symbols: bindingSymbols,
                    rule: "EUIX1110",
                    message: `Unknown variable '${ref}' in template binding in '${comp.name}'.`,
                    file: binding.file,
                    line: binding.location.line,
                    column: binding.location.column,
                    relatedIds: [binding.id],
                });
            }
        }

        for (const computed of project.computed.values()) {
            if (computed.componentId !== comp.id) continue;

            if (computed.explicitDeps) {
                for (const dep of computed.explicitDeps) {
                    const ref = dep.replace(/^data\./, "").trim();
                    pushUnknownRef(diagnostics, seen, {
                        ref,
                        symbols,
                        rule: "EUIX1103",
                        message: `Computed '${computed.name}' deps attribute lists unknown '${ref}' in '${comp.name}'.`,
                        file: computed.file,
                        line: computed.location.line,
                        column: computed.location.column,
                        relatedIds: [computed.id],
                    });
                }
            }

            const computedSymbols = new Set(symbols);
            for (const v of SCOPED_ACTION_VARS) computedSymbols.add(v);
            for (const m of computed.expression.matchAll(/\b(?:const|let|var|function|catch)\s*\(?\s*([A-Za-z_$][\w$]*)/g)) {
                if (m[1]) computedSymbols.add(m[1]);
            }
            for (const m of computed.expression.matchAll(/\b([A-Za-z_$][\w$]*)\s*=>/g)) {
                if (m[1]) computedSymbols.add(m[1]);
            }
            for (const m of computed.expression.matchAll(/\(\s*([A-Za-z_$][\w$,\s]*)\s*\)\s*=>/g)) {
                if (m[1]) {
                    for (const p of m[1].split(",")) {
                        const trimmed = p.trim();
                        if (trimmed) computedSymbols.add(trimmed);
                    }
                }
            }

            for (const ref of extractBodyVariableRefs(computed.expression)) {
                pushUnknownRef(diagnostics, seen, {
                    ref,
                    symbols: computedSymbols,
                    rule: "EUIX1102",
                    message: `Computed '${computed.name}' depends on unknown '${ref}' in '${comp.name}'.`,
                    file: computed.file,
                    line: computed.location.line,
                    column: computed.location.column,
                    relatedIds: [computed.id],
                });
            }
        }

        for (const watch of project.watchers.values()) {
            if (watch.componentId !== comp.id) continue;
            const watchSymbols = new Set(symbols);
            for (const v of SCOPED_ACTION_VARS) watchSymbols.add(v);
            for (const m of watch.body.matchAll(/\b(?:const|let|var|function|catch)\s*\(?\s*([A-Za-z_$][\w$]*)/g)) {
                if (m[1]) watchSymbols.add(m[1]);
            }
            for (const m of watch.body.matchAll(/\b([A-Za-z_$][\w$]*)\s*=>/g)) {
                if (m[1]) watchSymbols.add(m[1]);
            }
            for (const m of watch.body.matchAll(/\(\s*([A-Za-z_$][\w$,\s]*)\s*\)\s*=>/g)) {
                if (m[1]) {
                    for (const p of m[1].split(",")) {
                        const trimmed = p.trim();
                        if (trimmed) watchSymbols.add(trimmed);
                    }
                }
            }
            for (const m of watch.body.matchAll(/\bfor\s*\(\s*(?:const|let|var)?\s*([A-Za-z_$][\w$]*)\s+(?:of|in)\b/g)) {
                if (m[1]) watchSymbols.add(m[1]);
            }

            for (const ref of extractBodyVariableRefs(watch.body)) {
                pushUnknownRef(diagnostics, seen, {
                    ref,
                    symbols: watchSymbols,
                    rule: "EUIX1110",
                    message: `Unknown variable '${ref}' in watcher '${watch.name}' in '${comp.name}'.`,
                    file: watch.file,
                    line: watch.location.line,
                    column: watch.location.column,
                    relatedIds: [watch.id],
                });
            }
        }

        for (const action of project.actions.values()) {
            if (action.componentId !== comp.id) continue;
            const actionSymbols = new Set(symbols);
            for (const p of action.parameters) actionSymbols.add(p);
            for (const v of SCOPED_ACTION_VARS) actionSymbols.add(v);
            for (const m of action.body.matchAll(/\b(?:const|let|var|function|catch)\s*\(?\s*([A-Za-z_$][\w$]*)/g)) {
                if (m[1]) actionSymbols.add(m[1]);
            }
            for (const m of action.body.matchAll(/\b([A-Za-z_$][\w$]*)\s*=>/g)) {
                if (m[1]) actionSymbols.add(m[1]);
            }
            for (const m of action.body.matchAll(/\(\s*([A-Za-z_$][\w$,\s]*)\s*\)\s*=>/g)) {
                if (m[1]) {
                    for (const p of m[1].split(",")) {
                        const trimmed = p.trim();
                        if (trimmed) actionSymbols.add(trimmed);
                    }
                }
            }
            for (const m of action.body.matchAll(/\bfor\s*\(\s*(?:const|let|var)?\s*([A-Za-z_$][\w$]*)\s+(?:of|in)\b/g)) {
                if (m[1]) actionSymbols.add(m[1]);
            }

            for (const ref of extractBodyVariableRefs(action.body)) {
                pushUnknownRef(diagnostics, seen, {
                    ref,
                    symbols: actionSymbols,
                    rule: "EUIX1110",
                    message: `Unknown variable '${ref}' in action '${action.name}' in '${comp.name}'.`,
                    file: action.file,
                    line: action.location.line,
                    column: action.location.column,
                    relatedIds: [action.id],
                });
            }
        }
    }

    return diagnostics;
}

function componentSymbols(project: EuixProject, componentId: string): Set<string> {
    const symbols = new Set<string>();
    for (const state of project.states.values()) {
        symbols.add(state.name);
    }
    for (const computed of project.computed.values()) {
        symbols.add(computed.name);
    }
    for (const prop of project.props.values()) {
        if (prop.componentId === componentId) symbols.add(prop.name);
    }
    return symbols;
}

function collectTemplateScopeSymbols(project: EuixProject, comp: { id: string; file: string }): Set<string> {
    const symbols = componentSymbols(project, comp.id);
    for (const v of SCOPED_ACTION_VARS) symbols.add(v);
    const file = project.files.find((f) => f.path === comp.file);
    if (file) {
        // Collect form input/textarea/select/dialog/collapse bind attributes
        for (const m of file.source.matchAll(/\b(?:bind|bind\.[a-z]+)=["'](?:data\.)?([A-Za-z_$][\w$]*)["']/gi)) {
            if (m[1]) symbols.add(m[1].trim());
        }
        // Collect declarative path and set action write targets
        for (const m of file.source.matchAll(/<path>(?:data\.)?([A-Za-z_$][\w$]*)<\/path>/gi)) {
            if (m[1]) symbols.add(m[1].trim());
        }
        for (const m of file.source.matchAll(/\bset=["'](?:data\.)?([A-Za-z_$][\w$]*)[=\s"']/gi)) {
            if (m[1]) symbols.add(m[1].trim());
        }
        // Collect <for_each var="..." as="..." index="...">
        for (const m of file.source.matchAll(/<for_each\b[^>]*\b(?:var|as)=["']([^"']+)["']/gi)) {
            if (m[1]) symbols.add(m[1].trim());
        }
        for (const m of file.source.matchAll(/<for_each\b[^>]*\bindex=["']([^"']+)["']/gi)) {
            if (m[1]) symbols.add(m[1].trim());
        }
        // Collect <template let="..." let:foo="...">
        for (const m of file.source.matchAll(/\blet=["']([^"']+)["']/gi)) {
            if (m[1]) symbols.add(m[1].trim());
        }
        for (const m of file.source.matchAll(/\blet:([A-Za-z_$][\w$]*)=/gi)) {
            if (m[1]) symbols.add(m[1].trim());
        }
        // Collect <field as="..."> in item_map
        for (const m of file.source.matchAll(/<field\b[^>]*\bas=["']([^"']+)["']/gi)) {
            if (m[1]) symbols.add(m[1].trim());
        }
    }

    return symbols;
}

function extractBodyVariableRefs(body: string): string[] {
    const refs = new Set<string>();
    const trimmed = body.trim();
    if (!trimmed) return [];

    const isJsScript =
        trimmed.startsWith("RUN_SCRIPT") ||
        /\b(?:return|const|let|var|function|async|await)\b/.test(trimmed) ||
        trimmed.includes("=>") ||
        trimmed.includes("$engine.");

    if (isJsScript) {
        const code = trimmed.replace(/^RUN_SCRIPT\s*/, "");
        for (const r of extractExpressionRefs(code)) {
            refs.add(r);
        }
        return [...refs];
    }

    if (trimmed.includes("{") && trimmed.includes("}")) {
        const exprs = extractBindingsFromText(trimmed);
        for (const e of exprs) {
            const normalized = e.replace(/\$data\./g, "data.");
            for (const r of extractExpressionRefs(normalized)) {
                refs.add(r);
            }
        }
    }

    for (const m of trimmed.matchAll(/(?:\$data|data)\.([A-Za-z_$][\w$]*)/g)) {
        if (m[1]) refs.add(m[1]);
    }

    return [...refs];
}

function pushUnknownRef(
    diagnostics: Diagnostic[],
    seen: Set<string>,
    input: {
        ref: string;
        symbols: Set<string>;
        rule: string;
        message: string;
        file: string;
        line: number;
        column: number;
        relatedIds?: string[];
    },
): void {
    const { ref, symbols } = input;
    if (!ref || symbols.has(ref)) return;

    const key = `${input.rule}:${input.file}:${input.line}:${ref}`;
    if (seen.has(key)) return;
    seen.add(key);

    diagnostics.push({
        id: `${input.rule}:${input.file}:${input.line}:${input.column}`,
        rule: input.rule,
        category: getRuleCategory(input.rule),
        severity: "error",
        message: input.message,
        hint: ruleHint(input.rule),
        explanation: getRuleExplanation(input.rule),
        file: input.file,
        line: input.line,
        column: input.column,
        confidence: "confirmed",
        relatedIds: input.relatedIds,
    });
}
