import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { ExtensionContext } from "vscode";
import { execNodeScript } from "./execNode.js";

const execFileAsync = promisify(execFile);

export interface DoctorDiagnostic {
    id: string;
    rule: string;
    severity: "error" | "warning" | "info";
    message: string;
    hint?: string;
    file: string;
    line: number;
    column: number;
    confidence: string;
}

export interface EditorSymbolDetail {
    componentName?: string;
    stateType?: string | null;
    initialValue?: string | null;
    expression?: string;
    dependencies?: string[];
    apiMethod?: string;
    apiUrl?: string;
    readerCount?: number;
    writerCount?: number;
}

export interface EditorSymbol {
    kind: "state" | "computed" | "api" | "prop" | "action";
    name: string;
    file: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    detail?: EditorSymbolDetail;
}

export interface EditorReference {
    symbolKind: EditorSymbol["kind"];
    symbolName: string;
    usageKind: "definition" | "read" | "write" | "bind" | "watch" | "computed-dep";
    file: string;
    line: number;
    column: number;
    endLine: number;
    endColumn: number;
    label: string;
}

export interface AnalyzeResult {
    root: string;
    diagnostics: DoctorDiagnostic[];
    symbols: EditorSymbol[];
    references: EditorReference[];
    stats: {
        files: number;
        components: number;
        states: number;
        errors: number;
        warnings: number;
    };
}

export function resolveDoctorAnalyzeScript(context: ExtensionContext, workspaceRoot?: string): string | undefined {
    const candidates: string[] = [];

    if (workspaceRoot) {
        candidates.push(
            path.join(workspaceRoot, "packages", "doctor", "bin", "euix-doctor-analyze.js"),
            path.join(workspaceRoot, "node_modules", "@euix", "doctor", "bin", "euix-doctor-analyze.js"),
        );
    }

    candidates.push(path.join(context.extensionPath, "doctor", "bin", "euix-doctor-analyze.js"));

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }

    return undefined;
}

export function resolveDoctorCli(context: ExtensionContext, workspaceRoot?: string): string | undefined {
    const candidates: string[] = [];

    if (workspaceRoot) {
        candidates.push(
            path.join(workspaceRoot, "packages", "doctor", "bin", "euix-doctor.js"),
            path.join(workspaceRoot, "node_modules", "@euix", "doctor", "bin", "euix-doctor.js"),
        );
    }

    candidates.push(path.join(context.extensionPath, "doctor", "bin", "euix-doctor.js"));

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }

    return undefined;
}

export async function runAnalyze(
    context: ExtensionContext,
    root: string,
    target?: string,
    sourceContent?: string,
): Promise<AnalyzeResult> {
    const script = resolveDoctorAnalyzeScript(context, root);
    if (!script) {
        throw new Error(
            "EUIX Doctor CLI not found. Run from the EUIX monorepo or install @euix/doctor in the workspace.",
        );
    }

    const args = [root];
    if (target) args.push(target);
    if (sourceContent !== undefined) args.push("--stdin");

    const stdout =
        sourceContent !== undefined
            ? await execNodeScript(script, args, { cwd: root, input: sourceContent })
            : String(
                  (
                      await execFileAsync(process.execPath, [script, ...args], {
                          cwd: root,
                          encoding: "utf8",
                          maxBuffer: 32 * 1024 * 1024,
                          env: process.env,
                      })
                  ).stdout,
              );

    const result = JSON.parse(stdout) as AnalyzeResult;
    result.symbols = result.symbols ?? [];
    result.references = result.references ?? [];
    return result;
}

export async function runDoctorTests(context: ExtensionContext, root: string): Promise<{ passed: number; failed: number; details: string[] }> {
    const cli = resolveDoctorCli(context, root);
    if (!cli) {
        throw new Error(
            "EUIX Doctor CLI not found. Run from the EUIX monorepo or install @euix/doctor in the workspace.",
        );
    }

    const { stdout } = await execFileAsync(process.execPath, [cli, root, "--test", "--json"], {
        cwd: root,
        maxBuffer: 32 * 1024 * 1024,
        env: process.env,
    });

    const result = JSON.parse(stdout) as { testResults?: Array<{ name: string; passed: boolean; message?: string }> };
    const testResults = result.testResults ?? [];
    const failed = testResults.filter((r) => !r.passed);
    return {
        passed: testResults.length - failed.length,
        failed: failed.length,
        details: failed.slice(0, 5).map((r) => `${r.name}: ${r.message ?? "failed"}`),
    };
}
