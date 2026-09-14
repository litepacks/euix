import path from "node:path";
import { ruleHint } from "../diagnostics/messages.js";
import type { Diagnostic, DoctorResult } from "../ir/types.js";

const DOCTOR_VERSION = "0.2.0";

export function doctorResultToSarif(result: DoctorResult): string {
    const rules = buildRuleDefinitions(result.project.diagnostics);
    const results = result.project.diagnostics.map((d) => diagnosticToResult(d, result.project.root));

    return JSON.stringify(
        {
            version: "2.1.0",
            $schema: "https://json.schemastore.org/sarif-2.1.0.json",
            runs: [
                {
                    tool: {
                        driver: {
                            name: "EUIX Doctor",
                            version: DOCTOR_VERSION,
                            informationUri: "https://github.com/litepacks/euix/tree/main/packages/doctor",
                            rules,
                        },
                    },
                    results,
                },
            ],
        },
        null,
        2,
    );
}

function buildRuleDefinitions(diagnostics: Diagnostic[]) {
    const seen = new Map<string, Diagnostic["severity"]>();
    for (const d of diagnostics) {
        if (!seen.has(d.rule)) seen.set(d.rule, d.severity);
    }
    return [...seen.entries()].map(([id, severity]) => ({
        id,
        shortDescription: { text: id },
        fullDescription: { text: ruleHint(id) ?? `EUIX Doctor rule ${id}` },
        defaultConfiguration: {
            level: severity === "error" ? "error" : severity === "warning" ? "warning" : "note",
        },
    }));
}

function diagnosticToResult(d: Diagnostic, root: string) {
    const rel = path.relative(root, d.file).replace(/\\/g, "/");
    return {
        ruleId: d.rule,
        level: d.severity === "error" ? "error" : d.severity === "warning" ? "warning" : "note",
        message: {
            text: d.message,
            ...(d.hint ? { properties: { hint: d.hint } } : {}),
        },
        locations: [
            {
                physicalLocation: {
                    artifactLocation: { uri: rel, uriBaseId: "%SRCROOT%" },
                    region: { startLine: d.line, startColumn: d.column },
                },
            },
        ],
        properties: {
            confidence: d.confidence,
            ...(d.hint ? { hint: d.hint } : {}),
            ...(d.fix
                ? {
                      fixDescription: d.fix.description,
                      fixEdits: d.fix.edits,
                  }
                : {}),
        },
        ...(d.fix
            ? {
                  fixes: [
                      {
                          description: { text: d.fix.description },
                          artifactChanges: [
                              {
                                  artifactLocation: { uri: rel, uriBaseId: "%SRCROOT%" },
                                  replacements: d.fix.edits.map((edit) => ({
                                      deletedRegion: {
                                          startLine: d.line,
                                          startColumn: d.column,
                                      },
                                      insertedContent: { text: edit.replacement },
                                  })),
                              },
                          ],
                      },
                  ],
              }
            : {}),
    };
}
