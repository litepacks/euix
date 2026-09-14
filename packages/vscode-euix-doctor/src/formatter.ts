import fs from "node:fs";
import path from "node:path";
import type { ExtensionContext } from "vscode";
import { execNodeScript } from "./execNode.js";

export function resolveDoctorFormatScript(context: ExtensionContext, workspaceRoot?: string): string | undefined {
    const candidates: string[] = [];

    if (workspaceRoot) {
        candidates.push(
            path.join(workspaceRoot, "packages", "doctor", "bin", "euix-doctor-format.js"),
            path.join(workspaceRoot, "node_modules", "@euix", "doctor", "bin", "euix-doctor-format.js"),
        );
    }

    candidates.push(path.join(context.extensionPath, "doctor", "bin", "euix-doctor-format.js"));

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }

    return undefined;
}

export async function runFormat(
    context: ExtensionContext,
    root: string,
    source: string,
    filePath: string,
    indentSize: number,
): Promise<string> {
    const script = resolveDoctorFormatScript(context, root);
    if (!script) {
        throw new Error(
            "EUIX Doctor format CLI not found. Run from the EUIX monorepo or install @euix/doctor in the workspace.",
        );
    }

    return execNodeScript(script, ["--stdin", "--indent=" + String(indentSize), filePath], {
        cwd: root,
        input: source,
    });
}
