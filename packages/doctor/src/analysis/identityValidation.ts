import fs from "node:fs";
import type { Diagnostic, EuixFile, EuixProject } from "../ir/types.js";
import { getRuleCategory, getRuleExplanation, ruleHint } from "../diagnostics/messages.js";
import { findElements, makeLocation, parseHtmlDocument, parseXmlDocument, type ParsedDocument, type ParsedElement } from "../parser/xml.js";
import { canonicalFilePath } from "../utils/paths.js";

const STATE_TAGS = new Set(["state"]);
const COMPUTED_TAGS = new Set(["computed"]);
const ACTION_TAGS = new Set(["action", "action_def"]);
const API_ENDPOINT_TAGS = new Set(["api_endpoint", "endpoint"]);
const COMPONENT_TAGS = new Set(["component", "component_def"]);

export function validateDuplicateIds(project: EuixProject): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const file of project.files) {
        if (file.kind !== "xml" && file.kind !== "html") continue;
        const doc = parseProjectFile(file);
        for (const { componentName, scope } of componentScopes(doc)) {
            checkDuplicateElements(
                diagnostics,
                doc,
                componentName,
                findElements(scope, STATE_TAGS),
                (el) => el.attributes.name ?? el.attributes.id ?? "",
                "state",
                "EUIX1120",
            );
            checkDuplicateElements(
                diagnostics,
                doc,
                componentName,
                findElements(scope, COMPUTED_TAGS),
                (el) => el.attributes.name ?? el.attributes.id ?? "",
                "computed",
                "EUIX1120",
            );
            checkDuplicateElements(
                diagnostics,
                doc,
                componentName,
                findElements(scope, ACTION_TAGS),
                (el) => el.attributes.name ?? el.attributes.id ?? "",
                "action",
                "EUIX1120",
            );
        }
    }

    return diagnostics;
}

export function validateDuplicateApiTags(project: EuixProject): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const byTag = new Map<string, { file: string; line: number; column: number }[]>();

    for (const file of project.files) {
        if (file.kind !== "xml" && file.kind !== "html") continue;
        const doc = parseProjectFile(file);
        for (const el of findElements(documentRoot(doc), API_ENDPOINT_TAGS)) {
            const tag = el.attributes.id ?? el.attributes.tag ?? el.attributes.name;
            if (!tag) continue;
            const loc = makeLocation(doc.file, doc.source, el.start, el.end);
            const list = byTag.get(tag) ?? [];
            list.push({ file: doc.file, line: loc.line, column: loc.column });
            byTag.set(tag, list);
        }
    }

    for (const [tag, entries] of byTag) {
        if (entries.length < 2) continue;
        for (const entry of entries.slice(1)) {
            diagnostics.push({
                id: `EUIX1703:${entry.file}:${entry.line}:${entry.column}`,
                rule: "EUIX1703",
                category: getRuleCategory("EUIX1703"),
                severity: "error",
                message: `Duplicate api_endpoint tag '${tag}' — tags must be unique per project scope.`,
                hint: ruleHint("EUIX1703"),
                explanation: getRuleExplanation("EUIX1703"),
                file: entry.file,
                line: entry.line,
                column: entry.column,
                confidence: "confirmed",
            });
        }
    }

    return diagnostics;
}

export function validateComponentSrcPaths(project: EuixProject): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const ref of project.componentRefs.values()) {
        if (!ref.srcPath) continue;
        if (/^(?:https?:)?\/\/|^(?:data|blob):/i.test(ref.srcPath)) continue;

        const abs = canonicalFilePath(ref.srcPath);
        if (!fs.existsSync(abs)) {
            diagnostics.push({
                id: `EUIX1404:${ref.file}:${ref.location.line}:${ref.location.column}`,
                rule: "EUIX1404",
                category: getRuleCategory("EUIX1404"),
                severity: "error",
                message: `Component src '${displaySrc(ref.srcPath)}' not found (referenced from '${ref.parentComponentName}').`,
                hint: ruleHint("EUIX1404"),
                explanation: getRuleExplanation("EUIX1404"),
                file: ref.file,
                line: ref.location.line,
                column: ref.location.column,
                confidence: "confirmed",
                relatedIds: [ref.id],
            });
            continue;
        }

        const resolved = ref.resolvedComponentId ? project.components.get(ref.resolvedComponentId) : null;
        if (!resolved || !componentDefinesEuixSurface(resolved, project)) {
            diagnostics.push({
                id: `EUIX1404:${ref.file}:${ref.location.line}:${ref.location.column}`,
                rule: "EUIX1404",
                category: getRuleCategory("EUIX1404"),
                severity: "error",
                message: `Component src '${displaySrc(ref.srcPath)}' exists but defines no EUIX component.`,
                hint: ruleHint("EUIX1404"),
                explanation: getRuleExplanation("EUIX1404"),
                file: ref.file,
                line: ref.location.line,
                column: ref.location.column,
                confidence: "confirmed",
                relatedIds: [ref.id],
            });
        }
    }

    return diagnostics;
}

function parseProjectFile(file: EuixFile): ParsedDocument {
    return file.kind === "html"
        ? parseHtmlDocument(file.path, file.source)
        : parseXmlDocument(file.path, file.source);
}

function documentRoot(doc: ParsedDocument): ParsedElement {
    return {
        type: "element",
        tagName: "root",
        attributes: {},
        children: doc.root.filter((node): node is ParsedElement => node.type === "element"),
        selfClosing: false,
        start: 0,
        end: doc.source.length,
    };
}

function componentScopes(doc: ParsedDocument): { componentName: string; scope: ParsedElement }[] {
    const componentEls = doc.root.filter(
        (node): node is ParsedElement => node.type === "element" && COMPONENT_TAGS.has(node.tagName.toLowerCase()),
    );

    if (componentEls.length === 0) {
        return [{ componentName: inferNameFromFile(doc.file), scope: documentRoot(doc) }];
    }

    return componentEls.map((el) => ({
        componentName: el.attributes.name ?? el.attributes.id ?? inferNameFromFile(doc.file),
        scope: el,
    }));
}

function inferNameFromFile(file: string): string {
    const base = file.split(/[/\\]/).pop() ?? "App";
    return base.replace(/\.(xml|html|htm)$/i, "");
}

function checkDuplicateElements(
    diagnostics: Diagnostic[],
    doc: ParsedDocument,
    componentName: string,
    elements: ParsedElement[],
    nameOf: (el: ParsedElement) => string,
    kind: string,
    rule: string,
): void {
    const seen = new Map<string, ParsedElement>();
    for (const el of elements) {
        const name = nameOf(el);
        if (!name) continue;
        const prior = seen.get(name);
        if (!prior) {
            seen.set(name, el);
            continue;
        }
        const loc = makeLocation(doc.file, doc.source, el.start, el.end);
        diagnostics.push({
            id: `${rule}:${doc.file}:${loc.line}:${loc.column}`,
            rule,
            category: getRuleCategory(rule),
            severity: "error",
            message: `Duplicate ${kind} id '${name}' in component '${componentName}'.`,
            hint: ruleHint(rule),
            explanation: getRuleExplanation(rule),
            file: doc.file,
            line: loc.line,
            column: loc.column,
            confidence: "confirmed",
        });
    }
}

function displaySrc(srcPath: string): string {
    return srcPath.split(/[/\\]/).slice(-2).join("/");
}

function componentDefinesEuixSurface(
    component: { file: string; stateIds: string[]; computedIds: string[]; actionIds: string[] },
    project: EuixProject,
): boolean {
    if (component.stateIds.length > 0 || component.computedIds.length > 0 || component.actionIds.length > 0) {
        return true;
    }

    const file = project.files.find((f) => canonicalFilePath(f.path) === canonicalFilePath(component.file));
    if (!file || (file.kind !== "xml" && file.kind !== "html")) return false;

    const doc = parseProjectFile(file);
    const rootTags = doc.root
        .filter((node): node is ParsedElement => node.type === "element")
        .map((node) => node.tagName.toLowerCase());

    return (
        rootTags.some((tag) => COMPONENT_TAGS.has(tag) || tag === "uid_spec") ||
        findElements(documentRoot(doc), STATE_TAGS).length > 0
    );
}
