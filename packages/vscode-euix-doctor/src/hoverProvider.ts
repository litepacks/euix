import * as vscode from "vscode";
import { getAllSymbols } from "./symbolCache.js";
import { resolveApiTagReference, resolveReferenceName } from "./symbolUtils.js";
import type { EditorSymbol } from "./doctorCli.js";

export class EuixHoverProvider implements vscode.HoverProvider {
    provideHover(document: vscode.TextDocument, position: vscode.Position): vscode.Hover | null {
        const apiTag = resolveApiTagReference(document, position);
        const name = resolveReferenceName(document, position);
        if (!name && !apiTag) return null;

        const symbols = getAllSymbols();
        const match =
            (apiTag ? symbols.find((s) => s.kind === "api" && s.name === apiTag) : undefined) ??
            symbols.find(
                (s) =>
                    s.file === document.uri.fsPath &&
                    (s.kind === "state" || s.kind === "computed" || s.kind === "action") &&
                    s.name === name,
            ) ??
            symbols.find((s) => (s.kind === "state" || s.kind === "computed") && s.name === name);

        if (!match) return null;

        return new vscode.Hover(new vscode.MarkdownString(formatSymbolHover(match)));
    }
}

function formatSymbolHover(symbol: EditorSymbol): string {
    const lines = [`**${symbol.kind}** \`${symbol.name}\``];

    if (symbol.detail?.componentName) lines.push(`Component: \`${symbol.detail.componentName}\``);
    if (symbol.detail?.stateType) lines.push(`Type: \`${symbol.detail.stateType}\``);
    if (symbol.detail?.initialValue !== undefined && symbol.detail.initialValue !== null) {
        lines.push(`Initial: \`${symbol.detail.initialValue}\``);
    }
    if (symbol.detail?.dependencies?.length) {
        lines.push(`Deps: ${symbol.detail.dependencies.map((d) => `\`${d}\``).join(", ")}`);
    }
    if (symbol.detail?.expression) {
        lines.push(`Expression: \`${symbol.detail.expression}\``);
    }
    if (symbol.detail?.apiMethod) lines.push(`Method: \`${symbol.detail.apiMethod}\``);
    if (symbol.detail?.apiUrl) lines.push(`URL: \`${symbol.detail.apiUrl}\``);
    if (symbol.detail?.readerCount !== undefined) lines.push(`Readers: ${symbol.detail.readerCount}`);
    if (symbol.detail?.writerCount !== undefined) lines.push(`Writers: ${symbol.detail.writerCount}`);

    return lines.join("\n\n");
}
