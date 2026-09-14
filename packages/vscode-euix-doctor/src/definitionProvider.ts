import * as vscode from "vscode";
import { getAllSymbols } from "./symbolCache.js";
import { resolveApiTagReference, resolveReferenceName, symbolLocation } from "./symbolUtils.js";

export class EuixDefinitionProvider implements vscode.DefinitionProvider {
    provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
    ): vscode.Definition | vscode.LocationLink[] | null {
        const symbols = getAllSymbols();
        if (symbols.length === 0) return null;

        const name = resolveReferenceName(document, position);
        if (!name) return null;

        const apiTag = resolveApiTagReference(document, position);
        if (apiTag) {
            const api = symbols.find((s) => s.kind === "api" && s.name === apiTag);
            return api ? symbolLocation(api) : null;
        }

        const match =
            symbols.find(
                (s) =>
                    (s.kind === "state" || s.kind === "computed" || s.kind === "prop") &&
                    s.name === name,
            ) ?? symbols.find((s) => s.kind === "action" && s.name === name);

        return match ? symbolLocation(match) : null;
    }
}
