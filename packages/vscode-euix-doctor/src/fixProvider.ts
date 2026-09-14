import * as vscode from "vscode";
import { collectEuix0001Fixes, type FileFix } from "./euix0001.js";
import {
    buildApiEndpointInsertFix,
    buildStateInsertFix,
    extractUnknownApiTag,
    extractUnknownVariableName,
} from "./quickFixes.js";

export class EuixFixProvider implements vscode.CodeActionProvider {
    static readonly providedCodeActionKinds = [vscode.CodeActionKind.QuickFix];

    provideCodeActions(
        document: vscode.TextDocument,
        _range: vscode.Range,
        context: vscode.CodeActionContext,
    ): vscode.CodeAction[] {
        const doctorDiags = context.diagnostics.filter((d) => d.source === "EUIX Doctor");
        if (doctorDiags.length === 0) return [];

        const actions: vscode.CodeAction[] = [];
        const source = document.getText();

        for (const diagnostic of doctorDiags) {
            const rule = String(diagnostic.code);

            if (rule === "EUIX0001") {
                actions.push(...euix0001Actions(document, source, diagnostic));
                continue;
            }

            if (rule === "EUIX1110" || rule === "EUIX1102") {
                const name = extractUnknownVariableName(diagnostic.message);
                if (!name) continue;
                const fix = buildStateInsertFix(source, document.uri.fsPath, name);
                if (fix) actions.push(toQuickFix(document, fix, diagnostic));
                continue;
            }

            if (rule === "EUIX1701") {
                const tag = extractUnknownApiTag(diagnostic.message);
                if (!tag) continue;
                const fix = buildApiEndpointInsertFix(source, document.uri.fsPath, tag);
                if (fix) actions.push(toQuickFix(document, fix, diagnostic));
            }
        }

        return dedupeActions(actions);
    }
}

function euix0001Actions(
    document: vscode.TextDocument,
    source: string,
    trigger: vscode.Diagnostic,
): vscode.CodeAction[] {
    const fixes = collectEuix0001Fixes(source, document.uri.fsPath);
    if (fixes.length === 0) return [];

    const actions = fixes.map((fix) => toQuickFix(document, fix, trigger));

    if (fixes.length > 1) {
        const fixAll = new vscode.CodeAction(
            "Fix all EUIX0001 (wrap scripts in CDATA)",
            vscode.CodeActionKind.QuickFix,
        );
        fixAll.isPreferred = true;
        fixAll.diagnostics = [trigger];
        const edit = new vscode.WorkspaceEdit();
        for (const fix of fixes.sort((a, b) => b.start - a.start)) {
            edit.replace(document.uri, offsetRange(document, fix.start, fix.end), fix.replacement);
        }
        fixAll.edit = edit;
        actions.push(fixAll);
    }

    return actions;
}

function toQuickFix(
    document: vscode.TextDocument,
    fix: FileFix,
    diagnostic: vscode.Diagnostic,
): vscode.CodeAction {
    const action = new vscode.CodeAction(fix.description, vscode.CodeActionKind.QuickFix);
    action.isPreferred = true;
    action.diagnostics = [diagnostic];

    const edit = new vscode.WorkspaceEdit();
    if (fix.start === fix.end) {
        edit.insert(document.uri, document.positionAt(fix.start), fix.replacement);
    } else {
        edit.replace(document.uri, offsetRange(document, fix.start, fix.end), fix.replacement);
    }
    action.edit = edit;
    return action;
}

function offsetRange(document: vscode.TextDocument, start: number, end: number): vscode.Range {
    return new vscode.Range(document.positionAt(start), document.positionAt(end));
}

function dedupeActions(actions: vscode.CodeAction[]): vscode.CodeAction[] {
    const seen = new Set<string>();
    const out: vscode.CodeAction[] = [];
    for (const action of actions) {
        const key = action.title;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(action);
    }
    return out;
}
