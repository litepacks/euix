import { makeLocation, parseXmlDocument, walkElements } from "../parser/xml.js";
import type { Diagnostic, EuixProject } from "../ir/types.js";
import { ruleHint } from "../diagnostics/messages.js";
import { getRuleCategory } from "../diagnostics/catalog.js";

function diag(
    rule: string,
    severity: "error" | "warning" | "info",
    message: string,
    file: string,
    line: number,
    column: number,
    hint?: string,
): Diagnostic {
    return {
        id: `${rule}-${file}-${line}-${column}`,
        rule,
        category: getRuleCategory(rule),
        severity,
        message,
        file,
        line,
        column,
        confidence: "confirmed",
        hint,
    };
}

export function validateActionShorthands(project: EuixProject): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Map states by component or file
    const statesByName = new Map<string, { type?: string | null; file: string }>();
    for (const state of project.states.values()) {
        statesByName.set(state.name, { type: state.type, file: state.file });
    }

    // Map all defined action names
    const actionNames = new Set<string>();
    for (const action of project.actions.values()) {
        actionNames.add(action.name.toLowerCase());
    }

    // Map all API endpoint tags/ids
    const apiTags = new Set<string>();
    for (const file of project.files) {
        if (file.kind !== "xml" && file.kind !== "html") continue;
        const matches = file.source.matchAll(/<api_endpoint\b[^>]*?(?:id|tag)=["']([^"']+)["']/gi);
        for (const m of matches) {
            if (m[1]) apiTags.add(m[1].toLowerCase());
        }
    }

    for (const file of project.files) {
        if (file.kind !== "xml" && file.kind !== "html") continue;

        let parsedDoc;
        try {
            parsedDoc = parseXmlDocument(file.path, file.source);
        } catch {
            continue;
        }

        walkElements(parsedDoc.root, (el) => {
            const loc = makeLocation(file.path, file.source, el.start, el.end);

            for (const [attrName, attrVal] of Object.entries(el.attributes)) {
                const lowerAttr = attrName.toLowerCase();

                // 1. EUIX1310: on_*:toggle="state_name"
                if (lowerAttr.includes(":toggle")) {
                    const targetState = attrVal.trim().replace(/^data\./, "").replace(/^local\./, "");
                    const foundState = statesByName.get(targetState);
                    if (foundState && foundState.type && foundState.type !== "boolean") {
                        diagnostics.push(
                            diag(
                                "EUIX1310",
                                "warning",
                                `Action toggle targets state '${targetState}' with type='${foundState.type}'. Toggle requires boolean state.`,
                                file.path,
                                loc.line,
                                loc.column,
                                ruleHint("EUIX1310"),
                            ),
                        );
                    }
                }

                // 2. EUIX1311: on_*:set="counter={data.counter + 1}" on non-number state
                if (lowerAttr.includes(":set") && attrVal.includes("=")) {
                    const [targetKey, expr] = attrVal.split("=").map((s) => s.trim());
                    const cleanKey = targetKey.replace(/^data\./, "").replace(/^local\./, "");
                    const foundState = statesByName.get(cleanKey);

                    if (foundState && expr && (expr.includes("+") || expr.includes("-"))) {
                        // Check if state is declared as string (or omitted type which defaults to string)
                        if (foundState.type === "string") {
                            diagnostics.push(
                                diag(
                                    "EUIX1311",
                                    "warning",
                                    `Arithmetic evaluation in shorthand '${attrVal}' writes to string state '${cleanKey}'. Specify type='number' to avoid string concatenation.`,
                                    file.path,
                                    loc.line,
                                    loc.column,
                                    ruleHint("EUIX1311"),
                                ),
                            );
                        }
                    }
                }

                // 3. EUIX1702: on_*:revalidate="tag"
                if (lowerAttr.includes(":revalidate")) {
                    const targetTag = attrVal.trim().toLowerCase();
                    if (targetTag && !apiTags.has(targetTag)) {
                        diagnostics.push(
                            diag(
                                "EUIX1702",
                                "error",
                                `REVALIDATE shorthand references unknown endpoint tag '${attrVal}'. No matching <api_endpoint> defined.`,
                                file.path,
                                loc.line,
                                loc.column,
                                ruleHint("EUIX1702"),
                            ),
                        );
                    }
                }
            }
        });
    }

    return diagnostics;
}
