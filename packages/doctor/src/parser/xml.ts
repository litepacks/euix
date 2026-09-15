import { Parser } from "htmlparser2";
import { makeLocation } from "../utils/location.js";

export interface ParsedElement {
    type: "element";
    tagName: string;
    attributes: Record<string, string>;
    children: ParsedNode[];
    selfClosing: boolean;
    start: number;
    end: number;
}

export interface ParsedText {
    type: "text";
    data: string;
    start: number;
    end: number;
}

export type ParsedNode = ParsedElement | ParsedText;

export interface ParsedDocument {
    file: string;
    source: string;
    root: ParsedNode[];
}

export function parseXmlDocument(file: string, source: string): ParsedDocument {
    const root: ParsedNode[] = [];
    const stack: ParsedElement[] = [];

    const parser = new Parser(
        {
            onopentag(name: string, attribs: Record<string, string>) {
                const start = parser.startIndex;
                const element: ParsedElement = {
                    type: "element",
                    tagName: name.toLowerCase(),
                    attributes: { ...attribs },
                    children: [],
                    selfClosing: false,
                    start,
                    end: start,
                };
                if (stack.length === 0) root.push(element);
                else stack.at(-1)!.children.push(element);
                stack.push(element);
            },
            onclosetag(_name: string) {
                const current = stack.pop();
                if (!current) return;
                current.end = parser.endIndex ?? current.start;
                if (stack.length === 0 && !root.includes(current)) root.push(current);
            },
            ontext(text: string) {
                if (!text.trim()) return;
                const node: ParsedText = {
                    type: "text",
                    data: text,
                    start: parser.startIndex,
                    end: parser.endIndex ?? parser.startIndex + text.length,
                };
                if (stack.length) stack.at(-1)!.children.push(node);
                else root.push(node);
            },
            oncomment() {},
            onprocessinginstruction() {},
        },
        { xmlMode: true, decodeEntities: true, lowerCaseAttributeNames: false },
    );

    parser.write(source);
    parser.end();

    return { file, source, root };
}

export function parseHtmlDocument(file: string, source: string): ParsedDocument {
    const root: ParsedNode[] = [];
    const stack: ParsedElement[] = [];

    const parser = new Parser(
        {
            onopentag(name: string, attribs: Record<string, string>) {
                const start = parser.startIndex;
                const element: ParsedElement = {
                    type: "element",
                    tagName: name.toLowerCase(),
                    attributes: { ...attribs },
                    children: [],
                    selfClosing: false,
                    start,
                    end: start,
                };
                if (stack.length === 0) root.push(element);
                else stack.at(-1)!.children.push(element);
                stack.push(element);
            },
            onclosetag(_name: string) {
                const current = stack.pop();
                if (!current) return;
                current.end = parser.endIndex ?? current.start;
            },
            ontext(text: string) {
                const node: ParsedText = {
                    type: "text",
                    data: text,
                    start: parser.startIndex,
                    end: parser.endIndex ?? parser.startIndex + text.length,
                };
                if (stack.length) stack.at(-1)!.children.push(node);
            },
        },
        { xmlMode: false, decodeEntities: true },
    );

    parser.write(source);
    parser.end();
    return { file, source, root };
}

export function elementTextContent(node: ParsedElement): string {
    return node.children
        .map((child) => (child.type === "text" ? child.data : child.type === "element" ? " " + elementTextContent(child) + " " : ""))
        .join("")
        .trim();
}

export function findElements(node: ParsedNode | ParsedNode[], tagNames: Set<string>, out: ParsedElement[] = []): ParsedElement[] {
    const nodes = Array.isArray(node) ? node : [node];
    for (const n of nodes) {
        if (n.type === "element") {
            if (tagNames.has(n.tagName)) out.push(n);
            findElements(n.children, tagNames, out);
        }
    }
    return out;
}

export function walkElements(node: ParsedNode | ParsedNode[], visit: (el: ParsedElement, parent: ParsedElement | null) => void, parent: ParsedElement | null = null): void {
    const nodes = Array.isArray(node) ? node : [node];
    for (const n of nodes) {
        if (n.type === "element") {
            visit(n, parent);
            walkElements(n.children, visit, n);
        }
    }
}

export { makeLocation };
