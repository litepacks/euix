import path from "node:path";
import fs from "node:fs";
import { makeLocation, parseHtmlDocument, walkElements } from "../parser/xml.js";
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

export function validateHtmlIslands(project: EuixProject): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    for (const file of project.files) {
        if (file.kind !== "html") continue;

        let parsedDoc;
        try {
            parsedDoc = parseHtmlDocument(file.path, file.source);
        } catch {
            continue;
        }

        // Collect all template IDs in this HTML document
        const templateIds = new Set<string>();
        walkElements(parsedDoc.root, (el) => {
            if (el.tagName === "template" && el.attributes.id) {
                templateIds.add(el.attributes.id.trim());
            }
        });

        walkElements(parsedDoc.root, (el) => {
            const src =
                el.attributes["data-euix"] ||
                el.attributes["data-euix-src"] ||
                el.attributes["data-euix-component"] ||
                (el.tagName === "euix-component" ? el.attributes.src : null);

            const hasIslandMarker =
                src !== undefined && src !== null ||
                el.attributes["data-euix"] !== undefined ||
                el.tagName === "euix-component";

            if (!hasIslandMarker) return;

            const loc = makeLocation(file.path, file.source, el.start, el.end);
            const trimmedSrc = (src || "").trim();

            // 1. Validate JSON in data-props
            if (el.attributes["data-props"]) {
                try {
                    const parsed = JSON.parse(el.attributes["data-props"]);
                    if (!parsed || typeof parsed !== "object") {
                        diagnostics.push(
                            diag(
                                "EUIX0102",
                                "error",
                                `Attribute data-props must be a JSON object or array, received: '${el.attributes["data-props"]}'.`,
                                file.path,
                                loc.line,
                                loc.column,
                                ruleHint("EUIX0102"),
                            ),
                        );
                    }
                } catch {
                    diagnostics.push(
                        diag(
                            "EUIX0102",
                            "error",
                            `Invalid JSON syntax in data-props attribute: '${el.attributes["data-props"]}'.`,
                            file.path,
                            loc.line,
                            loc.column,
                            ruleHint("EUIX0102"),
                        ),
                    );
                }
            }

            // 2. Validate JSON in data-state
            if (el.attributes["data-state"]) {
                try {
                    const parsed = JSON.parse(el.attributes["data-state"]);
                    if (!parsed || typeof parsed !== "object") {
                        diagnostics.push(
                            diag(
                                "EUIX0102",
                                "error",
                                `Attribute data-state must be a JSON object or array, received: '${el.attributes["data-state"]}'.`,
                                file.path,
                                loc.line,
                                loc.column,
                                ruleHint("EUIX0102"),
                            ),
                        );
                    }
                } catch {
                    diagnostics.push(
                        diag(
                            "EUIX0102",
                            "error",
                            `Invalid JSON syntax in data-state attribute: '${el.attributes["data-state"]}'.`,
                            file.path,
                            loc.line,
                            loc.column,
                            ruleHint("EUIX0102"),
                        ),
                    );
                }
            }

            // 3. Validate source resolution
            if (!trimmedSrc) {
                // Check if element has inner template or script
                const hasInnerScript = el.children.some(
                    (c) =>
                        c.type === "element" &&
                        (c.tagName === "template" ||
                            (c.tagName === "script" &&
                                (c.attributes.type === "application/euix" || c.attributes.type === "text/euix"))),
                );
                if (!hasInnerScript && el.tagName === "euix-component") {
                    diagnostics.push(
                        diag(
                            "EUIX0101",
                            "error",
                            "<euix-component> is missing required src attribute.",
                            file.path,
                            loc.line,
                            loc.column,
                            ruleHint("EUIX0101"),
                        ),
                    );
                }
                return;
            }

            // Direct inline XML
            if (trimmedSrc.startsWith("<")) {
                return;
            }

            // Template selector (#template-id)
            if (trimmedSrc.startsWith("#")) {
                const targetId = trimmedSrc.slice(1);
                if (!templateIds.has(targetId)) {
                    // Check if it exists across any project files
                    let foundElsewhere = false;
                    for (const other of project.files) {
                        if (other.kind === "html" && other.source.includes(`id="${targetId}"`)) {
                            foundElsewhere = true;
                            break;
                        }
                    }
                    if (!foundElsewhere) {
                        diagnostics.push(
                            diag(
                                "EUIX0101",
                                "error",
                                `Unresolved template selector '${trimmedSrc}' in data-euix. No <template id="${targetId}"> found.`,
                                file.path,
                                loc.line,
                                loc.column,
                                ruleHint("EUIX0101"),
                            ),
                        );
                    }
                }
                return;
            }

            // Remote URL / file path (/components/counter.xml or ./counter.xml)
            if (!trimmedSrc.startsWith("http://") && !trimmedSrc.startsWith("https://")) {
                let resolved = false;
                const candidates: string[] = [];

                if (trimmedSrc.startsWith("/")) {
                    candidates.push(path.resolve(project.root, trimmedSrc.slice(1)));
                    candidates.push(path.resolve(project.root, "public", trimmedSrc.slice(1)));
                } else {
                    const fileDir = path.dirname(file.path);
                    candidates.push(path.resolve(fileDir, trimmedSrc));
                    candidates.push(path.resolve(project.root, trimmedSrc));
                }

                for (const candidate of candidates) {
                    if (fs.existsSync(candidate)) {
                        resolved = true;
                        break;
                    }
                    // Check if file is registered in project.files
                    if (project.files.some((f) => f.path === candidate)) {
                        resolved = true;
                        break;
                    }
                }

                if (!resolved) {
                    diagnostics.push(
                        diag(
                            "EUIX0101",
                            "error",
                            `Component source file not found for data-euix='${trimmedSrc}'.`,
                            file.path,
                            loc.line,
                            loc.column,
                            ruleHint("EUIX0101"),
                        ),
                    );
                }
            }
        });
    }

    return diagnostics;
}
