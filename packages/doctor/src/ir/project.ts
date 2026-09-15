import fs from "node:fs";
import path from "node:path";
import { collectFromDocument } from "../euix/collector.js";
import { expandComposition, finalizeCompositionRefs } from "../euix/composition.js";
import { inferProjectPlugins } from "../euix/pluginContext.js";
import { parseJsFile } from "../parser/oxc.js";
import { parseHtmlDocument, parseXmlDocument } from "../parser/xml.js";
import { fileKind, scanProject } from "../scanner/index.js";
import { canonicalFilePath } from "../utils/paths.js";
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
        webMcpTools: new Map(),
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

    if (target) {
        ingestCompanionJsFiles(project, path.resolve(root, target));
    }

    expandComposition(project);
    finalizeCompositionRefs(project);
    project.activePlugins = [...inferProjectPlugins(project)];

    return project;
}

export function ingestFile(project: EuixProject, file: EuixFile): void {
    if (file.kind === "xml") {
        const doc = parseXmlDocument(file.path, file.source);
        mergeCollected(project, collectFromDocument(doc));
        return;
    }

    if (file.kind === "html") {
        const doc = parseHtmlDocument(file.path, file.source);
        mergeCollected(project, collectFromDocument(doc));

        if (file.kind === "html") {
            for (const m of file.source.matchAll(/<script[^>]*type=["']application\/euix["'][^>]*>([\s\S]*?)<\/script>/gi)) {
                if (m[1]) {
                    const embedded = parseXmlDocument(`${file.path}#euix-script`, m[1]);
                    mergeCollected(project, collectFromDocument(embedded));
                }
            }
        }

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

function ingestCompanionJsFiles(project: EuixProject, absTarget: string): void {
    if (absTarget.includes("fixtures")) return;

    const dirs = new Set<string>();
    const baseDir = fs.existsSync(absTarget) && fs.statSync(absTarget).isFile()
        ? path.dirname(absTarget)
        : absTarget;

    if (path.basename(baseDir).toLowerCase() === "components") {
        dirs.add(path.join(baseDir, "..", "client"));
        dirs.add(path.join(baseDir, "..", "js"));
        dirs.add(path.join(baseDir, "..", "src", "client"));
        dirs.add(path.join(baseDir, "..", "src"));
    }
    dirs.add(path.join(project.root, "src", "client"));
    dirs.add(path.join(project.root, "src"));

    const known = new Set(project.files.map((f) => canonicalFilePath(f.path)));

    for (const dir of dirs) {
        if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) continue;
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            continue;
        }
        for (const entry of entries) {
            if (!entry.isFile()) continue;
            const ext = path.extname(entry.name).toLowerCase();
            const kind = fileKind(ext);
            if (!kind || kind === "html" || kind === "xml") continue;
            const full = path.normalize(path.join(dir, entry.name));
            if (known.has(canonicalFilePath(full))) continue;
            const source = fs.readFileSync(full, "utf8");
            const file: EuixFile = {
                path: full,
                kind,
                bytes: Buffer.byteLength(source, "utf8"),
                lines: source.split("\n").length,
                source,
            };
            project.files.push(file);
            known.add(canonicalFilePath(full));
            ingestFile(project, file);
        }
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
    for (const t of collected.webMcpTools) project.webMcpTools.set(t.id, t);
    for (const a of collected.apiCalls) project.apiCalls.set(a.id, a);
}
