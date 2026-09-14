import fs from "node:fs";
import path from "node:path";

const realPathCache = new Map<string, string>();

/** Resolve symlinks and normalize casing on case-insensitive filesystems. */
export function canonicalFilePath(filePath: string): string {
    const normalized = path.normalize(filePath);
    const cached = realPathCache.get(normalized);
    if (cached) return cached;

    try {
        const real = fs.realpathSync.native ? fs.realpathSync.native(normalized) : fs.realpathSync(normalized);
        realPathCache.set(normalized, real);
        return real;
    } catch {
        realPathCache.set(normalized, normalized);
        return normalized;
    }
}

export function isSameFile(a: string, b: string): boolean {
    return canonicalFilePath(a) === canonicalFilePath(b);
}
