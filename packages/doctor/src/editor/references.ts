import { extractApiTagRefs } from "../parser/expressions.js";
import type { EuixProject, SourceLocation } from "../ir/types.js";
import { offsetToLineColumn } from "../utils/location.js";
import { canonicalFilePath } from "../utils/paths.js";
import type { EditorSymbolKind } from "./symbols.js";

export type EditorReferenceKind = "definition" | "read" | "write" | "bind" | "watch" | "computed-dep";

export interface EditorReference {
    symbolKind: EditorSymbolKind;
    symbolName: string;
    usageKind: EditorReferenceKind;
    file: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    label: string;
}

export function collectEditorReferences(project: EuixProject, targetFile?: string): EditorReference[] {
    const target = targetFile ? canonicalFilePath(targetFile) : undefined;
    const sourceByFile = new Map(project.files.map((f) => [canonicalFilePath(f.path), f.source]));
    const refs: EditorReference[] = [];
    const inScope = (file: string) => !target || canonicalFilePath(file) === target;

    for (const state of project.states.values()) {
        if (!inScope(state.file)) continue;
        pushRef(refs, "state", state.name, "definition", state.location, sourceByFile, "state definition");
    }

    for (const computed of project.computed.values()) {
        if (!inScope(computed.file)) continue;
        pushRef(refs, "computed", computed.name, "definition", computed.location, sourceByFile, "computed definition");
        for (const dep of computed.dependencies) {
            const depName = dep.replace(/^data\./, "");
            pushRef(
                refs,
                "state",
                depName,
                "computed-dep",
                computed.location,
                sourceByFile,
                `computed '${computed.name}' dependency`,
            );
            const compDep = [...project.computed.values()].find(
                (c) => c.componentId === computed.componentId && c.name === depName,
            );
            if (compDep) {
                pushRef(
                    refs,
                    "computed",
                    depName,
                    "computed-dep",
                    computed.location,
                    sourceByFile,
                    `computed '${computed.name}' dependency`,
                );
            }
        }
    }

    for (const api of project.apiCalls.values()) {
        if (!inScope(api.file)) continue;
        pushRef(refs, "api", api.actionName, "definition", api.location, sourceByFile, "api_endpoint definition");
    }

    for (const action of project.actions.values()) {
        if (!inScope(action.file)) continue;
        pushRef(refs, "action", action.name, "definition", action.location, sourceByFile, "action definition");
        for (const read of action.reads) {
            pushRef(
                refs,
                "state",
                read.replace(/^data\./, ""),
                "read",
                action.location,
                sourceByFile,
                `action '${action.name}' read`,
            );
        }
        for (const write of action.writes) {
            pushRef(
                refs,
                "state",
                write.replace(/^data\./, ""),
                "write",
                action.location,
                sourceByFile,
                `action '${action.name}' write`,
            );
        }
    }

    for (const binding of project.bindings.values()) {
        if (!inScope(binding.file)) continue;
        for (const dep of binding.dependencies) {
            pushRef(
                refs,
                "state",
                dep.replace(/^data\./, ""),
                "bind",
                binding.location,
                sourceByFile,
                `binding ${binding.target}`,
            );
            const computed = [...project.computed.values()].find(
                (c) => c.componentId === binding.componentId && c.name === dep,
            );
            if (computed) {
                pushRef(refs, "computed", dep, "bind", binding.location, sourceByFile, `binding ${binding.target}`);
            }
        }
        for (const tag of extractApiTagRefs(binding.expression)) {
            pushRef(refs, "api", tag, "bind", binding.location, sourceByFile, `binding ${binding.target}`);
        }
    }

    for (const watch of project.watchers.values()) {
        if (!inScope(watch.file)) continue;
        const watched = watch.path.replace(/^data\./, "").split(".")[0];
        if (watched && !watched.startsWith("api")) {
            pushRef(refs, "state", watched, "watch", watch.location, sourceByFile, `watcher '${watch.path}'`);
        }
        const apiTag = watch.path.match(/^api\.([^.]+)/)?.[1];
        if (apiTag) {
            pushRef(refs, "api", apiTag, "watch", watch.location, sourceByFile, `watcher '${watch.path}'`);
        }
        for (const write of watch.writes) {
            pushRef(
                refs,
                "state",
                write.replace(/^data\./, ""),
                "write",
                watch.location,
                sourceByFile,
                `watcher '${watch.path}' write`,
            );
        }
    }

    for (const event of project.events.values()) {
        if (!inScope(event.file)) continue;
        for (const write of event.stateWrites) {
            pushRef(
                refs,
                "state",
                write.replace(/^data\./, ""),
                "write",
                event.location,
                sourceByFile,
                `event ${event.name}`,
            );
        }
    }

    return refs;
}

function pushRef(
    refs: EditorReference[],
    symbolKind: EditorSymbolKind,
    symbolName: string,
    usageKind: EditorReferenceKind,
    location: SourceLocation,
    sourceByFile: Map<string, string>,
    label: string,
): void {
    if (!symbolName) return;
    const source = sourceByFile.get(canonicalFilePath(location.file)) ?? "";
    const end = offsetToLineColumn(source, location.end);
    refs.push({
        symbolKind,
        symbolName,
        usageKind,
        file: location.file,
        line: location.line,
        column: location.column,
        endLine: end.line,
        endColumn: end.column,
        label,
    });
}
