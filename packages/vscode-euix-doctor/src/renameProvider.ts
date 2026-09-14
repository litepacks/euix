import * as vscode from "vscode";
import { getAllReferences, getAllSymbols } from "./symbolCache.js";
import { referenceLocation, resolveTargetSymbolName, symbolLocation } from "./symbolUtils.js";

export class EuixRenameProvider implements vscode.RenameProvider {
    prepareRename(document: vscode.TextDocument, position: vscode.Position): vscode.Range | null {
        const name = resolveTargetSymbolName(document, position);
        if (!name) return null;

        const wordRange =
            document.getWordRangeAtPosition(position, /[A-Za-z_$][\w]*/) ??
            document.getWordRangeAtPosition(position);
        if (!wordRange || document.getText(wordRange) !== name) return null;

        const hasSymbol =
            getAllSymbols().some((s) => s.name === name) ||
            getAllReferences().some((r) => r.symbolName === name);
        if (!hasSymbol) return null;

        return wordRange;
    }

    async provideRenameEdits(
        document: vscode.TextDocument,
        position: vscode.Position,
        newName: string,
    ): Promise<vscode.WorkspaceEdit | null> {
        const oldName = resolveTargetSymbolName(document, position);
        if (!oldName || oldName === newName) return null;

        const edit = new vscode.WorkspaceEdit();
        const touched = new Set<string>();

        for (const symbol of getAllSymbols().filter((s) => s.name === oldName)) {
            const uri = vscode.Uri.file(symbol.file);
            const doc = await openDocument(uri);
            for (const range of findNameRanges(doc, oldName, symbolLocation(symbol).range)) {
                const key = `${uri.toString()}:${range.start.line}:${range.start.character}`;
                if (touched.has(key)) continue;
                touched.add(key);
                edit.replace(uri, range, newName);
            }
        }

        for (const ref of getAllReferences().filter((r) => r.symbolName === oldName && r.usageKind !== "definition")) {
            const uri = vscode.Uri.file(ref.file);
            const doc = await openDocument(uri);
            for (const range of findNameRanges(doc, oldName, referenceLocation(ref).range)) {
                const key = `${uri.toString()}:${range.start.line}:${range.start.character}`;
                if (touched.has(key)) continue;
                touched.add(key);
                edit.replace(uri, range, newName);
            }
        }

        return touched.size > 0 ? edit : null;
    }
}

async function openDocument(uri: vscode.Uri): Promise<vscode.TextDocument> {
    return vscode.workspace.openTextDocument(uri);
}

function findNameRanges(document: vscode.TextDocument, name: string, span: vscode.Range): vscode.Range[] {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const pattern = new RegExp(`\\b${escaped}\\b`, "g");
    const ranges: vscode.Range[] = [];

    for (let line = span.start.line; line <= span.end.line; line++) {
        const text = document.lineAt(line).text;
        const sliceStart = line === span.start.line ? span.start.character : 0;
        const sliceEnd = line === span.end.line ? span.end.character : text.length;
        const slice = text.slice(sliceStart, sliceEnd);
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(slice)) !== null) {
            ranges.push(
                new vscode.Range(
                    line,
                    sliceStart + match.index,
                    line,
                    sliceStart + match.index + name.length,
                ),
            );
        }
    }

    return ranges;
}
