import { collectFromDocument } from "../euix/collector.js";
import { expandComposition, finalizeCompositionRefs } from "../euix/composition.js";
import { inferProjectPlugins } from "../euix/pluginContext.js";
import { parseJsFile } from "../parser/oxc.js";
import { parseHtmlDocument, parseXmlDocument } from "../parser/xml.js";
import { scanProject } from "../scanner/index.js";
import type { EuixFile, EuixProject } from "./types.js";

export function createEmptyProject(root: string): EuixProject {
    return {
        root,
        files: [],
        components: new Map(),
        states: new Map(),
        computed: new Map(),
        actions: new Map(),
        watchers: new Map(),
        props: new Map(),
        slots: new Map(),
        events: new Map(),
        bindings: new Map(),
        routes: new Map(),
        apiCalls: new Map(),
        componentRefs: new Map(),
        storageEffects: [],
        runtimeEffects: [],
        dependencies: [],
        diagnostics: [],
    };
}

export async function buildProject(root: string, target?: string): Promise<EuixProject> {
    const project = createEmptyProject(root);
    const files = scanProject(root, target);
    project.files = files;

    for (const file of files) {
        ingestFile(project, file);
    }

    expandComposition(project);
    finalizeCompositionRefs(project);
    project.activePlugins = [...inferProjectPlugins(project)];

    return project;
}

function ingestFile(project: EuixProject, file: EuixFile): void {
    if (file.kind === "xml") {
        const doc = parseXmlDocument(file.path, file.source);
        mergeCollected(project, collectFromDocument(doc));
        return;
    }

    if (file.kind === "html") {
        const doc = parseHtmlDocument(file.path, file.source);
        mergeCollected(project, collectFromDocument(doc));

        const js = parseJsFile(file.path, file.source);
        for (const tpl of js.templateLiterals.filter((t) => t.isEuix)) {
            const embedded = parseXmlDocument(`${file.path}#tpl@${tpl.start}`, tpl.source);
            mergeCollected(project, collectFromDocument(embedded));
        }
        return;
    }

    const js = parseJsFile(file.path, file.source);
    for (const tpl of js.templateLiterals.filter((t) => t.isEuix)) {
        const embedded = parseXmlDocument(`${file.path}#tpl@${tpl.start}`, tpl.source);
        mergeCollected(project, collectFromDocument(embedded));
    }
}

function mergeCollected(
    project: EuixProject,
    collected: ReturnType<typeof collectFromDocument>,
): void {
    for (const c of collected.components) project.components.set(c.id, c);
    for (const s of collected.states) project.states.set(s.id, s);
    for (const c of collected.computed) project.computed.set(c.id, c);
    for (const a of collected.actions) project.actions.set(a.id, a);
    for (const w of collected.watchers) project.watchers.set(w.id, w);
    for (const p of collected.props) project.props.set(p.id, p);
    for (const s of collected.slots) project.slots.set(s.id, s);
    for (const e of collected.events) project.events.set(e.id, e);
    for (const b of collected.bindings) project.bindings.set(b.id, b);
    for (const r of collected.routes) project.routes.set(r.id, r);
    for (const a of collected.apiCalls) project.apiCalls.set(a.id, a);
}
