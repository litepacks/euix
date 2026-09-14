import type { EditorReference, EditorSymbol } from "./doctorCli.js";

const symbolCache = new Map<string, EditorSymbol[]>();
const referenceCache = new Map<string, EditorReference[]>();

export function updateAnalysisCache(
    filePath: string,
    symbols: EditorSymbol[],
    references: EditorReference[],
    scope?: "file" | "workspace",
): void {
    if (scope === "file") {
        symbolCache.set(filePath, symbols);
        referenceCache.set(filePath, references.filter((r) => r.file === filePath));
        return;
    }

    symbolCache.clear();
    referenceCache.clear();

    for (const symbol of symbols) {
        const list = symbolCache.get(symbol.file) ?? [];
        list.push(symbol);
        symbolCache.set(symbol.file, list);
    }

    for (const ref of references) {
        const list = referenceCache.get(ref.file) ?? [];
        list.push(ref);
        referenceCache.set(ref.file, list);
    }
}

export function clearAnalysisCache(): void {
    symbolCache.clear();
    referenceCache.clear();
}

export function getSymbols(filePath: string): EditorSymbol[] {
    return symbolCache.get(filePath) ?? [];
}

export function getReferences(filePath: string): EditorReference[] {
    return referenceCache.get(filePath) ?? [];
}

export function getAllReferences(): EditorReference[] {
    return [...referenceCache.values()].flat();
}

export function getAllSymbols(): EditorSymbol[] {
    return [...symbolCache.values()].flat();
}
