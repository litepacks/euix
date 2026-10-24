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

export function validateAccessibility(project: EuixProject): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

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

            // 1. EUIX4001: Button missing accessible label
            if (el.tagName === "button") {
                const hasAria = Boolean(
                    el.attributes["aria-label"] ||
                    el.attributes["aria-labelledby"] ||
                    el.attributes.title,
                );

                // Collect text nodes inside button (ignoring comments/whitespace/action tags)
                const textNodes = el.children.filter((c) => c.type === "text" && (c as any).data.trim().length > 0);
                const hasText = textNodes.length > 0;

                if (!hasAria && !hasText) {
                    diagnostics.push(
                        diag(
                            "EUIX4001",
                            "warning",
                            "<button> has no text content or accessible label (aria-label, title). Screen readers cannot announce its purpose.",
                            file.path,
                            loc.line,
                            loc.column,
                            ruleHint("EUIX4001"),
                        ),
                    );
                }
            }

            // 2. EUIX4002: Non-interactive element click handler
            const nonInteractiveTags = new Set(["div", "span", "p", "section", "article", "header", "footer", "card", "flex", "container"]);
            if (nonInteractiveTags.has(el.tagName)) {
                const hasClickAttr = Object.keys(el.attributes).some(
                    (a) => a.toLowerCase().startsWith("on_click") || a.toLowerCase() === "onclick",
                );
                const hasClickChild = el.children.some(
                    (c) => c.type === "element" && c.tagName === "on_click",
                );

                if (hasClickAttr || hasClickChild) {
                    const hasRole = Boolean(el.attributes.role);
                    const hasTabIndex = el.attributes.tabindex !== undefined;

                    if (!hasRole && !hasTabIndex) {
                        diagnostics.push(
                            diag(
                                "EUIX4002",
                                "warning",
                                `<${el.tagName}> has an on_click handler without role="button" or tabindex="0". Keyboard and assistive tech cannot focus or activate it.`,
                                file.path,
                                loc.line,
                                loc.column,
                                ruleHint("EUIX4002"),
                            ),
                        );
                    }
                }
            }

            // 3. EUIX4003: Form input missing accessible name
            if (el.tagName === "input" && el.attributes.type !== "hidden" && el.attributes.type !== "submit") {
                const hasAria = Boolean(
                    el.attributes["aria-label"] ||
                    el.attributes["aria-labelledby"] ||
                    el.attributes.title ||
                    el.attributes.placeholder,
                );
                const hasId = Boolean(el.attributes.id);

                if (!hasAria && !hasId) {
                    diagnostics.push(
                        diag(
                            "EUIX4003",
                            "info",
                            `<input> lacks an accessible name (aria-label, placeholder, or id associated with a <label>).`,
                            file.path,
                            loc.line,
                            loc.column,
                            ruleHint("EUIX4003"),
                        ),
                    );
                }
            }
        });
    }

    return diagnostics;
}
