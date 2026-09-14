import { Parser } from "htmlparser2";

export interface FormatOptions {
    indentSize?: number;
}

interface FmtElement {
    type: "element";
    tagName: string;
    attributes: Record<string, string>;
    children: FmtNode[];
    selfClosing: boolean;
}

interface FmtText {
    type: "text";
    data: string;
}

interface FmtCdata {
    type: "cdata";
    data: string;
}

interface FmtComment {
    type: "comment";
    data: string;
}

type FmtNode = FmtElement | FmtText | FmtCdata | FmtComment;

const INLINE_TEXT_MAX = 96;

/** Pretty-print EUIX XML/HTML template documents. Preserves CDATA blocks and attribute values. */
export function formatEuixXml(source: string, options: FormatOptions = {}): string {
    const indentSize = options.indentSize ?? 2;
    const trimmed = source.trim();
    if (!trimmed) return source;

    const prolog = source.match(/^\s*(<\?xml[\s\S]*?\?>)/)?.[1];
    const body = prolog ? source.slice(source.indexOf(prolog) + prolog.length) : source;
    const tree = parseFormatTree(body);
    const formatted = serializeNodes(tree, 0, indentSize).trimEnd();
    return prolog ? `${prolog}\n${formatted}\n` : `${formatted}\n`;
}

function parseFormatTree(source: string): FmtNode[] {
    const root: FmtNode[] = [];
    const stack: FmtElement[] = [];
    let cdataBuffer = "";
    let inCdata = false;

    const parser = new Parser(
        {
            onopentag(name: string, attribs: Record<string, string>, isSelfClosing: boolean) {
                const element: FmtElement = {
                    type: "element",
                    tagName: name,
                    attributes: { ...attribs },
                    children: [],
                    selfClosing: isSelfClosing,
                };
                if (stack.length) stack.at(-1)!.children.push(element);
                else root.push(element);
                if (!isSelfClosing) stack.push(element);
            },
            onclosetag() {
                stack.pop();
            },
            ontext(text: string) {
                if (inCdata) {
                    cdataBuffer += text;
                    return;
                }
                const node: FmtText = { type: "text", data: text };
                if (stack.length) stack.at(-1)!.children.push(node);
                else if (text.trim()) root.push(node);
            },
            oncdatastart() {
                inCdata = true;
                cdataBuffer = "";
            },
            oncdataend() {
                const node: FmtCdata = { type: "cdata", data: cdataBuffer };
                if (stack.length) stack.at(-1)!.children.push(node);
                inCdata = false;
                cdataBuffer = "";
            },
            oncomment(data: string) {
                const node: FmtComment = { type: "comment", data };
                if (stack.length) stack.at(-1)!.children.push(node);
                else root.push(node);
            },
        },
        { xmlMode: true, decodeEntities: false, recognizeSelfClosing: true },
    );

    parser.write(source);
    parser.end();
    return root;
}

function serializeNodes(nodes: FmtNode[], depth: number, indentSize: number): string {
    const lines: string[] = [];
    for (const node of nodes) {
        const chunk = serializeNode(node, depth, indentSize);
        if (chunk) lines.push(chunk);
    }
    return lines.join("\n");
}

function serializeNode(node: FmtNode, depth: number, indentSize: number): string {
    const pad = " ".repeat(depth * indentSize);

    if (node.type === "comment") {
        return `${pad}<!--${node.data}-->`;
    }

    if (node.type === "text") {
        const text = node.data.trim();
        return text ? `${pad}${text}` : "";
    }

    if (node.type === "cdata") {
        const inner = node.data.replace(/^\n?/, "\n").replace(/\n?$/, "\n");
        return `${pad}<![CDATA[${inner}${pad}]]>`;
    }

    const attrs = formatAttributes(node.attributes);
    const open = attrs ? `<${node.tagName} ${attrs}>` : `<${node.tagName}>`;

    if (node.selfClosing) {
        return `${pad}${open.slice(0, -1)} />`;
    }

    const contentNodes = node.children.filter((child) => child.type !== "text" || child.data.trim());
    if (contentNodes.length === 0) {
        return `${pad}${open.slice(0, -1)} />`;
    }

    if (shouldInlineContent(contentNodes)) {
        const inline = contentNodes
            .map((child) => {
                if (child.type === "text") return child.data.trim();
                if (child.type === "cdata") return `<![CDATA[${child.data}]]>`;
                return serializeNode(child, 0, indentSize).trim();
            })
            .join("");
        return `${pad}${open.slice(0, -1)}>${inline}</${node.tagName}>`;
    }

    const inner = serializeNodes(contentNodes, depth + 1, indentSize);
    return `${pad}${open}\n${inner}\n${pad}</${node.tagName}>`;
}

function shouldInlineContent(nodes: FmtNode[]): boolean {
    if (nodes.length !== 1) return false;
    const only = nodes[0]!;
    if (only.type === "cdata") return false;
    if (only.type === "element") return false;
    if (only.type === "text") {
        const text = only.data.trim();
        return text.length > 0 && !text.includes("\n") && text.length <= INLINE_TEXT_MAX;
    }
    return false;
}

function formatAttributes(attributes: Record<string, string>): string {
    const entries = Object.entries(attributes);
    if (entries.length === 0) return "";
    return entries.map(([key, value]) => `${key}="${escapeAttr(value)}"`).join(" ");
}

function escapeAttr(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}
