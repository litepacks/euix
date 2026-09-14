import type { EuixProject, SourceLocation } from "../ir/types.js";
import { offsetToLineColumn } from "../utils/location.js";
import { canonicalFilePath } from "../utils/paths.js";

export type EditorSymbolKind = "state" | "computed" | "api" | "prop" | "action";

export interface EditorSymbolDetail {
    componentName?: string;
    stateType?: string | null;
    initialValue?: string | null;
    expression?: string;
    dependencies?: string[];
    apiMethod?: string;
    apiUrl?: string;
    readerCount?: number;
    writerCount?: number;
}

export interface EditorSymbol {
    kind: EditorSymbolKind;
    name: string;
    file: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    detail?: EditorSymbolDetail;
}

export function collectEditorSymbols(project: EuixProject, targetFile?: string): EditorSymbol[] {
    const target = targetFile ? canonicalFilePath(targetFile) : undefined;
    const sourceByFile = new Map(project.files.map((f) => [canonicalFilePath(f.path), f.source]));
    const symbols: EditorSymbol[] = [];

    const inScope = (file: string) => !target || canonicalFilePath(file) === target;

    for (const state of project.states.values()) {
        if (!inScope(state.file)) continue;
        symbols.push({
            ...toSymbol("state", state.name, state.file, state.location, sourceByFile),
            detail: {
                componentName: state.componentName,
                stateType: state.type,
                initialValue: state.initialValue,
                readerCount: state.readers.length + state.bindingConsumers.length + state.computedDependents.length,
                writerCount: state.writers.length,
            },
        });
    }

    for (const computed of project.computed.values()) {
        if (!inScope(computed.file)) continue;
        symbols.push({
            ...toSymbol("computed", computed.name, computed.file, computed.location, sourceByFile),
            detail: {
                componentName: computed.componentName,
                expression: computed.expression.trim().slice(0, 120),
                dependencies: computed.dependencies,
            },
        });
    }

    for (const api of project.apiCalls.values()) {
        if (!inScope(api.file)) continue;
        symbols.push({
            ...toSymbol("api", api.actionName, api.file, api.location, sourceByFile),
            detail: {
                componentName: api.componentName,
                apiMethod: api.method,
                apiUrl: api.url,
            },
        });
    }

    for (const action of project.actions.values()) {
        if (!inScope(action.file)) continue;
        symbols.push({
            ...toSymbol("action", action.name, action.file, action.location, sourceByFile),
            detail: {
                componentName: action.componentName,
            },
        });
    }

    return symbols;
}

function toSymbol(
    kind: EditorSymbolKind,
    name: string,
    file: string,
    location: SourceLocation,
    sourceByFile: Map<string, string>,
): EditorSymbol {
    const source = sourceByFile.get(canonicalFilePath(file)) ?? "";
    const end = offsetToLineColumn(source, location.end);
    return {
        kind,
        name,
        file,
        line: location.line,
        column: location.column,
        endLine: end.line,
        endColumn: end.column,
    };
}
