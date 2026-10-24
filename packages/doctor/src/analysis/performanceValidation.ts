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

export function validatePerformanceAndMemory(project: EuixProject): Diagnostic[] {
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

            // 1. EUIX3001: Missing key on <for_each>
            if (el.tagName === "for_each") {
                const hasKey = Boolean(el.attributes.key);
                if (!hasKey) {
                    diagnostics.push(
                        diag(
                            "EUIX3001",
                            "warning",
                            `<for_each> is missing a 'key' attribute. Keyed reconciliation is required for optimal DOM diffing.`,
                            file.path,
                            loc.line,
                            loc.column,
                            ruleHint("EUIX3001"),
                        ),
                    );
                }
            }

            // 2. EUIX3003: Large embedded static state in <data_model>
            if (el.tagName === "state") {
                const text = el.children
                    .filter((c) => c.type === "text")
                    .map((c) => (c as any).data)
                    .join("")
                    .trim();

                if (text.length > 2000) {
                    const id = el.attributes.id || "unnamed";
                    diagnostics.push(
                        diag(
                            "EUIX3003",
                            "info",
                            `State '${id}' embeds a large static data payload (${text.length} chars). Consider using <state src="..."> or an <api_endpoint>.`,
                            file.path,
                            loc.line,
                            loc.column,
                            ruleHint("EUIX3003"),
                        ),
                    );
                }
            }
        });
    }

    // 3. EUIX3002: Un-debounced watcher on rapid text input
    // Find all inputs that bind to state
    const inputBoundStates = new Set<string>();
    for (const b of project.bindings.values()) {
        if (b.target === "bind" || b.target.startsWith("bind")) {
            for (const dep of b.dependencies) {
                inputBoundStates.add(dep.replace(/^data\./, ""));
            }
        }
    }

    for (const watcher of project.watchers.values()) {
        const watchedPath = watcher.path.replace(/^data\./, "");
        if (inputBoundStates.has(watchedPath)) {
            // Check if watcher triggers an API fetch or network call without debounce
            const hasDebounce = Boolean((watcher as any).debounce || (watcher as any).throttle);
            const triggersApi =
                watcher.writes.some((w) => w.startsWith("api.")) ||
                project.apiCalls.has(watchedPath);

            if (triggersApi && !hasDebounce) {
                diagnostics.push(
                    diag(
                        "EUIX3002",
                        "warning",
                        `Watcher on '${watchedPath}' triggers API requests on keystroke without debounce or throttle.`,
                        watcher.file,
                        watcher.location.line,
                        watcher.location.column,
                        ruleHint("EUIX3002"),
                    ),
                );
            }
        }
    }

    return diagnostics;
}
