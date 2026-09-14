import * as vscode from "vscode";

export function resolveReferenceName(document: vscode.TextDocument, position: vscode.Position): string | undefined {
    const range =
        document.getWordRangeAtPosition(position, /[A-Za-z_$][\w]*/) ??
        document.getWordRangeAtPosition(position);
    if (!range) return undefined;
    return document.getText(range);
}

export function resolveApiTagReference(document: vscode.TextDocument, position: vscode.Position): string | undefined {
    const line = document.lineAt(position.line).text;
    const before = line.slice(0, position.character);
    const match = before.match(/api\.([A-Za-z_][\w]*)\.?[\w]*$/);
    return match?.[1];
}

export function resolveTargetSymbolName(
    document: vscode.TextDocument,
    position: vscode.Position,
): string | undefined {
    const apiTag = resolveApiTagReference(document, position);
    if (apiTag) return apiTag;
    return resolveReferenceName(document, position);
}

export function symbolLocation(symbol: {
    file: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
}): vscode.Location {
    const start = new vscode.Position(Math.max(0, symbol.line - 1), Math.max(0, symbol.column - 1));
    const end = new vscode.Position(Math.max(0, symbol.endLine - 1), Math.max(0, symbol.endColumn - 1));
    return new vscode.Location(vscode.Uri.file(symbol.file), new vscode.Range(start, end));
}

export type CompletionContext = "none" | "api" | "action" | "deps" | "data" | "general";

export function detectCompletionContext(
    document: vscode.TextDocument,
    position: vscode.Position,
): CompletionContext {
    const line = document.lineAt(position.line).text;
    const before = line.slice(0, position.character);

    if (/api\.[\w]*$/.test(before)) return "api";
    if (/\bdeps\s*=\s*"[^"]*$/.test(before)) return "deps";
    if (/\b(action|@click|on_click)\s*=\s*"[^"]*$/.test(before)) return "action";
    if (/(\{[^}]*|\bdata\.[\w.]*)$/.test(before)) return "data";
    if (/bind\s*=\s*"[^"]*$/.test(before)) return "data";
    if (/path\s*=\s*"[^"]*$/.test(before)) return "data";
    if (/tag\s*=\s*"[^"]*$/.test(before)) return "api";

    const word = resolveReferenceName(document, position);
    if (word && word.length >= 1) return "general";

    return "none";
}

export function referenceLocation(ref: {
    file: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
}): vscode.Location {
    return symbolLocation(ref);
}
