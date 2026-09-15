import fs from "node:fs";
import path from "node:path";
import { BUILTIN_TAGS, isPotentialComponentTag } from "./builtins.js";
import { collectFromDocument } from "./collector.js";
import type {
    ComponentInfo,
    ComponentReference,
    DependencyEdge,
    EuixFile,
    EuixProject,
    PropTypeMismatch,
} from "../ir/types.js";
import { parseHtmlDocument, parseXmlDocument, type ParsedDocument, type ParsedElement, walkElements } from "../parser/xml.js";
import { id, makeLocation } from "../utils/location.js";
import { canonicalFilePath, isSameFile } from "../utils/paths.js";
import { findStateInScope, unwrapBinding } from "../analysis/stateScope.js";

const MAX_IMPORT_DEPTH = 12;
const PROP_ATTR_SKIP = new Set([
    "name",
    "src",
    "class",
    "id",
    "if",
    "show",
    "key",
    "type",
    "icon",
    "label",
    "index",
    "path",
    "to",
    "component",
    "loader",
    "action",
    "bind",
    "lazy",
    "viewport",
    "preload",
    "retries",
    "retry_delay",
    "group",
    "title",
    "role",
    "lock_scroll",
    "on_error",
    "fallback",
    "let",
    "slot",
]);

interface ComponentRegistry {
    byName: Map<string, ComponentInfo>;
    byFile: Map<string, ComponentInfo>;
}

export function expandComposition(project: EuixProject): void {
    for (let depth = 0; depth < MAX_IMPORT_DEPTH; depth++) {
        const pending = collectPendingImportPaths(project);
        let ingested = 0;
        for (const filePath of pending) {
            if (ingestDiscoveredFile(project, filePath)) ingested++;
        }
        if (ingested === 0) break;
    }

    linkComposition(project);
}

function normalizeCompName(name: string): string {
    return name.toLowerCase().replace(/[-_]/g, "");
}

function buildRegistry(project: EuixProject): ComponentRegistry {
    const byName = new Map<string, ComponentInfo>();
    const byFile = new Map<string, ComponentInfo>();
    for (const comp of project.components.values()) {
        byName.set(comp.name.toLowerCase(), comp);
        byName.set(normalizeCompName(comp.name), comp);
        byFile.set(canonicalFilePath(comp.file), comp);
    }
    return { byName, byFile };
}

function collectPendingImportPaths(project: EuixProject): Set<string> {
    const registry = buildRegistry(project);
    const refs = scanReferences(project, registry);
    const pending = new Set<string>();
    const knownFiles = new Set(project.files.map((f) => canonicalFilePath(f.path)));

    for (const ref of refs) {
        const candidates: string[] = [];
        if (ref.srcPath) candidates.push(path.normalize(ref.srcPath));
        if (ref.refName) {
            const guessed = guessComponentPath(ref.file, ref.refName);
            if (guessed) candidates.push(guessed);
        }
        if (ref.srcPath && !path.isAbsolute(ref.srcPath)) {
            candidates.push(resolveImportPath(ref.file, ref.srcPath));
        }
        for (const candidate of candidates) {
            if (!fs.existsSync(candidate)) continue;
            const canonical = canonicalFilePath(candidate);
            if (!knownFiles.has(canonical)) pending.add(canonical);
        }
    }
    return pending;
}

function guessComponentPath(parentFile: string, refName: string): string | null {
    const dir = path.dirname(parentFile);
    const base = refName.replace(/\.(xml|html|htm)$/i, "");
    const candidates = [
        path.join(dir, `${base}.xml`),
        path.join(dir, `${base}.html`),
        path.join(dir, `${capitalize(base)}.xml`),
    ];
    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return canonicalFilePath(candidate);
    }
    return null;
}

function capitalize(value: string): string {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function linkComposition(project: EuixProject): void {
    const registry = buildRegistry(project);
    const refs = scanReferences(project, registry);
    project.componentRefs = new Map(refs.map((ref) => [ref.id, ref]));

    for (const comp of project.components.values()) {
        comp.childComponentIds = [];
        comp.childComponentNames = [...new Set(comp.childComponentNames)];
    }

    for (const ref of refs) {
        const parent = project.components.get(ref.parentComponentId);
        if (!parent) continue;

        if (ref.refName && !parent.childComponentNames.includes(ref.refName)) {
            parent.childComponentNames.push(ref.refName);
        }
        if (ref.resolvedComponentId) {
            if (!parent.childComponentIds.includes(ref.resolvedComponentId)) {
                parent.childComponentIds.push(ref.resolvedComponentId);
            }
            const child = project.components.get(ref.resolvedComponentId);
            if (child) {
                for (const propName of ref.propsPassed) {
                    const prop = [...project.props.values()].find(
                        (p) => p.componentId === child.id && p.name === propName,
                    );
                    if (prop && !prop.passedFrom.includes(parent.name)) {
                        prop.passedFrom.push(parent.name);
                    }
                }
            }
        }
    }
}

function scanReferences(project: EuixProject, registry: ComponentRegistry): ComponentReference[] {
    const refs: ComponentReference[] = [];

    for (const file of project.files) {
        if (file.kind !== "xml" && file.kind !== "html") continue;
        const doc = file.kind === "html" ? parseHtmlDocument(file.path, file.source) : parseXmlDocument(file.path, file.source);
        const owners = findComponentOwners(project, doc);

        walkElements(getWalkRoot(doc), (el) => {
            const owner = findOwnerAt(owners, el.start);
            if (!owner) return;

            collectReferenceFromElement(doc, el, owner, registry, refs);
        });
    }

    return refs;
}

function getWalkRoot(doc: ParsedDocument): ParsedElement {
    return {
        type: "element",
        tagName: "root",
        attributes: {},
        children: doc.root.filter((n): n is ParsedElement => n.type === "element"),
        selfClosing: false,
        start: 0,
        end: doc.source.length,
    };
}

interface ComponentOwner {
    component: ComponentInfo;
    start: number;
    end: number;
}

function findComponentOwners(project: EuixProject, doc: ParsedDocument): ComponentOwner[] {
    const fileComponents = [...project.components.values()].filter((c) => c.file === doc.file);
    if (fileComponents.length === 0) return [];

    return fileComponents.map((component) => ({
        component,
        start: component.location.start,
        end: component.location.end,
    }));
}

function findOwnerAt(owners: ComponentOwner[], offset: number): ComponentInfo | null {
    const matches = owners.filter((o) => offset >= o.start && offset <= o.end);
    if (matches.length === 0) return owners[0]?.component ?? null;
    return matches.sort((a, b) => a.start - b.start).at(-1)?.component ?? null;
}

function collectReferenceFromElement(
    doc: ParsedDocument,
    el: ParsedElement,
    owner: ComponentInfo,
    registry: ComponentRegistry,
    refs: ComponentReference[],
): void {
    const tag = el.tagName.toLowerCase();
    const loc = makeLocation(doc.file, doc.source, el.start, el.end);

    if (tag === "component") {
        const refName = el.attributes.name ?? null;
        const srcRaw = el.attributes.src ?? null;
        refs.push(
            resolveReference({
                doc,
                owner,
                registry,
                kind: "component-tag",
                refName,
                srcRaw,
                el,
                loc,
            }),
        );
        return;
    }

    if (tag === "import") {
        const refName = el.attributes.name ?? inferNameFromSrc(el.attributes.src) ?? null;
        refs.push(
            resolveReference({
                doc,
                owner,
                registry,
                kind: "import-tag",
                refName,
                srcRaw: el.attributes.src ?? null,
                el,
                loc,
            }),
        );
        return;
    }

    if (tag === "route" || tag === "nav_item") {
        const componentAttr = el.attributes.component ?? null;
        if (!componentAttr) return;
        const srcRaw = componentAttr.includes("/") || componentAttr.includes(".") ? componentAttr : null;
        const refName = srcRaw ? inferNameFromSrc(srcRaw) : componentAttr;
        refs.push(
            resolveReference({
                doc,
                owner,
                registry,
                kind: tag === "route" ? "route" : "nav-item",
                refName,
                srcRaw,
                el,
                loc,
            }),
        );
        return;
    }

    const registryHit = registry.byName.get(tag);
    const guessedPath = guessComponentPath(doc.file, tag);
    const siblingComponent = guessedPath && fs.existsSync(guessedPath);

    if (registryHit || siblingComponent) {
        refs.push(
            resolveReference({
                doc,
                owner,
                registry,
                kind: "custom-tag",
                refName: registryHit?.name ?? capitalize(tag),
                srcRaw: el.attributes.src ?? (siblingComponent ? toRelativeImport(doc.file, guessedPath!) : null),
                el,
                loc,
            }),
        );
        return;
    }

    if (isPotentialComponentTag(tag) && !BUILTIN_TAGS.has(tag)) {
        refs.push(
            resolveReference({
                doc,
                owner,
                registry,
                kind: "custom-tag",
                refName: capitalize(tag),
                srcRaw: el.attributes.src ?? null,
                el,
                loc,
            }),
        );
    }
}

function toRelativeImport(fromFile: string, targetFile: string): string {
    return path.relative(path.dirname(fromFile), targetFile).split(path.sep).join("/");
}

function resolveReference(input: {
    doc: ParsedDocument;
    owner: ComponentInfo;
    registry: ComponentRegistry;
    kind: ComponentReference["kind"];
    refName: string | null;
    srcRaw: string | null;
    el: ParsedElement;
    loc: ComponentReference["location"];
}): ComponentReference {
    const { doc, owner, registry, kind, refName, srcRaw, el, loc } = input;
    const isExternal = srcRaw ? /^(?:https?:)?\/\/|^(?:data|blob):/i.test(srcRaw) : false;
    const srcPath = srcRaw && !isExternal ? resolveImportPath(doc.file, srcRaw) : null;
    const propsPassed = collectPassedProps(el);
    const propValues = collectPassedPropValues(el);

    let resolved: ComponentInfo | null = null;
    if (srcPath) {
        resolved = registry.byFile.get(canonicalFilePath(srcPath)) ?? null;
    }
    if (!resolved && refName) {
        resolved = registry.byName.get(refName.toLowerCase()) ?? registry.byName.get(normalizeCompName(refName)) ?? null;
    }

    const refId = id("compref", owner.id, kind, refName ?? tagLabel(el), String(el.start));
    return {
        id: refId,
        parentComponentId: owner.id,
        parentComponentName: owner.name,
        kind,
        refName,
        srcPath,
        resolvedComponentId: resolved?.id ?? null,
        resolvedComponentName: resolved?.name ?? null,
        resolvedFile: resolved?.file ?? (isExternal ? srcRaw : srcPath),
        propsPassed,
        propValues,
        missingRequiredProps: [],
        propTypeMismatches: [],
        file: doc.file,
        location: loc,
    };
}

function tagLabel(el: ParsedElement): string {
    return el.tagName;
}

function collectPassedProps(el: ParsedElement): string[] {
    return Object.keys(collectPassedPropValues(el));
}

function collectPassedPropValues(el: ParsedElement): Record<string, string> {
    const values: Record<string, string> = {};
    for (const [attr, value] of Object.entries(el.attributes)) {
        if (PROP_ATTR_SKIP.has(attr)) continue;
        if (attr.startsWith("on_") || attr.startsWith("bind") || attr.startsWith("on")) continue;
        values[attr] = value;
    }
    return values;
}

function findMissingRequiredPropsForProject(
    project: EuixProject,
    component: ComponentInfo,
    passed: string[],
): string[] {
    const passedSet = new Set(passed);
    const missing: string[] = [];
    for (const prop of project.props.values()) {
        if (prop.componentId !== component.id) continue;
        if (prop.required && !passedSet.has(prop.name)) missing.push(prop.name);
    }
    return missing;
}

function inferNameFromSrc(src?: string): string | null {
    if (!src) return null;
    if (/^(?:https?:)?\/\/|^(?:data|blob):/i.test(src)) return null;
    const base = path.basename(src, path.extname(src));
    return base || null;
}

export function resolveImportPath(fromFile: string, src: string): string {
    if (/^(?:https?:)?\/\/|^(?:data|blob):/i.test(src)) return src;
    if (src.startsWith("/")) return path.normalize(src);

    const dir = path.dirname(fromFile);
    const candidate1 = path.normalize(path.join(dir, src));
    if (fs.existsSync(candidate1)) return candidate1;

    const candidate2 = path.normalize(path.join(dir, path.basename(src)));
    if (fs.existsSync(candidate2)) return candidate2;

    const candidate3 = path.normalize(path.join(path.dirname(dir), src));
    if (fs.existsSync(candidate3)) return candidate3;

    return candidate1;
}

function ingestDiscoveredFile(project: EuixProject, filePath: string): boolean {
    if (/^(?:https?:)?\/\/|^(?:data|blob):/i.test(filePath)) return false;
    const normalized = path.normalize(filePath);
    if (!fs.existsSync(normalized)) return false;
    const canonical = canonicalFilePath(normalized);
    if (project.files.some((f) => isSameFile(f.path, canonical))) return false;

    const ext = path.extname(normalized).toLowerCase();
    if (![".xml", ".html", ".htm"].includes(ext)) return false;

    const source = fs.readFileSync(normalized, "utf8");
    const file: EuixFile = {
        path: normalized,
        kind: ext === ".xml" ? "xml" : "html",
        bytes: Buffer.byteLength(source, "utf8"),
        lines: source.split("\n").length,
        source,
    };
    project.files.push(file);

    const doc = file.kind === "html" ? parseHtmlDocument(file.path, file.source) : parseXmlDocument(file.path, file.source);
    mergeCollected(project, collectFromDocument(doc));
    return true;
}

function mergeCollected(project: EuixProject, collected: ReturnType<typeof collectFromDocument>): void {
    for (const c of collected.components) {
        if (!c.childComponentIds) c.childComponentIds = [];
        project.components.set(c.id, c);
    }
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

/** Recompute missing required props after props map is final. */
export function finalizeCompositionRefs(project: EuixProject): void {
    for (const ref of project.componentRefs.values()) {
        if (!ref.resolvedComponentId) continue;
        if (ref.kind === "import-tag") continue;
        const child = project.components.get(ref.resolvedComponentId);
        if (!child) continue;
        ref.missingRequiredProps = findMissingRequiredPropsForProject(project, child, ref.propsPassed);
        ref.propTypeMismatches = findPropTypeMismatches(project, ref, child);
    }
}

function findPropTypeMismatches(
    project: EuixProject,
    ref: ComponentReference,
    child: ComponentInfo,
): PropTypeMismatch[] {
    const mismatches: PropTypeMismatch[] = [];
    for (const prop of project.props.values()) {
        if (prop.componentId !== child.id) continue;
        const rawValue = ref.propValues[prop.name];
        if (rawValue === undefined) continue;

        if (prop.enumValues?.length) {
            const literal = unwrapBinding(rawValue);
            if (literal !== null && !prop.enumValues.includes(literal)) {
                mismatches.push({
                    prop: prop.name,
                    expected: `enum(${prop.enumValues.join("|")})`,
                    inferred: `"${literal}"`,
                });
            }
        }

        if (!prop.type) continue;
        const expected = normalizePropType(prop.type);
        const inferred = inferPassedPropType(rawValue, ref.parentComponentId, project);
        if (inferred && !propTypesCompatible(expected, inferred)) {
            mismatches.push({ prop: prop.name, expected, inferred });
        }
    }
    return mismatches;
}

function normalizePropType(type: string): string {
    return type.trim().toLowerCase();
}

function inferPassedPropType(
    value: string,
    parentComponentId: string,
    project: EuixProject,
): string | null {
    const expr = unwrapBinding(value);
    if (expr === null) return null;

    const dataMatch = expr.match(/^data\.([a-zA-Z_][\w]*)/);
    if (dataMatch) {
        const stateName = dataMatch[1]!;
        const state = findStateInScope(project, parentComponentId, stateName);
        if (state?.type) return normalizePropType(state.type);
        if (state && expr.includes(".")) return "object";
        if (state?.initialValue?.trim().startsWith("{")) return "object";
        if (state?.initialValue?.trim().startsWith("[")) return "array";
    }

    if (/^(true|false)$/i.test(expr)) return "boolean";
    if (/^-?\d+(\.\d+)?$/.test(expr)) return "number";
    if (/^\[/.test(expr)) return "array";
    if (/^\{/.test(expr)) return "object";
    if (/^["']/.test(expr)) return "string";

    if (!value.trim().startsWith("{")) return "string";

    return null;
}

function propTypesCompatible(expected: string, inferred: string): boolean {
    if (expected === inferred) return true;
    if (expected === "number" && inferred === "string") return false;
    return false;
}

export function buildCompositionEdges(project: EuixProject, edges: DependencyEdge[]): void {
    for (const ref of project.componentRefs.values()) {
        if (!ref.resolvedComponentId) continue;
        edges.push({
            from: ref.parentComponentId,
            to: ref.resolvedComponentId,
            kind: "composes",
            confidence: ref.srcPath ? "confirmed" : "inferred",
        });
    }
}
