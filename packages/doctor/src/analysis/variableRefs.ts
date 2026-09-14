import { extractExpressionRefs } from "../parser/expressions.js";
import type { Diagnostic, EuixProject } from "../ir/types.js";
import { ruleHint } from "../diagnostics/messages.js";

export function validateUnknownVariables(project: EuixProject): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const seen = new Set<string>();

    for (const comp of project.components.values()) {
        const symbols = componentSymbols(project, comp.id);

        for (const binding of project.bindings.values()) {
            if (binding.componentId !== comp.id) continue;
            for (const ref of refsFromExpression(binding.expression)) {
                pushUnknownRef(diagnostics, seen, {
                    ref,
                    symbols,
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
                    const ref = dep.replace(/^data\./, "");
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

            for (const ref of refsFromExpression(computed.expression)) {
                pushUnknownRef(diagnostics, seen, {
                    ref,
                    symbols,
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
            for (const ref of refsFromExpression(watch.body)) {
                pushUnknownRef(diagnostics, seen, {
                    ref,
                    symbols,
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
            for (const ref of refsFromExpression(action.body)) {
                pushUnknownRef(diagnostics, seen, {
                    ref,
                    symbols,
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
        if (state.componentId === componentId) symbols.add(state.name);
    }
    for (const computed of project.computed.values()) {
        if (computed.componentId === componentId) symbols.add(computed.name);
    }
    for (const prop of project.props.values()) {
        if (prop.componentId === componentId) symbols.add(prop.name);
    }
    return symbols;
}

function refsFromExpression(expression: string): string[] {
    if (!expression.trim()) return [];
    const normalized = expression.replace(/\$data\./g, "data.");
    return extractExpressionRefs(normalized);
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
        severity: "error",
        message: input.message,
        hint: ruleHint(input.rule),
        file: input.file,
        line: input.line,
        column: input.column,
        confidence: "confirmed",
        relatedIds: input.relatedIds,
    });
}
