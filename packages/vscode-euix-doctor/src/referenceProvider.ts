import * as vscode from "vscode";
import { getAllReferences, getAllSymbols } from "./symbolCache.js";
import { referenceLocation, resolveTargetSymbolName, symbolLocation } from "./symbolUtils.js";

export class EuixReferenceProvider implements vscode.ReferenceProvider {
    provideReferences(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.Location[] | null {
        const targetName = resolveTargetSymbolName(document, position);
        if (!targetName) return null;

        const symbols = getAllSymbols().filter((s) => s.name === targetName);
        const refs = getAllReferences().filter((r) => r.symbolName === targetName);

        const locations: vscode.Location[] = [];

        for (const symbol of symbols) {
            locations.push(symbolLocation(symbol));
        }

        for (const ref of refs) {
            if (ref.usageKind === "definition") continue;
            locations.push(referenceLocation(ref));
        }

        return dedupeLocations(locations);
    }
}

function dedupeLocations(locations: vscode.Location[]): vscode.Location[] {
    const seen = new Set<string>();
    const out: vscode.Location[] = [];
    for (const loc of locations) {
        const key = `${loc.uri.toString()}:${loc.range.start.line}:${loc.range.start.character}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(loc);
    }
    return out;
}
