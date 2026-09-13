import path from "node:path";
import { analyzeTarget, runDoctor } from "@euix/doctor";
import type { Diagnostic as EuixDiagnostic, EuixProject } from "@euix/doctor";
import * as vscode from "vscode";

const EUIX_FILE_EXT = new Set([".xml", ".html", ".htm", ".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"]);
const DIAGNOSTIC_SOURCE = "EUIX Doctor";

let diagnosticCollection: vscode.DiagnosticCollection;
let statusBarItem: vscode.StatusBarItem | undefined;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let analysisVersion = 0;

export function activate(context: vscode.ExtensionContext): void {
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
        vscode.commands.registerCommand("euixDoctor.analyzeFile", () => analyzeCurrentFile(context)),
        vscode.commands.registerCommand("euixDoctor.runTests", () => runSafeTests(context)),
        vscode.workspace.onDidSaveTextDocument(onDidSave),
        vscode.workspace.onDidChangeConfiguration((e) => {
            if (e.affectsConfiguration("euixDoctor")) {
                void analyzeWorkspace(context);
            }
        }),
    );

    if (getConfig().runOnOpen) {
        void analyzeWorkspace(context);
    }
}

export function deactivate(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    diagnosticCollection?.clear();
    statusBarItem?.hide();
}

function getConfig(): {
    enable: boolean;
    runOnSave: boolean;
    runOnOpen: boolean;
    debounceMs: number;
    showStatusBar: boolean;
} {
    const cfg = vscode.workspace.getConfiguration("euixDoctor");
    return {
        enable: cfg.get<boolean>("enable", true),
        runOnSave: cfg.get<boolean>("runOnSave", true),
        runOnOpen: cfg.get<boolean>("runOnOpen", false),
        debounceMs: cfg.get<number>("debounceMs", 400),
        showStatusBar: cfg.get<boolean>("showStatusBar", true),
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

function onDidSave(document: vscode.TextDocument): void {
    const config = getConfig();
    if (!config.enable || !config.runOnSave || !isEuixFile(document.uri.fsPath)) return;

    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
        void analyzeWorkspace(undefined, document.uri.fsPath);
    }, config.debounceMs);
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

    const version = ++analysisVersion;

    if (statusBarItem) {
        statusBarItem.text = "$(sync~spin) EUIX Doctor";
        statusBarItem.show();
    }

    try {
        const project = await analyzeTarget(root);
        if (version !== analysisVersion) return;

        publishDiagnostics(project);
        updateStatusBar(project);

        const errors = project.diagnostics.filter((d) => d.severity === "error").length;
        const warnings = project.diagnostics.filter((d) => d.severity === "warning").length;

        if (context && errors > 0) {
            void vscode.commands.executeCommand("workbench.action.problems.focus");
        }

        void vscode.window.setStatusBarMessage(
            `EUIX Doctor: ${errors} error(s), ${warnings} warning(s)`,
            3000,
        );
    } catch (error) {
        if (version !== analysisVersion) return;
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`EUIX Doctor failed: ${message}`);
        updateStatusBar(null);
    }
}

async function analyzeCurrentFile(_context: vscode.ExtensionContext): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        void vscode.window.showWarningMessage("EUIX Doctor: no active editor.");
        return;
    }

    const filePath = editor.document.uri.fsPath;
    if (!isEuixFile(filePath)) {
        void vscode.window.showWarningMessage("EUIX Doctor: active file is not a supported EUIX source.");
        return;
    }

    const root = getWorkspaceRoot() ?? path.dirname(filePath);
    const version = ++analysisVersion;

    try {
        const project = await analyzeTarget(root, filePath);
        if (version !== analysisVersion) return;
        publishDiagnostics(project);
        updateStatusBar(project);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`EUIX Doctor failed: ${message}`);
    }
}

async function runSafeTests(_context: vscode.ExtensionContext): Promise<void> {
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
                const result = await runDoctor({ root, test: true });
                const failed = result.testResults.filter((r) => !r.passed);
                const passed = result.testResults.length - failed.length;

                if (failed.length === 0) {
                    void vscode.window.showInformationMessage(
                        `EUIX Doctor: ${passed}/${result.testResults.length} scenarios passed.`,
                    );
                    return;
                }

                const detail = failed
                    .slice(0, 5)
                    .map((r) => `${r.name}: ${r.message ?? "failed"}`)
                    .join("\n");

                void vscode.window.showWarningMessage(
                    `EUIX Doctor: ${failed.length} scenario(s) failed.`,
                    { modal: true, detail },
                );
            },
        );
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        void vscode.window.showErrorMessage(`EUIX Doctor tests failed: ${message}`);
    }
}

function publishDiagnostics(project: EuixProject): void {
    diagnosticCollection.clear();

    const grouped = new Map<string, vscode.Diagnostic[]>();

    for (const diagnostic of project.diagnostics) {
        const uri = vscode.Uri.file(diagnostic.file).toString();
        const list = grouped.get(uri) ?? [];
        list.push(toVscodeDiagnostic(diagnostic));
        grouped.set(uri, list);
    }

    for (const [uri, diagnostics] of grouped) {
        diagnosticCollection.set(vscode.Uri.parse(uri), diagnostics);
    }
}

function toVscodeDiagnostic(diagnostic: EuixDiagnostic): vscode.Diagnostic {
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

function updateStatusBar(project: EuixProject | null): void {
    if (!statusBarItem) return;

    if (!project) {
        statusBarItem.hide();
        return;
    }

    const errors = project.diagnostics.filter((d) => d.severity === "error").length;
    const warnings = project.diagnostics.filter((d) => d.severity === "warning").length;
    const icon = errors > 0 ? "$(error)" : warnings > 0 ? "$(warning)" : "$(check)";

    statusBarItem.text = `${icon} EUIX`;
    statusBarItem.tooltip = `EUIX Doctor — ${errors} error(s), ${warnings} warning(s). Click to re-analyze.`;
    statusBarItem.show();
}
