import fs from "node:fs";
import path from "node:path";
import type { EuixFile } from "../ir/types.js";

const SOURCE_EXTENSIONS = new Set([
    ".xml",
    ".html",
    ".htm",
    ".js",
    ".mjs",
    ".cjs",
    ".ts",
    ".tsx",
    ".jsx",
]);

const IGNORED_DIRS = new Set([
    "node_modules",
    "dist",
    "build",
    "coverage",
    ".git",
    ".next",
    ".cache",
    ".docboot",
    ".docup",
    "dist-docs",
    "playwright-report",
    "test-results",
    ".vscode",
    ".vscode-test",
    "scratch",
]);

export function fileKind(ext: string): EuixFile["kind"] | null {
    switch (ext) {
        case ".xml":
            return "xml";
        case ".html":
        case ".htm":
            return "html";
        case ".js":
            return "js";
        case ".mjs":
            return "mjs";
        case ".cjs":
            return "cjs";
        case ".ts":
            return "ts";
        case ".tsx":
            return "tsx";
        case ".jsx":
            return "jsx";
        default:
            return null;
    }
}

function walk(dir: string, out: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, out);
        } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (SOURCE_EXTENSIONS.has(ext)) out.push(full);
        }
    }
}

export function scanProject(root: string, target?: string): EuixFile[] {
    const absRoot = path.resolve(root);
    const absTarget = target ? path.resolve(absRoot, target) : absRoot;
    const paths: string[] = [];

    if (!fs.existsSync(absTarget)) {
        throw new Error(`Target not found: ${absTarget}`);
    }

    const stat = fs.statSync(absTarget);
    if (stat.isFile()) {
        paths.push(absTarget);
    } else {
        walk(absTarget, paths);
    }

    return paths
        .sort()
        .map((filePath) => {
            const source = fs.readFileSync(filePath, "utf8");
            const ext = path.extname(filePath).toLowerCase();
            const kind = fileKind(ext);
            if (!kind) return null;
            return {
                path: filePath,
                kind,
                bytes: Buffer.byteLength(source, "utf8"),
                lines: source.split("\n").length,
                source,
            } satisfies EuixFile;
        })
        .filter((f): f is EuixFile => f !== null);
}
