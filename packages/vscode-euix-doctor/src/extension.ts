import path from "node:path";
import * as vscode from "vscode";
import { runAnalyze, runDoctorTests, type AnalyzeResult, type DoctorDiagnostic } from "./doctorCli.js";
import { EuixCompletionProvider } from "./completionProvider.js";
import { EuixDefinitionProvider } from "./definitionProvider.js";
import { collectEuix0001Fixes } from "./euix0001.js";
import { EuixFixProvider } from "./fixProvider.js";
import { runFormat } from "./formatter.js";
import { EuixHoverProvider } from "./hoverProvider.js";
import { EuixReferenceProvider } from "./referenceProvider.js";
import { EuixRenameProvider } from "./renameProvider.js";
import { clearAnalysisCache, updateAnalysisCache } from "./symbolCache.js";

const EUIX_FILE_EXT = new Set([".xml", ".html", ".htm", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"]);
const EUIX_FORMAT_EXT = new Set([".xml", ".html", ".htm"]);
const DIAGNOSTIC_SOURCE = "EUIX Doctor";

let diagnosticCollection: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem | undefined;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let analysisVersion = 0;
let extensionContext: vscode.ExtensionContext;

export function activate(context: vscode.ExtensionContext): void {
    extensionContext = context;
    diagnosticCollection = vscode.languages.createDiagnosticCollection("euix-doctor");
    context.subscriptions.push(diagnosticCollection);

    if (getConfig().showStatusBar) {
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        statusBarItem.command = "euixDoctor.analyzeWorkspace";
        statusBarItem.tooltip = "Run EUIX Doctor analysis";
        context.subscriptions.push(statusBarItem);
    }

    context.subscriptions.push(
        vscode.commands.registerCommand("euixDoctor.analyzeWorkspace", () => analyzeWorkspace(context)),
        vscode.commands.registerCommand("euixDoctor.analyzeFile", () => analyzeActiveEditor(context)),
        vscode.commands.registerCommand("euixDoctor.runTests", () => runSafeTests(context)),
        vscode.commands.registerCommand("euixDoctor.fixFile", () => fixCurrentFile(context)),
        vscode.commands.registerCommand("euixDoctor.formatDocument", () => formatActiveEditor(context)),
        vscode.languages.registerCodeActionsProvider(
            [{ language: "xml" }, { language: "html" }],
            new EuixFixProvider(),
            { providedCodeActionKinds: EuixFixProvider.providedCodeActionKinds },
        ),
        vscode.languages.registerDocumentFormattingEditProvider(
            [{ language: "xml" }, { language: "html" }],
            new EuixDocumentFormatter(context),
        ),
        vscode.languages.registerDefinitionProvider(
            [{ language: "xml" }, { language: "html" }],
            new EuixDefinitionProvider(),
        ),
        vscode.languages.registerReferenceProvider(
            [{ language: "xml" }, { language: "html" }],
            new EuixReferenceProvider(),
        ),
        vscode.languages.registerHoverProvider(
            [{ language: "xml" }, { language: "html" }],
            new EuixHoverProvider(),
        ),
        vscode.languages.registerCompletionItemProvider(
            [{ language: "xml" }, { language: "html" }],
            new EuixCompletionProvider(),
            ".",
            '"',
            "{",
        ),
        vscode.languages.registerRenameProvider(
            [{ language: "xml" }, { language: "html" }],
            new EuixRenameProvider(),
        ),
        vscode.workspace.onDidSaveTextDocument((doc) => void onDidSave(context, doc)),
        vscode.workspace.onDidChangeTextDocument(onDidChange),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("euixDoctor")) {
                const editor = vscode.window.activeTextEditor;
                if (editor && isEuixFile(editor.document.uri.fsPath)) {
                    void analyzeDocument(context, editor.document);
                }
            }
        }),
    );

    if (getConfig().runOnOpen) {
        const editor = vscode.window.activeTextEditor;
        if (editor && isEuixFile(editor.document.uri.fsPath)) {
            void analyzeDocument(context, editor.document);
        }
    }
}

export function deactivate(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    diagnosticCollection?.clear();
    statusBarItem?.hide();
}

class EuixDocumentFormatter implements vscode.DocumentFormattingEditProvider {
    constructor(private readonly context: vscode.ExtensionContext) {}

    async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
        const config = getConfig();
        if (!config.formatEnable || !isEuixFormatFile(document.uri.fsPath)) return [];

        const root = getWorkspaceRoot() ?? path.dirname(document.uri.fsPath);
        const formatted = await runFormat(
            this.context,
            root,
            document.getText(),
            document.uri.fsPath,
            config.formatIndentSize,
        );

        if (formatted === document.getText()) return [];

        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length),
        );
        return [new vscode.TextEdit(fullRange, formatted)];
    }
}

function getConfig(): {
    enable: boolean;
    runOnSave: boolean;
    runOnType: boolean;
    runOnOpen: boolean;
    debounceMs: number;
    showStatusBar: boolean;
    formatEnable: boolean;
    formatOnSave: boolean;
    formatIndentSize: number;
} {
    const cfg = vscode.workspace.getConfiguration("euixDoctor");
    return {
        enable: cfg.get<boolean>("enable", true),
        runOnSave: cfg.get<boolean>("runOnSave", true),
        runOnType: cfg.get<boolean>("runOnType", true),
        runOnOpen: cfg.get<boolean>("runOnOpen", false),
        debounceMs: cfg.get<number>("debounceMs", 400),
        showStatusBar: cfg.get<boolean>("showStatusBar", true),
        formatEnable: cfg.get<boolean>("format.enable", true),
        formatOnSave: cfg.get<boolean>("formatOnSave", true),
        formatIndentSize: cfg.get<number>("format.indentSize", 2),
    };
}

function getWorkspaceRoot(): string | undefined {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders?.length) return undefined;
    return folders[0]!.uri.fsPath;
}

function isEuixFile(filePath: string): boolean {
    return EUIX_FILE_EXT.has(path.extname(filePath).toLowerCase());
}

function isEuixFormatFile(filePath: string): boolean {
    return EUIX_FORMAT_EXT.has(path.extname(filePath).toLowerCase());
}

function scheduleAnalyze(document: vscode.TextDocument): void {
    const config = getConfig();
    if (!config.enable || !config.runOnType || !isEuixFile(document.uri.fsPath)) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        void analyzeDocument(extensionContext, document);
    }, config.debounceMs);
}

function onDidChange(event: vscode.TextDocumentChangeEvent): void {
    scheduleAnalyze(event.document);
}

async function onDidSave(context: vscode.ExtensionContext, document: vscode.TextDocument): Promise<void> {
    const config = getConfig();
    if (!config.enable || !isEuixFile(document.uri.fsPath)) return;

    let activeDoc = document;
    if (config.formatOnSave && config.formatEnable && isEuixFormatFile(document.uri.fsPath)) {
        activeDoc = (await applyFormat(context, document)) ?? document;
    }

    if (config.runOnSave) {
        await analyzeDocument(context, activeDoc);
    }
}

async function applyFormat(
    context: vscode.ExtensionContext,
    document: vscode.TextDocument,
): Promise<vscode.TextDocument | undefined> {
    const config = getConfig();
    const root = getWorkspaceRoot() ?? path.dirname(document.uri.fsPath);

    try {
        const formatted = await runFormat(
            context,
            root,
            document.getText(),
            document.uri.fsPath,
            config.formatIndentSize,
        );
        if (formatted === document.getText()) return document;

        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(document.getText().length),
        );
        edit.replace(document.uri, fullRange, formatted);
        const applied = await vscode.workspace.applyEdit(edit);
        if (!applied) return document;

        return vscode.workspace.textDocuments.find((d) => d.uri.toString() === document.uri.toString()) ?? document;
    } catch {
        return document;
    }
}

async function analyzeDocument(
    context: vscode.ExtensionContext,
    document: vscode.TextDocument,
): Promise<void> {
    const config = getConfig();
    if (!config.enable) return;

    const filePath = document.uri.fsPath;
    const root = getWorkspaceRoot() ?? path.dirname(filePath);
    const version = ++analysisVersion;

    if (statusBarItem) {
        statusBarItem.text = "$(sync~spin) EUIX Doctor";
        statusBarItem.show();
    }

    try {
        const result = await runAnalyze(context, root, filePath, document.getText());
        if (version !== analysisVersion) return;

        publishDiagnostics(result, [filePath]);
        cacheAnalysisSymbols(result, [filePath]);
        updateStatusBar(result);
    } catch (error) {
        if (version !== analysisVersion) return;
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`EUIX Doctor failed: ${message}`);
        updateStatusBar(null);
    }
}

async function analyzeWorkspace(context?: vscode.ExtensionContext, _triggerFile?: string): Promise<void> {
    const config = getConfig();
    if (!config.enable) {
        diagnosticCollection.clear();
        updateStatusBar(null);
        return;
    }

    const root = getWorkspaceRoot();
    if (!root) {
        void vscode.window.showWarningMessage("EUIX Doctor: open a workspace folder first.");
        return;
    }

    const ctx = context ?? extensionContext;
    const version = ++analysisVersion;

    if (statusBarItem) {
        statusBarItem.text = "$(sync~spin) EUIX Doctor";
        statusBarItem.show();
    }

    try {
        const result = await runAnalyze(ctx, root);
        if (version !== analysisVersion) return;

        publishDiagnostics(result);
        cacheAnalysisSymbols(result);
        updateStatusBar(result);

        if (context && result.stats.errors > 0) {
            void vscode.commands.executeCommand("workbench.action.problems.focus");
        }

        void vscode.window.setStatusBarMessage(
            `EUIX Doctor: ${result.stats.errors} error(s), ${result.stats.warnings} warning(s)`,
            3000,
        );
    } catch (error) {
        if (version !== analysisVersion) return;
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`EUIX Doctor failed: ${message}`);
        updateStatusBar(null);
    }
}

async function analyzeActiveEditor(context: vscode.ExtensionContext): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        void vscode.window.showWarningMessage("EUIX Doctor: no active editor.");
        return;
    }

    if (!isEuixFile(editor.document.uri.fsPath)) {
        void vscode.window.showWarningMessage("EUIX Doctor: active file is not a supported EUIX source.");
        return;
    }

    await analyzeDocument(context, editor.document);
}

async function formatActiveEditor(context: vscode.ExtensionContext): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        void vscode.window.showWarningMessage("EUIX Doctor: no active editor.");
        return;
    }

    if (!isEuixFormatFile(editor.document.uri.fsPath)) {
        void vscode.window.showWarningMessage("EUIX Doctor: formatter supports .xml and .html EUIX files.");
        return;
    }

    await vscode.commands.executeCommand("editor.action.formatDocument");
    await analyzeDocument(context, editor.document);
}

async function fixCurrentFile(context: vscode.ExtensionContext): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        void vscode.window.showWarningMessage("EUIX Doctor: no active editor.");
        return;
    }

    const document = editor.document;
    if (!isEuixFile(document.uri.fsPath)) {
        void vscode.window.showWarningMessage("EUIX Doctor: active file is not a supported EUIX source.");
        return;
    }

    const fixes = collectEuix0001Fixes(document.getText(), document.uri.fsPath);
    if (fixes.length === 0) {
        void vscode.window.showInformationMessage("EUIX Doctor: no auto-fixes available in this file.");
        return;
    }

    const edit = new vscode.WorkspaceEdit();
    for (const fix of fixes.sort((a, b) => b.start - a.start)) {
        edit.replace(
            document.uri,
            new vscode.Range(document.positionAt(fix.start), document.positionAt(fix.end)),
            fix.replacement,
        );
    }

    const applied = await vscode.workspace.applyEdit(edit);
    if (applied) {
        await analyzeDocument(context, document);
        void vscode.window.showInformationMessage(`EUIX Doctor: applied ${fixes.length} fix(es).`);
    }
}

async function runSafeTests(context: vscode.ExtensionContext): Promise<void> {
    const root = getWorkspaceRoot();
    if (!root) {
        void vscode.window.showWarningMessage("EUIX Doctor: open a workspace folder first.");
        return;
    }

    try {
        await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: "EUIX Doctor: running safe test scenarios",
                cancellable: false,
            },
            async () => {
                const result = await runDoctorTests(context, root);

                if (result.failed === 0) {
                    void vscode.window.showInformationMessage(
                        `EUIX Doctor: ${result.passed}/${result.passed + result.failed} scenarios passed.`,
                    );
                    return;
                }

                void vscode.window.showWarningMessage(
                    `EUIX Doctor: ${result.failed} scenario(s) failed.`,
                    { modal: true, detail: result.details.join("\n") },
                );
            },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`EUIX Doctor tests failed: ${message}`);
    }
}

function cacheAnalysisSymbols(result: AnalyzeResult, targetFiles?: string[]): void {
    if (targetFiles?.length === 1) {
        updateAnalysisCache(targetFiles[0]!, result.symbols, result.references, "file");
        return;
    }

    clearAnalysisCache();
    updateAnalysisCache("", result.symbols, result.references, "workspace");
}

function publishDiagnostics(result: AnalyzeResult, targetFiles?: string[]): void {
    if (targetFiles?.length) {
        for (const file of targetFiles) {
            const uri = vscode.Uri.file(file);
            const diagnostics = result.diagnostics
                .filter((d) => d.file === file)
                .map(toVscodeDiagnostic);
            diagnosticCollection.set(uri, diagnostics);
        }
        return;
    }

    diagnosticCollection.clear();

    const grouped = new Map<string, vscode.Diagnostic[]>();
    for (const diagnostic of result.diagnostics) {
        const uri = vscode.Uri.file(diagnostic.file).toString();
        const list = grouped.get(uri) ?? [];
        list.push(toVscodeDiagnostic(diagnostic));
        grouped.set(uri, list);
    }

    for (const [uri, diagnostics] of grouped) {
        diagnosticCollection.set(vscode.Uri.parse(uri), diagnostics);
    }
}

function toVscodeDiagnostic(diagnostic: DoctorDiagnostic): vscode.Diagnostic {
    const line = Math.max(0, diagnostic.line - 1);
    const column = Math.max(0, diagnostic.column - 1);
    const range = new vscode.Range(line, column, line, column + 1);

    const severity =
        diagnostic.severity === "error"
            ? vscode.DiagnosticSeverity.Error
            : diagnostic.severity === "warning"
              ? vscode.DiagnosticSeverity.Warning
              : vscode.DiagnosticSeverity.Information;

    const item = new vscode.Diagnostic(range, diagnostic.message, severity);
    item.source = DIAGNOSTIC_SOURCE;
    item.code = diagnostic.rule;
    return item;
}

function updateStatusBar(result: AnalyzeResult | null): void {
    if (!statusBarItem) return;

    if (!result) {
        statusBarItem.hide();
        return;
    }

    const { errors, warnings } = result.stats;
    const icon = errors > 0 ? "$(error)" : warnings > 0 ? "$(warning)" : "$(check)";

    statusBarItem.text = `${icon} EUIX`;
    statusBarItem.tooltip = `EUIX Doctor — ${errors} error(s), ${warnings} warning(s). Click to re-analyze.`;
    statusBarItem.show();
}
