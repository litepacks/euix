import * as vscode from "vscode";
import { getAllSymbols, getSymbols } from "./symbolCache.js";
import type { EditorSymbol } from "./doctorCli.js";
import { detectCompletionContext } from "./symbolUtils.js";

const KIND_MAP: Record<EditorSymbol["kind"], vscode.CompletionItemKind> = {
    state: vscode.CompletionItemKind.Variable,
    computed: vscode.CompletionItemKind.Property,
    api: vscode.CompletionItemKind.Interface,
    prop: vscode.CompletionItemKind.Field,
    action: vscode.CompletionItemKind.Function,
};

export class EuixCompletionProvider implements vscode.CompletionItemProvider {
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.CompletionItem[] | null {
        const context = detectCompletionContext(document, position);
        if (context === "none") return null;

        const fileSymbols = getSymbols(document.uri.fsPath);
        const pool = fileSymbols.length > 0 ? fileSymbols : getAllSymbols();
        if (pool.length === 0) return null;

        const filtered = filterSymbols(pool, context);
        const seen = new Set<string>();
        const items: vscode.CompletionItem[] = [];

        for (const symbol of filtered) {
            if (seen.has(symbol.name)) continue;
            seen.add(symbol.name);

            const item = new vscode.CompletionItem(symbol.name, KIND_MAP[symbol.kind]);
            item.detail = symbol.kind;
            if (symbol.detail?.componentName) {
                item.documentation = `${symbol.kind} in ${symbol.detail.componentName}`;
            }
            if (context === "api") {
                item.insertText = symbol.name;
            } else if (context === "data") {
                item.insertText = symbol.kind === "api" ? symbol.name : symbol.name;
            }
            items.push(item);
        }

        return items.length > 0 ? items : null;
    }
}

function filterSymbols(
    symbols: EditorSymbol[],
    context: ReturnType<typeof detectCompletionContext>,
): EditorSymbol[] {
    switch (context) {
        case "api":
            return symbols.filter((s) => s.kind === "api");
        case "action":
            return symbols.filter((s) => s.kind === "action");
        case "deps":
            return symbols.filter((s) => s.kind === "state" || s.kind === "computed");
        case "data":
            return symbols.filter((s) => s.kind === "state" || s.kind === "computed" || s.kind === "prop");
        case "general":
            return symbols;
        default:
            return symbols;
    }
}
